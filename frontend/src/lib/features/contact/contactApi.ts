import { baseApi } from "@/lib/api/baseApi";

/** The four options the original Elementor contact form offered. */
export const CONTACT_SUBJECTS = [
  { value: "Inquiry", label: "Inquiry" },
  { value: "Complaint", label: "Complaint" },
  { value: "Request", label: "Request" },
  { value: "Suggestion", label: "Suggestion" },
] as const;

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number]["value"];

export type ContactPayload = {
  name: string;
  email: string;
  subject: ContactSubject;
  message: string;
};

export const contactApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    submitContact: build.mutation<{ received: boolean }, ContactPayload>({
      query: (body) => ({ url: "/contact", method: "POST", body }),
    }),
  }),
});

export const { useSubmitContactMutation } = contactApi;
