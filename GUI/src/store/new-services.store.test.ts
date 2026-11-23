import { Edge, Node } from '@xyflow/react';
import { saveFlowClick } from 'services/service-builder';
import { StepType } from 'types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useServiceStore from './new-services.store';

vi.mock('i18next', () => {
  const mockI18n = {
    use: vi.fn().mockReturnThis(),
    init: vi.fn().mockResolvedValue(undefined),
    t: (key: string) => key,
  };
  return { default: mockI18n, t: mockI18n.t };
});

vi.mock('services/service-builder', () => ({
  saveFlowClick: vi.fn().mockResolvedValue(undefined),
}));

const startNode: Node = { id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: {} };
const stepNode = (id: string, overrides: Record<string, unknown> = {}): Node => ({
  id,
  type: 'custom',
  position: { x: 0, y: 0 },
  data: { stepType: StepType.Textfield, ...overrides },
});
const ghostNode = (id: string): Node => ({ id, type: 'ghost', position: { x: 0, y: 0 }, data: {} });

describe('onContinueClick flow completeness gate', () => {
  beforeEach(() => {
    vi.mocked(saveFlowClick).mockClear();
    useServiceStore.setState({ name: 'A Service', navigableServices: new Map() });
  });

  it('blocks moving to Ready when a node is unreachable from start', async () => {
    const nodes = [startNode, stepNode('step-1'), stepNode('orphan-1')];
    const edges: Edge[] = [{ id: 'e1', source: 'start-1', target: 'step-1' }];
    useServiceStore.setState({ nodes, edges });

    await expect(useServiceStore.getState().onContinueClick()).rejects.toThrow();
    expect(saveFlowClick).not.toHaveBeenCalled();
  });

  it('blocks moving to Ready when a branch ends in a ghost node', async () => {
    const nodes = [startNode, stepNode('step-1'), ghostNode('ghost-1')];
    const edges: Edge[] = [
      { id: 'e1', source: 'start-1', target: 'step-1' },
      { id: 'e2', source: 'step-1', target: 'ghost-1' },
    ];
    useServiceStore.setState({ nodes, edges });

    await expect(useServiceStore.getState().onContinueClick()).rejects.toThrow();
    expect(saveFlowClick).not.toHaveBeenCalled();
  });

  it('blocks moving to Ready when a Next Service node has no resolvable target', async () => {
    const nodes = [startNode, stepNode('jump-1', { stepType: StepType.JumpToService, jumpToService: { input: [] } })];
    const edges: Edge[] = [{ id: 'e1', source: 'start-1', target: 'jump-1' }];
    useServiceStore.setState({ nodes, edges });

    await expect(useServiceStore.getState().onContinueClick()).rejects.toThrow();
    expect(saveFlowClick).not.toHaveBeenCalled();
  });

  it('allows moving to Ready once the flow is fully connected and resolved', async () => {
    const nodes = [
      startNode,
      stepNode('jump-1', { stepType: StepType.JumpToService, jumpToService: { serviceId: 'svc-1', input: [] } }),
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'start-1', target: 'jump-1' }];
    useServiceStore.setState({ nodes, edges, navigableServices: new Map([['svc-1', 'Other Service']]) });

    await useServiceStore.getState().onContinueClick();

    expect(saveFlowClick).toHaveBeenCalledWith('ready', true);
  });
});

describe('saveToHistory unsaved changes tracking', () => {
  const nodes = [startNode, stepNode('step-1')];
  const edges: Edge[] = [{ id: 'e1', source: 'start-1', target: 'step-1' }];

  beforeEach(() => {
    useServiceStore.setState({
      nodes,
      edges,
      history: [{ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }],
      historyIndex: 0,
      hasUnsavedChanges: false,
    });
  });

  it('does not mark the service as unsaved when only the selection changed', () => {
    useServiceStore.setState({
      nodes: nodes.map((node) => ({ ...node, selected: node.id === 'step-1' })),
      edges: edges.map((edge) => ({ ...edge, selected: true })),
    });

    useServiceStore.getState().saveToHistory();

    expect(useServiceStore.getState().hasUnsavedChanges).toBe(false);
    expect(useServiceStore.getState().history).toHaveLength(1);
  });

  it('marks the service as unsaved when the flow changed', () => {
    useServiceStore.setState({ nodes: [...nodes, stepNode('step-2')] });

    useServiceStore.getState().saveToHistory();

    expect(useServiceStore.getState().hasUnsavedChanges).toBe(true);
    expect(useServiceStore.getState().history).toHaveLength(2);
  });
});
