type QueryResult<T> = {
  data: T | null;
  error: unknown;
};

type CountResult = {
  count: number | null;
  error: unknown;
};

function describeDatabaseError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "Unknown database error";
}

/**
 * Resolve a Supabase query without hiding infrastructure or schema failures.
 * A null data value is still allowed for maybeSingle() and empty-result queries.
 */
export async function requireDatabaseQuery<T>(
  query: PromiseLike<QueryResult<T>>,
  fallback: T,
  operation: string,
): Promise<T> {
  const result = await query;
  if (result.error) {
    throw new Error(`${operation}: ${describeDatabaseError(result.error)}`);
  }
  return result.data ?? fallback;
}

export async function requireDatabaseCount(
  query: PromiseLike<CountResult>,
  fallback: number,
  operation: string,
): Promise<number> {
  const result = await query;
  if (result.error) {
    throw new Error(`${operation}: ${describeDatabaseError(result.error)}`);
  }
  return result.count ?? fallback;
}
