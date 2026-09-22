/**
 * The wire contract with the .NET API. Every endpoint answers with exactly one
 * of these shapes (see backend/src/BodyBiotics.Api/Http/ApiResults.cs), and
 * `baseApi` unwraps the success envelope once so components never see it.
 *
 * Types only: the frontend no longer serves any API routes.
 */
export type ApiSuccess<T> = { data: T };

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

export type ApiError = {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Field-keyed validation messages, when the API sends them. */
    details?: Record<string, string[]> | unknown;
  };
};

/** Narrows an unknown RTK Query error payload to the API's error envelope. */
export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }

  const { error } = value as { error: unknown };
  return (
    typeof error === "object" && error !== null && "code" in error && "message" in error
  );
}

export function apiErrorMessage(
  value: unknown,
  fallback = "Something went wrong",
): string {
  if (isApiError(value)) {
    return value.error.message;
  }

  // RTK Query hands back `{ status, data: <response body> }`, both from a
  // rejected `unwrap()` and from a query's `error`. Without this the envelope
  // is one level deeper than the check above looks, so every caller silently
  // fell back to its generic message and the API's own — "An order that is PAID
  // cannot become PAID", "does not have 3 left in stock" — never reached anyone.
  if (typeof value === "object" && value !== null && "data" in value) {
    const { data } = value as { data: unknown };
    if (isApiError(data)) {
      return data.error.message;
    }
  }

  return fallback;
}
