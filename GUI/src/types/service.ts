import { EndpointData } from './endpoint';
import { ServiceState } from './service-state';

export type EndpointDefinitionJson = {
  type: string;
  value: string;
  null: boolean;
};

export type ServiceIndexStatus = 'SUCCESS' | 'IN_PROGRESS' | 'FAILED';

export interface Service {
  readonly id: number;
  readonly name: string;
  readonly state: ServiceState;
  readonly type: 'GET' | 'POST';
  readonly description?: string;
  readonly slot: string;
  readonly examples: string[];
  readonly entities: string[];
  readonly discoverable?: boolean;
  readonly structure?: { value: string };
  readonly endpoints: Array<
    Pick<EndpointData, 'endpointId' | 'name' | 'type' | 'fileName'> & {
      // Passing as JSON from Resql because ruuter cannot handle parsing properly
      definitions: EndpointDefinitionJson;
    }
  >;
  readonly serviceId: string;
  readonly totalPages: number;
  readonly totalCount?: number;
  readonly indexStatus?: ServiceIndexStatus | null;
  readonly indexFailureReason?: string | null;
  readonly indexAttemptNo?: number | null;
  readonly incomingCount?: number;
  readonly outgoingCount?: number;
  readonly problemCount?: number;
  readonly isPinned?: boolean;
}
