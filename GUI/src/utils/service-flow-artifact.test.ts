import { Edge, Node } from '@xyflow/react';
import { StepType } from 'types';
import { describe, expect, it } from 'vitest';

import { buildExportPayloadFromService, parseFlowArtifact, serializeFlowArtifact } from './service-flow-artifact';

const endpoint = {
  endpointId: 'e1',
  name: 'Words',
  definitions: [{ id: 'd1', url: 'https://example.com/{word}', methodType: 'GET' }],
  responseSchema: JSON.stringify([{ words: Array.from({ length: 50 }, (_, i) => ({ id: i })) }]),
};

const nodes = [
  { id: 'api', type: 'custom', position: { x: 0, y: 0 }, data: { stepType: StepType.UserDefined, endpoint } },
  {
    id: 'assign',
    type: 'custom',
    position: { x: 0, y: 0 },
    data: {
      stepType: StepType.Assign,
      endpoint,
      assignElements: [{ id: 'a1', key: 'first', value: '${Words_res.response.body.words[0]}', data: { id: 0 } }],
    },
  },
] as unknown as Node[];
const edges: Edge[] = [{ id: 'e', source: 'api', target: 'assign' }];

describe('flow artifacts', () => {
  it('exports without API responses but keeps the API configuration and Assign expressions', () => {
    const exported = JSON.parse(serializeFlowArtifact(nodes, edges));
    expect(JSON.stringify(exported)).not.toContain('responseSchema');
    expect(exported.nodes[0].data.endpoint.definitions).toEqual(endpoint.definitions);
    expect(exported.nodes[1].data).not.toHaveProperty('endpoint');
    expect(exported.nodes[1].data.assignElements[0]).toMatchObject({
      key: 'first',
      value: '${Words_res.response.body.words[0]}',
      data: {},
    });
    expect(exported.edges).toEqual(edges);
  });

  it('cleans older exported files when importing them', () => {
    const oldFile = JSON.stringify({ nodes, edges, settings: { title: 'Old' } });
    const imported = parseFlowArtifact(oldFile);
    expect(JSON.stringify(imported.nodes)).not.toContain('responseSchema');
    expect(imported.nodes[0].data.endpoint?.definitions).toEqual(endpoint.definitions);
    expect(imported.settings?.title).toBe('Old');
  });

  it('cleans stored services when exporting them from the overview', () => {
    const service = { name: 'Old', structure: { value: JSON.stringify({ nodes, edges }) } };
    const exported = buildExportPayloadFromService(service as never);
    expect(exported).not.toContain('responseSchema');
    expect(exported.length).toBeLessThan(JSON.stringify({ nodes, edges }).length);
  });
});
