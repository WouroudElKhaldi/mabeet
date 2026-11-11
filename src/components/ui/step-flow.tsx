"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useRef } from "react";
import { Button, ButtonLink } from "./button";
import { FormStep } from "./form-dialog";

/**
 * One screen of a step-by-step flow (the guided setup): a progress bar, one question, and a way forward. When the
 * screen is a form (`saves`), its own button says `continueLabel`, saves and moves on; "Save and exit" saves it too,
 * then leaves. A screen that saves as it goes (photos, rooms) moves on with `nextLabel`. Every screen is its own
 * address, so Back and a reload land on it.
 */
export function StepFlow({
  progressLabel,
  stepLabel,
  step,
  total,
  title,
  intro,
  saves,
  continueLabel,
  nextLabel,
  nextHref,
  backLabel,
  backHref,
  exitLabel,
  exitHref,
  children,
}: {
  progressLabel: string;
  /** "Step 2 of 8". */
  stepLabel: string;
  /** Counted from 1. */
  step: number;
  total: number;
  title: string;
  intro?: string;
  /** The screen is a form that saves on its own button. */
  saves: boolean;
  continueLabel: string;
  nextLabel: string;
  nextHref: string;
  backLabel: string;
  backHref: string | null;
  exitLabel: string;
  exitHref: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const content = useRef<HTMLDivElement>(null);
  // Set by "Save and exit" just before it sends the form; any click inside the form clears it, so the form's own
  // button always moves on.
  const leaving = useRef(false);

  const saved = () => router.push(leaving.current ? exitHref : nextHref);

  const saveAndExit = () => {
    const form = content.current?.querySelector("form");
    if (!saves || !form) {
      router.push(exitHref);
      return;
    }
    if (!form.reportValidity()) return;
    leaving.current = true;
    form.requestSubmit();
  };

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted">{stepLabel}</p>
        <Button size="sm" variant="secondary" onClick={saveAndExit}>
          {exitLabel}
        </Button>
      </div>
      <div
        role="progressbar"
        aria-label={progressLabel}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={step}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
      <header className="grid gap-2">
        <h1 className="font-display text-3xl font-semibold text-balance">{title}</h1>
        {intro ? <p className="text-muted">{intro}</p> : null}
      </header>
      <div
        ref={content}
        onClickCapture={() => {
          leaving.current = false;
        }}
      >
        <FormStep onSaved={saved} submitLabel={continueLabel}>
          {children}
        </FormStep>
      </div>
      <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        {backHref ? (
          <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-semibold underline">
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            {backLabel}
          </Link>
        ) : (
          <span />
        )}
        <ButtonLink href={nextHref} variant={saves ? "ghost" : "primary"} size="sm">
          {nextLabel}
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </ButtonLink>
      </nav>
    </div>
  );
}
