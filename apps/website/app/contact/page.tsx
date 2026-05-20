import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Book an architecture audit with the Klorad team. Tell us what you need to model and we'll walk you through the platform mapped to your world.",
  alternates: { canonical: "/contact" },
};

const expectations = [
  "A walkthrough tailored to your domain",
  "A look at the platform and the SDK",
  "A direct line to the team behind it",
];

export default function ContactPage() {
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="absolute inset-0 grid-field" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-40 h-[600px] w-[600px] rounded-full bg-accent-soft blur-3xl"
      />
      <div className="relative z-10 mx-auto max-w-container px-6 py-24 md:px-8 md:py-32">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="animate-fade-up">
            <Eyebrow>Contact</Eyebrow>
            <h1 className="mt-6 text-4xl font-light leading-[1.05] text-text-primary md:text-5xl">
              Book an architecture audit.
            </h1>
            <p className="mt-6 max-w-md text-lg font-light leading-relaxed text-text-secondary">
              Tell us about the place you need to model: a campus, a corridor,
              a city, a site. We&apos;ll show you Klorad mapped to it.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-text-secondary">
              {expectations.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="text-accent">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
