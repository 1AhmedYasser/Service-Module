import api from 'services/api-dev';
import { buildExplainRequest, findUnresolvedPathPlaceholder } from 'store/new-services.store';
import { EndpointDefinition, EndpointVariableData } from 'types/endpoint';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateJsonRequest } from './json-request-utils';

vi.mock('services/api-dev', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const makeEndpoint = (
  url: string,
  params: Partial<EndpointVariableData>[] = [],
  methodType = 'get',
): EndpointDefinition =>
  ({
    id: 'e1',
    label: `${methodType.toUpperCase()} ${url}`,
    path: url,
    url,
    type: 'openApi',
    methodType,
    supported: true,
    isSelected: true,
    params: {
      variables: params.map((p, i) => ({ id: `${i}`, type: 'string', ...p })) as EndpointVariableData[],
      rawData: {},
      isRawSelected: false,
    },
  }) as EndpointDefinition;

describe('buildExplainRequest', () => {
  it('substitutes OpenAPI path params (in: path) without pre-encoding values', () => {
    const request = buildExplainRequest(
      makeEndpoint('https://ekilex.ee/api/word/search/{word}', [{ name: 'word', in: 'path', value: 'kas tan' }]),
    );
    expect(request.url).toBe('https://ekilex.ee/api/word/search/kas tan');
    expect(request.params).toEqual({});
  });

  it('keeps Estonian characters in path params unencoded so Ruuter encodes them once', () => {
    const request = buildExplainRequest(
      makeEndpoint('https://ekilex.ee/api/word/search/{word}', [{ name: 'word', paramType: 'path', value: 'õun' }]),
    );
    expect(request.url).toBe('https://ekilex.ee/api/word/search/õun');
  });

  it('substitutes path params marked with paramType', () => {
    const request = buildExplainRequest(
      makeEndpoint('https://ekilex.ee/api/word/search/{word}', [{ name: 'word', paramType: 'path', value: 'kastan' }]),
    );
    expect(request.url).toBe('https://ekilex.ee/api/word/search/kastan');
  });

  it('treats params matching a URL placeholder as path params even without markers', () => {
    const request = buildExplainRequest(
      makeEndpoint('https://ekilex.ee/api/word/search/{word}', [{ name: 'word', value: 'kastan' }]),
    );
    expect(request.url).toBe('https://ekilex.ee/api/word/search/kastan');
    expect(request.params).toEqual({});
  });

  it('keeps query params as params and out of the path', () => {
    const request = buildExplainRequest(
      makeEndpoint('https://ekilex.ee/api/word/search/{word}', [
        { name: 'word', in: 'path', value: 'kastan' },
        { name: 'lang', in: 'query', value: 'est' },
      ]),
    );
    expect(request.url).toBe('https://ekilex.ee/api/word/search/kastan');
    expect(request.params).toEqual({ lang: 'est' });
  });

  it('leaves URLs without path params unchanged (GET and POST)', () => {
    const get = buildExplainRequest(makeEndpoint('https://ekilex.ee/api/words', [{ name: 'q', value: 'x' }]));
    expect(get.url).toBe('https://ekilex.ee/api/words');
    expect(get.params).toEqual({ q: 'x' });

    const post = buildExplainRequest(makeEndpoint('https://ekilex.ee/api/words', [], 'post'));
    expect(post.url).toBe('https://ekilex.ee/api/words');
    expect(post.method).toBe('post');
  });

  it('does not touch ${var} runtime variables', () => {
    const request = buildExplainRequest(makeEndpoint('https://example.com/${base}/items', []));
    expect(request.url).toBe('https://example.com/${base}/items');
  });
});

describe('findUnresolvedPathPlaceholder', () => {
  it('returns the missing placeholder name', () => {
    expect(findUnresolvedPathPlaceholder('https://ekilex.ee/api/word/search/{word}')).toBe('word');
  });

  it('ignores ${var} runtime variables and resolved URLs', () => {
    expect(findUnresolvedPathPlaceholder('https://example.com/${base}/items')).toBeUndefined();
    expect(findUnresolvedPathPlaceholder('https://ekilex.ee/api/word/search/kastan')).toBeUndefined();
  });
});

describe('generateJsonRequest', () => {
  beforeEach(() => vi.mocked(api.post).mockReset());

  it('sends the resolved URL to the explain endpoint', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { response: { ok: true } } });
    const result = await generateJsonRequest(
      makeEndpoint('https://ekilex.ee/api/word/search/{word}', [{ name: 'word', in: 'path', value: 'kastan' }]),
    );
    expect(result).toEqual({ ok: true });
    const [, payload] = vi.mocked(api.post).mock.calls[0];
    expect((payload as any).requests[0]).toMatchObject({
      url: 'https://ekilex.ee/api/word/search/kastan',
      method: 'get',
      params: {},
    });
  });
});
