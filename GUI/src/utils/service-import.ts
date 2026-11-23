import i18n from 'i18n';
import { t } from 'i18next';
import { ChangeEvent } from 'react';
import { importMultipleServices } from 'resources/api-constants';
import api from 'services/api';
import { buildAllServiceContents } from 'services/service-builder';
import useServiceListStore from 'store/services.store';
import useToastStore from 'store/toasts.store';
import { isValidFlowData, parseFlowArtifact, serializeFlowArtifact } from 'utils/service-flow-artifact';

const handleImportServices = async (
  event: ChangeEvent<HTMLInputElement>,
): Promise<{
  validFiles: Array<{
    fileName: string;
    flowData: string;
    content: any;
    subServices: Array<{ suffix: string; content: any }>;
  }>;
  corruptedFiles: string[];
}> => {
  const files = event.target.files;
  if (!files) return { validFiles: [], corruptedFiles: [] };

  const validFiles: Array<{
    fileName: string;
    flowData: string;
    content: any;
    subServices: Array<{ suffix: string; content: any }>;
  }> = [];
  const corruptedFiles: string[] = [];

  const fileProcessingPromises = Array.from(files).map(async (file) => {
    const rawName = file.name.replaceAll(/\s+/g, '_').replace(/\.[^/.]+$/, '');
    const name = rawName.replace(/(_\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2})+$/, '');
    try {
      const content = await file.text();
      const { nodes, edges, settings } = parseFlowArtifact(content);

      if (!isValidFlowData({ nodes, edges })) {
        throw new Error('Invalid flow data structure');
      }

      const result = buildAllServiceContents(
        nodes as Parameters<typeof buildAllServiceContents>[0],
        edges,
        name,
        settings?.description ?? '',
      );

      validFiles.push({
        fileName: result.name,
        flowData: serializeFlowArtifact(nodes, edges, settings),
        content: result.content,
        subServices: result.subServices,
      });
    } catch (error) {
      corruptedFiles.push(name);
      console.error(`Error processing file ${name}:`, error);
    }
  });

  await Promise.all(fileProcessingPromises);

  return { validFiles, corruptedFiles };
};

export const importServices = async (event: ChangeEvent<HTMLInputElement>) => {
  const { validFiles, corruptedFiles } = await handleImportServices(event);

  if (corruptedFiles.length > 0) {
    useToastStore.getState().error({
      title: t('global.notificationError'),
      message: t('overview.import.importFailure', { files: corruptedFiles.join(', ') }),
    });
  }

  if (validFiles.length > 0) {
    api
      .post(importMultipleServices(), {
        services: validFiles,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      .then(async () => {
        const lengthCheck = i18n.language === 'en' ? 's' : 'ed';
        useToastStore.getState().success({
          title: t('newService.toast.success'),
          message: t('overview.import.importSuccess', {
            count: validFiles.length,
            lengthCheck: validFiles.length === 1 ? '' : lengthCheck,
          }),
        });
        const store = useServiceListStore.getState();
        await store.loadServicesList(store.servicesPagination, store.servicesSorting);
      })
      .catch((error) => {
        console.error('Error importing services:', error);
        useToastStore.getState().error({
          title: t('global.notificationError'),
          message: t('overview.import.failedToImport'),
        });
      });
  }

  event.target.value = '';
};
