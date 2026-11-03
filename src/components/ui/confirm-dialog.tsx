"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Button } from "./button";
import { TextArea } from "./field";
import { SheetDialog } from "./sheet-dialog";

export interface ConfirmOptions {
  title: string;
  body?: string;
  /** What the button that goes ahead says: "Delete", "Decline". Never just "Yes". */
  confirmLabel: string;
  /** Defaults to "Go back". */
  cancelLabel?: string;
  /** `danger` (the default) for what cannot be undone; `primary` for a change that is simply worth a second look. */
  tone?: "danger" | "primary";
  /** Adds a box for the reason the person gives ("Reason (optional, the guest sees it)"). */
  reason?: { label: string; placeholder?: string; required?: boolean };
}

/** What a person who went ahead answered. `reason` is empty when no reason box was asked for. */
export interface ConfirmAnswer {
  reason: string;
}

/**
 * Holds the question a screen is waiting on. Asking again before the first is answered answers the first with "no",
 * so no `await` is ever left hanging.
 */
export function createAnswerHolder<Answer>() {
  let resolveCurrent: ((answer: Answer | null) => void) | null = null;
  return {
    ask(): Promise<Answer | null> {
      resolveCurrent?.(null);
      return new Promise((resolve) => {
        resolveCurrent = resolve;
      });
    },
    answer(answer: Answer | null) {
      const resolve = resolveCurrent;
      resolveCurrent = null;
      resolve?.(answer);
    },
  };
}

/**
 * The "are you sure?" step before anything that cannot be undone:
 *
 *   const { confirm, dialog } = useConfirm();
 *   const answer = await confirm({ title: t("deletePhoto.title"), confirmLabel: t("deletePhoto.confirm") });
 *   if (!answer) return;  // the person went back (Esc, the dark layer and the Go back button all mean no)
 *   ...
 *   return <>{dialog}...</>;
 */
export function useConfirm() {
  const [holder] = useState(() => createAnswerHolder<ConfirmAnswer>());
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback(
    (next: ConfirmOptions) => {
      setOptions(next);
      return holder.ask();
    },
    [holder],
  );

  const answer = useCallback(
    (value: ConfirmAnswer | null) => {
      holder.answer(value);
      setOptions(null);
    },
    [holder],
  );

  // A screen that goes away with a question open must not leave its `await` waiting forever.
  useEffect(() => () => holder.answer(null), [holder]);

  return { confirm, dialog: <ConfirmDialog options={options} onAnswer={answer} /> };
}

function ConfirmDialog({
  options,
  onAnswer,
}: {
  options: ConfirmOptions | null;
  onAnswer: (answer: ConfirmAnswer | null) => void;
}) {
  const t = useTranslations("confirm");
  const [reason, setReason] = useState("");
  const blocked = Boolean(options?.reason?.required) && reason.trim() === "";

  return (
    <SheetDialog
      compact
      open={options !== null}
      onClose={() => {
        setReason("");
        onAnswer(null);
      }}
      title={options?.title ?? ""}
      footer={
        options ? (
          <>
            {/* The focus starts on "Go back": a stray Enter must never delete anything. */}
            <Button variant="secondary" data-autofocus onClick={() => onAnswer(null)}>
              {options.cancelLabel ?? t("keep")}
            </Button>
            <Button
              variant={options.tone ?? "danger"}
              disabled={blocked}
              onClick={() => {
                setReason("");
                onAnswer({ reason: reason.trim() });
              }}
            >
              {options.confirmLabel}
            </Button>
          </>
        ) : null
      }
    >
      {options?.body ? <p className="text-muted">{options.body}</p> : null}
      {options?.reason ? (
        <div className={options.body ? "mt-4" : undefined}>
          <TextArea
            label={options.reason.label}
            placeholder={options.reason.placeholder}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      ) : null}
    </SheetDialog>
  );
}
