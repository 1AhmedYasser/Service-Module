import { EndpointData } from 'types/endpoint';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from './api-dev';
import { persistEndpoints } from './endpoint.service';

vi.mock('./api-dev', () => ({
  default: { post: vi.fn().mockResolvedValue({ data: {} }) },
}));

const buildEndpoint = (isNew: boolean): EndpointData =>
  ({
    endpointId: 'e1',
    name: 'Words',
    type: 'custom',
    isNew,
    definitions: [{ id: 'd1', url: 'https://example.com', methodType: 'GET', isSelected: true }],
    responseSchema: '[{"big": "response"}]',
  }) as unknown as EndpointData;

describe('persistEndpoints', () => {
  beforeEach(() => vi.mocked(api.post).mockClear());

  it.each([
    ['creating', true],
    ['updating', false],
  ])('does not send the response when %s an API', async (_, isNew) => {
    await persistEndpoints([buildEndpoint(isNew)], 'service-1');

    const payload = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('responseSchema');
    expect(payload).toMatchObject({ endpointId: 'e1', name: 'Words', serviceId: 'service-1' });
  });

  it('keeps the response on the endpoint so the API registry list still has it', async () => {
    const endpoint = buildEndpoint(false);
    await persistEndpoints([endpoint], '');
    expect(endpoint.responseSchema).toBe('[{"big": "response"}]');
  });
});
