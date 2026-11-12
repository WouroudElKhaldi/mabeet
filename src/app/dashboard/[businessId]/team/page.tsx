import { getLocale, getTranslations } from "next-intl/server";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { DisclosurePanel } from "@/components/shell/disclosure-panel";
import { PageHeader } from "@/components/shell/page-header";
import { FormDialog } from "@/components/ui/form-dialog";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { Pill } from "@/components/ui/pill";
import {
  AddMemberForm,
  assignableRoles,
  CancelInvitation,
  canManageMember,
  holdsEveryPermission,
  MemberControls,
  RoleEditor,
} from "@/modules/team";
import { listMembers, listRoles, listTeamInvitations } from "@/modules/team/server";
import { can } from "@/server/auth/tenant-context";
import { requirePageAccess } from "@/server/http/session";
import { toIsoDate } from "@/utils/dates";
import { formatDate } from "@/utils/format";

type PageProps = { params: Promise<{ businessId: string }> };

/**
 * The team: who works in this place and with which role, and the invitations sent, as tables; the roles with the
 * permissions each one gives. Inviting someone and making a role open in a pop-up. Managing the team and managing the roles are two permissions, so each part shows
 * only to a member who holds its own.
 */
export default async function TeamPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, DASHBOARD_PAGES.team.anyOf);
  const managesTeam = can(ctx, "team.manage");
  const managesRoles = can(ctx, "roles.manage");
  const [t, locale, roles, members, invitations] = await Promise.all([
    getTranslations("dashboard.team"),
    getLocale(),
    listRoles(ctx),
    managesTeam ? listMembers(ctx) : null,
    managesTeam ? listTeamInvitations(ctx) : null,
  ]);
  const ownerRoleIds = new Set(roles.filter((role) => role.isOwner).map((role) => role.id));
  const givable = assignableRoles(ctx, roles).map(({ id, name }) => ({ id, name }));
  const grantable = [...ctx.permissions];
  const day = (date: Date) =>
    formatDate(toIsoDate(date), locale, { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <PageHeader
        title={t("title")}
        intro={t("intro")}
        actions={
          managesTeam ? (
            <FormDialog label={t("invite")} title={t("inviteTitle")} intro={t("inviteIntro")}>
              <AddMemberForm businessId={businessId} roles={givable} />
            </FormDialog>
          ) : null
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
        {members && (
          <section aria-labelledby="team-members" className="grid gap-3">
            <div>
              <h2 id="team-members" className="text-xl font-semibold">
                {t("members")}
              </h2>
              <p className="mt-1 text-sm text-muted">{t("memberCount", { count: members.length })}</p>
            </div>
            <DataTable label={t("members")} columns={[{ label: t("member") }, { label: t("role") }]}>
              {members.map((member) => {
                const isOwner = ownerRoleIds.has(member.role.id);
                return (
                  <DataRow key={member.id}>
                    <DataCell>
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        <bdi>{member.user.name}</bdi>
                        {member.id === ctx.membershipId && <Pill>{t("you")}</Pill>}
                      </p>
                      <p className="max-w-40 truncate text-muted md:max-w-64">
                        <bdi dir="ltr">{member.user.email}</bdi>
                      </p>
                    </DataCell>
                    <DataCell>
                      {canManageMember(ctx, { id: member.id, isOwner }) ? (
                        <MemberControls
                          businessId={businessId}
                          member={{ id: member.id, name: member.user.name, role: member.role }}
                          roles={givable}
                        />
                      ) : (
                        <span className="font-semibold text-muted">{member.role.name}</span>
                      )}
                    </DataCell>
                  </DataRow>
                );
              })}
            </DataTable>
          </section>
        )}

        {invitations && (
          <section aria-labelledby="team-invitations" className="grid gap-3">
            <h2 id="team-invitations" className="text-xl font-semibold">
              {t("invitations")}
            </h2>
            {invitations.length === 0 ? (
              <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("noInvitations")}</p>
            ) : (
              <DataTable
                label={t("invitations")}
                columns={[
                  { label: t("invitee") },
                  { label: t("role"), wide: true },
                  { label: t("status") },
                  { label: t("sent"), wide: true },
                  { label: t("cancelInvite"), align: "end", hiddenLabel: true },
                ]}
              >
                {invitations.map((invitation) => (
                  <DataRow key={invitation.id}>
                    <DataCell>
                      <p className="font-semibold">
                        <bdi>{invitation.name}</bdi>
                      </p>
                      <p className="max-w-40 truncate text-muted md:max-w-64">
                        <bdi dir="ltr">{invitation.email}</bdi>
                      </p>
                    </DataCell>
                    <DataCell wide>
                      <bdi>{invitation.role.name}</bdi>
                    </DataCell>
                    <DataCell>
                      <Pill tone={invitation.status === "PENDING" ? "accent" : "quiet"}>
                        {t(`invitationStatus.${invitation.status}`)}
                      </Pill>
                    </DataCell>
                    <DataCell wide className="text-muted">
                      {invitation.acceptedAt
                        ? t("acceptedOn", { date: day(invitation.acceptedAt) })
                        : t("invitedBy", {
                            name: invitation.invitedBy.name,
                            date: day(invitation.createdAt),
                          })}
                    </DataCell>
                    <DataCell align="end">
                      {invitation.status === "PENDING" && (
                        <CancelInvitation
                          businessId={businessId}
                          invitation={{ id: invitation.id, name: invitation.name }}
                        />
                      )}
                    </DataCell>
                  </DataRow>
                ))}
              </DataTable>
            )}
          </section>
        )}

        {managesRoles && (
          <section aria-labelledby="team-roles" className="grid gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="team-roles" className="text-xl font-semibold">
                  {t("roles")}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-muted">{t("rolesIntro")}</p>
              </div>
              <FormDialog label={t("newRole")} title={t("newRole")} variant="secondary" size="lg">
                <RoleEditor businessId={businessId} grantable={grantable} />
              </FormDialog>
            </div>
            {roles.map((role) => (
              <DisclosurePanel
                key={role.id}
                title={role.name}
                status={t("memberCount", { count: role._count.memberships })}
              >
                {role.isOwner ? (
                  <p className="text-sm text-muted">{t("ownerRole")}</p>
                ) : (
                  <RoleEditor
                    businessId={businessId}
                    role={{
                      id: role.id,
                      name: role.name,
                      description: role.description,
                      permissions: role.permissions,
                      memberCount: role._count.memberships,
                    }}
                    grantable={grantable}
                    editable={holdsEveryPermission(ctx, role)}
                  />
                )}
              </DisclosurePanel>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
