import * as Tabs from '@radix-ui/react-tabs';
import { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './ApiEndpointCard.scss';
import useServiceStore from 'store/new-services.store';
import { EndpointType } from 'types/endpoint/endpoint-type';
import { removeTrailingUnderscores } from 'utils/string-util';

import { EndpointCustom, EndpointOpenAPI, FormInput, FormSelect, Track } from '..';
import { TestPayload } from './Endpoints/Custom';
import { RequestTab } from '../../types';
import { EndpointData, EndpointEnv, EndpointTab } from '../../types/endpoint';
import { Option } from '../../types/option';

type EndpointCardProps = {
  endpoint: EndpointData;
  isNameDisabled?: boolean;
  onNameChange?: (name: string) => void;
  onNameExists?: (exists: boolean) => void;
  /** When provided (e.g. API Registry async check), overrides the internal duplicate-name check. */
  overrideNameExists?: boolean;
  onTestSuccess?: (payload: TestPayload) => void;
  onTypeChange?: (type: string) => void;
  onDescriptionChange?: (description: string) => void;
  onMandatoryViolationChange?: (hasViolation: boolean) => void;
  responseSchema?: string;
};

const ApiEndpointCard: FC<EndpointCardProps> = ({
  endpoint,
  isNameDisabled = false,
  onNameExists,
  onNameChange,
  overrideNameExists,
  onTestSuccess,
  onTypeChange,
  onDescriptionChange,
  onMandatoryViolationChange,
  responseSchema,
}) => {
  const { changeServiceEndpointType, getAvailableRequestValues } = useServiceStore();
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState<EndpointEnv>(EndpointEnv.Live);
  const [endpointName, setEndpointName] = useState<string>(endpoint.name);
  const options: { label: string; value: EndpointType; name: string }[] = [
    { label: 'Open API', value: 'openApi', name: '' },
    { label: 'Custom endpoint', value: 'custom', name: '' },
  ];
  const [option, setOption] = useState<Option | null>(options.find((o) => o.value === endpoint.type) ?? null);
  const [requestTab, setRequestTab] = useState<RequestTab>({ tab: EndpointTab.Params, showRawData: false });
  const [nameExists, setNameExists] = useState<boolean>(false);

  const getTabTriggerClasses = (tab: EndpointEnv) => `tab-group__tab-btn ${selectedTab === tab ? 'active' : ''}`;

  const requestValues = useMemo(() => getAvailableRequestValues(endpoint), [endpoint, getAvailableRequestValues]);

  return (
    <Tabs.Root
      defaultValue={EndpointEnv.Live}
      onValueChange={(value) => {
        setSelectedTab(value as EndpointEnv);
        if (value === EndpointEnv.Test) endpoint.hasTestEnv = true;
      }}
      className="tab-group"
    >
      <Track justify="between">
        <Tabs.List className="tab-group__list" aria-label="environment">
          <Tabs.Trigger className={getTabTriggerClasses(EndpointEnv.Live)} value={EndpointEnv.Live}>
            {t('newService.endpoint.single')}
          </Tabs.Trigger>
        </Tabs.List>
      </Track>
      {[EndpointEnv.Live, EndpointEnv.Test].map((env) => {
        return (
          <Tabs.Content className="tab-group__tab-content" value={env} key={env}>
            <Track direction="vertical" align="stretch" gap={16}>
              <Track isMultiline>
                <label htmlFor="service-type" className={'default_label'}>
                  {t('newService.uses')}
                </label>
                <FormSelect
                  name="service-type"
                  label=""
                  placeholder={t('newService.endpoint.type').toString()}
                  options={options}
                  disabled={selectedTab === EndpointEnv.Test}
                  style={{ fontSize: '15px' }}
                  onSelectionChange={(selection) => {
                    setOption(selection);
                    endpoint.type = selection?.value as EndpointType;
                    changeServiceEndpointType(endpoint, (selection?.value ?? 'custom') as EndpointType);
                    onTypeChange?.(selection?.value ?? '');
                  }}
                  defaultValue={option?.value}
                />
              </Track>
              {option && (
                <div>
                  <label htmlFor="endpointName" className={'default_label'}>
                    {t('newService.endpoint.name')}
                  </label>
                  <FormInput
                    name="endpointName"
                    label=""
                    placeholder={t('newService.endpoint.insertName').toString()}
                    maxLength={30}
                    value={endpointName}
                    disabled={isNameDisabled || selectedTab === EndpointEnv.Test}
                    onChange={(e) => {
                      const sanitizedValue = e.target.value
                        .replaceAll(/[^a-zA-Z0-9_\s]/g, '')
                        .replaceAll(/\s+/g, '_')
                        .replaceAll(/_+/g, '_');

                      setEndpointName(sanitizedValue);
                      const endpointsNames = useServiceStore
                        .getState()
                        .endpoints.map((ep) => ep.name)
                        .filter((name) => name !== endpoint.name);
                      const normalizedInput = removeTrailingUnderscores(sanitizedValue);
                      const isNameExist = endpointsNames.includes(normalizedInput);
                      setNameExists(isNameExist);
                      onNameExists?.(isNameExist);
                      onNameChange?.(normalizedInput);
                    }}
                  />
                  {(overrideNameExists ?? nameExists) && (
                    <span style={{ color: 'red', fontSize: '13px' }}>{t('newService.endpoint.nameAlreadyExists')}</span>
                  )}
                </div>
              )}
              {option?.value === 'openApi' && (
                <EndpointOpenAPI
                  endpoint={endpoint}
                  isLive={selectedTab === EndpointEnv.Live}
                  requestTab={requestTab}
                  setRequestTab={setRequestTab}
                  requestValues={requestValues}
                  onTestSuccess={onTestSuccess}
                  onDescriptionChange={onDescriptionChange}
                  onMandatoryViolationChange={onMandatoryViolationChange}
                  responseSchema={responseSchema}
                />
              )}
              {option?.value === 'custom' && (
                <EndpointCustom
                  endpoint={endpoint}
                  isLive={selectedTab === EndpointEnv.Live}
                  requestTab={requestTab}
                  setRequestTab={setRequestTab}
                  requestValues={requestValues}
                  onTestSuccess={onTestSuccess}
                  onDescriptionChange={onDescriptionChange}
                  onMandatoryViolationChange={onMandatoryViolationChange}
                  responseSchema={responseSchema}
                />
              )}
            </Track>
          </Tabs.Content>
        );
      })}
    </Tabs.Root>
  );
};

export default ApiEndpointCard;
