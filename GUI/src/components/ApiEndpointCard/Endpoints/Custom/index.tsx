import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useServiceStore from 'store/new-services.store';
import { RequestOperator } from 'types/endpoint/request-operator';
import { v4 as uuid } from 'uuid';

import { Button, FormInput, FormSelect, RequestVariables, Track } from '../../..';
import { RequestTab } from '../../../../types';
import { EndpointData, EndpointVariableData, PreDefinedEndpointEnvVariables } from '../../../../types/endpoint';
import { useTheme } from '../../../../utils/useTheme';

type EndpointCustomProps = {
  endpoint: EndpointData;
  isLive: boolean;
  requestValues: PreDefinedEndpointEnvVariables;
  requestTab: RequestTab;
  setRequestTab: React.Dispatch<React.SetStateAction<RequestTab>>;
};

const EndpointCustom: React.FC<EndpointCustomProps> = ({
  endpoint,
  isLive,
  requestValues,
  requestTab,
  setRequestTab,
}) => {
  const { t } = useTranslation();
  const [key, setKey] = useState<number>(0);
  const { setEndpoints, triggerJsonRequest } = useServiceStore();
  const ref = useRef<HTMLInputElement>(null);

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
      pathParams: {
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
    triggerJsonRequest(endpoint);
  };

  const refereshEndpoint = () => {
    setEndpoints((endpoint) => endpoint);
    setKey((prevKey) => prevKey + 1);
  };

  return (
    <Track direction="vertical" align="stretch" gap={16}>
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
                const parsedUrl = parseURL(event.target.value);
                endpoint.definitions[0].url = parsedUrl.url;

                const parameters: EndpointVariableData[] = [];
                Object.keys(parsedUrl.params).forEach((key) => {
                  parameters.push({
                    id: uuid(),
                    name: key,
                    type: 'custom',
                    required: false,
                    value: parsedUrl.params[key],
                    operator: (parsedUrl.operators[key] as RequestOperator) || '=',
                  });
                });

                endpoint.definitions[0].params = {
                  variables: parameters,
                  rawData: {},
                  isRawSelected: false,
                };

                const existingPathParams = endpoint.definitions[0].pathParams?.variables ?? [];
                const pathParamNames = parsePathParams(event.target.value);
                const pathParameters: EndpointVariableData[] = pathParamNames.map((name) => {
                  const existing = existingPathParams.find((p) => p.name === name);
                  return existing ?? { id: uuid(), name, type: 'custom', required: false };
                });

                endpoint.definitions[0].pathParams = {
                  variables: pathParameters,
                  rawData: {},
                  isRawSelected: false,
                };
                refereshEndpoint();
              }}
              placeholder={t('newService.endpoint.insert') ?? ''}
            />
          </Track>
          <Button onClick={handleJsonRequestClick}>{t('newService.test')}</Button>
        </Track>
      </div>
      <RequestVariables
        key={key}
        requestValues={requestValues}
        isLive={isLive}
        endpoint={endpoint}
        requestTab={requestTab}
        setRequestTab={setRequestTab}
        parentEndpointId={endpoint.endpointId}
        onParametersChange={(parameters) => {
          const url = new URL(endpoint.definitions[0].url ?? '');
          const baseUrl = `${url.origin}${url.pathname}`;

          const queryString = parameters
            .filter((param) => param.value && param.name)
            .map((param) => {
              const operator = param.operator ? param.operator : '=';
              return `${param.name}${operator}${encodeURIComponent(param.value ?? '')}`;
            })
            .join('&');

          endpoint.definitions[0].url = queryString ? `${baseUrl}?${queryString}` : baseUrl;
          endpoint.definitions[0].params = {
            variables: parameters,
            rawData: {},
          };

          if (ref?.current) {
            ref.current.value = endpoint.definitions[0].url;
          }
        }}
      />
    </Track>
  );
};

function parsePathParams(url: string): string[] {
  const path = url.split('?')[0];
  const matches = path.match(/\{([^}]+)\}/g) ?? [];
  return matches.map((m) => m.slice(1, -1));
}

function parseURL(url: string) {
  try {
    const queryString = url.split('?')[1] ?? '';
    const params: Record<string, any> = {};
    const operators: Record<string, string> = {};

    queryString
      .split('&')
      .filter(Boolean)
      .forEach((segment) => {
        const { index, token } = findOperators(segment);
        const name = decodeURIComponent(index !== -1 ? segment.slice(0, index) : segment);
        const value = decodeURIComponent(index !== -1 ? segment.slice(index + token.length) : '');
        const operator = index !== -1 ? token : '=';
        if (name) {
          params[name] = value;
          operators[name] = operator;
        }
      });

    return { url, params, operators };
  } catch (e) {
    console.error('Invalid URL format:', e);
    return { url, params: {}, operators: {} };
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
