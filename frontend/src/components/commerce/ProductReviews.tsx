"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { StarRating, StarRatingInput } from "@/components/commerce/StarRating";
import { Button } from "@/components/ui/Button";
import { ErrorState, Skeleton } from "@/components/ui/Feedback";
import { TextareaField } from "@/components/ui/Field";
import { apiErrorMessage } from "@/lib/api/http";
import { useGetSessionQuery } from "@/lib/features/auth/authApi";
import {
  useDeleteReviewMutation,
  useGetReviewsQuery,
  useSubmitReviewMutation,
  type Review,
} from "@/lib/features/reviews/reviewsApi";
import { BLUR_DATA_URL } from "@/lib/utils/imagePlaceholder";

const MIN_COMMENT = 10;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export type ProductReviewsProps = {
  slug: string;
  productName: string;
};

/**
 * Reviews block under the product: the average and the spread on the left, then
 * everyone's comments, then the signed-in customer's own form. Anonymous
 * visitors read the reviews and get a link to sign in rather than a dead form.
 */
export function ProductReviews({ slug, productName }: ProductReviewsProps) {
  const { data, isLoading, isError, error, refetch } = useGetReviewsQuery(slug);
  const { data: session } = useGetSessionQuery();

  const signedIn = Boolean(session?.user);
  const mine = data?.items.find((review) => review.isMine);

  return (
    <section
      aria-labelledby="reviews-heading"
      className="rounded-card mt-8 bg-white p-5 sm:p-8 lg:p-10"
    >
      <div className="border-b border-[#e6e6e6] pb-4">
        <h2 id="reviews-heading" className="font-sans text-2xl font-bold">
          Reviews ({data?.summary.count ?? 0})
        </h2>
        <span aria-hidden="true" className="bg-ink mt-4 block h-1 w-24" />
      </div>

      {isError ? (
        <div className="mt-8">
          <ErrorState
            message={apiErrorMessage(error, "We could not load the reviews.")}
            onRetry={() => void refetch()}
          />
        </div>
      ) : isLoading ? (
        <div className="mt-8 grid gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <div>
            {data && data.summary.count > 0 ? (
              <>
                <div className="flex items-center gap-4">
                  <p className="font-sans text-5xl font-medium">
                    {data.summary.average.toFixed(1)}
                  </p>
                  <div>
                    <StarRating value={data.summary.average} size="md" />
                    <p className="text-cocoa mt-1 text-sm">
                      {data.summary.count}{" "}
                      {data.summary.count === 1 ? "review" : "reviews"}
                    </p>
                  </div>
                </div>

                <ul className="mt-5 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = data.summary.distribution[String(star)] ?? 0;
                    const share =
                      data.summary.count === 0 ? 0 : (count / data.summary.count) * 100;

                    return (
                      <li key={star} className="flex items-center gap-3 text-sm">
                        <span className="text-cocoa w-12 shrink-0">{star} star</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#efe9e1]">
                          <span
                            className="bg-sand-deep block h-full rounded-full transition-[width] duration-500"
                            style={{ width: `${share}%` }}
                          />
                        </span>
                        <span className="text-cocoa w-6 text-right tabular-nums">
                          {count}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <ul className="mt-8 space-y-6">
                  {data.items.map((review) => (
                    <li key={review.id}>
                      <ReviewCard review={review} />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-lg font-bold text-[#101010]">
                There are no reviews yet.
              </p>
            )}
          </div>

          <div>
            {signedIn ? (
              <ReviewForm slug={slug} productName={productName} existing={mine} />
            ) : (
              <div className="rounded-card bg-[#f9f9f9] p-6">
                <h3 className="font-sans text-xl font-bold">
                  Be the first to review “{productName}”
                </h3>
                <p className="text-cocoa mt-2 text-sm leading-relaxed">
                  Reviews come from customers with an account, so shoppers know a real
                  person wrote them.
                </p>
                <div className="mt-4">
                  <Link
                    href={`/account/login?next=${encodeURIComponent(`/product/${slug}`)}`}
                    className="focus-ring"
                  >
                    <Button>Sign in to review</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="flex gap-4">
      <span
        aria-hidden="true"
        className="bg-sand text-cocoa-deep flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
      >
        {review.authorName.charAt(0).toUpperCase()}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="font-sans text-base font-bold text-[#101010]">
            {review.authorName}
          </p>
          <StarRating value={review.rating} />
          <time dateTime={review.createdAt} className="text-taupe-soft text-xs">
            {dateFormatter.format(new Date(review.createdAt))}
          </time>
          {review.isMine && (
            <span className="bg-blush text-cocoa-deep rounded-full px-2 py-0.5 text-xs">
              Your review
            </span>
          )}
        </div>

        <p className="text-cocoa text-meta mt-2 leading-relaxed">{review.comment}</p>

        {review.photoUrl && (
          <Image
            src={review.photoUrl}
            alt={`Photo from ${review.authorName}`}
            width={320}
            height={320}
            sizes="200px"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="rounded-card mt-3 h-auto w-[200px] object-cover transition-transform duration-300 hover:scale-[1.02]"
          />
        )}
      </div>
    </article>
  );
}

function ReviewForm({
  slug,
  productName,
  existing,
}: {
  slug: string;
  productName: string;
  existing: Review | undefined;
}) {
  const [submitReview, { isLoading }] = useSubmitReviewMutation();
  const [deleteReview, { isLoading: isDeleting }] = useDeleteReviewMutation();

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [errors, setErrors] = useState<{ rating?: string; comment?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // A blob URL is a live handle, not a string: each one has to be released or
  // the picked file stays in memory for the life of the tab.
  const previewUrl = useRef<string | null>(null);

  const pickPhoto = (file: File | null) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = file ? URL.createObjectURL(file) : null;

    setPreview(previewUrl.current);
    setPhoto(file);
  };

  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setSaved(false);

    const found: { rating?: string; comment?: string } = {};
    if (rating < 1) found.rating = "Pick a rating from 1 to 5 stars.";
    if (comment.trim().length < MIN_COMMENT) {
      found.comment = `Tell other shoppers a little more (at least ${MIN_COMMENT} characters).`;
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      await submitReview({
        slug,
        rating,
        comment: comment.trim(),
        photo,
        removePhoto,
      }).unwrap();

      pickPhoto(null);
      setRemovePhoto(false);
      if (fileInput.current) fileInput.current.value = "";
      setSaved(true);
    } catch (error) {
      setSubmitError(apiErrorMessage(error, "We could not save your review."));
    }
  };

  const onPickPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (file && file.size > MAX_PHOTO_BYTES) {
      setSubmitError("Photos must be 4MB or smaller.");
      event.target.value = "";
      return;
    }

    setSubmitError(null);
    pickPhoto(file);
  };

  const onDelete = async () => {
    setSubmitError(null);

    try {
      await deleteReview(slug).unwrap();
      setRating(0);
      setComment("");
      pickPhoto(null);
      setRemovePhoto(false);
      setSaved(false);
    } catch (error) {
      setSubmitError(apiErrorMessage(error, "We could not remove your review."));
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4">
      <div>
        <h3 className="font-sans text-xl font-bold">
          {existing ? "Edit your review" : `Be the first to review “${productName}”`}
        </h3>
        <p className="text-taupe-soft mt-1 text-sm">
          Your name is shown with your review. Your email address is never published.
        </p>
      </div>

      <div>
        <p className="text-cocoa mb-1 text-sm font-medium">
          Your rating <span className="text-[#ff0000]">*</span>
        </p>
        <StarRatingInput
          value={rating}
          onChange={(next) => setRating(next)}
          label="Your rating"
          disabled={isLoading}
        />
        {errors.rating && (
          <p role="alert" className="mt-1 text-xs text-red-700">
            {errors.rating}
          </p>
        )}
      </div>

      <TextareaField
        label={
          <>
            Your review <span className="text-[#ff0000]">*</span>
          </>
        }
        rows={5}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        error={errors.comment}
        className="rounded-card border-neutral-200"
        required
      />

      <div>
        <label
          htmlFor="review-photo"
          className="text-cocoa mb-1 block text-sm font-medium"
        >
          Add a photo (optional)
        </label>
        <input
          id="review-photo"
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onPickPhoto}
          disabled={isLoading}
          className="focus-ring file:bg-sand file:text-cocoa-deep file:rounded-control block w-full text-sm file:mr-3 file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium"
        />

        {preview && (
          <Image
            src={preview}
            alt=""
            width={200}
            height={200}
            unoptimized
            className="rounded-card mt-3 h-auto w-[140px] object-cover"
          />
        )}

        {existing?.photoUrl && !photo && (
          <label className="text-cocoa mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={removePhoto}
              onChange={(event) => setRemovePhoto(event.target.checked)}
            />
            Remove the photo on my review
          </label>
        )}
      </div>

      {submitError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {submitError}
        </p>
      )}

      {saved && (
        <p role="status" className="bg-lime/20 text-cocoa rounded-lg px-3 py-2 text-sm">
          Thanks — your review is live.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={isLoading} className="rounded-card">
          {isLoading ? "Saving…" : existing ? "Update review" : "Submit review"}
        </Button>

        {existing && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => void onDelete()}
            disabled={isDeleting}
          >
            {isDeleting ? "Removing…" : "Delete my review"}
          </Button>
        )}
      </div>
    </form>
  );
}
