import type { EnvConfigType } from '@/services/environment';

/**
 * Replica-side auto-persist env holder — stubbed.
 *
 * The replica-sync subsystem was removed. The replica-side mutators
 * (`applyRemote*`, `softDelete*`, `markAvailable*`) in the custom-font /
 * texture / dictionary / OPDS / ABS stores previously read the boot-registered
 * envConfig from here to fire-and-forget persist their in-memory state. With
 * replica pull gone, those mutators are only reached from legacy code paths
 * and no env is registered, so `getReplicaPersistEnv` always returns `null`
 * and the persist calls self-skip. The stores keep importing it so they
 * compile unchanged.
 */
const replicaPersistEnv: EnvConfigType | null = null;

export const enableReplicaAutoPersist = (_envConfig: EnvConfigType | null): void => {
  void _envConfig;
};

export const getReplicaPersistEnv = (): EnvConfigType | null => replicaPersistEnv;
