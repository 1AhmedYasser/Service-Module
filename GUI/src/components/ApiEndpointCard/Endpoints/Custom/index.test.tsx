import { render, screen } from '@testing-library/react';
import { EndpointData, EndpointTab } from 'types/endpoint';
import { describe, expect, it, vi } from 'vitest';

import EndpointCustom from './index';

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

vi.mock('services/api-dev', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('../../..', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../..');
  return { ...actual, RequestVariables: () => null };
});

const buildEndpoint = (responseSchema?: string) =>
  ({ endpointId: 'e1', name: 'Test', type: 'custom', definitions: [], responseSchema }) as unknown as EndpointData;

const renderCard = (endpoint: EndpointData, responseSchema?: string) =>
  render(
    <EndpointCustom
      endpoint={endpoint}
      isLive
      requestValues={{} as never}
      requestTab={{ tab: EndpointTab.Params, showRawData: false }}
      setRequestTab={vi.fn()}
      responseSchema={responseSchema}
    />,
  );

const getResponseBox = () => screen.getByPlaceholderText('{...}') as HTMLTextAreaElement;

describe('EndpointCustom response box', () => {
  it('shows the response stored on the endpoint, as the API registry does', () => {
    renderCard(buildEndpoint('{"registry": true}'));
    expect(getResponseBox().value).toBe('{"registry": true}');
  });

  it('shows the response passed in by the canvas when the endpoint has none', () => {
    renderCard(buildEndpoint(), '[{"live": true}]');
    expect(getResponseBox().value).toBe('[{"live": true}]');
  });

  it('fills the box when the canvas response arrives after opening', () => {
    const endpoint = buildEndpoint();
    const { rerender } = renderCard(endpoint);
    expect(screen.queryByPlaceholderText('{...}')).toBeNull();

    rerender(
      <EndpointCustom
        endpoint={endpoint}
        isLive
        requestValues={{} as never}
        requestTab={{ tab: EndpointTab.Params, showRawData: false }}
        setRequestTab={vi.fn()}
        responseSchema='[{"live": true}]'
      />,
    );

    expect(getResponseBox().value).toBe('[{"live": true}]');
  });
});
