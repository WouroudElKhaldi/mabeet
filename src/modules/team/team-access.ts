import { findUngrantable, type Permission, toPermissions } from "@/config/permissions";

// What the Team page offers a person, read from the same rules team-service.ts enforces, so a screen never offers
// a change the server would refuse. The server still checks every one.

interface Viewer {
  membershipId: string;
  isOwner: boolean;
  permissions: ReadonlySet<Permission>;
}

interface RoleShape {
  isOwner: boolean;
  permissions: readonly string[];
}

/** Whether this person holds every permission of the role, so they may give it, or edit it. */
export function holdsEveryPermission(viewer: Viewer, role: RoleShape): boolean {
  return findUngrantable(viewer.permissions, [...toPermissions(role.permissions)]).length === 0;
}

/**
 * The roles this person may give someone: the owner role only from an owner, any other one within their own
 * permissions. The owner role comes last, so a form's first choice never hands out everything by accident.
 */
export function assignableRoles<Role extends RoleShape>(viewer: Viewer, roles: readonly Role[]): Role[] {
  return roles
    .filter((role) => (role.isOwner ? viewer.isOwner : holdsEveryPermission(viewer, role)))
    .sort((first, second) => Number(first.isOwner) - Number(second.isOwner));
}

/** Whether this person may change or remove the member: never their own access, and an owner only by an owner. */
export function canManageMember(viewer: Viewer, member: { id: string; isOwner: boolean }): boolean {
  return member.id !== viewer.membershipId && (!member.isOwner || viewer.isOwner);
}
