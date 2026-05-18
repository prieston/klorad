"use client";

import { useState } from "react";

type FormState = "idle" | "submitting" | "submitted" | "error";

const fieldClass =
  "w-full rounded-md border border-line-strong bg-surface-1 px-3.5 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent";
const labelClass =
  "block text-xs font-medium uppercase tracking-[0.16em] text-text-tertiary";

export function ContactForm() {
  const [state, setState] = useState<FormState>("idle");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === "submitting") return;

    const form = event.currentTarget;
    setState("submitting");

    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed request");
      }
      setState("submitted");
      form.reset();
    } catch (error) {
      console.error("Contact submission failed", error);
      setState("error");
    }
  };

  const message =
    state === "submitted"
      ? "Thank you — we've received your message and will be in touch."
      : state === "error"
        ? "Something went wrong. Please try again, or email us directly."
        : null;

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-panel space-y-5 rounded-2xl p-6 md:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="name" className={labelClass}>
            Your name
          </label>
          <input id="name" name="name" type="text" required className={fieldClass} />
        </div>
        <div className="space-y-2">
          <label htmlFor="organization" className={labelClass}>
            Organization
          </label>
          <input
            id="organization"
            name="organization"
            type="text"
            required
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="role" className={labelClass}>
            Your role
          </label>
          <input id="role" name="role" type="text" required className={fieldClass} />
        </div>
        <div className="space-y-2">
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className={fieldClass}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="context" className={labelClass}>
          What do you want to model?
        </label>
        <textarea
          id="context"
          name="context"
          required
          rows={5}
          className={`${fieldClass} resize-y`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={state === "submitting"}
          className="inline-flex items-center justify-center rounded-md bg-accent px-6 py-3 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "submitting" ? "Sending…" : "Send message"}
        </button>
        {message && <p className="text-sm text-text-secondary">{message}</p>}
      </div>
    </form>
  );
}
