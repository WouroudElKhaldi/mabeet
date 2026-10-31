import { isArabic } from "@/config/appearance";
import { BRAND } from "@/config/brand";

// Plain, table-based HTML that renders the same in Gmail, Outlook and Apple Mail, plus a text version.
// Every value that came from a user is escaped.

const ACCENT = BRAND.accent;
const INK = "#222222";
const MUTED = "#6a6a6a";
const LINE = "#ebebeb";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

interface Detail {
  label: string;
  value: string;
}

export interface Message {
  /** Short line above the title, e.g. "Booking request". */
  kicker: string;
  title: string;
  /** Paragraphs of plain text. */
  body: string[];
  /** Facts shown as a boarding-pass style table. */
  details?: Detail[];
  action?: { label: string; url: string };
  /** Small print under the button. */
  footnote?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Renders one email. Arabic is laid out right to left. */
export function render(subject: string, message: Message, locale = "en"): RenderedEmail {
  const rtl = isArabic(locale);
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  // Arabic has no capitals, and letter spacing breaks its joined letters.
  const caps = rtl ? "" : "letter-spacing:.12em;text-transform:uppercase;";
  const details = message.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-top:2px dashed ${LINE};border-bottom:2px dashed ${LINE}">
        ${message.details
          .map(
            (detail) => `<tr>
              <td style="padding:10px 0;font-size:11px;font-weight:700;${caps}color:${MUTED};width:42%;text-align:${align}">${escapeHtml(detail.label)}</td>
              <td style="padding:10px 0;font-size:15px;font-weight:600;color:${INK};text-align:${align}">${escapeHtml(detail.value)}</td>
            </tr>`,
          )
          .join("")}
      </table>`
    : "";
  const action = message.action
    ? `<p style="margin:24px 0 8px"><a href="${escapeHtml(message.action.url)}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:8px">${escapeHtml(message.action.label)}</a></p>`
    : "";

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}"><body dir="${dir}" style="margin:0;background:#f7f7f7;text-align:${align};font-family:-apple-system,'Segoe UI',Inter,Roboto,Arial,sans-serif;color:${INK}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${LINE}">
        <tr><td style="background:${ACCENT};color:#ffffff;padding:14px 28px;font-size:12px;font-weight:700;${caps}text-align:${align}">
          ${escapeHtml(BRAND.name)} &middot; ${escapeHtml(message.kicker)}
        </td></tr>
        <tr><td dir="${dir}" style="padding:28px;text-align:${align}">
          <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:700">${escapeHtml(message.title)}</h1>
          ${message.body.map((paragraph) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${INK}">${escapeHtml(paragraph)}</p>`).join("")}
          ${details}
          ${action}
          ${message.footnote ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${MUTED}">${escapeHtml(message.footnote)}</p>` : ""}
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:${MUTED}">${escapeHtml(BRAND.name)} &middot; ${escapeHtml(BRAND.tagline)}</p>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    message.title,
    "",
    ...message.body,
    ...(message.details?.length
      ? ["", ...message.details.map((detail) => `${detail.label}: ${detail.value}`)]
      : []),
    ...(message.action ? ["", `${message.action.label}: ${message.action.url}`] : []),
    ...(message.footnote ? ["", message.footnote] : []),
    "",
    `${BRAND.name} · ${BRAND.tagline}`,
  ].join("\n");

  return { subject, html, text };
}
