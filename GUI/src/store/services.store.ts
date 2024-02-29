import { create } from "zustand";
import axios from "axios";
import {
  changeIntentConnection,
  changeServiceStatus,
  deleteService as deleteServiceApi,
  getAvailableIntents,
  getConnectionRequests,
  getServicesList,
  requestServiceIntentConnection,
  respondToConnectionRequest,
} from "resources/api-constants";
import { Service, ServiceState } from "types";
import useToastStore from "./toasts.store";
import { Trigger } from "types/Trigger";
import { Intent } from "types/Intent";

interface ServiceStoreState {
  services: Service[];
  commonServices: Service[];
  notCommonServices: Service[];
  loadServicesList: () => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  selectedService: Service | undefined;
  setSelectedService: (service: Service) => void;
  changeServiceState: (
    onEnd: () => void,
    successMessage: string,
    errorMessage: string,
    activate: boolean,
    draft: boolean
  ) => Promise<void>;
  checkServiceIntentConnection: (onConnected: (response: Trigger) => void, onNotConnected: () => void) => Promise<void>;
  deleteSelectedService: (onEnd: () => void, successMessage: string, errorMessage: string) => Promise<void>;
  requestServiceIntentConnection: (
    onEnd: () => void,
    successMessage: string,
    errorMessage: string,
    intent: string
  ) => Promise<void>;
  loadRequestsList: (onEnd: (requests: Trigger[]) => void, errorMessage: string) => Promise<void>;
  loadAvailableIntentsList: (onEnd: (requests: Intent[]) => void, errorMessage: string) => Promise<void>;
  respondToConnectionRequest: (
    onEnd: () => void,
    successMessage: string,
    errorMessage: string,
    status: boolean,
    request: Trigger
  ) => Promise<void>;
  cancelConnectionRequest: (
    onEnd: () => void,
    successMessage: string,
    errorMessage: string,
    request: Trigger
  ) => Promise<void>;
}

const useServiceListStore = create<ServiceStoreState>((set, get, store) => ({
  services: [],
  commonServices: [],
  notCommonServices: [],
  loadServicesList: async () => {
    const result = await axios.get(getServicesList());
    const services = result.data.response.map(
      (item: any) =>
        ({
          id: item.id,
          name: item.name,
          description: item.description,
          state: item.state,
          type: item.type,
          isCommon: item.iscommon,
          serviceId: item.serviceId,
          usedCount: 0,
        } as Service)
    );

    set({
      services,
      commonServices: services.filter((e: Service) => e.isCommon === true),
      notCommonServices: services.filter((e: Service) => e.isCommon === false),
    });
  },
  deleteService: async (id) => {
    const services = get().services.filter((e: Service) => e.serviceId !== id);
    set({
      services,
      commonServices: services.filter((e: Service) => e.isCommon === true),
      notCommonServices: services.filter((e: Service) => e.isCommon === false),
    });
  },
  selectedService: undefined,
  setSelectedService: (service: Service) => {
    set({
      selectedService: service,
    });
  },
  changeServiceState: async (onEnd, successMessage, errorMessage, activate, draft) => {
    const selectedService = get().selectedService;
    console.log(selectedService);
    if (!selectedService) return;

    try {
      await axios.post(changeServiceStatus(), {
        id: selectedService.serviceId,
        state:
          selectedService.state === ServiceState.Active
            ? ServiceState.Inactive
            : selectedService.state === ServiceState.Draft
            ? ServiceState.Ready
            : selectedService.state === ServiceState.Ready && activate
            ? ServiceState.Active
            : selectedService.state === ServiceState.Inactive && !draft
            ? ServiceState.Active
            : ServiceState.Draft,
        type: selectedService.type,
      });
      useToastStore.getState().success({ title: successMessage });
      await useServiceListStore.getState().loadServicesList();
    } catch (_) {
      useToastStore.getState().error({ title: errorMessage });
    }
    set({
      selectedService: undefined,
    });
    onEnd();
  },
  checkServiceIntentConnection: async (onConnected, onNotConnected) => {
    const selectedService = get().selectedService;
    if (!selectedService) return;

    try {
      const res = await axios.post(changeIntentConnection(), {
        serviceId: selectedService.serviceId,
      });
      if (res.data.response) {
        onConnected(res.data.response);
      } else {
        onNotConnected();
      }
    } catch (_) {
      onNotConnected();
    }
  },
  deleteSelectedService: async (onEnd, successMessage, errorMessage) => {
    const selectedService = get().selectedService;
    if (!selectedService) return;

    try {
      await axios.post(deleteServiceApi(), {
        id: selectedService?.serviceId,
        type: selectedService?.type,
      });
      useToastStore.getState().success({ title: successMessage });
      await useServiceListStore.getState().deleteService(selectedService.serviceId);
    } catch (_) {
      useToastStore.getState().error({ title: errorMessage });
    }
    set({
      selectedService: undefined,
    });
    onEnd();
  },
  requestServiceIntentConnection: async (onEnd, successMessage, errorMessage, intent) => {
    const selectedService = get().selectedService;
    if (!selectedService) return;

    try {
      await axios.post(requestServiceIntentConnection(), {
        serviceId: selectedService.serviceId,
        serviceName: selectedService.name,
        intent: intent,
      });
      useToastStore.getState().success({ title: successMessage });
    } catch (_) {
      useToastStore.getState().error({ title: errorMessage });
    }
    onEnd();
  },
  loadRequestsList: async (onEnd, errorMessage) => {
    try {
      const requests = await axios.get(getConnectionRequests());
      onEnd(requests.data.response);
    } catch (_) {
      onEnd([]);
      useToastStore.getState().error({ title: errorMessage });
    }
  },
  loadAvailableIntentsList: async (onEnd, errorMessage) => {
    try {
      const requests = await axios.get(getAvailableIntents());
      onEnd(requests.data.response);
    } catch (_) {
      onEnd([]);
      useToastStore.getState().error({ title: errorMessage });
    }
  },
  respondToConnectionRequest: async (onEnd, successMessage, errorMessage, status, request) => {
    try {
      await axios.post(respondToConnectionRequest(), {
        serviceId: request.service,
        serviceName: request.serviceName,
        intent: request.intent,
        authorRole: request.authorRole,
        status: status === true ? "approved" : "declined",
      });
      useToastStore.getState().success({ title: successMessage });
    } catch (_) {
      useToastStore.getState().error({ title: errorMessage });
    }
    onEnd();
  },
  cancelConnectionRequest: async (onEnd, successMessage, errorMessage, request) => {
    try {
      await axios.post(respondToConnectionRequest(), {
        serviceId: request.service,
        serviceName: request.serviceName,
        intent: request.intent,
        authorRole: request.authorRole,
        status: "deleted",
      });
      useToastStore.getState().success({ title: successMessage });
    } catch (_) {
      useToastStore.getState().error({ title: errorMessage });
    }
    onEnd();
  },
}));

export default useServiceListStore;
