import { Chip } from 'types/chip';

export type EndpointResponseVariable = {
  name: string;
  nodeId: string;
  resultName?: string;
  response?: unknown;
  chips: Chip[];
};
