/**
 * ESM loader hook: resolves the Next.js "server-only" marker to an empty module so
 * server modules can run in plain Node scripts (seed, knowledge import).
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: new URL("./server-only-empty.mjs", import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
