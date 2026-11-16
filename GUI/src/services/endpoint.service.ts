/**
 * endpoint.service.ts
 *
 * Single common point for endpoint persistence (create & update).
 * Has NO dependency on any Zustand store — all context is passed explicitly.
 * Both the service-flow (via service-builder.ts) and API Registry store
 * call this service directly.
 */

import { createEndpoint, updateEndpoint } from 'resources/api-constants';
import api from 'services/api-dev';
import { EndpointData } from 'types/endpoint';

function normalizeEndpointVariableTypes(endpoint: EndpointData): void {
  for (const definition of endpoint.definitions ?? []) {
    for (const section of ['body', 'headers', 'params'] as const) {
      if (definition[section]?.variables) {
        for (const v of definition[section].variables) {
          if (!v.type || v.type === 'custom') v.type = 'STRING';
        }
      }
    }
  }
}

/**
 * Persists one or more endpoints.
 *
 * @param endpoints  Endpoints to save. Mutated in-place (isNew cleared, serviceId set).
 * @param serviceId  The service that owns these endpoints. Pass `''` for global/registry endpoints.
 * @returns          Indexing validation warning codes (e.g. VALIDATION_DESCRIPTION_MISSING). Saving
 *                   succeeded in that case, but LLM indexing was not started.
 */
export async function persistEndpoints(endpoints: EndpointData[], serviceId: string): Promise<string[]> {
  const tasks: Promise<any>[] = [];
  const indexWarnings: string[] = [];
  const collectIndexWarning = (res: any) => {
    const warning = res?.data?.response?.indexWarning;
    if (typeof warning === 'string' && warning) indexWarnings.push(warning);
  };

  for (const endpoint of endpoints) {
    const hasSelectedDefinition = endpoint.definitions.some((d) => d.isSelected);
    if (!hasSelectedDefinition) continue;

    normalizeEndpointVariableTypes(endpoint);

    if (endpoint.isNew) {
      tasks.push(
        api
          .post(createEndpoint(), {
            ...endpoint,
            serviceId,
            description: endpoint.description ?? '',
            definitions: JSON.stringify(endpoint.definitions),
          })
          .then((res) => {
            endpoint.isNew = false;
            collectIndexWarning(res);
          }),
      );
    } else {
      tasks.push(
        api
          .post(updateEndpoint(endpoint.endpointId), {
            ...endpoint,
            serviceId,
            description: endpoint.description ?? '',
            definitions: JSON.stringify(endpoint.definitions),
          })
          .then(collectIndexWarning),
      );
    }
  }

  await Promise.all(tasks);
  return indexWarnings;
}
