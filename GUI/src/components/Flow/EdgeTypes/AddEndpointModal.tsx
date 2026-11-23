import { ApiEndpointCard, Button, Modal, Track } from 'components';
import { TestPayload } from 'components/ApiEndpointCard/Endpoints/Custom';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAllEndpoints, testEndpointUrl } from 'resources/api-constants';
import api from 'services/api-dev';
import { persistEndpoints } from 'services/endpoint.service';
import useApiRegistryStore, { showIndexValidationToast } from 'store/api-registry.store';
import useServiceStore from 'store/new-services.store';
import useToastStore from 'store/toasts.store';
import { v4 as uuid } from 'uuid';

import { EndpointData } from '../../../types/endpoint/endpoint-data';

interface AddEndpointModalProps {
  onClose: () => void;
  /** Called after a successful save (create or edit) */
  onSaveSuccess?: () => void;
  /** Service-flow create: update the edge's endpoint preference list */
  onUpdatePreferences?: (endpointIds: string[]) => void;
  /** Service-flow create: current endpoint ids on this edge */
  currentEndpointIds?: string[];
  /** 'create' (default) or 'edit' */
  mode?: 'create' | 'edit';
  /** 'service' (default) or 'registry' */
  context?: 'service' | 'registry';
  /** Edit mode: the endpoint to pre-fill*/
  initialEndpoint?: EndpointData;
}

const AddEndpointModal: React.FC<AddEndpointModalProps> = ({
  onClose,
  onSaveSuccess,
  onUpdatePreferences,
  currentEndpointIds,
  mode = 'create',
  context = 'service',
  initialEndpoint,
}) => {
  const { t } = useTranslation();

  const [endpoint] = useState<EndpointData>(() => {
    if (mode === 'edit' && initialEndpoint) {
      return structuredClone(initialEndpoint);
    }
    return { endpointId: uuid(), name: '', definitions: [], isNew: true };
  });

  const [endpointName, setEndpointName] = useState(mode === 'edit' && initialEndpoint ? initialEndpoint.name : '');
  const [endpointNameExists, setEndpointNameExists] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasTestedUrl, setHasTestedUrl] = useState(
    mode === 'edit' && (initialEndpoint?.type === 'custom' || initialEndpoint?.type === 'openApi'),
  );
  const [endpointType, setEndpointType] = useState<string>(initialEndpoint?.type ?? '');
  const [endpointDescription, setEndpointDescription] = useState(
    mode === 'edit' && initialEndpoint ? (initialEndpoint.description ?? '') : '',
  );
  const [hasMandatoryViolation, setHasMandatoryViolation] = useState(false);
  const lastTestPayload = useRef<TestPayload | null>(null);

  // Registry-specific: async debounced name check (paginated store can't do this synchronously)
  const [registryNameExists, setRegistryNameExists] = useState(false);
  const [registryNameChecking, setRegistryNameChecking] = useState(false);

  useEffect(() => {
    if (context !== 'registry' || !endpointName) {
      setRegistryNameExists(false);
      setRegistryNameChecking(false); // reset if name was cleared mid-check
      return;
    }
    setRegistryNameChecking(true);
    const timer = setTimeout(async () => {
      try {
        const result = await api.post(getAllEndpoints(), {
          page: 1,
          page_size: 50,
          sorting: 'name asc',
          search: endpointName,
          pagination: false,
        });
        const rows: any[] = result.data?.response ?? [];
        // Exact-match check; exclude self when editing
        const exists = rows.some((row) => row.name === endpointName && row.endpointId !== endpoint.endpointId);
        setRegistryNameExists(exists);
      } catch {
        setRegistryNameExists(false);
      } finally {
        setRegistryNameChecking(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [endpointName, context, endpoint.endpointId]);

  const effectiveNameExists = context === 'registry' ? registryNameExists : endpointNameExists;

  const handleClose = () => {
    onClose();
  };

  const handleSave = () => {
    const passedEndpoint = endpoint;
    passedEndpoint.name = endpointName;

    const hasSelectedDefinition = passedEndpoint.definitions.some((d) => d.isSelected);
    if (!hasSelectedDefinition) {
      useToastStore.getState().error({ title: t('newService.endpoint.noEndpointSelected') });
      return;
    }

    setIsSaving(true);

    // Validate params before saving
    const allParams = passedEndpoint.definitions.flatMap((d) => d.params?.variables ?? []);
    const descriptionViolation = allParams.filter((p) => p.name).some((p) => !p.description);
    if (descriptionViolation) {
      useToastStore.getState().error({ title: t('newService.endpoint.nameTypeDescriptionRequired') });
      setIsSaving(false);
      return;
    }
    const mandatoryViolation = allParams.some((p) => p.mandatory && (!p.name || !p.value));
    if (mandatoryViolation) {
      useToastStore.getState().error({ title: t('newService.endpoint.mandatoryNameValueRequired') });
      setIsSaving(false);
      return;
    }
    // Block save if any PATH parameter has no value
    const missingPathParam = allParams.find((p) => p.paramType === 'path' && !p.value?.trim());
    if (missingPathParam) {
      useToastStore
        .getState()
        .error({ title: t('newService.endpoint.missingPathParam', { name: missingPathParam.name }) });
      setIsSaving(false);
      return;
    }

    // Resolve serviceId: service-flow gets it from the store; registry preserves the
    // endpoint's own serviceId (edit) or uses empty string (create).
    const serviceId = context === 'service' ? useServiceStore.getState().serviceId : (passedEndpoint.serviceId ?? '');

    persistEndpoints([passedEndpoint], serviceId)
      .then(async (indexWarnings) => {
        // Saved, but LLM indexing was not started (e.g. missing description)
        indexWarnings.forEach(showIndexValidationToast);
        // For custom and openApi endpoints in registry context, call testEndpointUrl to persist response_schema to DB
        if (
          context === 'registry' &&
          (passedEndpoint.type === 'custom' || passedEndpoint.type === 'openApi') &&
          lastTestPayload.current
        ) {
          try {
            await api.post(testEndpointUrl(), {
              endpointId: passedEndpoint.endpointId,
              request: lastTestPayload.current.request,
            });
          } catch {
            // Non-fatal: schema capture failure should not block save success
          }
        }
        // Update local store state after successful persist
        if (context === 'registry') {
          if (mode === 'create') {
            useApiRegistryStore.getState().addEndpointAfterCreate(passedEndpoint);
          } else {
            useApiRegistryStore.getState().updateEndpointInList(passedEndpoint);
          }
        } else if (mode === 'create') {
          useServiceStore.getState().addEndpoint(passedEndpoint);
          const newEndpointIds = [...(currentEndpointIds ?? []), passedEndpoint.endpointId];
          onUpdatePreferences?.(newEndpointIds);
        } else {
          useServiceStore.getState().editEndpoint(passedEndpoint);
        }
        const successKey =
          mode === 'create' ? 'serviceFlow.apiElements.createSuccess' : 'serviceFlow.apiElements.editSuccess';
        useToastStore.getState().success({ title: t(successKey) });
        setIsSaving(false);
        onSaveSuccess?.();
        onClose();
      })
      .catch((error) => {
        console.error(`Error saving API endpoint: ${error}`);
        const errorKey =
          mode === 'create' ? 'serviceFlow.apiElements.createError' : 'serviceFlow.apiElements.editError';
        useToastStore.getState().error({ title: t(errorKey) });
        setIsSaving(false);
      });
  };

  const modalTitle = mode === 'edit' ? t('newService.editEndpoint') : t('newService.createNewEndpoint');

  return (
    <Modal title={modalTitle} onClose={handleClose} size="large">
      <Track isMultiline gap={16} direction="vertical" align="stretch">
        <ApiEndpointCard
          endpoint={endpoint}
          onNameExists={context === 'registry' ? undefined : setEndpointNameExists}
          onNameChange={setEndpointName}
          overrideNameExists={context === 'registry' ? registryNameExists : undefined}
          onTestSuccess={(payload) => {
            setHasTestedUrl(true);
            lastTestPayload.current = payload;
          }}
          onTypeChange={(type) => {
            setEndpointType(type);
            setHasTestedUrl(false);
            lastTestPayload.current = null;
          }}
          onDescriptionChange={setEndpointDescription}
          onMandatoryViolationChange={setHasMandatoryViolation}
        />
        <Track justify="end" gap={16}>
          <Button appearance="secondary" onClick={handleClose}>
            {t('overview.cancel')}
          </Button>
          <Button
            appearance={isSaving ? 'loading' : 'primary'}
            disabled={
              endpointName === '' ||
              effectiveNameExists ||
              registryNameChecking ||
              hasMandatoryViolation ||
              ((endpointType === 'custom' || endpointType === 'openApi') && !hasTestedUrl) ||
              ((endpointType === 'custom' || endpointType === 'openApi') && endpointDescription === '')
            }
            onClick={handleSave}
          >
            {t('global.save')}
          </Button>
        </Track>
      </Track>
    </Modal>
  );
};

export default AddEndpointModal;
