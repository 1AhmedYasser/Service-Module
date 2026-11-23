import { PaginationState, SortingState } from '@tanstack/react-table';
import { Edge, Node } from '@xyflow/react';
import i18n from 'i18n';
import {
  changeServiceStatus,
  deleteService as deleteServiceApi,
  getNavigableServicesList,
  getServiceById,
  getServiceDependencies,
  getServicesOverview,
  locateService as locateServiceApi,
  pinService as pinServiceApi,
  reindexService as reindexServiceApi,
  unpinService as unpinServiceApi,
} from 'resources/api-constants';
import { Service, ServiceState } from 'types';
import { ActivationBlocker } from 'types/activation-blocker';
import { ServiceDependency, ServiceLocation } from 'types/service-dependency';
import { FlowCompletenessResult, validateFlowCompleteness } from 'utils/flow-completeness';
import { findActivationBlockers, ServiceFlowLookup } from 'utils/service-activation';
import { AffectedService, findAffectedActiveServices } from 'utils/service-draft-return';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import useToastStore from './toasts.store';
import api from '../services/api-dev';

const fetchServiceFlow = async (serviceId: string): Promise<(ServiceFlowLookup & { edges: Edge[] }) | undefined> => {
  try {
    const response = await api.post<Service>(getServiceById(), { id: serviceId, search: '' });
    const data = response.data;
    if (!data?.serviceId) return undefined;

    const structure = JSON.parse(data.structure?.value ?? '{}');
    return {
      name: data.name,
      state: data.state,
      nodes: (structure?.nodes ?? []) as Node[],
      edges: (structure?.edges ?? []) as Edge[],
    };
  } catch (error) {
    console.error(error);
    return undefined;
  }
};

export interface ServiceStatusTarget {
  readonly serviceId: string;
  readonly state: ServiceState;
  readonly type: 'GET' | 'POST' | null;
}

export interface ServicesFilters {
  readonly search: string;
  readonly state: string;
  readonly dependencies: 'all' | 'yes' | 'no' | 'problematic';
}

export const DEFAULT_SERVICES_FILTERS: ServicesFilters = { search: '', state: '', dependencies: 'all' };

export type ServicesLoadState = 'loading' | 'success' | 'error';

let latestServicesRequestId = 0;

const toSortingParam = (sorting: SortingState): string => {
  if (sorting.length === 0) return '';
  const order = sorting[0].desc ? 'desc' : 'asc';
  return `${sorting[0].id} ${order}`;
};

/** Shows the toast for a service indexing validation error code returned by the backend (e.g. VALIDATION_DESCRIPTION_MISSING). */
export const showServiceIndexValidationToast = (code: string): void => {
  useToastStore.getState().error({
    title: i18n.t(`overview.index.validation.${code}`, { defaultValue: i18n.t('overview.index.toast.failed') }),
  });
};

// Attempts whose failure was already announced in this session, keyed by `${serviceId}:${attemptNo}`.
// Ensures each new failure produces exactly one toast, and reloads never re-announce existing failures.
const announcedIndexFailures = new Set<string>();

// A failure is "new" when the row was seen before on this page and either was IN_PROGRESS,
// or a newer attempt has failed already (e.g. submission failed during activation). Rows seen for the
// first time (initial load, reload, other page) are never announced.
const announceNewIndexFailures = (previous: Service[], next: Service[]): void => {
  const previousById = new Map(previous.map((service) => [service.serviceId, service]));
  for (const service of next) {
    const before = previousById.get(service.serviceId);
    if (service.indexStatus !== 'FAILED' || !before) continue;
    const isNewAttempt = (service.indexAttemptNo ?? 0) > (before.indexAttemptNo ?? 0);
    if (before.indexStatus !== 'IN_PROGRESS' && !isNewAttempt) continue;
    const key = `${service.serviceId}:${service.indexAttemptNo ?? ''}`;
    if (announcedIndexFailures.has(key)) continue;
    announcedIndexFailures.add(key);
    useToastStore.getState().error({
      title: i18n.t('overview.index.toast.indexFailed', { name: service.name }),
      message: service.indexFailureReason ?? undefined,
    });
  }
};

const mapService = (item: any, isPinned: boolean): Service => ({
  id: item.id,
  name: item.name,
  description: item.description,
  examples: item.examples ?? [],
  entities: item.entities ?? [],
  slot: item.slot,
  state: item.state,
  type: item.type,
  serviceId: item.serviceId,
  totalPages: item.totalPages ?? 1,
  totalCount: item.totalCount ?? 0,
  indexStatus: item.indexStatus ?? null,
  indexFailureReason: item.indexFailureReason ?? null,
  indexAttemptNo: item.indexAttemptNo ?? null,
  incomingCount: item.incomingCount ?? 0,
  outgoingCount: item.outgoingCount ?? 0,
  problemCount: item.problemCount ?? 0,
  isPinned,
  endpoints: [],
});

interface ServiceStoreState {
  services: Service[];
  pinnedServices: Service[];
  servicesTotalCount: number;
  servicesTotalPages: number;
  servicesPagination: PaginationState;
  servicesSorting: SortingState;
  servicesFilters: ServicesFilters;
  servicesVersion: number;
  servicesLoadState: ServicesLoadState;
  isRefreshingServices: boolean;
  orientation: 'horizontal' | 'vertical';
  toggleOrientation: () => void;
  autoView: boolean;
  toggleAutoView: () => void;
  loadServicesList: (
    pagination: PaginationState,
    sorting: SortingState,
    filters?: ServicesFilters,
    options?: { keepOrder?: boolean; silent?: boolean },
  ) => Promise<void>;
  togglePinService: (service: Service) => Promise<void>;
  loadServiceDependencies: (serviceId: string) => Promise<ServiceDependency[]>;
  locateService: (
    serviceId: string,
    pageSize: number,
    sorting: SortingState,
    filters: ServicesFilters,
  ) => Promise<ServiceLocation | undefined>;
  selectedService: Service | undefined;
  setSelectedService: (service: Service) => void;
  loadFlowCompleteness: (serviceId: string) => Promise<FlowCompletenessResult>;
  loadActivationBlockers: (serviceId: string) => Promise<ActivationBlocker[]>;
  loadAffectedActiveServices: (serviceId: string) => Promise<AffectedService[]>;
  changeServiceState: (service: ServiceStatusTarget, state: ServiceState) => Promise<void>;
  reindexService: (service: Service) => Promise<void>;
  deleteSelectedService: (
    onEnd: () => void,
    successMessage: string,
    errorMessage: string,
    pagination: PaginationState,
    sorting: SortingState,
  ) => Promise<void>;
}

const useServiceListStore = create<ServiceStoreState>()(
  persist(
    (set, get) => ({
      services: [],
      pinnedServices: [],
      servicesTotalCount: 0,
      servicesTotalPages: 1,
      servicesPagination: { pageIndex: 0, pageSize: 10 },
      servicesSorting: [],
      servicesFilters: DEFAULT_SERVICES_FILTERS,
      servicesVersion: 0,
      servicesLoadState: 'loading',
      isRefreshingServices: false,
      orientation: 'vertical',
      autoView: false,
      toggleAutoView: () =>
        set((state) => ({
          autoView: !state.autoView,
        })),
      toggleOrientation: () =>
        set((state) => ({
          orientation: state.orientation === 'horizontal' ? 'vertical' : 'horizontal',
        })),
      loadServicesList: async (pagination, sorting, filters = get().servicesFilters, options = {}) => {
        const requestId = ++latestServicesRequestId;
        // Silent loads (indexing status polling) don't show the refreshing indicator.
        if (!options.silent) {
          if (get().servicesLoadState === 'success') set({ isRefreshingServices: true });
          else set({ servicesLoadState: 'loading' });
        }

        let result;
        try {
          result = await api.post(getServicesOverview(), {
            page: pagination.pageIndex + 1,
            page_size: pagination.pageSize,
            sorting: toSortingParam(sorting),
            search: filters.search,
            state: filters.state,
            dependencies: filters.dependencies,
          });
        } catch (error) {
          if (requestId === latestServicesRequestId) set({ servicesLoadState: 'error', isRefreshingServices: false });
          throw error;
        }
        if (requestId !== latestServicesRequestId) return;

        const response = result.data.response ?? {};
        const services: Service[] = (response.services ?? []).map((item: any) => mapService(item, false));
        const pinnedServices: Service[] = (response.pinned ?? []).map((item: any) => mapService(item, true));
        announceNewIndexFailures([...get().pinnedServices, ...get().services], [...pinnedServices, ...services]);

        if (options.keepOrder) {
          const freshById = new Map([...pinnedServices, ...services].map((service) => [service.serviceId, service]));
          const refreshInPlace = (list: Service[]) =>
            list.map((service) => {
              const fresh = freshById.get(service.serviceId);
              return fresh ? { ...fresh, isPinned: service.isPinned } : service;
            });
          set({
            services: refreshInPlace(get().services),
            pinnedServices: refreshInPlace(get().pinnedServices),
            servicesVersion: get().servicesVersion + 1,
            servicesLoadState: 'success',
            isRefreshingServices: false,
          });
          return;
        }

        set({
          services,
          pinnedServices,
          servicesTotalCount: services[0]?.totalCount ?? 0,
          servicesTotalPages: Math.max(services[0]?.totalPages ?? 1, 1),
          servicesPagination: pagination,
          servicesSorting: sorting,
          servicesFilters: filters,
          servicesVersion: get().servicesVersion + 1,
          servicesLoadState: 'success',
          isRefreshingServices: false,
        });
      },
      loadServiceDependencies: async (serviceId) => {
        const result = await api.post(getServiceDependencies(), { service_id: serviceId });
        return (result.data.response ?? []).map((item: any): ServiceDependency => ({
          direction: item.direction,
          serviceId: item.serviceId,
          name: item.name,
          state: item.state ?? null,
          type: item.type ?? null,
          deleted: !!item.deleted,
          incomingCount: item.incomingCount ?? 0,
          outgoingCount: item.outgoingCount ?? 0,
        }));
      },
      locateService: async (serviceId, pageSize, sorting, filters) => {
        const result = await api.post(locateServiceApi(), {
          service_id: serviceId,
          page_size: pageSize,
          sorting: toSortingParam(sorting),
          search: filters.search,
          state: filters.state,
          dependencies: filters.dependencies,
        });
        const location = result.data.response;
        if (!location?.serviceId) return undefined;
        return {
          serviceId: location.serviceId,
          pinned: !!location.pinned,
          page: location.page == null ? null : Number(location.page),
        };
      },
      togglePinService: async (service) => {
        const { servicesPagination, servicesSorting, pinnedServices, services } = get();
        const pin = !service.isPinned;
        set({
          pinnedServices: pin
            ? [...pinnedServices, { ...service, isPinned: true }]
            : pinnedServices.filter((s) => s.serviceId !== service.serviceId),
          services: pin ? services.filter((s) => s.serviceId !== service.serviceId) : services,
        });
        try {
          await api.post(pin ? pinServiceApi() : unpinServiceApi(), { service_id: service.serviceId });
        } catch (error) {
          console.error(error);
          useToastStore.getState().error({ title: i18n.t('overview.service.toast.failed.pin') });
        }
        await get().loadServicesList(servicesPagination, servicesSorting);
      },
      selectedService: undefined,
      setSelectedService: (service: Service) => {
        set({
          selectedService: service,
        });
      },
      loadFlowCompleteness: async (serviceId: string) => {
        const [flow, navigableResponse] = await Promise.all([
          fetchServiceFlow(serviceId),
          api.get<{ readonly serviceId: string; readonly name: string }[]>(getNavigableServicesList()),
        ]);
        if (!flow) throw new Error(`Service ${serviceId} could not be loaded`);

        const navigable = Array.isArray(navigableResponse.data) ? navigableResponse.data : [];
        return validateFlowCompleteness(
          flow.nodes,
          flow.edges,
          new Map(navigable.map((service) => [service.serviceId, service.name])),
        );
      },
      loadActivationBlockers: async (serviceId: string) => {
        const rootFlow = await fetchServiceFlow(serviceId);
        if (!rootFlow) return [];
        return findActivationBlockers(rootFlow.nodes, fetchServiceFlow);
      },
      loadAffectedActiveServices: (serviceId: string) =>
        findAffectedActiveServices(serviceId, get().loadServiceDependencies),
      changeServiceState: async (service, state) => {
        try {
          const result = await api.post(changeServiceStatus(), {
            id: service.serviceId,
            state,
            type: service.type ?? 'POST',
          });
          // Activation never fails because of indexing; a validation warning (e.g. missing description) is shown as a toast.
          const indexWarning: string | undefined = result.data?.response?.indexWarning ?? undefined;
          if (indexWarning) showServiceIndexValidationToast(indexWarning);
        } catch (error) {
          console.error(error);
          useToastStore.getState().error({ title: i18n.t('overview.service.toast.failed.state') });
          return;
        }

        const withNewState = (item: Service) => (item.serviceId === service.serviceId ? { ...item, state } : item);
        set({
          services: get().services.map(withNewState),
          pinnedServices: get().pinnedServices.map(withNewState),
        });
        useToastStore.getState().success({ title: i18n.t('overview.service.toast.updated') });

        const { servicesPagination, servicesSorting } = get();
        await get()
          .loadServicesList(servicesPagination, servicesSorting, undefined, { keepOrder: true })
          .catch(console.error);
      },
      reindexService: async (service) => {
        let requestFailed = false;
        try {
          await api.post(reindexServiceApi(), { serviceId: service.serviceId });
        } catch (error: any) {
          // Validation errors (e.g. missing description) keep the existing indexing status.
          const validationCode: string | undefined =
            error?.response?.status === 400 ? error.response.data?.response?.code : undefined;
          if (validationCode) {
            showServiceIndexValidationToast(validationCode);
            return;
          }
          console.error(error);
          requestFailed = true;
        }

        if (!requestFailed) {
          // Show Processing right away; the real result arrives through polling.
          const markInProgress = (item: Service): Service =>
            item.serviceId === service.serviceId ? { ...item, indexStatus: 'IN_PROGRESS' } : item;
          set({
            services: get().services.map(markInProgress),
            pinnedServices: get().pinnedServices.map(markInProgress),
          });
          useToastStore.getState().success({ title: i18n.t('overview.index.toast.started') });
        }

        const { servicesPagination, servicesSorting } = get();
        await get()
          .loadServicesList(servicesPagination, servicesSorting, undefined, { keepOrder: true, silent: true })
          .catch(console.error);

        // A submission failure is announced by the failure toast once the row turns FAILED;
        // only show the generic error when the request failed without that.
        if (requestFailed) {
          const current = [...get().pinnedServices, ...get().services].find(
            (item) => item.serviceId === service.serviceId,
          );
          if (current?.indexStatus !== 'FAILED') {
            useToastStore.getState().error({ title: i18n.t('overview.index.toast.failed') });
          }
        }
      },
      deleteSelectedService: async (onEnd, successMessage, errorMessage) => {
        const selectedService = get().selectedService;
        if (!selectedService) return;

        try {
          await api.post(deleteServiceApi(), {
            id: selectedService?.serviceId,
            type: selectedService?.type,
          });
          useToastStore.getState().success({ title: successMessage });
        } catch (error) {
          useToastStore.getState().error({ title: errorMessage });
          throw error;
        }
        set({
          selectedService: undefined,
        });
        onEnd();
      },
    }),
    {
      name: 'state-configs',
      partialize: (state) => ({ orientation: state.orientation, autoView: state.autoView }),
    },
  ),
);

export default useServiceListStore;
