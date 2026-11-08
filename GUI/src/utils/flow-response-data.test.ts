import { Node } from '@xyflow/react';
import { StepType } from 'types';
import { Assign } from 'types/assign';
import { EndpointData } from 'types/endpoint';
import { EndpointResponseVariable } from 'types/endpoint/endpoint-response-variables';
import { NodeDataProps } from 'types/service-flow';
import { describe, expect, it } from 'vitest';

import {
  compactResponseData,
  getResponseBoxContent,
  isExplainErrorResponse,
  omitResponseSchema,
  resolveVariablePath,
  sanitizeFlowNode,
  withResolvedAssignData,
} from './flow-response-data';

const endpoint = {
  endpointId: 'e1',
  name: 'Words',
  definitions: [{ id: 'd1', url: 'https://example.com', methodType: 'GET' }],
  responseSchema: '[{"big": "response"}]',
} as unknown as EndpointData;

const makeNode = (data: Partial<NodeDataProps>): Node<NodeDataProps> =>
  ({ id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data }) as Node<NodeDataProps>;

const response = {
  words: [{ wordId: 1, tags: ['a'] }, { wordId: 2 }],
  meta: { total: 2, 'odd"key': { deep: true } },
};

const variables: EndpointResponseVariable[] = [
  { name: 'Words', nodeId: 'n1', resultName: 'Words_res', response, chips: [] },
];

describe('compactResponseData', () => {
  it('keeps only the type of objects and arrays', () => {
    expect(compactResponseData({ a: 1 })).toEqual({});
    expect(compactResponseData([1, 2])).toEqual([]);
  });

  it('keeps small values and empties long strings', () => {
    expect(compactResponseData(5)).toBe(5);
    expect(compactResponseData('short')).toBe('short');
    expect(compactResponseData(null)).toBeNull();
    expect(compactResponseData(undefined)).toBeUndefined();
    expect(compactResponseData('x'.repeat(201))).toBe('');
  });
});

describe('omitResponseSchema', () => {
  it('returns a copy without the response and leaves the original untouched', () => {
    const result = omitResponseSchema(endpoint);
    expect(result).not.toHaveProperty('responseSchema');
    expect(result.endpointId).toBe('e1');
    expect(endpoint.responseSchema).toBe('[{"big": "response"}]');
  });
});

describe('sanitizeFlowNode', () => {
  it('removes the response from API nodes but keeps their configuration', () => {
    const node = makeNode({ stepType: StepType.UserDefined, endpoint });
    const result = sanitizeFlowNode(node);
    expect(result.data.endpoint).not.toHaveProperty('responseSchema');
    expect(result.data.endpoint?.definitions).toEqual(endpoint.definitions);
  });

  it('removes endpoints attached to nodes that are not API nodes', () => {
    const node = makeNode({ stepType: StepType.Assign, endpoint, assignElements: [] });
    expect(sanitizeFlowNode(node).data).not.toHaveProperty('endpoint');
  });

  it('keeps Assign expressions and only the type of their data', () => {
    const element: Assign = {
      id: 'a1',
      key: 'words',
      value: '${Words_res.response.body.words}',
      data: response.words,
      slots: [{ id: '', key: 'words', value: '${Words_res.response.body.words}', data: response.words }],
    };
    const result = sanitizeFlowNode(makeNode({ stepType: StepType.Assign, assignElements: [element] }));
    const [saved] = result.data.assignElements!;
    expect(saved).toMatchObject({ id: 'a1', key: 'words', value: element.value, data: [] });
    expect(saved.slots?.[0]).toMatchObject({ value: element.value, data: [] });
    expect(element.data).toBe(response.words);
  });

  it('compacts data in Next Service inputs', () => {
    const input: Assign = { id: 'i1', key: 'meta', value: '${Words_res.response.body.meta}', data: response.meta };
    const node = makeNode({
      stepType: StepType.JumpToService,
      jumpToService: { serviceName: 'other', input: [input] },
    });
    expect(sanitizeFlowNode(node).data.jumpToService?.input[0].data).toEqual({});
  });

  it('returns nodes without response data unchanged', () => {
    const node = makeNode({ stepType: StepType.Textfield, message: 'Hi' });
    expect(sanitizeFlowNode(node)).toBe(node);
  });
});

describe('resolveVariablePath', () => {
  const roots = new Map<string, unknown>([['Words_res.response.body', response]]);

  it('resolves dot, bracket and index paths', () => {
    expect(resolveVariablePath('Words_res.response.body', roots)).toBe(response);
    expect(resolveVariablePath('Words_res.response.body.words', roots)).toBe(response.words);
    expect(resolveVariablePath('Words_res.response.body["words"]["0"]', roots)).toBe(response.words[0]);
    expect(resolveVariablePath('Words_res.response.body.words[1]', roots)).toBe(response.words[1]);
    expect(resolveVariablePath('Words_res.response.body.words.0.tags', roots)).toBe(response.words[0].tags);
    expect(resolveVariablePath(String.raw`Words_res.response.body["meta"]["odd\"key"]`, roots)).toBe(
      response.meta['odd"key'],
    );
  });

  it('returns undefined for unknown roots, missing fields and expressions', () => {
    expect(resolveVariablePath('Other_res.response.body', roots)).toBeUndefined();
    expect(resolveVariablePath('Words_res.response.body.missing', roots)).toBeUndefined();
    expect(resolveVariablePath('Words_res.response.bodyExtra', roots)).toBeUndefined();
    expect(resolveVariablePath("Words_res.response.body.words ?? ''", roots)).toBeUndefined();
  });

  it('uses the longest matching root', () => {
    const nested = new Map<string, unknown>([
      ['Words', { response: { body: 'wrong' } }],
      ['Words_res.response.body', response],
    ]);
    expect(resolveVariablePath('Words_res.response.body.meta', nested)).toBe(response.meta);
  });
});

describe('withResolvedAssignData', () => {
  it('fills in data from live responses, including bracket paths from the field tree', () => {
    const [fromChip, fromTree] = withResolvedAssignData(
      [
        { id: '1', key: 'words', value: '${Words_res.response.body.words}', data: [] },
        { id: '2', key: 'first', value: '${Words_res.response.body["words"]["0"]}', data: 'Words_res.response.body' },
      ],
      variables,
    );
    expect(fromChip.data).toBe(response.words);
    expect(fromTree.data).toBe(response.words[0]);
  });

  it('fills in data for variables that point to earlier assigned variables', () => {
    const [, chained] = withResolvedAssignData(
      [
        { id: '1', key: 'meta', value: '${Words_res.response.body.meta}', data: {} },
        { id: '2', key: 'total', value: '${meta.total}' },
      ],
      variables,
    );
    expect(chained.data).toBe(2);
  });

  it('keeps the saved data when the API response is not available', () => {
    const element: Assign = { id: '1', key: 'words', value: '${Words_res.response.body.words}', data: [] };
    const failed: EndpointResponseVariable[] = [
      { ...variables[0], response: { statusCode: 500, error: 'Server error' } },
    ];
    expect(withResolvedAssignData([element], failed)[0]).toBe(element);
    expect(withResolvedAssignData([element], [])[0]).toBe(element);
  });
});

describe('isExplainErrorResponse', () => {
  it('detects the error shape returned for failed API calls', () => {
    expect(isExplainErrorResponse({ statusCode: 404, error: 'Not found' })).toBe(true);
    expect(isExplainErrorResponse({ statusCode: 200, error: 'x', extra: 1 })).toBe(false);
    expect(isExplainErrorResponse(response)).toBe(false);
    expect(isExplainErrorResponse([])).toBe(false);
  });
});

describe('getResponseBoxContent', () => {
  it('prefers the live response, then the registry, then the live error', () => {
    const error = { statusCode: 500, error: 'down' };
    expect(getResponseBoxContent({ a: 1 }, 'registry')).toBe(JSON.stringify([{ a: 1 }], undefined, 4));
    expect(getResponseBoxContent(error, 'registry')).toBe('registry');
    expect(getResponseBoxContent(undefined, 'registry')).toBe('registry');
    expect(getResponseBoxContent(error, undefined)).toBe(JSON.stringify([error], undefined, 4));
    expect(getResponseBoxContent(undefined, undefined)).toBeUndefined();
  });
});
