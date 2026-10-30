import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useServiceStore, { extractMapValues, getEndpointBody } from 'store/new-services.store';
import useToastStore from 'store/toasts.store';
import { RequestOperator } from 'types/endpoint/request-operator';
import { generateJsonRequest } from 'utils/json-request-utils';
import { v4 as uuid } from 'uuid';

import { Button, FormInput, FormSelect, RequestVariables, Track } from '../../..';
import { RequestTab } from '../../../../types';
import { EndpointData, EndpointVariableData, PreDefinedEndpointEnvVariables } from '../../../../types/endpoint';
import { useTheme } from '../../../../utils/useTheme';

export type TestPayload = {
  request: {
    url: string | undefined;
    method: string;
    headers: Record<string, string>;
    params: Record<string, string>;
    body: unknown;
  };
  responseBody: unknown;
};

type EndpointCustomProps = {
  endpoint: EndpointData;
  isLive: boolean;
  requestValues: PreDefinedEndpointEnvVariables;
  requestTab: RequestTab;
  setRequestTab: React.Dispatch<React.SetStateAction<RequestTab>>;
  onTestSuccess?: (payload: TestPayload) => void;
  onDescriptionChange?: (description: string) => void;
  onMandatoryViolationChange?: (hasViolation: boolean) => void;
};

const EndpointCustom: React.FC<EndpointCustomProps> = ({
  endpoint,
  isLive,
  requestValues,
  requestTab,
  setRequestTab,
  onTestSuccess,
  onDescriptionChange,
  onMandatoryViolationChange,
}) => {
  const { t } = useTranslation();
  const [key, setKey] = useState<number>(0);
  const { setEndpoints } = useServiceStore();
  const ref = useRef<HTMLInputElement>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [responseContent, setResponseContent] = useState<string | null>(endpoint.responseSchema ?? null);
  const [isResponseOpen, setIsResponseOpen] = useState(!!endpoint.responseSchema);

  // initial endpoint data
  if (endpoint.definitions.length === 0) {
    endpoint.definitions.push({
      id: uuid(),
      label: '',
      methodType: 'GET',
      type: 'custom',
      dataType: 'custom',
      path: '',
      supported: true,
      isSelected: true,
      body: {
        variables: [],
        rawData: {},
        isRawSelected: false,
      },
      headers: {
        variables: [],
        rawData: {},
        isRawSelected: false,
      },
      params: {
        variables: [],
        rawData: {},
        isRawSelected: false,
      },
    });
  }

  // Adding "key" dependency breaks focus in variable inputs
  // Likely impossible to fix without a significant refactor
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setKey(key + 1), [isLive]);
  const theme = useTheme();

  const handleJsonRequestClick = () => {
    setIsTesting(true);
    const def = endpoint.definitions[0];

    // Build the test URL by resolving {param} placeholders.
    // PATH params must have values; any remaining unresolved {name} blocks the test.
    // Derive path param names directly from {name} placeholders in the URL path so that
    // endpoints loaded from the DB (where paramType may not be persisted) work correctly.
    const allParams = def.params?.variables ?? [];
    const urlPathPart = (def.url ?? '').split('?')[0];
    const pathPlaceholderNames = new Set([...urlPathPart.matchAll(/(?<!\$)\{([^{}]+)\}/g)].map((m) => m[1]));
    const pathParams = allParams.filter((v) => pathPlaceholderNames.has(v.name));
    const queryParams = allParams.filter((v) => !pathPlaceholderNames.has(v.name));

    // Validate path params have values
    for (const param of pathParams) {
      if (!param.value?.trim()) {
        useToastStore.getState().error({ title: t('newService.endpoint.missingPathParam', { name: param.name }) });
        setIsTesting(false);
        return;
      }
    }

    // Validate named query params have values (dynamic placeholders must be filled)
    for (const param of queryParams) {
      if (param.name && !param.value?.trim()) {
        useToastStore.getState().error({ title: t('newService.endpoint.missingPathParam', { name: param.name }) });
        setIsTesting(false);
        return;
      }
    }

    // Replace {name} placeholders in the URL path
    let testUrl = def.url ?? '';
    for (const param of pathParams) {
      testUrl = testUrl.split(`{${param.name}}`).join(param.value ?? '');
    }

    // Strip query string — query params are sent separately via the params map
    const testUrlBase = testUrl.includes('?') ? testUrl.split('?')[0] : testUrl;

    // Check for any remaining unresolved {name} in the path (excluding ${var} runtime vars)
    const unresolvedRegex = /(?<!\$)\{([^{}]+)\}/;
    const remaining = unresolvedRegex.exec(testUrlBase);
    if (remaining) {
      useToastStore.getState().error({ title: t('newService.endpoint.unresolvedPlaceholder', { name: remaining[1] }) });
      setIsTesting(false);
      return;
    }

    const queryOnlyParams = def.params ? { ...def.params, variables: queryParams } : undefined;

    const request = {
      url: testUrlBase,
      method: def.methodType,
      headers: extractMapValues(def.headers) as Record<string, string>,
      params: extractMapValues(queryOnlyParams) as Record<string, string>,
      body: getEndpointBody(def),
    };
    generateJsonRequest({ ...def, url: testUrlBase, params: queryOnlyParams })
      .then((content) => {
        const schema = JSON.stringify(content, undefined, 4);
        setResponseContent(schema);
        endpoint.responseSchema = schema;
        setIsResponseOpen(true);
        useToastStore.getState().success({ title: t('newService.endpoint.success') });
        onTestSuccess?.({ request, responseBody: content });
      })
      .catch((error) => {
        useToastStore.getState().error({ title: error.message ?? t('newService.endpoint.error') });
      })
      .finally(() => setIsTesting(false));
  };

  const refereshEndpoint = () => {
    setEndpoints((endpoint) => endpoint);
    setKey((prevKey) => prevKey + 1);
  };

  return (
    <Track direction="vertical" align="stretch" gap={16}>
      <div>
        <label htmlFor="endpointDescription" style={{ color: `${theme === 'dark' ? 'white' : 'black'}` }}>
          {t('newService.description')}
        </label>
        <FormInput
          name="endpointDescription"
          label=""
          placeholder={t('newService.endpoint.insertDescription') ?? ''}
          defaultValue={endpoint.description ?? ''}
          onChange={(e) => {
            endpoint.description = e.target.value;
            onDescriptionChange?.(e.target.value);
          }}
        />
      </div>
      <div>
        <label htmlFor="endpointUrl" style={{ color: `${theme === 'dark' ? 'white' : 'black'}` }}>
          {t('newService.endpoint.url')}
        </label>
        <Track gap={8}>
          <Track style={{ width: '100%' }}>
            <div style={{ width: 108 }}>
              <FormSelect
                name={'request-type'}
                label={''}
                style={{ borderRadius: '4px 0 0 4px', borderRight: 0, fontSize: '15px' }}
                options={[
                  { label: 'GET', value: 'GET' },
                  { label: 'POST', value: 'POST' },
                ]}
                onSelectionChange={(selection) => {
                  endpoint.definitions[0].methodType = selection?.value ?? 'GET';
                }}
                defaultValue={endpoint.definitions[0]?.methodType ?? 'GET'}
              />
            </div>
            <FormInput
              ref={ref}
              style={{ borderRadius: '0 4px 4px 0' }}
              name="endpointUrl"
              label=""
              defaultValue={endpoint.definitions[0]?.url ?? ''}
              onChange={(event) => {
                const parsedUrl = parseURLWithPlaceholders(event.target.value);
                endpoint.definitions[0].url = parsedUrl.url;

                const existingVars = endpoint.definitions[0].params?.variables ?? [];
                const parameters: EndpointVariableData[] = [];

                // Add path params first (preserve existing values entered by the user)
                parsedUrl.pathParams.forEach((name) => {
                  const existing = existingVars.find((v) => v.name === name && v.paramType === 'path');
                  parameters.push({
                    id: existing?.id ?? uuid(),
                    name,
                    type: existing?.type && existing.type !== 'custom' ? existing.type : 'STRING',
                    required: false,
                    value: existing?.value ?? '',
                    paramType: 'path',
                  });
                });

                // Add query params
                Object.keys(parsedUrl.params).forEach((key) => {
                  const existingQuery = existingVars.find((v) => v.name === key);
                  parameters.push({
                    id: existingQuery?.id ?? uuid(),
                    name: key,
                    type: existingQuery?.type && existingQuery.type !== 'custom' ? existingQuery.type : 'STRING',
                    required: false,
                    value: parsedUrl.params[key],
                    operator: (parsedUrl.operators[key] as RequestOperator) || '=',
                    paramType: 'query',
                  });
                });

                endpoint.definitions[0].params = {
                  variables: parameters,
                  rawData: {},
                  isRawSelected: false,
                };
                refereshEndpoint();
              }}
              placeholder={t('newService.endpoint.insert') ?? ''}
            />
          </Track>
        </Track>
      </div>
      <RequestVariables
        key={key}
        requestValues={requestValues}
        isLive={isLive}
        endpoint={endpoint}
        requestTab={requestTab}
        setRequestTab={setRequestTab}
        onMandatoryViolationChange={onMandatoryViolationChange}
        onParametersChange={(parameters) => {
          // Preserve the path template (including {name} placeholders) from stored URL.
          // Use string split instead of URL constructor to avoid encoding {braces}.
          const storedUrl = endpoint.definitions[0].url ?? '';
          let pathTemplate = storedUrl.includes('?') ? storedUrl.split('?')[0] : storedUrl;

          // When a path param is renamed, update the {oldName} placeholder in the URL path.
          const oldPathParams = endpoint.definitions[0].params?.variables?.filter((p) => p.paramType === 'path') ?? [];
          const newPathParams = parameters.filter((p) => p.paramType === 'path');
          for (const newParam of newPathParams) {
            const oldParam = oldPathParams.find((p) => p.id === newParam.id);
            if (oldParam && oldParam.name !== newParam.name && newParam.name) {
              pathTemplate = pathTemplate.split(`{${oldParam.name}}`).join(`{${newParam.name}}`);
            }
          }

          // Rebuild query string from non-path params.
          // Empty values restore the {paramName} placeholder so the URL stays as a template.
          // Renaming a query param key here updates the corresponding key in the URL.
          const queryString = parameters
            .filter((param) => param.paramType !== 'path' && param.name)
            .map((param) => {
              const operator = param.operator ?? '=';
              const val = param.value?.trim() ? encodeURIComponent(param.value) : `{${param.name}}`;
              return `${param.name}${operator}${val}`;
            })
            .join('&');

          endpoint.definitions[0].url = queryString ? `${pathTemplate}?${queryString}` : pathTemplate;
          endpoint.definitions[0].params = {
            variables: parameters,
            rawData: {},
          };

          if (ref?.current) {
            ref.current.value = endpoint.definitions[0].url;
          }
        }}
      />
      <Track justify="end">
        <Button appearance={isTesting ? 'loading' : 'primary'} onClick={handleJsonRequestClick}>
          {t('newService.test')}
        </Button>
      </Track>
      <div>
        <button
          type="button"
          onClick={() => setIsResponseOpen((o) => !o)}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            borderTop: '1px solid #D2D3D8',
            padding: '8px 4px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 14,
            color: theme === 'dark' ? 'white' : '#34394C',
          }}
        >
          <span>{t('newService.endpoint.response')}</span>
          <span>{isResponseOpen ? '▲' : '▼'}</span>
        </button>
        {isResponseOpen && (
          <textarea
            readOnly
            value={responseContent ?? ''}
            placeholder="{...}"
            style={{
              width: '100%',
              minHeight: 100,
              resize: 'vertical',
              fontFamily: 'monospace',
              fontSize: 13,
              padding: '8px',
              border: '1px solid #D2D3D8',
              borderRadius: 4,
              backgroundColor: '#F0F0F2',
              boxSizing: 'border-box',
            }}
          />
        )}
      </div>
    </Track>
  );
};

function parseURLWithPlaceholders(url: string): {
  url: string;
  pathParams: string[];
  params: Record<string, string>;
  operators: Record<string, string>;
} {
  try {
    const [pathPart, queryPart = ''] = url.split('?');

    // Detect {name} placeholders in the path portion
    const pathParams: string[] = [];
    const pathPlaceholderRegex = /\{(\w+)\}/g;
    let match;
    while ((match = pathPlaceholderRegex.exec(pathPart)) !== null) {
      if (!pathParams.includes(match[1])) {
        pathParams.push(match[1]);
      }
    }

    // Parse query params
    const params: Record<string, string> = {};
    const operators: Record<string, string> = {};
    queryPart
      .split('&')
      .filter(Boolean)
      .forEach((segment) => {
        const { index, token } = findOperators(segment);
        const name = decodeURIComponent(index === -1 ? segment : segment.slice(0, index));
        const rawValue = decodeURIComponent(index === -1 ? '' : segment.slice(index + token.length));
        // If the value is itself a {placeholder}, treat it as empty (dynamic param — user fills in Params tab)
        const value = /^\{[^}]+\}$/.test(rawValue) ? '' : rawValue;
        const operator = index === -1 ? '=' : token;
        if (name) {
          params[name] = value;
          operators[name] = operator;
        }
      });

    return { url, pathParams, params, operators };
  } catch (e) {
    console.error('Invalid URL format:', e);
    return { url, pathParams: [], params: {}, operators: {} };
  }
}

function findOperators(segment: string): { index: number; token: string } {
  const operatorTokens = ['>=', '<=', '>', '<', '='];
  let found = operatorTokens
    .map((token) => ({ token, idx: segment.indexOf(token) }))
    .filter(({ idx }) => idx !== -1)
    .sort((a, b) => a.idx - b.idx || b.token.length - a.token.length)[0];
  return found ? { index: found.idx, token: found.token } : { index: -1, token: '' };
}

export default EndpointCustom;
