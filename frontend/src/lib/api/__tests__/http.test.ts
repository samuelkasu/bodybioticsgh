import { apiErrorMessage, isApiError, type ApiError } from "@/lib/api/http";

const notFound: ApiError = {
  error: { code: "NOT_FOUND", message: 'No product with slug "ghost"' },
};

describe("api error envelope", () => {
  it("recognises the API's error shape", () => {
    expect(isApiError(notFound)).toBe(true);
  });

  it("recognises an error carrying validation details", () => {
    const withDetails: ApiError = {
      error: {
        code: "BAD_REQUEST",
        message: "Invalid request",
        details: { perPage: ["Too big: expected number to be <=48"] },
      },
    };

    expect(isApiError(withDetails)).toBe(true);
  });

  it("rejects anything that is not the envelope", () => {
    expect(isApiError(null)).toBe(false);
    expect(isApiError(undefined)).toBe(false);
    expect(isApiError("boom")).toBe(false);
    expect(isApiError({})).toBe(false);
    expect(isApiError({ data: { id: "p1" } })).toBe(false);
    // A proxy or gateway error page: shaped like an error, not ours.
    expect(isApiError({ error: "Bad Gateway" })).toBe(false);
    expect(isApiError({ error: { message: "missing code" } })).toBe(false);
  });

  it("reads the message out for display", () => {
    expect(apiErrorMessage(notFound)).toBe('No product with slug "ghost"');
  });

  it("falls back when the payload is not an API error", () => {
    // Offline: RTK Query hands back a FETCH_ERROR with no envelope at all.
    expect(apiErrorMessage({ status: "FETCH_ERROR" })).toBe("Something went wrong");
    expect(apiErrorMessage(undefined, "You appear to be offline")).toBe(
      "You appear to be offline",
    );
  });
});
