import { Edge, Node } from '@xyflow/react';
import { StepType } from 'types';
import { describe, expect, it } from 'vitest';

import { validateFlowCompleteness } from './flow-completeness';

const startNode: Node = { id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: {} };
const stepNode = (id: string, overrides: Record<string, unknown> = {}): Node => ({
  id,
  type: 'custom',
  position: { x: 0, y: 0 },
  data: { stepType: StepType.Textfield, ...overrides },
});
const ghostNode = (id: string): Node => ({ id, type: 'ghost', position: { x: 0, y: 0 }, data: {} });

describe('validateFlowCompleteness', () => {
  it('is complete for a simple fully connected flow', () => {
    const nodes = [startNode, stepNode('step-1')];
    const edges: Edge[] = [{ id: 'e1', source: 'start-1', target: 'step-1' }];

    const result = validateFlowCompleteness(nodes, edges, new Map());

    expect(result.isComplete).toBe(true);
    expect(result.unconnectedNodeIds.size).toBe(0);
    expect(result.unfinishedEdgeIds.size).toBe(0);
    expect(result.unresolvedJumpToServiceNodeIds.size).toBe(0);
  });

  it('flags a node that is not reachable from the start node', () => {
    const nodes = [startNode, stepNode('step-1'), stepNode('orphan-1')];
    const edges: Edge[] = [{ id: 'e1', source: 'start-1', target: 'step-1' }];

    const result = validateFlowCompleteness(nodes, edges, new Map());

    expect(result.isComplete).toBe(false);
    expect(result.unconnectedNodeIds.has('orphan-1')).toBe(true);
    expect(result.unconnectedNodeIds.has('step-1')).toBe(false);
  });

  it('flags an edge that ends in a ghost node as unfinished', () => {
    const nodes = [startNode, stepNode('step-1'), ghostNode('ghost-1')];
    const edges: Edge[] = [
      { id: 'e1', source: 'start-1', target: 'step-1' },
      { id: 'e2', source: 'step-1', target: 'ghost-1' },
    ];

    const result = validateFlowCompleteness(nodes, edges, new Map());

    expect(result.isComplete).toBe(false);
    expect(result.unfinishedEdgeIds.has('e2')).toBe(true);
  });

  it('flags a jump-to-service node with no selected target', () => {
    const nodes = [startNode, stepNode('jump-1', { stepType: StepType.JumpToService, jumpToService: { input: [] } })];
    const edges: Edge[] = [{ id: 'e1', source: 'start-1', target: 'jump-1' }];

    const result = validateFlowCompleteness(nodes, edges, new Map());

    expect(result.isComplete).toBe(false);
    expect(result.unresolvedJumpToServiceNodeIds.has('jump-1')).toBe(true);
  });

  it('flags a jump-to-service node whose target is no longer navigable', () => {
    const nodes = [
      startNode,
      stepNode('jump-1', {
        stepType: StepType.JumpToService,
        jumpToService: { serviceId: 'deleted-service', input: [] },
      }),
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'start-1', target: 'jump-1' }];

    const result = validateFlowCompleteness(nodes, edges, new Map());

    expect(result.isComplete).toBe(false);
    expect(result.unresolvedJumpToServiceNodeIds.has('jump-1')).toBe(true);
  });

  it('does not flag a jump-to-service node whose target is navigable, regardless of its status', () => {
    const nodes = [
      startNode,
      stepNode('jump-1', {
        stepType: StepType.JumpToService,
        jumpToService: { serviceId: 'draft-service', input: [] },
      }),
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'start-1', target: 'jump-1' }];

    const result = validateFlowCompleteness(nodes, edges, new Map([['draft-service', 'Draft Service']]));

    expect(result.isComplete).toBe(true);
    expect(result.unresolvedJumpToServiceNodeIds.size).toBe(0);
  });

  it('flags a node referencing the result of a deleted API call', () => {
    const nodes = [
      startNode,
      stepNode('assign-1', {
        stepType: StepType.Assign,
        assignElements: [{ id: 'a1', key: 'x', value: '${Deleted_API_res.response.body.value}' }],
      }),
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'start-1', target: 'assign-1' }];

    const result = validateFlowCompleteness(nodes, edges, new Map());

    expect(result.isComplete).toBe(false);
    expect(result.unresolvedEndpointReferenceNodeIds.has('assign-1')).toBe(true);
  });

  it('does not flag a node referencing the result of an existing API call', () => {
    const nodes = [
      startNode,
      stepNode('api-1', { stepType: StepType.UserDefined, endpoint: { name: 'My API', definitions: [] } }),
      stepNode('assign-1', {
        stepType: StepType.Assign,
        assignElements: [{ id: 'a1', key: 'x', value: '${My_API_res.response.statusCodeValue}' }],
      }),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'start-1', target: 'api-1' },
      { id: 'e2', source: 'api-1', target: 'assign-1' },
    ];

    const result = validateFlowCompleteness(nodes, edges, new Map());

    expect(result.isComplete).toBe(true);
    expect(result.unresolvedEndpointReferenceNodeIds.size).toBe(0);
  });
});
