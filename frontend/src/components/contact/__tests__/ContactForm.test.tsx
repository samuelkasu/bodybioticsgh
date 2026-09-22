import { validateContact } from "@/components/contact/ContactForm";
import { validateCredentials } from "@/components/account/AuthForms";
import type { ContactPayload } from "@/lib/features/contact/contactApi";

const valid: ContactPayload = {
  name: "Ama Mensah",
  email: "ama@example.com",
  subject: "Inquiry",
  message: "Do you have the Anua cleansing oil in stock?",
};

describe("contact validation", () => {
  it("accepts a complete enquiry", () => {
    expect(validateContact(valid)).toEqual({});
  });

  it("requires a name", () => {
    expect(validateContact({ ...valid, name: "   " }).name).toBeDefined();
  });

  it("requires a valid email", () => {
    expect(validateContact({ ...valid, email: "nope" }).email).toBeDefined();
  });

  it("requires a message with some substance", () => {
    // Matches the server's 10-character minimum, so a one-word "hi" fails here
    // rather than after a round-trip.
    expect(validateContact({ ...valid, message: "hi" }).message).toBeDefined();
    expect(validateContact({ ...valid, message: "         " }).message).toBeDefined();
  });
});

describe("credential validation", () => {
  it("accepts a valid login", () => {
    expect(
      validateCredentials("ama@example.com", "x", { requireStrongPassword: false }),
    ).toEqual({});
  });

  it("does not impose a length rule on sign-in", () => {
    // Rejecting a short password on login would leak the policy and break
    // accounts created before it changed.
    const errors = validateCredentials("ama@example.com", "short", {
      requireStrongPassword: false,
    });

    expect(errors.password).toBeUndefined();
  });

  it("requires a long password on registration", () => {
    const errors = validateCredentials("ama@example.com", "short", {
      requireStrongPassword: true,
    });

    expect(errors.password).toMatch(/at least 10/i);
  });

  it("rejects an empty password either way", () => {
    expect(
      validateCredentials("ama@example.com", "", { requireStrongPassword: false })
        .password,
    ).toBeDefined();
  });

  it("rejects a malformed email", () => {
    expect(
      validateCredentials("ama@", "a-long-enough-password", {
        requireStrongPassword: true,
      }).email,
    ).toBeDefined();
  });
});
