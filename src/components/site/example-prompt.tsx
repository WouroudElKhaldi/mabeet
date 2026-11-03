import { MessageSquareText } from "lucide-react";

/** Something to try typing into an AI app, shown as the visitor's own chat message. */
export function ExamplePrompt({ label, prompt }: { label: string; prompt: string }) {
  return (
    <figure>
      <figcaption className="mb-2 flex items-center gap-1.5 text-[0.6875rem] font-bold tracking-[0.12em] text-muted uppercase">
        <MessageSquareText className="size-3.5" aria-hidden />
        {label}
      </figcaption>
      <blockquote className="rounded-2xl rounded-ss-sm bg-accent-soft px-4 py-3 text-[0.9375rem] leading-relaxed ring-1 ring-accent-line">
        {prompt}
      </blockquote>
    </figure>
  );
}
