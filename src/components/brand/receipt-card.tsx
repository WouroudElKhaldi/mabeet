import { Check } from "lucide-react";
import { BrandScene, SceneLayer, Sheen } from "./brand-scene";
import { Postmark } from "./postmark";

interface ReceiptProps {
  title: string;
  lines: string[];
  footer?: string;
}

/**
 * A short list of promises printed as a till receipt (the `receipt` torn edge, like `DirectReceipts`), tilted a
 * little. Put it in a `SceneLayer` to float it in a `BrandScene` with other art; `ReceiptCard` is it on its own.
 */
export function Receipt({ title, lines, footer }: ReceiptProps) {
  return (
    <div className="relative -rotate-1 drop-shadow-[0_18px_28px_rgb(0_0_0/0.14)]">
      <div className="receipt relative bg-surface px-6 pt-6 pb-10 font-mono text-[0.8125rem] text-ink">
        <p className="text-center text-[0.6875rem] font-bold tracking-[0.18em] text-accent uppercase">
          {title}
        </p>
        <div className="my-4 border-t border-dashed border-line-strong" />
        <ul className="grid gap-3">
          {lines.map((line) => (
            <li key={line} className="flex gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        {footer ? (
          <>
            <div className="my-4 border-t border-dashed border-line-strong" />
            <p className="text-center text-xs text-muted">{footer}</p>
          </>
        ) : null}
        <Sheen />
      </div>
    </div>
  );
}

/**
 * A `Receipt` in its own `BrandScene`: it rises in, leans toward the mouse with light sliding across it, and a
 * turning postmark lands on its corner like a stamp. "At a glance" beside a page's title.
 */
export function ReceiptCard(props: ReceiptProps) {
  return (
    <BrandScene maxDegrees={9} className="mx-auto w-full max-w-sm">
      <SceneLayer enter="rise">
        <Receipt {...props} />
      </SceneLayer>
      <SceneLayer depth={70} enter="stamp" className="absolute -end-1 -top-9 sm:-end-8">
        <Postmark spin className="size-20 rotate-12" />
      </SceneLayer>
    </BrandScene>
  );
}
