import type { ReactNode } from "react";

export type LegalDocumentProps = {
  title: string;
  /** Rendered under the title, e.g. "Last updated 16 September 2026". */
  updated: string;
  intro: ReactNode;
  children: ReactNode;
};

/**
 * Shared shell for the Terms and Privacy pages: one readable column, a plain
 * heading hierarchy and generous line height. Legal copy is read on a phone at
 * arm's length, so it gets a longer measure and larger body than marketing copy.
 */
export function LegalDocument({ title, updated, intro, children }: LegalDocumentProps) {
  return (
    <article className="mx-auto w-full max-w-[52rem]">
      <h1 className="text-3xl leading-tight sm:text-4xl lg:text-5xl">{title}</h1>
      <p className="text-taupe-soft mt-3 text-sm">{updated}</p>

      <div className="text-cocoa mt-6 space-y-4 text-base leading-relaxed">{intro}</div>

      <div className="mt-10 space-y-10">{children}</div>
    </article>
  );
}

export type LegalSectionProps = {
  /** Numbered like a contract so support can point at "clause 7". */
  number: number;
  heading: string;
  children: ReactNode;
};

export function LegalSection({ number, heading, children }: LegalSectionProps) {
  const id = `clause-${number}`;

  return (
    <section aria-labelledby={id} className="scroll-mt-24" id={id}>
      <h2 className="font-sans text-xl font-bold sm:text-2xl">
        <span className="text-taupe-soft mr-2 tabular-nums">{number}.</span>
        {heading}
      </h2>

      <div className="text-cocoa mt-4 space-y-4 text-base leading-relaxed [&_a]:underline [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
        {children}
      </div>
    </section>
  );
}
