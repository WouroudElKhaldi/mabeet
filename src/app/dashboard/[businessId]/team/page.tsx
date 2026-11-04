import { getLocale, getTranslations } from "next-intl/server";
import { DASHBOARD_PAGES } from "@/components/dashboard/nav-items";
import { DisclosurePanel } from "@/components/shell/disclosure-panel";
import { PageHeader, Panel } from "@/components/shell/page-header";
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
 * The team: who works in this place and with which role, inviting someone, the invitations sent, and the roles with
 * the permissions each one gives. Managing the team and managing the roles are two permissions, so each part shows
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
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
        {members && (
          <Panel title={t("members")} intro={t("memberCount", { count: members.length })}>
            <ul className="divide-y divide-line">
              {members.map((member) => {
                const isOwner = ownerRoleIds.has(member.role.id);
                return (
                  <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        <bdi>{member.user.name}</bdi>
                        {member.id === ctx.membershipId && <Pill>{t("you")}</Pill>}
                      </p>
                      <p className="truncate text-sm text-muted">
                        <bdi dir="ltr">{member.user.email}</bdi>
                      </p>
                    </div>
                    {canManageMember(ctx, { id: member.id, isOwner }) ? (
                      <MemberControls
                        businessId={businessId}
                        member={{ id: member.id, name: member.user.name, role: member.role }}
                        roles={givable}
                      />
                    ) : (
                      <span className="text-sm font-semibold text-muted">{member.role.name}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}

        {managesTeam && (
          <Panel title={t("inviteTitle")} intro={t("inviteIntro")}>
            <AddMemberForm businessId={businessId} roles={givable} />
          </Panel>
        )}

        {invitations && (
          <Panel title={t("invitations")}>
            {invitations.length === 0 ? (
              <p className="text-sm text-muted">{t("noInvitations")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        <bdi>{invitation.name}</bdi>
                        <Pill tone={invitation.status === "PENDING" ? "accent" : "quiet"}>
                          {t(`invitationStatus.${invitation.status}`)}
                        </Pill>
                      </p>
                      <p className="text-sm text-muted">
                        <bdi dir="ltr">{invitation.email}</bdi> · <bdi>{invitation.role.name}</bdi>
                      </p>
                      <p className="text-sm text-muted">
                        {invitation.acceptedAt
                          ? t("acceptedOn", { date: day(invitation.acceptedAt) })
                          : t("invitedBy", {
                              name: invitation.invitedBy.name,
                              date: day(invitation.createdAt),
                            })}
                      </p>
                    </div>
                    {invitation.status === "PENDING" && (
                      <CancelInvitation
                        businessId={businessId}
                        invitation={{ id: invitation.id, name: invitation.name }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {managesRoles && (
          <section aria-labelledby="team-roles" className="grid gap-4">
            <div>
              <h2 id="team-roles" className="text-2xl font-semibold">
                {t("roles")}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">{t("rolesIntro")}</p>
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
            <Panel title={t("newRole")}>
              <RoleEditor businessId={businessId} grantable={grantable} />
            </Panel>
          </section>
        )}
      </div>
    </>
  );
}
