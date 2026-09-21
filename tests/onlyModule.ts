/**
 * Resolve a ported module found by `import.meta.glob`.
 *
 * The player (P1) and Explore (P2) ports land in parallel with these tests, so
 * the tests locate the module by file name under the owning package's tree
 * instead of hardcoding a path that package has not chosen yet. Exactly one
 * match is required: none means the port has not landed, two means a stale
 * copy would be tested instead of the live one.
 */
export function onlyModule<M>(modules: Record<string, M>, description: string): M {
  const paths = Object.keys(modules);
  if (paths.length === 0) {
    throw new Error(`${description}: no module found. Has its package ported it yet?`);
  }
  if (paths.length > 1) {
    throw new Error(`${description}: expected one module, found ${paths.length}: ${paths.join(', ')}`);
  }
  return modules[paths[0]];
}
