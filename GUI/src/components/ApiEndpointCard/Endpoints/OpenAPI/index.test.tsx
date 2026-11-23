import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import api from 'services/api';
import { EndpointData, EndpointTab } from 'types/endpoint';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EndpointOpenAPI from './index';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: {},
}));

vi.mock('i18n', () => ({
  default: { t: (key: string) => key },
}));

vi.mock('services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('../../..', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../..');
  return { ...actual, RequestVariables: () => null };
});

const spec = {
  paths: {
    '/api/word/search/{word}': {
      get: {
        parameters: [
          { name: 'word', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'lang', in: 'query', schema: { type: 'string' } },
          { name: 'X-Api-Key', in: 'header', schema: { type: 'string' } },
        ],
        responses: { '200': { type: 'array', items: { type: 'string' } } },
      },
    },
    '/api/inline': {
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { name: { type: 'string' }, tags: { type: 'array' } } },
            },
          },
        },
        responses: {},
      },
    },
    '/api/inline-array': {
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' } } } },
            },
          },
        },
        responses: {},
      },
    },
    '/api/ref': {
      post: {
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Word' } } } },
        responses: {},
      },
    },
    '/api/no-body': {
      post: { responses: {} },
    },
  },
  components: { schemas: { Word: { type: 'object', properties: { value: { type: 'string' } } } } },
};

const fetchDefinitions = async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { response: spec } });
  const endpoint = { endpointId: 'e1', name: 'Test', definitions: [] } as unknown as EndpointData;
  render(
    <EndpointOpenAPI
      endpoint={endpoint}
      isLive
      requestValues={{} as never}
      requestTab={{ tab: EndpointTab.Params, showRawData: false }}
      setRequestTab={vi.fn()}
    />,
  );
  await userEvent.type(screen.getAllByRole('textbox')[1], 'https://ekilex.ee/v3/api-docs');
  await userEvent.click(screen.getByText('newService.endpoint.ask'));
  await waitFor(() => expect(endpoint.definitions.length).toBeGreaterThan(0));
  return (label: string) => endpoint.definitions.find((d) => d.label === label)!;
};

describe('EndpointOpenAPI spec parsing', () => {
  beforeEach(() => vi.mocked(api.post).mockReset());

  it('splits header parameters from params and marks path/query params', async () => {
    const get = await fetchDefinitions();
    const def = get('GET /api/word/search/{word}');
    expect(def.params?.variables.map((v) => [v.name, v.paramType])).toEqual([
      ['word', 'path'],
      ['lang', 'query'],
    ]);
    expect(def.headers?.variables.map((v) => v.name)).toEqual(['X-Api-Key']);
    expect(def.body).toBeUndefined();
  });

  it('parses inline, inline-array and $ref request body schemas', async () => {
    const get = await fetchDefinitions();
    expect(get('POST /api/inline').body?.variables.map((v) => v.name)).toEqual(['name', 'tags']);
    const arrayBody = get('POST /api/inline-array').body?.variables[0];
    expect(arrayBody?.name).toBe('items');
    expect((arrayBody?.arrayData as { name: string }[]).map((v) => v.name)).toEqual(['id']);
    expect(get('POST /api/ref').body?.variables.map((v) => v.name)).toEqual(['value']);
  });

  it('always gives POST endpoints a body section', async () => {
    const get = await fetchDefinitions();
    expect(get('POST /api/no-body').body).toEqual({ variables: [], rawData: {}, isRawSelected: false });
  });
});
