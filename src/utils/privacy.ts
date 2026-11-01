// Guest contact details for team members who may see a booking but not reach the guest (no `guests.contact`).

/** "+96171123456" -> "+961••••3456". Keeps enough to recognise a guest without exposing the number. */
export function maskPhone(phone: string): string {
  const visibleTail = 4;
  if (phone.length <= visibleTail + 4) return "•".repeat(phone.length);
  return `${phone.slice(0, 4)}${"•".repeat(4)}${phone.slice(-visibleTail)}`;
}

/** "maya@example.com" -> "m•••@example.com" */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}•••@${domain}`;
}
