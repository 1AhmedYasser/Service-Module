import { ServiceState } from 'types';
import { ServiceDependency } from 'types/service-dependency';
import { describe, expect, it, vi } from 'vitest';

import { findAffectedActiveServices } from './service-draft-return';

const incoming = (
  serviceId: string,
  state: ServiceState | null = ServiceState.Active,
  overrides: Partial<ServiceDependency> = {},
): ServiceDependency => ({
  direction: 'incoming',
  serviceId,
  name: `Service ${serviceId}`,
  state,
  type: 'POST',
  deleted: false,
  incomingCount: 0,
  outgoingCount: 0,
  ...overrides,
});

const graph = (edges: Record<string, ServiceDependency[]>) =>
  vi.fn((serviceId: string) => Promise.resolve(edges[serviceId] ?? []));

describe('findAffectedActiveServices', () => {
  it('returns nothing when no service depends on the target', async () => {
    const result = await findAffectedActiveServices('target', graph({}));

    expect(result).toEqual([]);
  });

  it('returns direct Active dependents', async () => {
    const result = await findAffectedActiveServices('target', graph({ target: [incoming('a')] }));

    expect(result).toEqual([{ serviceId: 'a', name: 'Service a', state: ServiceState.Active }]);
  });

  it('ignores outgoing, deleted and non-Active dependents', async () => {
    const fetch = graph({
      target: [
        incoming('out', ServiceState.Active, { direction: 'outgoing' }),
        incoming('deleted', ServiceState.Active, { deleted: true }),
        incoming('draft', ServiceState.Draft),
        incoming('ready', ServiceState.Ready),
      ],
    });

    const result = await findAffectedActiveServices('target', fetch);

    expect(result).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('includes Active services that reach the target through other Active services', async () => {
    const result = await findAffectedActiveServices(
      'target',
      graph({ target: [incoming('a')], a: [incoming('b')], b: [incoming('c')] }),
    );

    expect(result.map((service) => service.serviceId)).toEqual(['a', 'b', 'c']);
  });

  it('does not traverse through non-Active services', async () => {
    const fetch = graph({ target: [incoming('draft', ServiceState.Draft)], draft: [incoming('a')] });

    const result = await findAffectedActiveServices('target', fetch);

    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalledWith('draft');
  });

  it('handles cycles and services reachable through several paths', async () => {
    const fetch = graph({
      target: [incoming('a'), incoming('b')],
      a: [incoming('b'), incoming('target')],
      b: [incoming('a')],
    });

    const result = await findAffectedActiveServices('target', fetch);

    expect(result.map((service) => service.serviceId)).toEqual(['a', 'b']);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
