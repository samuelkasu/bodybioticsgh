import { baseApi } from "@/lib/api/baseApi";

export type Review = {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  /** Relative to this origin; /uploads is proxied to the API (next.config.ts). */
  photoUrl: string | null;
  createdAt: string;
  /** True on the signed-in customer's own review. */
  isMine: boolean;
};

export type ReviewSummary = {
  average: number;
  count: number;
  /** Keyed "1".."5" — JSON object keys are strings even when the API sends ints. */
  distribution: Record<string, number>;
};

export type ReviewList = {
  summary: ReviewSummary;
  items: Review[];
};

export type SubmitReviewArgs = {
  slug: string;
  rating: number;
  comment: string;
  photo?: File | null;
  /** Drops the photo already on the review without attaching a new one. */
  removePhoto?: boolean;
};

export const reviewsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getReviews: build.query<ReviewList, string>({
      query: (slug) => `/products/${slug}/reviews`,
      providesTags: (_result, _error, slug) => [{ type: "Review" as const, id: slug }],
    }),

    submitReview: build.mutation<Review, SubmitReviewArgs>({
      query: ({ slug, rating, comment, photo, removePhoto }) => {
        // multipart, not JSON: the photo travels with the rating in one request,
        // so a saved review can never end up pointing at an upload that failed.
        const body = new FormData();
        body.append("rating", String(rating));
        body.append("comment", comment);
        if (photo) body.append("photo", photo);
        if (removePhoto) body.append("removePhoto", "true");

        return { url: `/products/${slug}/reviews`, method: "POST", body };
      },
      invalidatesTags: (_result, _error, { slug }) => [{ type: "Review", id: slug }],
    }),

    deleteReview: build.mutation<{ removed: boolean }, string>({
      query: (slug) => ({ url: `/products/${slug}/reviews`, method: "DELETE" }),
      invalidatesTags: (_result, _error, slug) => [{ type: "Review", id: slug }],
    }),
  }),
});

export const { useGetReviewsQuery, useSubmitReviewMutation, useDeleteReviewMutation } =
  reviewsApi;
