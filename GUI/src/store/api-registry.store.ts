import { PaginationState, SortingState } from '@tanstack/react-table';
import { t } from 'i18next';
import {
  createEndpoint,
  deleteEndpoint as deleteEndpointUrl,
  getAllEndpoints,
  reindexEndpointUrl,
  testEndpointUrl,
} from 'resources/api-constants';
import api from 'services/api-dev';
import { extractMapValues, getEndpointBody } from 'store/new-services.store';
import { EndpointData } from 'types/endpoint';
import { formatSchema } from 'utils/json-request-utils';
import { v4 as uuid } from 'uuid';
import { create } from 'zustand';

import useToastStore from './toasts.store';

export interface VerificationMetadata {
  lastTestAt: string | null;
  verificationStatus: 'verified' | 'failed' | 'unverified';
  lastStatusCode: string | null;
  schemaCaptured: boolean;
}

interface ApiRegistryState {
  endpoints: EndpointData[];
  verificationMap: Record<string, VerificationMetadata>;
  totalPages: number;
  loading: boolean;
  pagination: PaginationState;
  sorting: SortingState;
  search: string;
  loadEndpoints: (
    pagination: PaginationState,
    sorting: SortingState,
    search: string,
    options?: { silent?: boolean },
  ) => Promise<void>;
  testEndpoint: (endpoint: EndpointData) => Promise<void>;
  copyEndpoint: (endpoint: EndpointData) => Promise<void>;
  deleteEndpoint: (endpoint: EndpointData) => Promise<void>;
  reIndexEndpoint: (endpointId: string) => Promise<void>;
  addEndpointAfterCreate: (endpoint: EndpointData) => void;
  updateEndpointInList: (endpoint: EndpointData) => void;
}

/** Shows the toast for an indexing validation error code returned by the backend (e.g. VALIDATION_DESCRIPTION_MISSING). */
export const showIndexValidationToast = (code: string): void => {
  useToastStore.getState().error({
    title: t(`apiRegistry.indexValidation.${code}`, { defaultValue: t('apiRegistry.reIndexError') }),
  });
};

// Attempts whose failure was already announced in this session, keyed by `${endpointId}:${attemptNo}`.
// Ensures each new failure produces exactly one toast, and reloads never re-announce existing failures.
const announcedIndexFailures = new Set<string>();

// A failure is "new" when the row was seen before on this page and either was IN_PROGRESS,
// or a newer attempt has failed already (e.g. submission failed during save). Rows seen for the
// first time (initial load, reload, other page) are never announced.
const announceNewIndexFailures = (previous: EndpointData[], next: EndpointData[]): void => {
  const previousById = new Map(previous.map((e) => [e.endpointId, e]));
  for (const endpoint of next) {
    const before = previousById.get(endpoint.endpointId);
    if (endpoint.llm_index_status !== 'FAILED' || !before) continue;
    const isNewAttempt = (endpoint.llm_index_attempt_no ?? 0) > (before.llm_index_attempt_no ?? 0);
    if (before.llm_index_status !== 'IN_PROGRESS' && !isNewAttempt) continue;
    const key = `${endpoint.endpointId}:${endpoint.llm_index_attempt_no ?? ''}`;
    if (announcedIndexFailures.has(key)) continue;
    announcedIndexFailures.add(key);
    useToastStore.getState().error({
      title: t('apiRegistry.indexFailed', { name: endpoint.name }),
      message: endpoint.llm_index_failure_reason ?? undefined,
    });
  }
};

const useApiRegistryStore = create<ApiRegistryState>((set, get) => ({
  endpoints: [],
  verificationMap: {},
  totalPages: 0,
  loading: false,
  pagination: { pageIndex: 0, pageSize: 10 },
  sorting: [{ id: 'created_at', desc: true }],
  search: '',

  loadEndpoints: async (pagination, sorting, search, options) => {
    const silent = options?.silent ?? false;
    set(silent ? { pagination, sorting, search } : { loading: true, pagination, sorting, search });
    try {
      const order = sorting[0]?.desc ? 'desc' : 'asc';
      const colId = sorting[0]?.id;
      const sortFieldMap: Record<string, string> = {
        name: 'name',
        lastTest: 'lastTestAt',
        status: 'lastStatusCode',
        schema: 'schemaCaptured',
      };
      const primaryField = colId ? (sortFieldMap[colId] ?? colId) : null;
      const secondarySortMap: Record<string, string> = {};
      const secondarySort = colId ? (secondarySortMap[colId] ?? '') : '';
      const sort = primaryField ? `${primaryField} ${order}${secondarySort}` : 'created_at desc';
      const result = await api.post(getAllEndpoints(), {
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        sorting: sort,
        search: search || '',
        pagination: true,
      });
      const rows: any[] = result.data?.response ?? [];
      const totalPages: number = rows[0]?.totalPages ?? 0;
      const endpoints: EndpointData[] = rows.map((row) => {
        let definitions: EndpointData['definitions'] = [];
        try {
          const raw = row.definitions?.value ?? row.definitions;
          if (typeof raw === 'string') definitions = JSON.parse(raw);
          else if (Array.isArray(raw)) definitions = raw;
        } catch {
          definitions = []; // malformed JSON — fall back to empty definitions
        }
        // Normalize llm index status from various API shapes (snake_case or camelCase)
        const rawLlm = row.llm_index_status ?? row.llmIndexStatus ?? row.llmIndexstatus ?? null;
        const normalizedLlm = rawLlm && typeof rawLlm !== 'object' ? String(rawLlm).trim().toUpperCase() : null;
        const allowed =
          normalizedLlm === 'SUCCESS' || normalizedLlm === 'FAILED' || normalizedLlm === 'IN_PROGRESS'
            ? normalizedLlm
            : null;

        return {
          endpointId: row.endpointId,
          name: row.name,
          description: row.description ?? '',
          type: row.type,
          serviceId: row.serviceId,
          definitions,
          responseSchema: formatSchema(row.responseSchema),
          llm_index_status: allowed,
          llm_index_failure_reason: row.llmIndexFailureReason ?? row.llm_index_failure_reason ?? null,
          llm_index_attempt_no: row.llmIndexAttemptNo ?? row.llm_index_attempt_no ?? null,
        };
      });
      const verificationMap: Record<string, VerificationMetadata> = {};
      rows.forEach((row) => {
        if (row.endpointId) {
          verificationMap[row.endpointId] = {
            lastTestAt: row.lastTestAt ?? null,
            verificationStatus: ((): VerificationMetadata['verificationStatus'] => {
              if (row.verificationStatus === true) return 'verified';
              if (row.lastStatusCode || row.lastTestAt) return 'failed';
              return 'unverified';
            })(),
            lastStatusCode: row.lastStatusCode ?? null,
            schemaCaptured: row.responseSchemaCaptured ?? row.schemaCaptured ?? false,
          };
        }
      });
      announceNewIndexFailures(get().endpoints, endpoints);
      set({ endpoints, verificationMap, totalPages, loading: false });
    } catch {
      set({ loading: false });
      // Background polling failures are silent; the next poll retries.
      if (!silent) useToastStore.getState().error({ title: t('apiRegistry.loadError') });
    }
  },

  testEndpoint: async (endpoint) => {
    const def = endpoint.definitions?.[0];
    if (!def) return;

    let url = def.url || def.openApiUrl || def.path || '';
    if (!url) return;

    // Resolve {paramName} path variable placeholders using stored param values
    const allParams = def.params?.variables ?? [];
    const pathParams = allParams.filter((p) => p.paramType === 'path');
    const queryParams = allParams.filter((p) => p.paramType !== 'path');
    for (const param of pathParams) {
      if (param.value?.trim()) {
        url = url.split(`{${param.name}}`).join(param.value);
      }
    }
    // Skip test if any path variable placeholder is still unresolved
    if (/(?<!\$)\{([^{}]+)\}/.test(url)) return;

    // Strip any inline query string — query params are sent separately
    const urlBase = url.includes('?') ? url.split('?')[0] : url;
    const queryOnlyParams = def.params ? { ...def.params, variables: queryParams } : undefined;

    let networkError = false;
    try {
      await api.post(testEndpointUrl(), {
        endpointId: endpoint.endpointId,
        request: {
          url: urlBase,
          method: def.methodType ?? 'GET',
          headers: extractMapValues(def.headers),
          params: extractMapValues(queryOnlyParams),
          body: getEndpointBody(def),
        },
      });
    } catch {
      networkError = true;
    } finally {
      const { pagination, sorting, search } = get();
      await get().loadEndpoints(pagination, sorting, search);
    }

    if (networkError) {
      useToastStore.getState().error({ title: t('apiRegistry.testError') });
      return;
    }

    const meta = get().verificationMap[endpoint.endpointId];
    if (meta?.verificationStatus === 'verified') {
      useToastStore.getState().success({ title: t('apiRegistry.testSuccess') });
    } else {
      useToastStore.getState().error({ title: t('apiRegistry.testError') });
    }
  },

  copyEndpoint: async (endpoint) => {
    const newId = uuid();

    const now = new Date();
    const pad = (n: number, len = 2) => String(n).padStart(len, '0');
    const ts = `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}_${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(now.getSeconds())}`;

    // Strip any previously appended timestamp (_YYYY_MM_DD_HH_MM_SS or _YYYY_MM_DD_HH_MM_SS_MMM)
    const baseName = endpoint.name.replace(/_\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}(_\d{3})?$/, '');
    const defaultName = `${baseName}_${ts}`;
    const { endpoints } = get();
    const nameExists = endpoints.some((e) => e.name === defaultName);
    const copyName = nameExists ? `${defaultName}_${pad(now.getMilliseconds(), 3)}` : defaultName;

    // Strip testValue from definitions so copy starts clean
    const cleanDefinitions = endpoint.definitions.map((def) => ({
      ...def,
      params: def.params
        ? {
            ...def.params,
            variables: def.params.variables.map(({ testValue: _, ...v }) => v),
          }
        : def.params,
      headers: def.headers
        ? {
            ...def.headers,
            variables: def.headers.variables.map(({ testValue: _, ...v }) => v),
          }
        : def.headers,
      body: def.body
        ? {
            ...def.body,
            variables: def.body.variables.map(({ testValue: _, ...v }) => v),
          }
        : def.body,
    }));

    try {
      await api.post(createEndpoint(), {
        endpointId: newId,
        name: copyName,
        type: endpoint.type ?? 'custom',
        serviceId: endpoint.serviceId || '',
        definitions: JSON.stringify(cleanDefinitions),
      });

      const newEndpoint: EndpointData = {
        ...endpoint,
        endpointId: newId,
        name: copyName,
        definitions: cleanDefinitions,
      };

      set((state) => ({
        endpoints: [newEndpoint, ...state.endpoints],
        verificationMap: {
          ...state.verificationMap,
          [newId]: {
            lastTestAt: null,
            verificationStatus: 'unverified',
            lastStatusCode: null,
            schemaCaptured: false,
          },
        },
      }));
      useToastStore.getState().success({ title: t('apiRegistry.copySuccess') });
    } catch {
      useToastStore.getState().error({ title: t('apiRegistry.copyError') });
    }
  },

  deleteEndpoint: async (endpoint) => {
    try {
      await api.post(deleteEndpointUrl(), { id: endpoint.endpointId });
      set((state) => ({
        endpoints: state.endpoints.filter((e) => e.endpointId !== endpoint.endpointId),
      }));
      useToastStore.getState().success({ title: t('apiRegistry.deleteSuccess') });
    } catch {
      useToastStore.getState().error({ title: t('apiRegistry.deleteError') });
    }
  },

  reIndexEndpoint: async (endpointId) => {
    // 202 = attempt started (row is IN_PROGRESS in the DB). The final result arrives via the LLM callback
    // and is picked up by polling. A submission failure is already persisted as FAILED with a reason
    // and announced by the failure toast after reload, so it needs no extra toast here.
    let validationCode: string | null = null;
    let requestFailed = false;
    try {
      await api.post(reindexEndpointUrl(), { endpointId });
    } catch (err: any) {
      const body = err?.response?.data?.response;
      if (err?.response?.status === 400 && typeof body?.code === 'string') {
        validationCode = body.code;
      } else {
        requestFailed = true;
      }
    }

    if (!validationCode) {
      // Show Processing right away; the reload below confirms the persisted status
      set((state) => ({
        endpoints: state.endpoints.map((e) =>
          e.endpointId === endpointId ? { ...e, llm_index_status: 'IN_PROGRESS' } : e,
        ),
      }));
    }

    // Always reload — backend is the source of truth for the status
    const { pagination, sorting, search } = get();
    await get().loadEndpoints(pagination, sorting, search, { silent: true });

    if (validationCode) {
      showIndexValidationToast(validationCode);
    } else if (!requestFailed) {
      useToastStore.getState().success({ title: t('apiRegistry.reIndexSuccess') });
    } else if (get().endpoints.find((e) => e.endpointId === endpointId)?.llm_index_status !== 'FAILED') {
      useToastStore.getState().error({ title: t('apiRegistry.reIndexError') });
    }
  },

  addEndpointAfterCreate: (endpoint) => {
    set((state) => ({ endpoints: [endpoint, ...state.endpoints] }));
  },

  updateEndpointInList: (endpoint) => {
    set((state) => ({
      endpoints: state.endpoints.map((e) => (e.endpointId === endpoint.endpointId ? endpoint : e)),
    }));
  },
}));

export default useApiRegistryStore;
