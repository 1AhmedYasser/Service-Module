import { create } from 'zustand';
import { EndpointData, PreDefinedEndpointEnvVariables } from 'types/endpoint';
import { v4 as uuid } from "uuid";
import axios from 'axios';
import { getSecretVariables, getTaraAuthResponseVariables } from 'resources/api-constants';
import { Node } from "reactflow";

interface ServiceState {
  flow: string | undefined;
  endpoints: EndpointData[];
  serviceName: string;
  serviceId: string;
  description: string;
  isCommon: boolean;
  secrets: PreDefinedEndpointEnvVariables;
  availableVariables: PreDefinedEndpointEnvVariables;
  deleteEndpoint: (id: string) => void;
  setIsCommon: (isCommon: boolean) => void;
  setDescription: (description: string) => void;
  setSecrets: (newSecrets: PreDefinedEndpointEnvVariables) => void;
  addProductionVariables: (variables: string[]) => void,
  addTestVariables: (variables: string[]) => void,
  changeServiceName: (name: string) => void;
  addEndpoint: () => void;
  loadSecretVariables: () => Promise<void>;
  loadTaraVariables: () => Promise<void>;
  loadFlowData: () => Promise<void>;
  getAvailableRequestValues: (endpointId: string) => PreDefinedEndpointEnvVariables;
  onNameChange: (endpointId: string, oldName: string, newName: string) => void;
  changeServiceEndpointType: (id: string, type: string) => void;
  setEndpoints: (callback: (prev: EndpointData[]) => EndpointData[]) => void;
}

const useServiceStore = create<ServiceState>((set, get, store) => ({
  flow: undefined,
  endpoints: [],
  serviceName: '',
  serviceId: uuid(),
  description: '',
  isCommon: false,
  secrets: { prod: [], test: [] },
  availableVariables: { prod: [], test: [] },
  deleteEndpoint: (id: string) => {
    const newEndpoints = get().endpoints.filter((x) => x.id !== id);
    set({ endpoints: newEndpoints });
  },
  changeServiceName: (name: string) => set({ serviceName: name }),
  setDescription: (description: string) => set({ description }),
  setIsCommon: (isCommon: boolean) => set({ isCommon }),
  setSecrets: (newSecrets: PreDefinedEndpointEnvVariables) => set({ secrets: newSecrets }),
  addProductionVariables: (variables: any) => {
    set(state => ({
      availableVariables: {
        prod: [ ...variables, ...state.availableVariables.prod ],
        test: state.availableVariables.test,
      }
    }))
  },
  addTestVariables: (variables: any) => {
    const prevVariables = get().availableVariables;
    set({
      availableVariables: {
        prod: prevVariables.prod,
        test: [ ...variables, ...prevVariables.test ],
      }
    })
  },
  addEndpoint: () => {
    const newEndpoint = { id: uuid(), name: "", definedEndpoints: [] };
    set(state => ({ endpoints:[ ...state.endpoints, newEndpoint] }));
  },

  loadFlowData: async () => {
    let nodes: Node[] = [];
    if(get().flow) {
      nodes = JSON.parse(get().flow!)?.nodes;
    }

    await get().loadSecretVariables();
    
    if (nodes?.find((node) => node.data.stepType === "auth")) {
      await get().loadTaraVariables();
    }

    const variables = nodes?.filter((node) => node.data.stepType === "input")
      .map((node) => `{{ClientInput_${node.data.clientInputId}}}`);
    get().addProductionVariables(variables);
  },
  loadSecretVariables: async () => {
    const result = await axios.get(getSecretVariables());
    const data: { prod: string[]; test: string[] } = result.data;
    data.prod = data.prod.map((v) => `{{${v}}}`);
    data.test = data.test.filter(x => !data.prod.includes(x)).map((v) => `{{${v}}}`);
    
    if (!data) return;

    if (Object.keys(get().secrets).length === 0) {
      get().setSecrets(data);
    }

    get().addProductionVariables(data.prod);
    get().addTestVariables(data.test);
  },
  loadTaraVariables: async () => {
    const result = await axios.post(getTaraAuthResponseVariables());
    const data: { [key: string]: any } = result.data?.response?.body ?? {};
    const taraVariables = Object.keys(data).map(key => `{{TARA.${key}}}`);
    get().addProductionVariables(taraVariables);
  },
  getAvailableRequestValues: (endpointId: string) => {
    const variables = get().endpoints
      .filter(endpoint => endpoint.id !== endpointId)
      .map(endpoint => ({
        id: endpoint.id,
        name: endpoint.name,
        response: endpoint.definedEndpoints.find(x => x.isSelected)?.response ?? [],
      }))
      .flatMap(({id, name, response}) => response?.map(x => `{{${name === "" ? id : name}.${x.name}}}`));

    return {
        prod: [ ...variables, ...get().availableVariables.prod ],
        test: get().availableVariables.test,
    };
  },
  onNameChange: (endpointId: string, oldName: string, newName: string) => {
    const endpoint = get().endpoints.find(x => x.id === endpointId);
    const response = endpoint?.definedEndpoints.find(x => x.isSelected)?.response ?? [];
    const variables = response.map(x => `{{${newName === "" ? x.id : newName}.${x.name}}}`);

    const oldFilteredVariables = get().availableVariables.prod.filter((v) => v.replace("{{", "").split(".")[0] !== oldName);

    set(state => ({
      availableVariables: {
        prod: [ ...variables, ...oldFilteredVariables ],
        test: state.availableVariables.test,
      }
    }));
  },
  changeServiceEndpointType: (id: string, type: string) => {
    const endpoints = get().endpoints.map(x => {
      if(x.id !== id) return x;
      return {
        ...x,
        type,
        definedEndpoints: [],
      }
    });

    set({ endpoints });
  },

  setEndpoints: (callback) => {
    set(state => ({
      endpoints: callback(state.endpoints)
    }));
  },
}));

export default useServiceStore;
