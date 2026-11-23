import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { t } from 'i18next';
import React, { FC, useEffect, useState } from 'react';
import { CgChevronDown, CgChevronUp } from 'react-icons/cg';
import { FaGear } from 'react-icons/fa6';
import { TiArrowLeft } from 'react-icons/ti';
import { useNavigate, useParams } from 'react-router-dom';
import '@buerokratt-ria/header/src/Header.scss';
import { deleteService, getNavigableServicesList } from 'resources/api-constants';
import { ROUTES } from 'resources/routes-constants';
import useServiceStore from 'store/new-services.store';
import useToastStore from 'store/toasts.store';
import { ServiceState } from 'types';
import { AffectedService } from 'utils/service-draft-return';
import { navigateToService } from 'utils/service-navigation-utils';
import { removeTrailingUnderscores } from 'utils/string-util';

import { Button, Modal, Track } from '..';
import api from '../../services/api-dev';
import useServiceListStore from '../../store/services.store';
import Dialog from '../Dialog';
import Icon from '../Icon';
import ReturnToDraftModal from '../ReturnToDraftModal';
import SettingsModal from '../ServiceConfigurationForm';
import ServiceStatusChip from '../ServicesTable/ServiceStatusChip';

import './NewServiceHeader.scss';

type ServiceOption = { readonly name: string; readonly serviceId: string; readonly state?: ServiceState };

type NewServiceHeaderProps = {
  activeStep: number;
  backOnClick: () => void;
  continueOnClick: () => void;
  saveOnClick: () => void;
};

const showEmptyNameError = () => {
  useToastStore.getState().error({
    title: t('newService.serviceName.title'),
    message: t('newService.serviceName.placeholder'),
  });
};

const NewServiceHeader: FC<NewServiceHeaderProps> = ({ backOnClick, continueOnClick, saveOnClick }) => {
  const name = removeTrailingUnderscores(useServiceStore((state) => state.serviceNameDashed()));
  const serviceState = useServiceStore((state) => state.serviceState);
  const hasUnsavedChanges = useServiceStore((state) => state.hasUnsavedChanges);
  const selectedService = useServiceListStore((state) => state.selectedService);
  const [showServiceConfig, setShowServiceConfig] = useState<boolean>(false);
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [isDeleteServiceModalVisible, setIsDeleteServiceModalVisible] = useState(false);
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [affectedServices, setAffectedServices] = useState<AffectedService[] | null>(null);
  const { id } = useParams();

  useEffect(() => {
    if (!isServiceDropdownOpen) return;

    api
      .get(getNavigableServicesList())
      .then((res) => {
        const data: ServiceOption[] = Array.isArray(res.data) ? res.data : [];
        setServices(data.map((s) => ({ name: s.name, serviceId: s.serviceId, state: s.state })));
      })
      .catch(console.error);
  }, [isServiceDropdownOpen]);

  const otherServices = services.filter((service) => service.serviceId !== id);
  const hasPendingChanges = !id || hasUnsavedChanges;

  const saveAsDraft = async () => {
    setIsSaving(true);
    try {
      await useServiceStore.getState().onServiceSave(ServiceState.Draft, false);
      useServiceStore.setState({ serviceState: ServiceState.Draft });
      saveOnClick();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!name) {
      showEmptyNameError();
      return;
    }
    if (serviceState !== ServiceState.Active || !id) {
      await saveAsDraft();
      return;
    }

    setIsSaving(true);
    let affected: AffectedService[];
    try {
      affected = await useServiceListStore.getState().loadAffectedActiveServices(id);
    } catch (error) {
      console.error(error);
      useToastStore.getState().error({ title: t('overview.service.toast.failed.state') });
      setIsSaving(false);
      return;
    }

    if (affected.length > 0) {
      setIsSaving(false);
      setAffectedServices(affected);
      return;
    }
    await saveAsDraft();
  };

  return (
    <>
      <header className="new-service-header">
        {showServiceConfig && (
          <Dialog
            title={t('serviceFlow.serviceConfiguration')}
            onClose={() => setShowServiceConfig(false)}
            size="large"
          >
            <SettingsModal id={id} />
          </Dialog>
        )}
        <Track justify="between" gap={16}>
          <Button appearance="primary" className={'icon_button'} onClick={backOnClick}>
            <Icon icon={<TiArrowLeft size={20} />} />
            {t('menu.backToServiceListing')}
          </Button>
          <Button appearance="primary" className={'icon_button'} onClick={() => setShowServiceConfig(true)}>
            {t('serviceFlow.serviceConfiguration')}
            <Icon icon={<FaGear size={18} />} size="medium" />
          </Button>
          <DropdownMenu.Root open={isServiceDropdownOpen} onOpenChange={setIsServiceDropdownOpen}>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="naming naming--trigger">
                <span className="naming__label">{name || '...'}</span>
                {serviceState && <ServiceStatusChip state={serviceState} variant="outlined" />}
                {isServiceDropdownOpen ? (
                  <CgChevronUp className="naming__chevron" size={25} />
                ) : (
                  <CgChevronDown className="naming__chevron" size={25} />
                )}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="service-switch-dropdown" sideOffset={5} align="center">
                {otherServices.length === 0 ? (
                  <div className="service-switch-dropdown__empty">
                    {t('serviceFlow.element.jumpToService.noActiveServices')}
                  </div>
                ) : (
                  otherServices.map((service) => (
                    <DropdownMenu.Item
                      key={service.serviceId}
                      className="service-switch-dropdown__item"
                      onSelect={() => navigateToService(service.serviceId, navigate)}
                    >
                      <span className="service-switch-dropdown__name">{service.name}</span>
                      {service.state && <ServiceStatusChip state={service.state} variant="outlined" />}
                    </DropdownMenu.Item>
                  ))
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <Button
            appearance={isDeleting ? 'loading' : 'error'}
            disabled={
              serviceState && id ? serviceState !== ServiceState.Draft && serviceState !== ServiceState.Ready : true
            }
            onClick={() => {
              setIsDeleteServiceModalVisible(true);
            }}
          >
            {t('serviceFlow.apiElements.delete')}
          </Button>
          <Button appearance={isSaving ? 'loading' : 'primary'} disabled={isSaving} onClick={() => void handleSave()}>
            {t('global.save')}
            {hasPendingChanges && (
              <span
                className="unsaved-changes-dot"
                role="img"
                aria-label={t('newService.unsavedChangesIndicator')}
                title={t('newService.unsavedChangesIndicator')}
              />
            )}
          </Button>
          <Button
            appearance={isContinuing ? 'loading' : 'primary'}
            onClick={() => {
              if (isSaving) {
                useToastStore.getState().info({ title: t('overview.service.toast.cannotContinueUntilServiceIsSaved') });
                return;
              }
              setIsContinuing(true);
              useServiceStore
                .getState()
                .onContinueClick()
                .then(() => {
                  setIsContinuing(false);
                  continueOnClick();
                })
                .catch((error) => {
                  setIsContinuing(false);
                  console.error(error);
                });
            }}
            disabled={!name}
          >
            {t('global.confirm')}
          </Button>
        </Track>
      </header>
      {affectedServices && (
        <ReturnToDraftModal
          affectedServices={affectedServices}
          onCancel={() => setAffectedServices(null)}
          onConfirm={() => {
            setAffectedServices(null);
            void saveAsDraft();
          }}
          onOpenService={(serviceId) => {
            setAffectedServices(null);
            navigateToService(serviceId, navigate);
          }}
        />
      )}
      {isDeleteServiceModalVisible && (
        <Modal title={t('overview.popup.delete')} onClose={() => setIsDeleteServiceModalVisible(false)}>
          <Track justify="end" gap={16}>
            <Button appearance="secondary" onClick={() => setIsDeleteServiceModalVisible(false)}>
              {t('overview.cancel')}
            </Button>
            <Button
              appearance="error"
              onClick={() => {
                setIsDeleteServiceModalVisible(false);
                setIsDeleting(true);
                api
                  .post(deleteService(), {
                    id: selectedService?.serviceId,
                    type: selectedService?.type,
                  })
                  .then(() => {
                    navigate(ROUTES.OVERVIEW_ROUTE, { replace: true });
                    useServiceStore.getState().resetState();
                    setIsDeleting(false);
                  })
                  .catch((error) => {
                    setIsDeleting(false);
                    console.error(error);
                  });
              }}
            >
              {t('overview.delete')}
            </Button>
          </Track>
        </Modal>
      )}
    </>
  );
};

export default NewServiceHeader;
