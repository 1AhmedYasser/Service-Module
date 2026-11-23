import { Node } from '@xyflow/react';
import { t } from 'i18next';
import { getNewNonce, testService } from 'resources/api-constants';
import useServiceStore, { ServiceStoreState } from 'store/new-services.store';
import useTestServiceStore from 'store/test-services.store';
import { NodeDataProps } from 'types/service-flow';
import { ServiceState } from 'types/service-state';
import { ServiceTestError } from 'types/service-test-error';
import { validateStep } from 'utils/flow-utils';
import { translateObjectKeys } from 'utils/i18n-util';
import { removeTrailingUnderscores, toSnakeCase } from 'utils/string-util';

import api, { createApiInstance } from './api';

interface ServiceResponse {
  response?: { content: string; buttons?: string }[];
  nextServiceTestError?: NextServiceTestError;
}

interface NextServiceTestError {
  serviceName: string;
  state: string;
}

const testRunBody = (input: string[]) => ({ input, testMode: true });

export const runServiceTest = async (input: string, serviceName?: string) => {
  const headerValue = validateTestEnvironment();
  if (!headerValue) {
    return;
  }

  const serviceData = getServiceTestData();
  if (!serviceData) {
    return;
  }

  const { state, name, serviceStore } = serviceData;

  // Clear previous test states first so stale testingPassed:false doesn't block re-runs
  clearPreviousTestStates(serviceStore);

  // Re-read fresh nodes from store after clearing (serviceStore.nodes is a stale snapshot)
  const invalidNodes = getInvalidNodes(useServiceStore.getState().nodes);
  if (invalidNodes.length > 0) {
    reportInvalidNodes(invalidNodes);
    return true;
  }

  const nameToUse = serviceName ?? name;
  const stateToUse = state == ServiceState.Ready ? ServiceState.Draft : state;

  try {
    const testNonce = await fetchNonce();
    await executeServiceTest(headerValue, stateToUse, nameToUse, input.split(','), testNonce);

    const runNonce = await fetchNonce();
    const response = await executeService(stateToUse, nameToUse, input.split(','), runNonce);

    if (response.data?.nextServiceTestError) {
      reportNextServiceTestError(response.data.nextServiceTestError);
      return;
    }

    addSuccessMessages(response.data);
  } catch (error) {
    handleTestError(error, serviceStore);
  }
};

export const fetchNonce = async (): Promise<string> => {
  const response = await api.get<string>(getNewNonce());
  return response.data;
};

export function getInvalidNodes(nodes: Node[]): { label: string; error: string }[] {
  const invalidNodes: { label: string; error: string }[] = [];

  nodes.forEach((node) => {
    // Skip start and ghost nodes as they don't need validation
    if (node.type === 'start' || node.type === 'ghost') return;

    const result = validateStep(node.data as NodeDataProps);
    if (!result.isValid) {
      invalidNodes.push({
        label: node.data.label as string,
        error: result.error as string,
      });
    }
  });

  return invalidNodes;
}

export function reportInvalidNodes(invalidNodes: { label: string; error: string }[]): void {
  const store = useTestServiceStore.getState();

  invalidNodes.forEach((node) => {
    store.addError('chat.service-test-error.invalidNode', {
      [t('chat.service-test-error.stepName')]: node.label,
      [t('chat.service-test-error.message')]: node.error,
    });
  });
}

export const validateTestEnvironment = (): string | null => {
  const headerValue = import.meta.env.REACT_APP_RUUTER_SERVICES_TESTING_HEADER;
  if (!headerValue) {
    console.error('runServiceTest: REACT_APP_RUUTER_SERVICES_TESTING_HEADER value is not set, not testing.');
    return null;
  }
  return headerValue;
};

const getServiceTestData = (): {
  state: ServiceState;
  name: string;
  serviceStore: ServiceStoreState;
} | null => {
  const serviceStore = useServiceStore.getState();
  const state = serviceStore.serviceState;
  const name = removeTrailingUnderscores(serviceStore.serviceNameDashed());

  if (!state) {
    // This should never happen, widget is hidden until state is set
    console.error('runServiceTest: Service state is not set, not testing.');
    return null;
  }

  return { state, name, serviceStore };
};

export const clearPreviousTestStates = (serviceStore: ServiceStoreState) => {
  serviceStore.setNodes((prevNodes) =>
    prevNodes.map((prevNode) => ({
      ...prevNode,
      data: {
        ...prevNode.data,
        testingPassed: true,
      },
    })),
  );
};

export const executeServiceTest = async (
  headerValue: string,
  state: ServiceState,
  name: string,
  input: string[],
  nonce: string,
) => {
  const testApi = createApiInstance({
    'x-ruuter-testing': headerValue,
    'x-ruuter-nonce': nonce,
  });
  return testApi.post(testService(state, name), testRunBody(input));
};

export const updateNodeTestState = (serviceStore: ServiceStoreState, nodeId: string, passed: boolean) => {
  serviceStore.setNodes((prevNodes) =>
    prevNodes.map((prevNode) => {
      if (prevNode.id !== nodeId) return prevNode;
      return {
        ...prevNode,
        data: {
          ...prevNode.data,
          testingPassed: passed,
        },
      };
    }),
  );
};

export const handleTestError = (error: unknown, serviceStore: ServiceStoreState) => {
  const store = useTestServiceStore.getState();

  if (hasResponseData(error)) {
    const errorData = error.response.data;
    if (isErrorResponse(errorData)) {
      console.error('runServiceTest: Service test error:', errorData);

      const node = serviceStore.nodes.find((node) => toSnakeCase(String(node.data.label ?? '')) === errorData.stepName);

      if (!node) {
        console.error('runServiceTest: Node not found:', errorData);
        store.addError('chat.unknown-error');
        return;
      }

      updateNodeTestState(serviceStore, node.id, false);

      const payload = translateError(errorData, node.data.label as string);
      store.addError('chat.service-test-error.title', payload);
    } else {
      console.error('runServiceTest: Unknown error response format:', errorData);
      store.addError('chat.unknown-error');
    }
  } else {
    console.error('runServiceTest: Network or other error:', error);
    store.addError('chat.unknown-error');
  }
};

export function isErrorResponse(response: unknown): response is ServiceTestError {
  return typeof response === 'object' && response !== null && 'causeCode' in response && 'message' in response;
}

export function hasResponseData(error: unknown): error is { response: { data: unknown } } {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response,
  );
}

export function translateError(error: ServiceTestError, nodeLabel: string): Record<string, string> {
  const translatedError: Record<string, string> = { ...error };
  translatedError.stepName = nodeLabel;

  let translatedCauseCode: string;
  switch (translatedError.causeCode) {
    case 'E_unknown':
      translatedCauseCode = 'chat.service-test-error.causeUnknown';
      break;
    case 'E_null':
      translatedCauseCode = 'chat.service-test-error.causeNull';
      break;
    case 'E_script':
      translatedCauseCode = 'chat.service-test-error.causeScript';
      break;
    default:
      translatedCauseCode = translatedError.causeCode;
  }

  translatedError.causeCode = translatedCauseCode;

  return translateObjectKeys(translatedError, 'chat.service-test-error');
}

export const executeService = async (state: ServiceState, name: string, input: string[], nonce: string) => {
  return api.post<ServiceResponse>(testService(state, name), testRunBody(input), {
    headers: { 'x-ruuter-nonce': nonce },
  });
};

export const reportNextServiceTestError = (error: NextServiceTestError): void => {
  const store = useTestServiceStore.getState();

  if (!error.serviceName) {
    store.addError('chat.next-service-test-error.missing');
    return;
  }

  store.addError('chat.next-service-test-error.unavailable', {
    [t('chat.next-service-test-error.serviceName')]: error.serviceName,
    [t('chat.next-service-test-error.state')]: error.state
      ? t(`overview.service.states.${error.state}`, { defaultValue: error.state })
      : t('chat.next-service-test-error.notFound'),
  });
};

export const addSuccessMessages = (responseData: ServiceResponse): void => {
  const res = responseData.response?.[0];
  const store = useTestServiceStore.getState();
  if (res) {
    store.addBotMessage(res.content, res.buttons);
  }
  store.addSuccess('chat.service-test-success');
};
