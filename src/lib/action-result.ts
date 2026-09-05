/** Uniform result type for server actions so the UI can show errors without throwing. */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; status?: number };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: unknown, fallback = "Er is iets misgegaan"): ActionResult<never> {
  if (error instanceof Error) {
    const status = (error as { status?: number }).status;
    return { ok: false, error: error.message || fallback, status };
  }
  return { ok: false, error: fallback };
}

/** Wraps a server action body so every thrown error becomes a typed result. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (err) {
    console.error("[action]", err);
    return fail(err);
  }
}
