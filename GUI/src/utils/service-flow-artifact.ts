import { Edge, Node } from '@xyflow/react';
import useServiceStore from 'store/new-services.store';
import { Service } from 'types';
import { FlowData, NodeDataProps, ServiceExportSettings } from 'types/service-flow';
import { sanitizeFlowNodes } from 'utils/flow-response-data';

export const isValidFlowData = (data: unknown): data is FlowData =>
  !!data &&
  typeof data === 'object' &&
  Array.isArray((data as FlowData).nodes) &&
  Array.isArray((data as FlowData).edges);

export const buildServiceSettings = (service: {
  name?: string;
  description?: string;
  examples?: string[];
  entities?: string[];
  discoverable?: boolean;
}): ServiceExportSettings => ({
  title: service.name ?? '',
  description: service.description ?? '',
  examples: service.examples ?? [],
  keywords: service.entities ?? [],
  discoverable: service.discoverable ?? false,
});

export const buildServiceSettingsFromStore = (): ServiceExportSettings =>
  buildServiceSettings({
    name: useServiceStore.getState().name,
    description: useServiceStore.getState().description,
    examples: useServiceStore.getState().examples,
    entities: useServiceStore.getState().entities,
    discoverable: useServiceStore.getState().discoverable,
  });

export const applyServiceSettings = (settings?: ServiceExportSettings) => {
  if (!settings) return;

  const store = useServiceStore.getState();
  if (settings.title) store.changeServiceName(settings.title);
  if (settings.description !== undefined) store.setDescription(settings.description);
  if (settings.examples !== undefined) store.setExamples(settings.examples);
  if (settings.keywords !== undefined) store.setEntities(settings.keywords);
  store.setDiscoverable(false);
};

export const serializeFlowArtifact = (
  nodes: Node<NodeDataProps>[] | Node[],
  edges: Edge[],
  settings?: ServiceExportSettings,
): string => JSON.stringify({ nodes: sanitizeFlowNodes(nodes as Node[]), edges, ...(settings ? { settings } : {}) });

export const parseFlowArtifact = (
  content: string,
): { nodes: FlowData['nodes']; edges: FlowData['edges']; settings?: ServiceExportSettings } => {
  const parsed = JSON.parse(content) as FlowData;
  const nodes = Array.isArray(parsed.nodes) ? sanitizeFlowNodes(parsed.nodes) : parsed.nodes;
  return { nodes, edges: parsed.edges, settings: parsed.settings };
};

export const buildExportPayloadFromService = (service: Service): string => {
  const parsed = JSON.parse(service.structure?.value ?? '{}') as FlowData;
  const nodes = parsed.nodes ?? [];
  const edges = parsed.edges ?? [];
  return serializeFlowArtifact(nodes, edges, buildServiceSettings(service));
};
