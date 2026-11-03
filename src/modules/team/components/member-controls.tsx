"use client";

import { UserMinus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { inputClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

/** A role as the team's forms offer it. */
export interface RoleChoice {
  id: string;
  name: string;
}

/**
 * One member's controls on the team list: move them to another role, or take them off the team, each behind a
 * confirmation. `roles` holds only the roles this person may give; the member's own role stays shown even when it is
 * not one of them.
 */
export function MemberControls({
  businessId,
  member,
  roles,
}: {
  businessId: string;
  member: { id: string; name: string; role: RoleChoice };
  roles: RoleChoice[];
}) {
  const t = useTranslations("dashboard.team");
  const tConfirm = useTranslations("confirm");
  const { run, pending, error } = useAction();
  const { confirm, dialog } = useConfirm();
  const ownRoleOffered = roles.some((role) => role.id === member.role.id);

  const changeRole = async (roleId: string) => {
    const role = roles.find((choice) => choice.id === roleId);
    if (!role) return;
    const answer = await confirm({
      title: tConfirm("changeRole.title", { name: member.name, role: role.name }),
      body: tConfirm("changeRole.body"),
      confirmLabel: tConfirm("changeRole.confirm"),
      tone: "primary",
    });
    if (answer) await run(() => api.patch(`/api/workspaces/${businessId}/members/${member.id}`, { roleId }));
  };

  const remove = async () => {
    const answer = await confirm({
      title: tConfirm("removeMember.title", { name: member.name }),
      body: tConfirm("removeMember.body"),
      confirmLabel: tConfirm("removeMember.confirm"),
    });
    if (answer) await run(() => api.delete(`/api/workspaces/${businessId}/members/${member.id}`));
  };

  return (
    <div className="grid w-full gap-2 sm:w-auto">
      {dialog}
      <div className="flex flex-wrap items-center gap-2">
        {/* Shows the member's role until the change is confirmed and the page reads it again. */}
        <select
          value={member.role.id}
          disabled={pending}
          aria-label={t("role")}
          onChange={(event) => void changeRole(event.target.value)}
          className={`${inputClass} min-w-0 flex-1 sm:w-52 sm:flex-none`}
        >
          {!ownRoleOffered && (
            <option value={member.role.id} disabled>
              {member.role.name}
            </option>
          )}
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => void remove()}>
          <UserMinus className="size-4" aria-hidden />
          {t("remove")}
        </Button>
      </div>
      <FormError message={error} />
    </div>
  );
}

/** Cancels an invitation that is still waiting, behind a confirmation; its link stops working. */
export function CancelInvitation({
  businessId,
  invitation,
}: {
  businessId: string;
  invitation: { id: string; name: string };
}) {
  const t = useTranslations("dashboard.team");
  const tConfirm = useTranslations("confirm");
  const { run, pending, error } = useAction();
  const { confirm, dialog } = useConfirm();

  const cancel = async () => {
    const answer = await confirm({
      title: tConfirm("cancelInvitation.title", { name: invitation.name }),
      body: tConfirm("cancelInvitation.body"),
      confirmLabel: tConfirm("cancelInvitation.confirm"),
    });
    if (answer) await run(() => api.delete(`/api/workspaces/${businessId}/invitations/${invitation.id}`));
  };

  return (
    <div className="grid justify-items-end gap-2">
      {dialog}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => void cancel()}>
        <X className="size-4" aria-hidden />
        {t("cancelInvite")}
      </Button>
      <FormError message={error} />
    </div>
  );
}
