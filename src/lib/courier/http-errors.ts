/** Pulls the first human message out of the error shapes Steadfast and Pathao use. */
export function errorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { message?: unknown; errors?: unknown; error?: unknown };
  if (b.errors && typeof b.errors === 'object') {
    for (const v of Object.values(b.errors as Record<string, unknown>)) {
      if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
      if (typeof v === 'string') return v;
    }
  }
  if (typeof b.message === 'string' && b.message) return b.message;
  if (typeof b.error === 'string' && b.error) return b.error;
  return null;
}
