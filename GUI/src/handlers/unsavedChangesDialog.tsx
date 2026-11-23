import { Button, Modal, Track } from 'components';
import { t } from 'i18next';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useServiceStore from 'store/new-services.store';

export default function UnsavedChangesDialog() {
  const nextLocation = useServiceStore((state) => state.nextLocation);
  const proceedNavigation = useServiceStore((state) => state.proceedNavigation);
  const cancelNavigation = useServiceStore((state) => state.cancelNavigation);
  const canDiscardNavigation = useServiceStore((state) => state.canDiscardNavigation);
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  if (!nextLocation) return null;

  const goToNextLocation = () => {
    const nextLocation = proceedNavigation();
    if (nextLocation) {
      navigate(nextLocation, { replace: true });
      useServiceStore.getState().resetState();
    }
  };

  return (
    <Modal title={t('newService.popup.unsavedChanges')} onClose={() => {}}>
      <Track gap={10} align="center" justify="end">
        <Button appearance="secondary" onClick={cancelNavigation}>
          {t('global.cancel')}
        </Button>
        {canDiscardNavigation && (
          <Button appearance="primary" onClick={goToNextLocation}>
            {t('global.continue')}
          </Button>
        )}
        <Button
          appearance={isSaving ? 'loading' : 'primary'}
          onClick={async () => {
            setIsSaving(true);
            try {
              const beforeSave = useServiceStore.getState().beforeNavigationSave;
              if (beforeSave) {
                useServiceStore.setState({ beforeNavigationSave: null });
                beforeSave();
              }
              await useServiceStore.getState().onServiceSave('draft', false);
              goToNextLocation();
            } catch (error) {
              console.error(error);
            } finally {
              setIsSaving(false);
            }
          }}
        >
          {t('newService.popup.saveAndContinue')}
        </Button>
      </Track>
    </Modal>
  );
}
