import { ServiceDependency } from 'types/service-dependency';
import { ServiceState } from 'types/service-state';

export interface AffectedService {
  readonly serviceId: string;
  readonly name: string;
  readonly state: ServiceState;
}

export type FetchServiceDependencies = (serviceId: string) => Promise<ServiceDependency[]>;

export const findAffectedActiveServices = async (
  serviceId: string,
  fetchDependencies: FetchServiceDependencies,
): Promise<AffectedService[]> => {
  const visited = new Set<string>([serviceId]);
  const affected = new Map<string, AffectedService>();
  let queue = [serviceId];

  while (queue.length > 0) {
    const levels = await Promise.all(queue.map(fetchDependencies));
    const nextQueue: string[] = [];

    for (const dependency of levels.flat()) {
      if (dependency.direction !== 'incoming' || dependency.deleted) continue;
      if (dependency.state !== ServiceState.Active || visited.has(dependency.serviceId)) continue;

      visited.add(dependency.serviceId);
      affected.set(dependency.serviceId, {
        serviceId: dependency.serviceId,
        name: dependency.name,
        state: dependency.state,
      });
      nextQueue.push(dependency.serviceId);
    }

    queue = nextQueue;
  }

  return Array.from(affected.values());
};
