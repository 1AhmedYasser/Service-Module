import { EndpointDefinition } from './endpoint-definition';
import { EndpointType } from './endpoint-type';

export type EndpointData = {
  endpointId: string;
  name: string;
  fileName?: string;
  type?: EndpointType;
  isNew?: boolean;
  hasTestEnv?: boolean;
  serviceId?: string;
  description?: string;
  definitions: EndpointDefinition[];
  responseSchema?: string;
  llm_index_status?: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' | null;
  llm_index_failure_reason?: string | null;
  llm_index_attempt_no?: number | null;
};
