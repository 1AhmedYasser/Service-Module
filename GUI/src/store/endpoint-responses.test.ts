import { Node } from '@xyflow/react';
import api from 'services/api-dev';
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

vi.mock('services/api-dev', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const response = { words: [{ wordId: 1 }] };
const apiNode = {
  id: 'api-1',
  type: 'custom',
  position: { x: 0, y: 0 },
  data: {
    stepType: StepType.UserDefined,
    label: 'Words - 1',
    endpoint: {
      endpointId: 'e1',
      name: 'Words',
      definitions: [{ id: 'd1', url: 'https://example.com', methodType: 'GET' }],
      responseSchema: '[{"old": true}]',
    },
  },
} as unknown as Node;

describe('API responses kept in memory', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
    useServiceStore.getState().resetState();
  });

  it('keeps each API node response and result name after loading them', async () => {
    useServiceStore.setState({ reactFlowInstance: { getNodes: () => [apiNode] } as never });
    vi.mocked(api.post).mockResolvedValueOnce({ data: { response: [response] } });

    await useServiceStore.getState().loadEndpointsResponseVariables();

    const [variable] = useServiceStore.getState().endpointsResponseVariables;
    expect(variable).toMatchObject({ nodeId: 'api-1', resultName: 'Words_res', response });
    expect(variable.chips.map((chip) => chip.name)).toEqual(['words', 'Base Response', 'Status Code']);
  });

  it('clears the responses when leaving the canvas', () => {
    useServiceStore.setState({
      endpointsResponseVariables: [{ name: 'Words', nodeId: 'api-1', response, chips: [] }],
    });

    useServiceStore.getState().resetState();

    expect(useServiceStore.getState().endpointsResponseVariables).toEqual([]);
  });

  it('removes saved responses from services as they load', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { prod: [], test: [] } });
    vi.mocked(api.post).mockImplementation((url: string) =>
      Promise.resolve(
        url.includes('service-by-id')
          ? {
              data: { name: 'S', structure: { value: JSON.stringify({ nodes: [apiNode], edges: [] }) }, endpoints: [] },
            }
          : { data: { response: [] } },
      ),
    );

    await useServiceStore.getState().loadService('service-1');

    const [loaded] = useServiceStore.getState().nodes;
    expect(loaded.data.endpoint).not.toHaveProperty('responseSchema');
    expect(JSON.stringify(useServiceStore.getState().history)).not.toContain('responseSchema');
  });
});
