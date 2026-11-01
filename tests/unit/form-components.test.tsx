import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { LabeledControl } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { SlideLabel, slideParent } from "@/components/ui/slide-label";
import { LogIn } from "lucide-react";

// The shared form and page parts, rendered: what a screen reader is told, and what keeps a long title on a phone.

describe("FormError", () => {
  it("announces the message, and shows nothing when there is none", () => {
    const html = renderToStaticMarkup(<FormError message="Those dates were just taken." />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("text-danger");
    expect(html).toContain("Those dates were just taken.");
    expect(renderToStaticMarkup(<FormError message={null} />)).toBe("");
  });

  it("takes the caller's classes, for the space around it", () => {
    expect(renderToStaticMarkup(<FormError message="x" className="mt-4" />)).toContain("mt-4");
  });
});

describe("LabeledControl", () => {
  it("links its error to the control inside, so a screen reader reads them together", () => {
    const html = renderToStaticMarkup(
      <LabeledControl label="Room" error="Pick a room">
        <select />
      </LabeledControl>,
    );
    const describedBy = /<select[^>]*aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(describedBy).toBeTruthy();
    expect(html).toContain(`id="${describedBy}"`);
    expect(html).toMatch(/<select[^>]*aria-invalid="true"/);
  });

  it("leaves the control alone when there is nothing to say", () => {
    const html = renderToStaticMarkup(
      <LabeledControl label="Room">
        <select />
      </LabeledControl>,
    );
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain("aria-invalid");
  });
});

describe("PageHeader and Panel", () => {
  it("let a long title shrink instead of pushing the page sideways on a phone", () => {
    const header = renderToStaticMarkup(<PageHeader title="بيت الجبل في دير القمر" />);
    expect(header).toContain("min-w-0");
    expect(header).toContain("rise-in");
    expect(renderToStaticMarkup(<Panel title="Rooms">…</Panel>)).toContain("min-w-0");
  });
});

describe("SlideLabel", () => {
  it("keeps the words for screen readers and hides the icon from them", () => {
    const html = renderToStaticMarkup(<SlideLabel icon={LogIn}>Sign in</SlideLabel>);
    expect(html).toContain("Sign in");
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("slides only under a parent marked with slideParent, and mirrors arrows in Arabic", () => {
    const html = renderToStaticMarkup(
      <SlideLabel icon={LogIn} flipInRtl>
        Sign in
      </SlideLabel>,
    );
    expect(slideParent).toBe("group/slide");
    expect(html).toContain("group-hover/slide:start-[calc(100%-1rem)]");
    expect(html).toContain("group-hover/slide:opacity-0");
    expect(html).toContain("rtl:rotate-180");
  });

  it("stands still and spins while the button waits", () => {
    const html = renderToStaticMarkup(
      <SlideLabel icon={LogIn} spinning>
        Sign in
      </SlideLabel>,
    );
    expect(html).toContain("animate-spin");
    expect(html).not.toContain("group-hover/slide");
  });
});
