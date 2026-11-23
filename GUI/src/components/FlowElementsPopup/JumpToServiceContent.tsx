import { Node } from '@xyflow/react';
import Button from 'components/Button';
import { FormSelect } from 'components/FormElements';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdOpenInNew } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import useServiceStore from 'store/new-services.store';
import { Assign } from 'types/assign';
import { JumpToService } from 'types/jump-to-service';
import { NodeDataProps } from 'types/service-flow';
import { navigateToService } from 'utils/service-navigation-utils';

import Icon from '../Icon';
import Track from '../Track';
import JumpToServiceInputBuilder from './JumpToServiceInputBuilder';
import PreviousVariables from './PreviousVariables';

type ServiceOption = { readonly name: string; readonly serviceId: string };

type JumpToServiceContentProps = {
  readonly node: Node<NodeDataProps>;
  readonly jumpToService: JumpToService;
  readonly onChange: (value: JumpToService) => void;
};

const JumpToServiceContent: FC<JumpToServiceContentProps> = ({ node, jumpToService, onChange }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const navigableServices = useServiceStore((state) => state.navigableServices);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void useServiceStore
      .getState()
      .loadNavigableServiceIds()
      .finally(() => setIsLoading(false));
  }, []);

  const services: ServiceOption[] = useMemo(
    () => Array.from(navigableServices, ([serviceId, name]) => ({ name, serviceId })),
    [navigableServices],
  );

  const serviceOptions = services.map((s) => ({ label: s.name, value: { name: s.name, serviceId: s.serviceId } }));

  const defaultServiceValue =
    jumpToService.serviceId || jumpToService.serviceName?.trim()
      ? (services.find(
          (s) =>
            (jumpToService.serviceId && s.serviceId === jumpToService.serviceId) ||
            s.name === jumpToService.serviceName,
        ) ?? null)
      : null;

  const isLinkedServiceDeleted =
    !isLoading && !!jumpToService.serviceId && !services.some((s) => s.serviceId === jumpToService.serviceId);

  const handleServiceChange = (selection: { label: string; value: { name: string; serviceId: string } } | null) => {
    if (!selection) return;
    const service = services.find((s) => s.serviceId === selection.value.serviceId);
    onChange({
      ...jumpToService,
      serviceName: service?.name ?? selection.label,
      serviceId: service?.serviceId,
    });
  };

  const handleInputChange = (input: Assign[]) => {
    onChange({ ...jumpToService, input });
  };

  const handleNavigateToService = () => {
    if (!jumpToService.serviceId) return;
    navigateToService(jumpToService.serviceId, navigate);
  };

  return (
    <Track direction="vertical" align="stretch" gap={16}>
      <Track direction="vertical" align="stretch" gap={16} style={{ padding: '16px 16px 0' }}>
        {isLoading ? (
          <Track justify="center">
            <div className="loader" />
          </Track>
        ) : (
          <>
            <Track direction="horizontal" gap={8}>
              <div style={{ flex: 1 }}>
                <FormSelect
                  label={t('serviceFlow.element.jumpToService.targetService')}
                  name="targetService"
                  placeholder={t('serviceFlow.element.jumpToService.selectService')}
                  options={serviceOptions}
                  defaultValue={defaultServiceValue ?? undefined}
                  onSelectionChange={handleServiceChange}
                />
              </div>
              {jumpToService.serviceId && !isLinkedServiceDeleted && (
                <Button
                  appearance="icon"
                  size="s"
                  onClick={handleNavigateToService}
                  aria-label={t('serviceFlow.element.jumpToService.navigateToService')}
                  title={t('serviceFlow.element.jumpToService.navigateToService')}
                >
                  <Icon icon={<MdOpenInNew color="#005aa3" />} size="medium" />
                </Button>
              )}
            </Track>
            {isLinkedServiceDeleted && (
              <p style={{ color: '#c00', fontSize: '13px' }}>
                {t('serviceFlow.element.jumpToService.deletedService', {
                  serviceName: jumpToService.serviceName,
                })}
              </p>
            )}
            {!isLinkedServiceDeleted && services.length === 0 && (
              <p style={{ color: '#888', fontSize: '13px' }}>
                {t('serviceFlow.element.jumpToService.noActiveServices')}
              </p>
            )}
          </>
        )}
      </Track>
      <JumpToServiceInputBuilder seedGroup={jumpToService.input} onChange={handleInputChange} />
      <PreviousVariables node={node} />
    </Track>
  );
};

export default JumpToServiceContent;
