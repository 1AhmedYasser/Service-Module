import { Card, FormInput, Switch, Track } from 'components';
import { FC, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import useServiceStore from '../../store/new-services.store';
import DynamicList from '../DynamicList';
import { InfoTooltip } from '../InfoTooltip';

type SettingsModalProps = {
  id?: string;
};

const SettingsModal: FC<SettingsModalProps> = () => {
  const { t } = useTranslation();

  const name = useServiceStore((state) => state.serviceNameDashed());
  const description = useServiceStore((state) => state.description);
  const examples = useServiceStore((state) => state.examples);
  const entities = useServiceStore((state) => state.entities);
  const discoverable = useServiceStore((state) => state.discoverable);

  const { setHasUnsavedChanges } = useServiceStore();
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div>
        <Card>
          <Track align={'left'} direction={'vertical'} gap={10}>
            <Track style={{ width: '100%' }} direction={'horizontal'}>
              <Track style={{ width: '100%' }} gap={5}>
                <FormInput
                  ref={titleRef}
                  label={t('newService.title') + ' :'}
                  name={'Pealkiri'}
                  placeholder={name ? t('newService.title').toString() : t('newService.titleRequired').toString()}
                  value={name}
                  showExclamation={!name}
                  highlightPlaceholder={!name}
                  onChange={(e) => {
                    setHasUnsavedChanges(true);
                    const value = e.target.value.trimStart().replaceAll(/_+/g, '_');
                    const hasSpecialCharacters = /[^\p{L}\p{N}_ ]/u;
                    if (!hasSpecialCharacters.test(value) && !value.startsWith(' ')) {
                      useServiceStore.getState().changeServiceName(value);
                    }
                  }}
                />
                <InfoTooltip name={'newService.serviceName.title'} />
              </Track>
            </Track>
            <Track style={{ width: '100%' }} direction={'horizontal'}>
              <Track style={{ width: '100%' }} gap={5}>
                <FormInput
                  ref={descriptionRef}
                  label={t('newService.serviceDescription.title') + ' :'}
                  name={'description'}
                  placeholder={t('newService.serviceDescription.placeholder').toString()}
                  value={description}
                  showExclamation={!description}
                  highlightPlaceholder={false}
                  onChange={(e) => {
                    setHasUnsavedChanges(true);
                    useServiceStore.getState().setDescription(e.target.value);
                  }}
                />
                <InfoTooltip name={'newService.serviceDescription.tooltip'} />
              </Track>
            </Track>
            <Track direction={'horizontal'} align={'center'} gap={8} style={{ width: '100%' }}>
              <DynamicList
                label={t('newService.examples.title')}
                value={examples}
                onChange={(e) => useServiceStore.getState().setExamples(e)}
                tooltipText={'newService.examples.tooltip'}
                placeholder={'newService.examples.placeholder'}
              />
            </Track>
            <Track direction={'horizontal'} align={'center'} gap={8} style={{ width: '100%' }}>
              <DynamicList
                label={t('newService.keywords.title')}
                value={entities}
                onChange={(e) => useServiceStore.getState().setEntities(e)}
                tooltipText={'newService.keywords.tooltip'}
                placeholder={'newService.keywords.placeholder'}
              />
            </Track>
            <Switch
              label={t('newService.discoverable.title') + ' :'}
              checked={discoverable}
              onCheckedChange={(checked) => {
                setHasUnsavedChanges(true);
                useServiceStore.getState().setDiscoverable(checked);
              }}
              tooltip={<InfoTooltip name={'newService.discoverable.tooltip'} />}
            />
          </Track>
        </Card>
      </div>
    </>
  );
};

export default SettingsModal;
