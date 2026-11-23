import { buildExplainRequest } from 'store/new-services.store';

import { servicesRequestsExplain } from '../resources/api-constants';
import api from '../services/api-dev';
import { EndpointDefinition } from '../types/endpoint';

/**
 * Normalises a raw `response_schema` value from the backend into a pretty-printed JSON string.
 * Handles three shapes:
 *  - PostgreSQL JSONB descriptor  { type: 'jsonb', value: '...', null: false }
 *  - Plain JSON string            '{"data":[...]}'
 *  - Parsed JSON object/array     { data: [...] }
 */
export function formatSchema(schema: unknown): string | undefined {
  if (!schema) return undefined;
  // Unwrap PostgreSQL JSONB descriptor
  const raw = (schema as any)?.type === 'jsonb' ? (schema as any).value : schema;
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    try {
      return JSON.stringify(JSON.parse(raw), undefined, 4);
    } catch {
      return raw;
    }
  }
  return JSON.stringify(raw, undefined, 4);
}

export const generateJsonRequest = async (endpoint: EndpointDefinition) => {
  try {
    const response = await api.post(servicesRequestsExplain(), {
      requests: [buildExplainRequest(endpoint)],
    });
    return response.data.response;
  } catch (error) {
    console.error('Error generating JSON request: ', error);
    throw error;
  }
};
