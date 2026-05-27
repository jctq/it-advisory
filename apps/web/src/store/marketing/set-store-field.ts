export function resolveStoreFieldValue<TState extends object, K extends keyof TState>(
  state: TState,
  key: K,
  value: TState[K] | ((previous: TState[K]) => TState[K]),
): TState[K] {
  if (typeof value === 'function') {
    return (value as (previous: TState[K]) => TState[K])(state[key]);
  }
  return value;
}

export function buildStoreFieldPatch<TState extends object, K extends keyof TState>(
  state: TState,
  key: K,
  value: TState[K] | ((previous: TState[K]) => TState[K]),
): Pick<TState, K> {
  return { [key]: resolveStoreFieldValue(state, key, value) } as Pick<TState, K>;
}
