import { DEFAULT_SERVICES_FILTERS, ServicesFilters } from 'store/services.store';
import { ServiceState } from 'types';

export const STATUS_FILTER_OPTIONS: ServiceState[] = [ServiceState.Draft, ServiceState.Ready, ServiceState.Active];

export const DEPENDENCY_FILTER_OPTIONS: ServicesFilters['dependencies'][] = ['all', 'yes', 'no', 'problematic'];

export const hasActiveFilters = (filters: ServicesFilters) =>
  filters.search !== DEFAULT_SERVICES_FILTERS.search ||
  filters.state !== DEFAULT_SERVICES_FILTERS.state ||
  filters.dependencies !== DEFAULT_SERVICES_FILTERS.dependencies;
