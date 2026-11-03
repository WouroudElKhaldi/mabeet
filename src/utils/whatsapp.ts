// A WhatsApp number may be stored with spaces or a "+" (as people type it), so only its digits go in the link.

/** Opens a WhatsApp chat with `phone`, given with its country code. */
export function whatsappLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
