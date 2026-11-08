import { Node } from '@xyflow/react';
import { StepType } from 'types';
import { Assign } from 'types/assign';
import { EndpointData } from 'types/endpoint';
import { EndpointResponseVariable } from 'types/endpoint/endpoint-response-variables';
import { NodeDataProps } from 'types/service-flow';
import { isTemplate, templateToString } from 'utils/string-util';

const MAX_KEPT_STRING_LENGTH = 200;
const PATH_SEGMENT = /^(?:\.([^.[\]]+)|\["((?:[^"\\]|\\.)*)"\]|\[(\d+)\])/;

export const compactResponseData = (value: unknown): unknown => {
  if (Array.isArray(value)) return [];
  if (value !== null && typeof value === 'object') return {};
  if (typeof value === 'string' && value.length > MAX_KEPT_STRING_LENGTH) return '';
  return value;
};

const compactAssign = (element: Assign): Assign => {
  const compacted: Assign = { ...element };
  if ('data' in element) compacted.data = compactResponseData(element.data);
  if (Array.isArray(element.slots)) compacted.slots = element.slots.map(compactAssign) as Assign['slots'];
  return compacted;
};

export const omitResponseSchema = <T extends Pick<EndpointData, 'responseSchema'>>({
  responseSchema: _responseSchema,
  ...rest
}: T): Omit<T, 'responseSchema'> => rest;

export const sanitizeFlowNode = <T extends Node>(node: T): T => {
  const data = node.data as Partial<NodeDataProps> | undefined;
  if (!data || typeof data !== 'object') return node;

  const { endpoint, assignElements, jumpToService, ...rest } = data;
  if (endpoint === undefined && assignElements === undefined && jumpToService === undefined) return node;

  const nextData: Partial<NodeDataProps> = { ...rest };
  if (endpoint && data.stepType === StepType.UserDefined) nextData.endpoint = omitResponseSchema(endpoint);
  if (assignElements !== undefined) {
    nextData.assignElements = Array.isArray(assignElements) ? assignElements.map(compactAssign) : assignElements;
  }
  if (jumpToService !== undefined) {
    nextData.jumpToService = Array.isArray(jumpToService?.input)
      ? { ...jumpToService, input: jumpToService.input.map(compactAssign) }
      : jumpToService;
  }

  return { ...node, data: nextData };
};

export const sanitizeFlowNodes = <T extends Node>(nodes: T[]): T[] => nodes.map(sanitizeFlowNode);

export const isExplainErrorResponse = (response: unknown): boolean => {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return false;
  const keys = Object.keys(response).sort((a, b) => a.localeCompare(b));
  return keys.length === 2 && keys[0] === 'error' && keys[1] === 'statusCode';
};

const parsePathSegments = (path: string): string[] | undefined => {
  const segments: string[] = [];
  let rest = path;
  while (rest.length > 0) {
    const match = PATH_SEGMENT.exec(rest);
    if (!match) return undefined;
    segments.push(match[1] ?? match[2]?.replaceAll(String.raw`\"`, '"') ?? match[3]);
    rest = rest.slice(match[0].length);
  }
  return segments;
};

const readSegment = (current: unknown, segment: string): unknown => {
  if (Array.isArray(current)) {
    const index = Number(segment);
    return Number.isInteger(index) ? current[index] : undefined;
  }
  if (current !== null && typeof current === 'object' && Object.hasOwn(current, segment)) {
    return (current as Record<string, unknown>)[segment];
  }
  return undefined;
};

export const resolveVariablePath = (path: string, roots: Map<string, unknown>): unknown => {
  let matchedRoot: string | undefined;
  for (const root of roots.keys()) {
    const boundary = path.charAt(root.length);
    const isRootMatch = path.startsWith(root) && (boundary === '' || boundary === '.' || boundary === '[');
    if (isRootMatch && (matchedRoot === undefined || root.length > matchedRoot.length)) matchedRoot = root;
  }
  if (matchedRoot === undefined) return undefined;

  const segments = parsePathSegments(path.slice(matchedRoot.length));
  if (!segments) return undefined;

  let current = roots.get(matchedRoot);
  for (const segment of segments) {
    current = readSegment(current, segment);
    if (current === undefined) return undefined;
  }
  return current;
};

export const getResponseRoots = (variables: EndpointResponseVariable[]): Map<string, unknown> => {
  const roots = new Map<string, unknown>();
  for (const variable of variables) {
    if (!variable.resultName || variable.response === undefined || isExplainErrorResponse(variable.response)) continue;
    roots.set(`${variable.resultName}.response.body`, variable.response);
  }
  return roots;
};

export const resolveAssignValueData = (value: string, roots: Map<string, unknown>): unknown =>
  typeof value === 'string' && isTemplate(value) ? resolveVariablePath(templateToString(value), roots) : undefined;

export const withResolvedAssignData = (elements: Assign[], variables: EndpointResponseVariable[]): Assign[] => {
  const roots = getResponseRoots(variables);
  return elements.map((element) => {
    const resolved = resolveAssignValueData(element.value, roots);
    const data = resolved === undefined ? element.data : resolved;
    if (element.key) roots.set(element.key, data);
    return resolved === undefined ? element : { ...element, data };
  });
};

export const getResponseBoxContent = (liveResponse: unknown, registryResponse: string | undefined) => {
  const formatLive = () => JSON.stringify([liveResponse], undefined, 4);
  if (liveResponse !== undefined && !isExplainErrorResponse(liveResponse)) return formatLive();
  if (registryResponse) return registryResponse;
  return liveResponse === undefined ? undefined : formatLive();
};
