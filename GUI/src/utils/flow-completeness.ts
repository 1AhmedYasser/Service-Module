import { Edge, Node } from '@xyflow/react';
import { StepType } from 'types';
import { JumpToService } from 'types/jump-to-service';
import { getEndpointResultName } from 'utils/flow-utils';

export interface FlowCompletenessResult {
  readonly isComplete: boolean;
  readonly unconnectedNodeIds: ReadonlySet<string>;
  readonly unfinishedEdgeIds: ReadonlySet<string>;
  readonly unresolvedJumpToServiceNodeIds: ReadonlySet<string>;
  readonly unresolvedEndpointReferenceNodeIds: ReadonlySet<string>;
}

const ENDPOINT_RESULT_REFERENCE_RE = /(?<!\w)(\w+_res)\.response\b/g;
const INTERNAL_RESULT_NAMES = ['dynamic_choices_res'];

const collectStrings = (value: unknown, strings: string[] = []): string[] => {
  if (typeof value === 'string') strings.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, strings));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectStrings(item, strings));
  return strings;
};

const getUnresolvedEndpointReferenceNodeIds = (nodes: Node[]): Set<string> => {
  const resultNames = new Set([
    ...INTERNAL_RESULT_NAMES,
    ...nodes
      .filter((node) => node.data?.stepType === StepType.UserDefined)
      .map((node) => getEndpointResultName(node, nodes)),
  ]);

  return new Set(
    nodes
      .filter((node) => node.type === 'custom')
      .filter((node) =>
        collectStrings(node.data).some((text) =>
          [...text.matchAll(ENDPOINT_RESULT_REFERENCE_RE)].some(([, name]) => !resultNames.has(name)),
        ),
      )
      .map((node) => node.id),
  );
};

const getReachableNodeIds = (nodes: Node[], edges: Edge[]): Set<string> => {
  const startNode = nodes.find((node) => node.type === 'start');
  const reachableNodeIds = new Set<string>();
  if (!startNode) return reachableNodeIds;

  const queue = [startNode.id];
  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    if (reachableNodeIds.has(currentId)) continue;
    reachableNodeIds.add(currentId);
    edges.forEach((edge) => {
      if (edge.source === currentId) queue.push(edge.target);
    });
  }

  return reachableNodeIds;
};

export const validateFlowCompleteness = (
  nodes: Node[],
  edges: Edge[],
  navigableServices: Map<string, string>,
): FlowCompletenessResult => {
  const reachableNodeIds = getReachableNodeIds(nodes, edges);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  const unconnectedNodeIds = new Set(
    nodes.filter((node) => node.type === 'custom' && !reachableNodeIds.has(node.id)).map((node) => node.id),
  );

  const unfinishedEdgeIds = new Set(
    edges.filter((edge) => nodesById.get(edge.target)?.type === 'ghost').map((edge) => edge.id),
  );

  const unresolvedJumpToServiceNodeIds = new Set(
    nodes
      .filter((node) => node.type === 'custom' && node.data?.stepType === StepType.JumpToService)
      .filter((node) => {
        const jumpToService = node.data?.jumpToService as JumpToService | undefined;
        const serviceId = jumpToService?.serviceId;
        return !serviceId || !navigableServices.has(serviceId);
      })
      .map((node) => node.id),
  );

  const unresolvedEndpointReferenceNodeIds = getUnresolvedEndpointReferenceNodeIds(nodes);

  return {
    isComplete:
      unconnectedNodeIds.size === 0 &&
      unfinishedEdgeIds.size === 0 &&
      unresolvedJumpToServiceNodeIds.size === 0 &&
      unresolvedEndpointReferenceNodeIds.size === 0,
    unconnectedNodeIds,
    unfinishedEdgeIds,
    unresolvedJumpToServiceNodeIds,
    unresolvedEndpointReferenceNodeIds,
  };
};

export const getFlowCompletenessMessageKeys = (result: FlowCompletenessResult): string[] => [
  ...(result.unconnectedNodeIds.size > 0 ? ['newService.toast.unconnectedServiceBlocks'] : []),
  ...(result.unfinishedEdgeIds.size > 0 ? ['newService.toast.unfinishedFlows'] : []),
  ...(result.unresolvedJumpToServiceNodeIds.size > 0 ? ['newService.toast.unresolvedJumpToService'] : []),
  ...(result.unresolvedEndpointReferenceNodeIds.size > 0 ? ['newService.toast.unresolvedEndpointReferences'] : []),
];
