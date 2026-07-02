import { Edge, Node } from '@xyflow/react';
import { AxiosError } from 'axios';
import { Group, Rule } from 'components/FlowElementsPopup/RuleBuilder/types';
import { format } from 'date-fns';
import i18next, { t } from 'i18next';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { createNewService, editService } from 'resources/api-constants';
import useServiceStore from 'store/new-services.store';
import useToastStore from 'store/toasts.store';
import { StepType } from 'types';
import { Assign } from 'types/assign';
import { NodeDataProps } from 'types/service-flow';
import {
  decodeHtmlEntities,
  getLastDigits,
  isNumericString,
  removeTrailingUnderscores,
  removeWrapperQuotes,
  stringToArray,
  toSnakeCase,
} from 'utils/string-util';

import api from '../services/api-dev';

const htmlToMarkdown = new NodeHtmlMarkdown({
  textReplace: [
    [/\\_/g, '_'],
    [/\\\[/g, '['],
    [/\\\]/g, ']'],
  ],
});

/**
 * Normalises MCQ button payloads on all MultiChoiceQuestion nodes.
 *
 * Imported services may reference the wrong service name (the original export
 * name) and stale button indices.  This function rebuilds every button's
 * payload so it matches:
 *   #service, /<type>/services/active/<serviceName>_mcq_<nodeId>_<buttonIndex>
 *
 * Safe to call on any flow: nodes that have no MCQ data are left untouched.
 */
export function normalizeMcqPayloads(nodes: Node<NodeDataProps>[], serviceName: string): Node<NodeDataProps>[] {
  return nodes.map((node) => {
    if (node.data?.stepType !== StepType.MultiChoiceQuestion) return node;

    const buttons = node.data.multiChoiceQuestion?.buttons;
    if (!Array.isArray(buttons) || buttons.length === 0) return node;

    const mcqNodeId = getLastDigits(toSnakeCase(node.data.label ?? ''));

    const normalizedButtons = buttons.map((btn, idx) => {
      // Only rewrite payloads that already follow the MCQ payload convention.
      // Payloads that don't match are left unchanged to avoid corrupting custom data.
      const mcqPayloadPattern = /^(#service,\s*\/[^/]+\/services\/active\/)([^/]+_mcq_\d+_)(\d+)$/;
      const match = mcqPayloadPattern.exec(btn.payload ?? '');
      if (!match) return btn;

      const prefix = match[1]; // e.g. "#service, /POST/services/active/"
      return {
        ...btn,
        payload: `${prefix}${serviceName}_mcq_${mcqNodeId}_${idx}`,
      };
    });

    return {
      ...node,
      data: {
        ...node.data,
        multiChoiceQuestion: {
          ...node.data.multiChoiceQuestion!,
          buttons: normalizedButtons,
        },
      },
    };
  });
}

export function normalizeEdgeLabels(edges: Edge[], nodes: Node<NodeDataProps>[]): Edge[] {
  const mcqNodes = nodes.filter((n) => n.data?.stepType === StepType.MultiChoiceQuestion);
  if (mcqNodes.length === 0) return edges;

  const edgeMap = new Map(edges.map((e) => [e.id, { ...e }]));

  for (const mcqNode of mcqNodes) {
    const buttons = mcqNode.data?.multiChoiceQuestion?.buttons;
    if (!Array.isArray(buttons)) continue;

    const mcqEdges = edges.filter((e) => e.source === mcqNode.id);

    // Find button indices already claimed by correctly-labeled edges
    const claimedIndices = new Set<number>();
    const unclaimedEdges: Edge[] = [];

    mcqEdges.forEach((edge) => {
      const idx = buttons.findIndex((b: any) => b.title === edge.label);
      if (idx === -1) {
        unclaimedEdges.push(edge);
      } else {
        claimedIndices.add(idx);
      }
    });

    // Assign remaining button titles only to edges with broken/missing labels
    const unclaimedButtonIndices = buttons.map((_, i) => i).filter((i) => !claimedIndices.has(i));

    unclaimedEdges.forEach((edge, i) => {
      if (i < unclaimedButtonIndices.length) {
        const copy = edgeMap.get(edge.id);
        if (copy) copy.label = buttons[unclaimedButtonIndices[i]].title;
      }
    });
  }

  return edges.map((e) => edgeMap.get(e.id) ?? e);
}

/**
 * Builds YAML content for the main service and all MCQ branch sub-services.
 *
 * Sub-services are embedded inside the returned object so that each JSON file
 * is self-contained when sent to the import-services endpoint. The server
 * resolves the final main service name (adding a timestamp on conflict) and
 * then prepends that resolved name to each sub-service suffix.
 */
export function buildAllServiceContents(
  rawNodes: Node<NodeDataProps>[],
  edges: Edge[],
  name: string,
  description: string = '',
): {
  name: string;
  content: any;
  flowData: string;
  subServices: Array<{ suffix: string; content: any }>;
} {
  const nodes = normalizeMcqPayloads(rawNodes, name);
  const mcqNodes = nodes.filter((n) => n.data?.stepType === StepType.MultiChoiceQuestion);
  const fullFlowData = JSON.stringify({ nodes: rawNodes, edges });

  // Main service – truncated at the first MCQ node (same as saveFlow)
  const mainNodes =
    mcqNodes.length > 0
      ? nodes.slice(0, nodes.findIndex((n) => n.data?.stepType === StepType.MultiChoiceQuestion) + 1)
      : nodes;

  const subServices: Array<{ suffix: string; content: any }> = [];

  for (const mcqNode of mcqNodes) {
    const mcqEdges = edges.filter((e) => e.source === mcqNode.id);
    for (const [edgeIdx, edge] of mcqEdges.entries()) {
      const nextNode = nodes.find((n) => n.id === edge.target);
      if (!nextNode) continue;

      const foundIndex = mcqNode.data?.multiChoiceQuestion?.buttons.findIndex((b: any) => b.title === edge.label) ?? -1;
      const buttonIndex = foundIndex === -1 ? edgeIdx : foundIndex;
      const mcqNodeId = getLastDigits(toSnakeCase(mcqNode.data.label ?? ''));
      const suffix = `_mcq_${mcqNodeId}_${buttonIndex}`;
      const subServiceName = `${name}${suffix}`;

      const branchNodes = getBranchNodes(nodes, edges, nextNode);
      const branchEdges = edges.filter((e) => branchNodes.some((n) => n.id === e.source || n.id === e.target));

      subServices.push({
        suffix,
        content: getYamlContent(branchNodes, branchEdges, subServiceName, description, false),
      });
    }
  }

  return {
    name,
    content: getYamlContent(mainNodes, edges, name, description, false),
    flowData: fullFlowData,
    subServices,
  };
}

interface SaveFlowConfig {
  name: string;
  edges: Edge[];
  nodes: Node<NodeDataProps>[];
  onSuccess: (e: any) => void;
  onError: (e: any) => void;
  description: string;
  slot: string;
  examples: string[];
  entities: string[];
  isCommon: boolean;
  serviceId: string;
  isNewService: boolean;
  status: 'draft' | 'ready';
  showError?: boolean;
}

const hasInvalidRules = (elements: any[]): boolean => {
  if (!Array.isArray(elements)) return true;
  return elements.some((e) => {
    if ('children' in e) {
      const group = e as Group;
      if (group.children.length === 0) return true;
      return hasInvalidRules(group.children);
    } else {
      const rule = e as Rule;
      return rule.value === '' || rule.field === '' || rule.operator === '';
    }
  });
};

const hasInvalidElements = (elements: any[]): boolean => {
  return elements.some((e) => {
    const element = e as Assign;
    return element.key === '' || element.value === '';
  });
};

const getAssignedVariableNames = (nodes: Node[]): Set<string> => {
  const names = new Set(['chatId', 'authorId', 'input', 'buttons', 'res']);
  for (const node of nodes) {
    const data = node.data as NodeDataProps | undefined;
    if (data?.stepType === StepType.Assign && Array.isArray(data.assignElements)) {
      for (const e of data.assignElements) {
        const key = e.key?.replaceAll('${', '').replaceAll('}', '').trim();
        if (key) names.add(key);
      }
    }
  }
  return names;
};

const buildConditionString = (group: any, assignedVariableNames: Set<string>): string => {
  const formatField = (rawField: string): string => {
    if (assignedVariableNames.has(rawField)) return rawField;
    return isNumericString(rawField) ? rawField : `"${rawField}"`;
  };

  if ('children' in group) {
    const subgroup = group as Group;
    if (subgroup.children.length === 0) {
      return '';
    }

    const conditions = subgroup.children.map((child) => {
      if ('children' in child) {
        return `(${buildConditionString(child, assignedVariableNames)})`;
      } else {
        const rule = child;
        const rawField = rule.field.replaceAll('${', '').replaceAll('}', '');
        const absoluteValue = removeWrapperQuotes(rule.value.replaceAll('${', '').replaceAll('}', ''));
        const value = formatField(absoluteValue);
        const field = formatField(rawField);
        return `${field} ${rule.operator} ${value}`;
      }
    });

    if (subgroup.not) {
      return `!(${subgroup.type === 'and' ? conditions.join(' && ') : conditions.join(' || ')})`;
    } else {
      return subgroup.type === 'and' ? conditions.join(' && ') : conditions.join(' || ');
    }
  } else {
    const rule = group as Rule;
    const rawField = rule.field.replaceAll('${', '').replaceAll('}', '');
    const absoluteValue = removeWrapperQuotes(rule.value.replaceAll('${', '').replaceAll('}', ''));
    const value = formatField(absoluteValue);
    const field = formatField(rawField);
    return `${field} ${rule.operator} ${value}`;
  }
};

export const saveFlow = async ({
  name,
  edges: rawEdges,
  nodes: rawNodes,
  onSuccess,
  onError,
  description,
  slot,
  examples,
  entities,
  isCommon,
  serviceId,
  isNewService,
  status = 'ready',
  showError = true,
}: SaveFlowConfig) => {
  try {
    const nodes = normalizeMessageNodes(normalizeMcqPayloads(rawNodes, name));
    const edges = normalizeEdgeLabels(rawEdges, nodes);
    let yamlContent = getYamlContent(nodes, edges, name, description, showError);

    const mcqNodes = nodes.filter((node) => node.data?.stepType === StepType.MultiChoiceQuestion);

    if (mcqNodes.length > 0) {
      const nodesUpToFirstMcq = nodes.slice(
        0,
        nodes.findIndex((node) => node.data?.stepType === StepType.MultiChoiceQuestion) + 1,
      );
      yamlContent = getYamlContent(nodesUpToFirstMcq, edges, name, description, showError);
    }

    await saveService(
      yamlContent,
      {
        name,
        serviceId,
        description,
        slot,
        examples,
        entities,
        isCommon,
        nodes,
        edges,
        isNewService,
      } as SaveFlowConfig,
      true,
      status,
      onError,
    );

    for (const mcqNode of mcqNodes) {
      const mcqEdges = edges.filter((edge) => edge.source === mcqNode.id);

      for (const [edgeIdx, edge] of mcqEdges.entries()) {
        const nextNode = nodes.find((n) => n.id === edge.target);
        if (!nextNode) continue;

        const foundIndex = mcqNode?.data?.multiChoiceQuestion?.buttons.findIndex((e: any) => e.title === edge.label);
        const buttonIndex = foundIndex === -1 ? edgeIdx : foundIndex;
        const mcqNodeId = getLastDigits(toSnakeCase(mcqNode.data.label ?? ''));
        const serviceName = `${name}_mcq_${mcqNodeId}_${buttonIndex}`;
        const branchNodes = getBranchNodes(nodes, edges, nextNode);
        const branchEdges = edges.filter((edge) =>
          branchNodes.some((n: any) => n.id === edge.source || n.id === edge.target),
        );

        await saveService(
          getYamlContent(branchNodes, branchEdges, serviceName, description, showError),
          {
            name: serviceName,
            serviceId,
            description,
            slot,
            examples,
            entities,
            isCommon,
            nodes,
            edges,
            isNewService,
          } as SaveFlowConfig,
          false,
          status,
        );
      }
    }

    onSuccess?.(undefined);
  } catch (e: any) {
    onError(e);
    throw e;
  }
};

async function saveService(
  content: any,
  config: SaveFlowConfig,
  updateServiceDb: boolean,
  status: 'draft' | 'ready' = 'ready',
  onError?: (e: any) => void,
) {
  const { isNewService, serviceId, name, description, slot, examples, entities, isCommon, edges, nodes } = config;
  if (updateServiceDb) {
    useServiceStore.getState().changeServiceName(removeTrailingUnderscores(name));
  }
  await api
    .post(
      isNewService ? createNewService() : editService(serviceId),
      {
        name: removeTrailingUnderscores(name),
        serviceId,
        description,
        slot,
        examples,
        entities,
        type: 'POST',
        content: content,
        isCommon,
        structure: JSON.stringify({ edges, nodes }),
        updateServiceDb: updateServiceDb,
        state: status,
      },
      {
        params: {
          location: `${import.meta.env.REACT_APP_RUUTER_SERVICES_POST_PATH}/${name}.yml`,
        },
      },
    )
    .catch(onError);
}

const validateMCQ = (node: NodeDataProps | undefined) => {
  if (!node?.multiChoiceQuestion?.question || node.multiChoiceQuestion.question === '')
    return i18next.t('toast.missing-mcq-question');
  if (!node?.multiChoiceQuestion?.buttons || node.multiChoiceQuestion.buttons.length === 0)
    return i18next.t('toast.missing-mcq-options');
  return null;
};

export const validateCondition = (node: NodeDataProps | undefined) => {
  const rulesChildren = Array.isArray(node?.rules?.children) ? node.rules.children : [];
  const invalidRulesExist = hasInvalidRules(rulesChildren);
  const isInvalid = !Array.isArray(node?.rules?.children) || invalidRulesExist || node.rules.children.length === 0;
  return isInvalid ? (i18next.t('toast.missing-condition-rules') ?? 'Error') : null;
};

export function getYamlContent(
  nodes: Node<NodeDataProps>[],
  edges: Edge[],
  name: string,
  description: string,
  showError = true,
): any {
  const allRelations: any[] = [];

  nodes.forEach((node) => {
    const outgoingEdges = edges.filter((edge) => edge.source === node.id);

    outgoingEdges.forEach((edge) => {
      const followingNode = nodes.find((n) => n.id === edge.target)?.data;
      let error: string | null = null;

      switch (followingNode?.stepType) {
        case StepType.Textfield:
          error = validateTextField(followingNode);
          break;
        case StepType.OpenWebpage:
          error = validateOpenWebpage(followingNode);
          break;
        case StepType.FileGenerate:
          error = validateFileGenerate(followingNode);
          break;
        case StepType.Assign:
          error = validateAssign(followingNode);
          break;
        case StepType.MultiChoiceQuestion:
          error = validateMCQ(followingNode);
          break;
        case StepType.DynamicChoices:
          error = validateDynamicChoices(followingNode);
          break;
        case StepType.Condition:
          error = validateCondition(followingNode);
          break;
        case StepType.Input:
          if (followingNode?.type === 'placeholder' && !allRelations.includes(node.id)) {
            allRelations.push(node.id);
            return;
          }
          break;
      }

      if (error && showError) {
        throw new Error(error);
      }

      allRelations.push(`${edge.source},${edge.target}`);
    });
  });
  // find finishing nodes
  edges.forEach((edge) => {
    const current = edges.find((lastEdge) => lastEdge.source === edge.source);
    const nextStep = edges.find((lastEdge) => lastEdge.source === edge.target);
    if (!nextStep && current?.type !== 'placeholder') allRelations.push(edge.target);
  });

  const finishedFlow = new Map();

  finishedFlow.set('declaration', {
    call: 'declare',
    version: 0.1,
    description:
      description && description.trim().length > 0 ? description : `Description placeholder for '${name ?? ''}'`,
    method: 'post',
    accepts: 'json',
    returns: 'json',
    namespace: 'service',
    allowList: {
      body: [
        {
          field: 'chatId',
          type: 'string',
          description: 'The chat ID for the message',
        },
        {
          field: 'authorId',
          type: 'string',
          description: 'The author ID for the message',
        },
        {
          field: 'input',
          type: 'object',
          description: 'The Input from the user',
        },
      ],
    },
  });

  const firstNode = nodes.find((node) => node.type === 'custom');
  finishedFlow.set('prepare', {
    assign: {
      chatId: '${incoming.body.chatId}',
      authorId: '${incoming.body.authorId}',
      input: '${incoming.body.input}',
      buttons: [],
      res: {
        result: '',
      },
    },
    next: firstNode ? toSnakeCase(firstNode.data.label?.toString() ?? 'format_messages') : 'format_messages',
  });

  const nonceStepsNeeded: string[] = [];

  try {
    allRelations.forEach((r) => {
      const [parentNodeId, childNodeId] = r.split(',');
      const parentNode = nodes.findLast((node) => node.id === parentNodeId);
      if (
        !parentNode?.type ||
        parentNode.type !== 'custom' ||
        [StepType.Rule, StepType.RuleDefinition].includes(parentNode.data?.stepType)
      ) {
        return;
      }

      const childNode = nodes.find((node) => node.id === childNodeId);
      const parentStepName = toSnakeCase(parentNode.data.label);

      if (parentNode.data.stepType === StepType.Textfield) {
        return handleTextField(finishedFlow, parentStepName, parentNode, childNode);
      }

      if (parentNode.data.stepType === StepType.Assign) {
        return handleAssignStep(parentNode, finishedFlow, parentStepName, childNode);
      }

      if (parentNode.data.stepType === StepType.Condition) {
        return handleConditionStep(allRelations, parentNodeId, nodes, parentNode, finishedFlow, parentStepName, edges);
      }

      if (parentNode.data.stepType === StepType.Input) {
        return;
      }

      if (parentNode.data.stepType === StepType.MultiChoiceQuestion) {
        return handleMultiChoiceQuestion(finishedFlow, parentStepName, parentNode, childNode, name);
      }

      if (parentNode.data.stepType === StepType.DynamicChoices) {
        return handleDynamicChoices(finishedFlow, parentStepName, parentNode, childNode);
      }

      if (parentNode.data.stepType === StepType.UserDefined) {
        return handleEndpointStep(parentNode, finishedFlow, parentStepName, childNode, nonceStepsNeeded);
      }

      if (parentNode.data.stepType === StepType.JumpToService) {
        return handleJumpToServiceStep(parentNode, finishedFlow, parentStepName);
      }

      const nextStep = childNode ? toSnakeCase(childNode.data.label ?? 'format_messages') : 'format_messages';
      const template = getTemplate(parentNode, parentStepName, nextStep);

      finishedFlow.set(parentStepName, template);
    });
  } catch (e: any) {
    if (showError) {
      throw new Error(i18next.t('toast.cannot-save-flow') ?? (e?.message as string) ?? 'Error');
    }
  }

  nonceStepsNeeded.forEach((stepName) => injectNonceStep(finishedFlow, stepName));

  finishedFlow.set('format_messages', {
    call: 'http.post',
    args: {
      url: '[#SERVICE_DMAPPER_HBS]/bot_responses_to_messages',
      headers: {
        type: 'json',
      },
      body: {
        data: {
          botMessages: '${[res]}',
          chatId: "${chatId ?? ''}",
          authorId: "${authorId ?? ''}",
          authorFirstName: '',
          authorLastName: '',
          authorTimestamp: '${new Date().toISOString()}',
          created: '${new Date().toISOString()}',
          buttons: '${buttons ?? []}',
        },
      },
    },
    result: 'formatMessage',
    next: 'service-end',
  });

  finishedFlow.set('service-end', {
    return: "${formatMessage.response.body ?? ''}",
  });

  return Object.fromEntries(finishedFlow.entries());
}

export const validateTextField = (nodeData: NodeDataProps): string | null => {
  if (nodeData?.message === undefined) {
    return i18next.t('toast.missing-textfield-message');
  }
  return null;
};

export const validateOpenWebpage = (nodeData: NodeDataProps): string | null => {
  if (nodeData?.link === undefined || nodeData?.linkText === undefined) {
    return i18next.t('toast.missing-website');
  }
  return null;
};

export const validateFileGenerate = (nodeData: NodeDataProps): string | null => {
  if (nodeData?.fileName === undefined || nodeData?.fileContent === undefined) {
    return i18next.t('toast.missing-file-generation');
  }
  return null;
};

export const validateAssign = (nodeData: NodeDataProps): string | null => {
  if (nodeData?.assignElements === undefined || nodeData?.assignElements?.length === 0) {
    return i18next.t('toast.missing-assign-elements');
  }
  return null;
};

export const validateMultiChoiceQuestion = (nodeData: NodeDataProps): string | null => {
  if (nodeData?.multiChoiceQuestion?.question === undefined || nodeData?.multiChoiceQuestion.question === '') {
    return i18next.t('toast.missing-mcq-question');
  }
  if (!nodeData?.multiChoiceQuestion?.buttons || nodeData?.multiChoiceQuestion.buttons.length === 0) {
    return i18next.t('toast.missing-mcq-options');
  }
  return null;
};

export const validateDynamicChoices = (nodeData: NodeDataProps): string | null => {
  if (nodeData?.dynamicChoices?.list === undefined || nodeData?.dynamicChoices.list === '') {
    return i18next.t('toast.missing-dynamic-choices-list');
  }
  if (nodeData?.dynamicChoices?.serviceName === undefined || nodeData?.dynamicChoices.serviceName === '') {
    return i18next.t('toast.missing-dynamic-choices-service-name');
  }
  if (nodeData?.dynamicChoices?.key === undefined || nodeData?.dynamicChoices.key === '') {
    return i18next.t('toast.missing-dynamic-choices-key');
  }
  return null;
};

function getBranchNodes(
  nodes: Node<NodeDataProps>[],
  edges: Edge[],
  startNode: Node<NodeDataProps>,
): Node<NodeDataProps>[] {
  const branchNodes: Node<NodeDataProps>[] = [startNode];
  const visited = new Set<string>([startNode.id]);
  const queue: string[] = [startNode.id];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    const currentNode = nodes.find((n) => n.id === currentId);
    if (currentNode?.data?.stepType === StepType.MultiChoiceQuestion) {
      continue;
    }

    const outgoingEdges = edges.filter((edge) => edge.source === currentId);

    for (const edge of outgoingEdges) {
      if (visited.has(edge.target)) continue;

      const nextNode = nodes.find((node) => node.id === edge.target);
      if (!nextNode) continue;

      branchNodes.push(nextNode);
      visited.add(nextNode.id);
      queue.push(nextNode.id);
    }
  }

  return branchNodes;
}

const SPACE_PLACEHOLDER = '\uE000';

function replaceSpacesOutsideTags(input: string, placeholder: string): string {
  let result = '';
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === '<') {
      const closingIndex = input.indexOf('>', i + 1);
      if (closingIndex > i + 1) {
        result += input.slice(i, closingIndex + 1);
        i = closingIndex + 1;
        continue;
      }
    }
    result += ch === ' ' || ch === '\t' ? placeholder : ch;
    i++;
  }
  return result;
}

const containsHtmlMarkup = (value: string): boolean => /<[a-z][^>]*>/i.test(value);

function normalizeMarkdownListsToPlainBullets(markdown: string): string {
  return markdown.replace(/^(\s*)[-*+]\s+(.+)$/gm, '$1• $2').replace(/^(\s*)(\d+)\.\s+(.+)$/gm, '$1$2) $3');
}

export function toMarkdownMessage(raw: string): string {
  const prepared = decodeHtmlEntities(raw).replaceAll('{{', '${').replaceAll('}}', '}');
  const withPlaceholders = replaceSpacesOutsideTags(prepared, SPACE_PLACEHOLDER);
  const markdown = containsHtmlMarkup(withPlaceholders)
    ? htmlToMarkdown
        .translate(withPlaceholders)
        .replaceAll(SPACE_PLACEHOLDER, ' ')
        .replaceAll(/\\([-~>[\]_*#().!`=<\\])/g, String.raw`\\$1`)
    : withPlaceholders.replaceAll(SPACE_PLACEHOLDER, ' ');

  const normalized = normalizeMarkdownListsToPlainBullets(markdown);
  const trimmed = normalized.trim().toLowerCase();
  return trimmed === 'yes' || trimmed === 'no' ? `\${"${trimmed}"}` : normalized;
}

function normalizeMessageNodes(nodes: Node<NodeDataProps>[]): Node<NodeDataProps>[] {
  return nodes.map((node) => {
    if (node.data.stepType === StepType.Textfield && typeof node.data.message === 'string') {
      return {
        ...node,
        data: {
          ...node.data,
          message: toMarkdownMessage(node.data.message),
        },
      };
    }

    if (node.data.stepType === StepType.MultiChoiceQuestion && node.data.multiChoiceQuestion) {
      return {
        ...node,
        data: {
          ...node.data,
          multiChoiceQuestion: {
            ...node.data.multiChoiceQuestion,
            question: toMarkdownMessage(node.data.multiChoiceQuestion.question ?? ''),
          },
        },
      };
    }

    return node;
  });
}

function resolveMessageContent(message: string | undefined): string {
  if (!message) return '';
  return containsHtmlMarkup(message) ? toMarkdownMessage(message) : message;
}

function handleTextField(
  finishedFlow: Map<any, any>,
  parentStepName: string,
  parentNode: Node,
  childNode: Node<NodeDataProps> | undefined,
) {
  const finalMessage = resolveMessageContent(
    typeof parentNode.data.message === 'string' ? parentNode.data.message : undefined,
  );

  finishedFlow.set(parentStepName, {
    assign: {
      res: {
        result: finalMessage,
      },
    },
    next: childNode ? toSnakeCase(childNode.data.label ?? 'format_messages') : 'format_messages',
  });
}

function handleConditionStep(
  allRelations: any[],
  parentNodeId: any,
  nodes: Node<NodeDataProps>[],
  parentNode: Node<NodeDataProps>,
  finishedFlow: Map<any, any>,
  parentStepName: string,
  edges: Edge[],
) {
  const conditionRelations: string[] = allRelations.filter((r) => r.startsWith(parentNodeId));

  const rulesChildren = Array.isArray(parentNode.data.rules?.children) ? parentNode.data.rules.children : [];
  const invalidRulesExist = hasInvalidRules(rulesChildren);
  const isInvalid =
    !Array.isArray(parentNode.data.rules?.children) || invalidRulesExist || parentNode.data.rules.children.length === 0;
  if (isInvalid) {
    throw new Error(i18next.t('toast.missing-condition-rules') ?? 'Error');
  }

  const outgoingEdges = edges.filter((e) => e.source === parentNodeId);
  const successEdge = outgoingEdges.find((e) => e.label === 'Success') ?? outgoingEdges[0];
  const failureEdge = outgoingEdges.find((e) => e.label === 'Failure') ?? outgoingEdges[1];

  const successChildId = successEdge?.target ?? conditionRelations[0]?.split(',')[1];
  const failureChildId = failureEdge?.target ?? conditionRelations[1]?.split(',')[1];

  const successChild = nodes.find((node) => node.id === successChildId);
  const failureChild = nodes.find((node) => node.id === failureChildId);

  const assignedVariableNames = getAssignedVariableNames(nodes);
  finishedFlow.set(parentStepName, {
    switch: [
      {
        condition: `\${${buildConditionString(parentNode.data.rules, assignedVariableNames)}}`,
        next: toSnakeCase(successChild?.data?.label ?? '') ?? '',
      },
    ],
    next: toSnakeCase(failureChild?.data?.label ?? '') ?? '',
  });
}

function handleAssignStep(
  parentNode: Node<NodeDataProps>,
  finishedFlow: Map<any, any>,
  parentStepName: string,
  childNode: Node<NodeDataProps> | undefined,
) {
  const invalidElementsExist = hasInvalidElements(parentNode.data.assignElements ?? []);
  const isInvalid =
    parentNode.data?.assignElements === undefined ||
    invalidElementsExist ||
    parentNode.data?.assignElements.length === 0;

  if (isInvalid) {
    throw new Error(i18next.t('toast.missing-assign-elements') ?? 'Error');
  }

  finishedFlow.set(parentStepName, {
    assign: parentNode.data.assignElements?.reduce((acc: Record<string, any>, e: Assign) => {
      acc[e.key] = normalizeAssignValue(e.value);
      return acc;
    }, {}),
    next: childNode ? toSnakeCase(childNode.data.label ?? 'format_messages') : 'format_messages',
  });
}

/**
 * Ruuter injects JSON.parse() around *_res variables when they appear inside function calls
 * (e.g. String(testAPI_res.response.body[...])), causing failures because _res variables
 * are already parsed objects. Strip String() wrappers from API response variable expressions
 * so Ruuter handles them via direct property access (which works correctly).
 */
function normalizeAssignValue(value: string): string {
  const match = /^\$\{String\(([\s\S]*)\)\}$/.exec(value);
  if (match && /\b\w+_res\b/.test(match[1])) {
    return '${' + match[1] + '}';
  }
  return value;
}

function handleEndpointStep(
  parentNode: Node<NodeDataProps>,
  finishedFlow: Map<any, any>,
  parentStepName: string,
  childNode: Node<NodeDataProps> | undefined,
  nonceStepsNeeded: string[],
) {
  const endpointDefinition = parentNode.data.endpoint?.definitions[0];
  const paramsVariables = endpointDefinition?.params?.variables;
  const bodyVariables = endpointDefinition?.body?.variables;
  const isRawBodySelected = endpointDefinition?.body?.isRawSelected ?? false;
  const rawBody = endpointDefinition?.body?.rawData ?? {};
  const headersVariables = endpointDefinition?.headers?.variables;
  const methodType = endpointDefinition?.methodType?.toLowerCase();
  const hasNonEqualOperator = Array.isArray(paramsVariables) && paramsVariables.some(hasNonEqualOperatorParam);

  const baseUrl = getEndpointBaseUrl(endpointDefinition?.url, hasNonEqualOperator);
  const { resolvedUrl, pathPlaceholderNames } = resolveUrlWithPathParams(baseUrl, paramsVariables);

  const stepConfig: any = {
    call: `http.${methodType ?? 'post'}`,
    args: {
      url: resolvedUrl,
    },
    result: `${parentNode.data.endpoint?.name.replaceAll(' ', '_')}_res`,
    next: childNode ? toSnakeCase(childNode.data.label ?? 'format_messages') : 'format_messages',
  };

  applyEndpointQuery(stepConfig, paramsVariables, pathPlaceholderNames, hasNonEqualOperator);
  applyEndpointBody(stepConfig, isRawBodySelected, rawBody, bodyVariables);
  applyEndpointHeaders(stepConfig, headersVariables);

  finishedFlow.set(parentStepName, stepConfig);

  if (
    Object.keys((stepConfig.args.headers ?? {}) as Record<string, unknown>).some(
      (key) => key.toLowerCase() === 'x-ruuter-nonce',
    )
  ) {
    nonceStepsNeeded.push(parentStepName);
  }
}

function hasNonEqualOperatorParam(param: any): boolean {
  return Boolean(param?.operator && param.operator !== '=');
}

function getEndpointBaseUrl(url: unknown, hasNonEqualOperator: boolean): string {
  const urlString = typeof url === 'string' ? url : '';
  // Preserve existing behavior: if a non-equal operator is used, keep the full URL
  // (including any inline query string); otherwise strip the inline query string.
  return hasNonEqualOperator ? urlString : (urlString.split('?')[0] ?? '');
}

function resolveUrlWithPathParams(
  baseUrl: string,
  paramsVariables: any[] | undefined,
): { resolvedUrl: string; pathPlaceholderNames: Set<string> } {
  // Resolve path param placeholders ({name}) directly into the URL so Ruuter does not
  // attempt Spring-style URI template expansion at runtime and fail with
  // "Not enough variable values available to expand '<name>'".
  const urlPathPart = baseUrl.split('?')[0];
  const pathPlaceholderNames = new Set([...urlPathPart.matchAll(/(?<!\$)\{([^{}]+)\}/g)].map((m) => m[1]));

  let resolvedUrl = baseUrl;
  if (!Array.isArray(paramsVariables) || pathPlaceholderNames.size === 0) {
    return { resolvedUrl, pathPlaceholderNames };
  }

  for (const param of paramsVariables) {
    const name = String(param?.name ?? '');
    if (!name) continue;
    if (!pathPlaceholderNames.has(name)) continue;
    if (param?.value == null) continue;
    resolvedUrl = resolvedUrl.split(`{${name}}`).join(String(param.value));
  }

  return { resolvedUrl, pathPlaceholderNames };
}

function applyEndpointQuery(
  stepConfig: any,
  paramsVariables: any[] | undefined,
  pathPlaceholderNames: Set<string>,
  hasNonEqualOperator: boolean,
) {
  if (!Array.isArray(paramsVariables) || paramsVariables.length === 0 || hasNonEqualOperator) return;

  const queryOnlyParams = paramsVariables.filter((e: any) => {
    const name = String(e?.name ?? '');
    return !pathPlaceholderNames.has(name);
  });

  if (queryOnlyParams.length === 0) return;

  stepConfig.args.query = queryOnlyParams.reduce((acc: any, e: any) => {
    const name = String(e?.name ?? '');
    if (!name) return acc;
    acc[name] = e?.value;
    return acc;
  }, {});
}

function applyEndpointBody(
  stepConfig: any,
  isRawBodySelected: boolean,
  rawBody: any,
  bodyVariables: any[] | undefined,
) {
  if (isRawBodySelected) {
    try {
      const rawJsonStr = String(rawBody?.value ?? '').replace(/(?<!")(\$\{[^}]+\})(?!")/g, '"$1"');
      const rawJson = JSON.parse(rawJsonStr);
      stepConfig.args.body = rawJson;
    } catch (e: any) {
      console.log(`Unable to save JSON to Yaml. ${e.message}`);
    }
    return;
  }

  if (Array.isArray(bodyVariables) && bodyVariables.length > 0) {
    stepConfig.args.body = bodyVariables.reduce((acc: any, e: any) => {
      acc[e.name] = e.value;
      return acc;
    }, {});
  }
}

function applyEndpointHeaders(stepConfig: any, headersVariables: any[] | undefined) {
  if (Array.isArray(headersVariables) && headersVariables.length > 0) {
    stepConfig.args.headers = headersVariables.reduce((acc: any, e: any) => {
      acc[e.name] = e.value;
      return acc;
    }, {});
  }
}

function injectNonceStep(finishedFlow: Map<any, any>, stepName: string) {
  const step = finishedFlow.get(stepName);
  const headers = step?.args?.headers;
  if (!headers) return;

  const nonceHeaderKey = Object.keys(headers as Record<string, unknown>).find(
    (key) => key.toLowerCase() === 'x-ruuter-nonce',
  );
  if (!nonceHeaderKey) return;

  const nonceStepName = `${stepName}_get_new_nonce`;
  const nonceResultName = `${stepName}_nonce`;

  headers[nonceHeaderKey] = `\${${nonceResultName}.response.body[0].nonce}`;

  redirectReferencesTo(finishedFlow, stepName, nonceStepName);

  insertStepBefore(finishedFlow, stepName, nonceStepName, {
    call: 'http.post',
    args: {
      url: '[#SERVICE_TRAINING_RESQL]/get-new-nonce',
    },
    result: nonceResultName,
    next: stepName,
  });
}

function insertStepBefore(finishedFlow: Map<any, any>, beforeKey: string, newKey: string, newValue: any) {
  const entries = Array.from(finishedFlow.entries());
  finishedFlow.clear();
  for (const [key, value] of entries) {
    if (key === beforeKey) {
      finishedFlow.set(newKey, newValue);
    }
    finishedFlow.set(key, value);
  }
}

function redirectReferencesTo(finishedFlow: Map<any, any>, targetStepName: string, newStepName: string) {
  finishedFlow.forEach((step, stepName) => {
    if (stepName === targetStepName) return;

    if (step?.next === targetStepName) {
      step.next = newStepName;
    }

    if (Array.isArray(step?.switch)) {
      step.switch.forEach((branch: any) => {
        if (branch?.next === targetStepName) {
          branch.next = newStepName;
        }
      });
    }
  });
}

function handleMultiChoiceQuestion(
  finishedFlow: Map<any, any>,
  parentStepName: string,
  parentNode: Node<NodeDataProps>,
  childNode: Node<NodeDataProps> | undefined,
  serviceName: string,
) {
  const rootServiceName = serviceName.replace(/_mcq_\d+_\d+$/, '');
  parentNode.data.multiChoiceQuestion?.buttons.forEach((b) => {
    b.payload = b.payload.replace(/\/[^/]*_mcq_/, `/${rootServiceName}_mcq_`);
  });

  const finalQuestion = resolveMessageContent(parentNode?.data?.multiChoiceQuestion?.question ?? '');

  return finishedFlow.set(parentStepName, {
    assign: {
      buttons: parentNode?.data?.multiChoiceQuestion?.buttons ?? [],
      res: {
        result: finalQuestion,
      },
    },
    next: childNode ? toSnakeCase(childNode.data.label ?? 'format_messages') : 'format_messages',
  });
}

function handleJumpToServiceStep(parentNode: Node<NodeDataProps>, finishedFlow: Map<any, any>, parentStepName: string) {
  const resultName = `${parentStepName}_result`;
  const returnStepName = 'return_next_service_res';

  finishedFlow.set(parentStepName, {
    template: '[#SERVICE_PROJECT_LAYER]/jump-to-service',
    requestType: 'templates',
    body: {
      chatId: "${chatId ?? ''}",
      authorId: "${authorId ?? ''}",
      serviceName: parentNode.data.jumpToService?.serviceName ?? '',
      input: (parentNode.data.jumpToService?.input ?? []).map((e: Assign) => normalizeAssignValue(e.value)),
    },
    result: resultName,
    next: returnStepName,
  });

  finishedFlow.set(returnStepName, {
    return: `\${${resultName}.response ?? ''}`,
    next: 'end',
  });
}

function handleDynamicChoices(
  finishedFlow: Map<any, any>,
  parentStepName: string,
  parentNode: Node<NodeDataProps>,
  childNode: Node<NodeDataProps> | undefined,
) {
  const list = parentNode.data.dynamicChoices?.list ?? '';
  finishedFlow.set(parentStepName, {
    call: 'http.post',
    args: {
      url: '[#SERVICE_DMAPPER]/generate/buttons-list',
      body: {
        list: stringToArray(list, list),
        service_name: parentNode.data.dynamicChoices?.serviceName ?? '',
        key: parentNode.data.dynamicChoices?.key ?? '',
        payload_prefix: '#service, /POST/services/active/',
        payload_keys: parentNode.data.dynamicChoices?.payloadKeys.split(',').filter((item) => item.trim()) ?? [],
      },
    },
    result: 'dynamic_choices_res',
    next: 'assign_dynamic_choices_buttons',
  });

  return finishedFlow.set('assign_dynamic_choices_buttons', {
    assign: {
      buttons: '${dynamic_choices_res.response.body.response ?? []}',
    },
    next: childNode ? toSnakeCase(childNode.data.label ?? 'format_messages') : 'format_messages',
  });
}

const getTemplate = (node: Node, stepName: string, nextStep?: string) => {
  const data = getTemplateDataFromNode(node);

  return {
    template: `${data?.templateName}`,
    requestType: 'templates',
    body: data?.body,
    result: data?.resultName ?? `${stepName}_result`,
    next: nextStep ?? 'format_messages',
  };
};

const getTemplateDataFromNode = (node: Node): { templateName: string; body?: any; resultName?: string } | undefined => {
  if (node.data.stepType === StepType.Auth) {
    return {
      templateName: '[#SERVICE_PROJECT_LAYER]/tara',
      resultName: 'TARA',
    };
  }
  if (node.data.stepType === StepType.Input) {
    return {
      templateName: '[#SERVICE_PROJECT_LAYER]/client-input',
      resultName: `client_input_${node.data.clientInputId}_result`,
    };
  }
  if (node.data.stepType === StepType.FileGenerate) {
    return {
      templateName: '[#SERVICE_PROJECT_LAYER]/file-generate',
      body: {
        fileName: node.data.fileName ?? '',
        fileContent: node.data.fileContent ?? '',
      },
    };
  }
  if (node.data.stepType === StepType.FileSign) {
    return {
      templateName: '[#SERVICE_PROJECT_LAYER]/siga',
      body: {
        type: 'smart_id',
        country: 'EE',
      },
      resultName: 'SiGa',
    };
  }
  if (node.data.stepType === StepType.JumpToService) {
    return {
      templateName: '[#SERVICE_PROJECT_LAYER]/jump-to-service',
      body: {
        chatId: "${chatId ?? ''}",
        authorId: "${authorId ?? ''}",
        serviceName: node.data.jumpToService?.serviceName ?? '',
        input: (node.data.jumpToService?.input ?? []).map((e: Assign) => normalizeAssignValue(e.value)),
      },
    };
  }
  if (node.data.stepType === StepType.FinishingStepRedirect) {
    return {
      templateName: '[#SERVICE_PROJECT_LAYER]/direct-to-cs',
      body: {
        message: node.data.message ?? '',
      },
    };
  }
  if (node.data.stepType === StepType.FinishingStepEnd) {
    return {
      templateName: '[#SERVICE_PROJECT_LAYER]/end-conversation',
      body: {
        message: node.data.message ?? '',
      },
    };
  }
  if (node.data.stepType === StepType.OpenWebpage) {
    return {
      templateName: '[#SERVICE_PROJECT_LAYER]/open-webpage',
      body: {
        link: node.data.link ?? '',
        linkText: node.data.linkText ?? '',
      },
    };
  }
};

export const saveFlowClick = async (status: 'draft' | 'ready' = 'ready', showError: boolean = true) => {
  const name = removeTrailingUnderscores(useServiceStore.getState().serviceNameDashed());
  const serviceId = useServiceStore.getState().serviceId;
  const description = useServiceStore.getState().description;
  const slot = useServiceStore.getState().slot;
  const examples = useServiceStore.getState().examples;
  const entities = useServiceStore.getState().entities;
  const isCommon = useServiceStore.getState().isCommon;
  const isNewService = useServiceStore.getState().isNewService;
  const edges = useServiceStore.getState().edges;
  const nodes = useServiceStore.getState().nodes as Node<NodeDataProps>[];

  await saveFlow({
    name: name || `${t('newService.defaultServiceName').toString()}_${format(new Date(), 'dd_MM_yyyy_HH_mm_ss')}`,
    edges,
    nodes,
    onSuccess: () => {
      useToastStore.getState().success({
        title: i18next.t('newService.toast.success'),
        message: i18next.t('newService.toast.savedSuccessfully'),
      });
      useServiceStore.getState().enableTestButton();
    },
    onError: (e: AxiosError) => {
      useToastStore.getState().error({
        title: i18next.t('newService.toast.failed'),
        message: e.response?.status === 409 ? t('newService.toast.serviceNameAlreadyExists') : e?.message,
      });
    },
    description,
    slot,
    examples,
    entities,
    isCommon,
    serviceId,
    isNewService,
    status,
    showError,
  });
};

export const editServiceInfo = async () => {
  const name = removeTrailingUnderscores(useServiceStore.getState().serviceNameDashed());
  const description = useServiceStore.getState().description;
  const serviceId = useServiceStore.getState().serviceId;
  const slot = useServiceStore.getState().slot;

  const tasks: Promise<any>[] = [];

  tasks.push(
    api.post(editService(serviceId), {
      name,
      description,
      slot,
      type: 'POST',
      updateServiceDb: true,
      state: 'ready',
    }),
  );

  await Promise.all(tasks)
    .then(() =>
      useToastStore.getState().success({
        title: i18next.t('newService.toast.success'),
        message: i18next.t('newService.toast.savedSuccessfully'),
      }),
    )
    .catch((e) => {
      useToastStore.getState().error({
        title: i18next.t('newService.toast.saveFailed'),
        message: e?.message,
      });
    });
};
