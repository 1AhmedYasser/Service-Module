import { ServiceState } from 'types';

const baseUrl = import.meta.env.REACT_APP_API_URL;

export const getOpenApiSpec = (): string => `${baseUrl}/services/open-api-spec`;
export const servicesRequestsExplain = (): string => `${baseUrl}/services/requests/explain`;
export const getSecretVariables = (): string => `${baseUrl}/secrets`;
export const getDomainFile = (): string => `${baseUrl}/internal/domain-file`;
export const getServiceSettings = (): string => `${baseUrl}/service-settings`;
export const saveServiceSettings = (): string => `${baseUrl}/service-settings`;
export const getTaraAuthResponseVariables = (): string => `${baseUrl}/user-info`;
export const getEndpointValidationMock = (): string => `${baseUrl}/mocks/validation-mock`;
export const getEndpointValidation = (): string => `${baseUrl}/services/endpoint-url-validation`;
export const deleteService = (): string => `${baseUrl}/services/delete`;
export const changeServiceStatus = (): string => `${baseUrl}/services/status`;
export const reindexService = (): string => `${baseUrl}/services/reindex-service`;
export const createNewService = (): string => `${baseUrl}/services/add`;
export const testService = (state: ServiceState, serviceName: string): string =>
  `${baseUrl}/services/${state.toLowerCase()}/${serviceName}`;
export const getNewNonce = (): string => `${baseUrl}/get-new-nonce`;
export const editService = (id: string): string => `${baseUrl}/services/edit?id=${id}`;
export const getServicesList = (): string => `${baseUrl}/services`;
export const getServicesOverview = (): string => `${baseUrl}/services/overview`;
export const pinService = (): string => `${baseUrl}/services/pin`;
export const unpinService = (): string => `${baseUrl}/services/unpin`;
export const getServiceDependencies = (): string => `${baseUrl}/services/dependencies`;
export const locateService = (): string => `${baseUrl}/services/locate`;
export const getNavigableServicesList = (): string => `${baseUrl}/navigable-services`;
export const getConnectionRequests = (): string => `${baseUrl}/services/connection-requests`;
export const getAvailableIntents = (): string => `${baseUrl}/services/available-intents`;
export const jsonToYml = (): string => `${baseUrl}/saveJsonToYml`;
export const getFaultyServices = (page: number, pageSize: number, sort: string, order: string): string =>
  `${baseUrl}/services/services-detailed/nok?page=${page}&page_size=${pageSize}&sort=${sort}&order=${order}`;
export const getServiceById = (): string => `${baseUrl}/service-by-id`;
export const createEndpoint = (): string => `${baseUrl}/services/create-endpoint`;
export const updateEndpoint = (id: string): string => `${baseUrl}/services/update-endpoint?id=${id}`;
export const deleteEndpoint = (): string => `${baseUrl}/services/delete-endpoint`;
export const getSlots = (): string => `${baseUrl}/slots`;
export const userStepPreferences = (): string => `${baseUrl}/steps/preferences`;
export const getAllEndpoints = (): string => `${baseUrl}/endpoints/all`;
export const testEndpointUrl = (): string => `${baseUrl}/services/test-endpoint`;
export const reindexEndpointUrl = (): string => `${baseUrl}/endpoints/reindex-endpoint`;
export const importMultipleServices = (): string => `${baseUrl}/services/import-services`;
export const checkImportNames = (): string => `${baseUrl}/services/check-import-names`;
