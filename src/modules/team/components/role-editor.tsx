"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { ALL_PERMISSIONS, type Permission } from "@/config/permissions";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

export interface EditableRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  /** Active members on it; only an unused role can be deleted. */
  memberCount: number;
}

/**
 * Creates a role when `role` is absent, and edits it otherwise: its name, what it is for, and one box per permission.
 * A permission this person lacks cannot be ticked, and a role holding one they lack is only shown (`editable`).
 */
export function RoleEditor({
  businessId,
  role,
  grantable,
  editable = true,
}: {
  businessId: string;
  role?: EditableRole;
  /** The permissions this person holds, so may give. */
  grantable: readonly Permission[];
  editable?: boolean;
}) {
  const t = useTranslations("dashboard.team");
  const tPermission = useTranslations("permissions");
  const tConfirm = useTranslations("confirm");
  const { run, pending, error, fieldErrors } = useAction(["name"]);
  const { confirm, dialog } = useConfirm();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      name: String(data.get("name")).trim(),
      description: String(data.get("description") ?? "").trim() || null,
      permissions: data.getAll("permissions"),
    };
    const saved = await run(() =>
      role
        ? api.patch(`/api/workspaces/${businessId}/roles/${role.id}`, body)
        : api.post(`/api/workspaces/${businessId}/roles`, body),
    );
    if (saved && !role) form.reset();
  };

  const remove = async (existing: EditableRole) => {
    const answer = await confirm({
      title: tConfirm("deleteRole.title", { name: existing.name }),
      body: tConfirm("deleteRole.body"),
      confirmLabel: tConfirm("deleteRole.confirm"),
    });
    if (answer) await run(() => api.delete(`/api/workspaces/${businessId}/roles/${existing.id}`));
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4">
      {dialog}
      {!editable && <p className="text-sm text-muted">{t("roleLocked")}</p>}
      <fieldset disabled={!editable || pending} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t("roleName")}
            name="name"
            required
            minLength={2}
            maxLength={40}
            defaultValue={role?.name}
            error={fieldErrors.name ? t("roleNameError") : null}
          />
          <Field
            label={t("roleDescription")}
            name="description"
            maxLength={200}
            defaultValue={role?.description ?? ""}
          />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("permissions")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {ALL_PERMISSIONS.map((permission) => (
              <label
                key={permission}
                className="flex items-start gap-2 text-sm font-semibold has-disabled:opacity-40"
              >
                <input
                  type="checkbox"
                  name="permissions"
                  value={permission}
                  defaultChecked={role?.permissions.includes(permission) ?? false}
                  disabled={!grantable.includes(permission)}
                  className="mt-0.5 size-4 accent-accent"
                />
                <span>
                  {tPermission(`${permission}.title`)}
                  <span className="block text-xs font-normal text-muted">
                    {tPermission(`${permission}.description`)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </fieldset>
      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {role ? t("saveRole") : t("createRole")}
          </Button>
          {role && role.memberCount === 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => void remove(role)}
            >
              <Trash2 className="size-4" aria-hidden />
              {t("deleteRole")}
            </Button>
          )}
          <FormError message={error} />
        </div>
      )}
    </form>
  );
}
