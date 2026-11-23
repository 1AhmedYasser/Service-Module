import { FC } from 'react';
import { ServiceState } from 'types';

import ServiceStatusChip from './ServiceStatusChip';

const CHANGEABLE_STATES: ReadonlyArray<ServiceState | 'deleted'> = [
  ServiceState.Draft,
  ServiceState.Ready,
  ServiceState.Active,
];

type ServiceStatusButtonProps = {
  readonly state: ServiceState | 'deleted';
  readonly isLoading: boolean;
  readonly onClick: () => void;
};

const ServiceStatusButton: FC<ServiceStatusButtonProps> = ({ state, isLoading, onClick }) => (
  <button
    type="button"
    className="services-table__status-button"
    disabled={isLoading || !CHANGEABLE_STATES.includes(state)}
    onClick={onClick}
  >
    <ServiceStatusChip state={state} isLoading={isLoading} />
  </button>
);

export default ServiceStatusButton;
