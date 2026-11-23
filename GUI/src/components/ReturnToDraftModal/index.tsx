import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { AffectedService } from 'utils/service-draft-return';

import Button from '../Button';
import Modal from '../Modal';
import ServiceStatusChip from '../ServicesTable/ServiceStatusChip';

import './ReturnToDraftModal.scss';

type ReturnToDraftModalProps = {
  readonly affectedServices: AffectedService[];
  readonly cancelLabel?: string;
  readonly confirmLabel?: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly onOpenService: (serviceId: string) => void;
};

const ReturnToDraftModal: FC<ReturnToDraftModalProps> = ({
  affectedServices,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  onOpenService,
}) => {
  const { t } = useTranslation();
  const hasAffectedServices = affectedServices.length > 0;

  return (
    <Modal
      title={t(hasAffectedServices ? 'overview.popup.returnToDraft.title' : 'overview.popup.setToDraftConfirm.message')}
      onClose={onCancel}
      footer={
        <>
          <Button appearance="secondary" onClick={onCancel}>
            {cancelLabel ?? t('overview.popup.returnToDraft.cancel')}
          </Button>
          <Button appearance="primary" onClick={onConfirm}>
            {confirmLabel ?? t('overview.popup.returnToDraft.confirm')}
          </Button>
        </>
      }
    >
      {hasAffectedServices && (
        <>
          <p className="affected-services__description">{t('overview.popup.returnToDraft.description')}</p>
          <ul className="affected-services">
            {affectedServices.map((service) => (
              <li key={service.serviceId}>
                <button
                  type="button"
                  className="affected-services__item"
                  onClick={() => onOpenService(service.serviceId)}
                >
                  <strong>{service.name}</strong>
                  <ServiceStatusChip state={service.state} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
};

export default ReturnToDraftModal;
