import { prisma } from "@/server/db/client";
import { appUrl, firstName, noticeLanguage, queueNotice } from "@/server/email/notices";
import { sendEmail } from "@/server/email/send";
import { type Message, render } from "@/server/email/templates";
import { defineJob } from "@/server/jobs/queue";
import { findInvitationForNotice } from "./invitation-repository";

// The team's emails. Every notify* function puts a job on the "notify" queue and never throws: a mail outage must
// not undo or slow down the change that caused it, and the worker retries a failed delivery. Jobs carry only ids;
// the worker loads the rows fresh.

/** A host invited someone to the team: the invitation email, with the link to register or sign in and join. */
export function notifyInvitation(invitationId: string): void {
  queueNotice(invitation, { invitationId });
}

const invitation = defineJob(
  "notify",
  "notify.invitation",
  async ({ invitationId }: { invitationId: string }) => {
    const now = new Date();
    const invited = await findInvitationForNotice(prisma, invitationId);
    // Cancelled or run out before the worker got to it: no email.
    if (invited?.status !== "PENDING" || invited.expiresAt <= now) return;
    const l = noticeLanguage(invited.locale);
    const days = Math.max(1, Math.round((invited.expiresAt.getTime() - now.getTime()) / 86_400_000));
    const host = invited.invitedBy;
    const place = invited.business.name;
    const role = invited.role.name;
    const link = appUrl(`/invite/${invited.token}`);
    await sendEmail({
      to: invited.email,
      idempotencyKey: `invitation-${invited.id}`,
      replyTo: host.isDeleted ? undefined : host.email,
      ...render(
        l === "ar"
          ? `${host.name} يدعوك للانضمام إلى فريق ${place}`
          : `${host.name} invited you to join ${place}`,
        l === "ar"
          ? {
              kicker: "دعوة إلى الفريق",
              title: `أهلًا ${firstName(invited.name)}`,
              body: [
                `يدعوك ${host.name} للانضمام إلى فريق ${place} على Mabeet بدور «${role}».`,
                "أنشئ حسابك من الرابط أدناه، أو سجّل الدخول إن كان لديك حساب بهذا البريد، وتنضمّ مباشرة.",
              ],
              details: [
                { label: "المكان", value: place },
                { label: "الدور", value: role },
              ],
              action: { label: "اقبل الدعوة", url: link },
              footnote: `تعمل هذه الدعوة لمدة ${days} أيام. إن لم تكن تتوقعها، تجاهل هذه الرسالة.`,
            }
          : {
              kicker: "Team invitation",
              title: `Hello ${firstName(invited.name)}`,
              body: [
                `${host.name} invited you to join the ${place} team on Mabeet as ${role}.`,
                "Create your account from the link below, or sign in if you already have one with this email, and you're in.",
              ],
              details: [
                { label: "Place", value: place },
                { label: "Role", value: role },
              ],
              action: { label: "Accept the invitation", url: link },
              footnote: `This invitation works for ${days} days. If you weren't expecting it, ignore this email.`,
            },
        l,
      ),
    });
  },
);

/** The invited person joined: the host who invited them hears it, in their own account's language. */
export function notifyInvitationAccepted(invitationId: string): void {
  queueNotice(invitationAccepted, { invitationId });
}

const invitationAccepted = defineJob(
  "notify",
  "notify.invitation-accepted",
  async ({ invitationId }: { invitationId: string }) => {
    const invited = await findInvitationForNotice(prisma, invitationId);
    if (invited?.status !== "ACCEPTED" || invited.invitedBy.isDeleted) return;
    const host = invited.invitedBy;
    const l = noticeLanguage(host.locale);
    const name = invited.acceptedBy?.name ?? invited.name;
    const place = invited.business.name;
    const role = invited.role.name;
    const team = appUrl(`/dashboard/${invited.businessId}/team`);
    const message: Message =
      l === "ar"
        ? {
            kicker: "الفريق",
            title: `${name} قبل دعوتك`,
            body: [`انضمّ ${name} إلى فريق ${place} بدور «${role}».`],
            details: [
              { label: "المكان", value: place },
              { label: "الدور", value: role },
            ],
            action: { label: "افتح الفريق", url: team },
          }
        : {
            kicker: "Team",
            title: `${name} accepted your invitation`,
            body: [`${name} joined the ${place} team as ${role}.`],
            details: [
              { label: "Place", value: place },
              { label: "Role", value: role },
            ],
            action: { label: "Open the team", url: team },
          };
    await sendEmail({
      to: host.email,
      idempotencyKey: `invitation-accepted-${invited.id}`,
      ...render(message.title, message, l),
    });
  },
);
