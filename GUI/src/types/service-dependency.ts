import { ServiceState } from './service-state';

export type ServiceDependencyDirection = 'incoming' | 'outgoing';

export interface ServiceDependency {
  readonly direction: ServiceDependencyDirection;
  readonly serviceId: string;
  readonly name: string;
  readonly state: ServiceState | null;
  readonly type: 'GET' | 'POST' | null;
  readonly deleted: boolean;
  readonly incomingCount: number;
  readonly outgoingCount: number;
}

export interface ServiceLocation {
  readonly serviceId: string;
  readonly pinned: boolean;
  readonly page: number | null;
}
