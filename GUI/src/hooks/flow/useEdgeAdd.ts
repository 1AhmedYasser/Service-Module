import { Edge, Node, useReactFlow } from '@xyflow/react';
import useServiceStore from 'store/new-services.store';
import { Step, StepType } from 'types';
import { omitResponseSchema } from 'utils/flow-response-data';
import { generateUniqueId, getNodeLabel } from 'utils/flow-utils';

function useEdgeAdd(id: string) {
  const { setEdges, setNodes, getNodes, getNode, getEdge } = useReactFlow();

  const handleEdgeClick = (step: Step) => {
    const edge = getEdge(id);
    if (!edge) return;

    const targetNode = getNode(edge.target);
    if (!targetNode) return;

    const nodeLabel = getNodeLabel(step, getNodes());
    const stepType: StepType = step.type;

    const newNodeId = generateUniqueId();

    const insertNode = {
      id: newNodeId,
      position: { x: targetNode.position.x, y: targetNode.position.y },
      data: {
        label: nodeLabel,
        onDelete: useServiceStore.getState().onDelete,
        onEdit: useServiceStore.getState().handleNodeEdit,
        type: [
          StepType.DynamicChoices,
          StepType.FinishingStepEnd,
          StepType.FinishingStepRedirect,
          StepType.JumpToService,
        ].includes(stepType)
          ? 'finishing-step'
          : 'step',
        stepType: stepType,
        readonly: [StepType.Auth, StepType.FinishingStepEnd, StepType.FinishingStepRedirect].includes(stepType),
        endpoint: step.data ? omitResponseSchema(step.data) : undefined,
        setClickedNode: useServiceStore.getState().setClickedNode,
      },
      className: (() => {
        if ([StepType.FinishingStepEnd, StepType.FinishingStepRedirect].includes(stepType)) {
          return 'finishing-step';
        }
        if ([StepType.DynamicChoices, StepType.JumpToService].includes(stepType)) {
          return 'dynamic-choices';
        }
        return 'step';
      })(),
      type: 'custom',
    };

    const sourceEdge = {
      id: `${edge.source}->${newNodeId}`,
      source: edge.source,
      target: newNodeId,
      type: 'step',
      label: edge.label,
    };

    let targetEdge: Edge | null = null;

    if (
      stepType != StepType.DynamicChoices &&
      stepType != StepType.FinishingStepEnd &&
      stepType != StepType.FinishingStepRedirect &&
      stepType != StepType.JumpToService
    ) {
      targetEdge = {
        id: `${newNodeId}->${edge.target}`,
        source: newNodeId,
        target: edge.target,
        type: 'step',
        animated: getNode(edge.target)?.type === 'ghost',
        deletable: getNode(edge.target)?.type != 'ghost',
      };
    }

    let ghostNodes: Node[] = [];
    let ghostEdges: Edge[] = [];

    if (stepType === StepType.MultiChoiceQuestion || stepType === StepType.Condition || stepType === StepType.Input) {
      const labels = stepType === StepType.MultiChoiceQuestion ? ['Jah', 'Ei'] : ['Success', 'Failure'];
      ghostNodes = labels.slice(1).map((_) => ({
        id: generateUniqueId(),
        type: 'ghost',
        position: {
          x: targetNode.position.x,
          y: targetNode.position.y,
        },
        data: { type: 'ghost' },
        className: 'ghost',
        selectable: false,
        draggable: false,
      }));

      ghostEdges = ghostNodes.map((ghostNode, i) => {
        return {
          id: `${newNodeId}->${ghostNode.id}`,
          source: newNodeId,
          target: ghostNode.id,
          type: 'step',
          animated: true,
          deletable: false,
          label: labels[i],
        };
      });

      if (targetEdge) {
        targetEdge.label = labels[labels.length - 1] ?? '+';
      }
    }

    let newEdges: Edge[] = [];

    setEdges((edges) => {
      const edgeIndex = edges.findIndex((e) => e.id === id);
      const remainingEdges = edges.filter((e) => e.id !== id);
      const insertIndex = edgeIndex === -1 ? remainingEdges.length : edgeIndex;
      newEdges = [
        ...remainingEdges.slice(0, insertIndex),
        sourceEdge,
        ...(targetEdge ? [targetEdge] : []),
        ...ghostEdges,
        ...remainingEdges.slice(insertIndex),
      ];
      return newEdges;
    });

    setNodes((nodes) => {
      const targetNodeIndex = nodes.findIndex((node) => node.id === edge.target);
      const newNodes = [...nodes.slice(0, targetNodeIndex), insertNode, ...nodes.slice(targetNodeIndex)];

      const newNodeIndex = newNodes.findIndex((node) => node.id === newNodeId);
      newNodes.splice(newNodeIndex + 1, 0, ...ghostNodes);

      return newNodes;
    });

    const isFinishingStep = [
      StepType.DynamicChoices,
      StepType.FinishingStepEnd,
      StepType.FinishingStepRedirect,
      StepType.JumpToService,
    ].includes(stepType);
    if (!isFinishingStep) {
      setTimeout(() => {
        useServiceStore.getState().saveToHistory();
      }, 0);
    }
  };
  return handleEdgeClick;
}

export default useEdgeAdd;
