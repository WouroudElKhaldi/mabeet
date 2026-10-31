// Fine-grained permissions. Owners and managers combine these into custom roles. Money, plans and payouts are not
// a permission: only the owner handles them (requireOwner).

const PERMISSIONS = {
  "rooms.read": "See rooms, rates and photos",
  "rooms.manage": "Create and edit rooms, rates and photos",
  "offerings.manage": "Create and edit experiences, services and their sessions",
  "calendar.read": "See the calendar and availability",
  "blocks.manage": "Close and reopen dates",
  "feeds.manage": "Manage Airbnb and Booking.com calendar links",
  "bookings.read": "See bookings",
  "bookings.decide": "Confirm, decline and cancel bookings",
  "guests.contact": "See guest phone numbers and emails",
  "reviews.reply": "Reply to and hide reviews",
  "analytics.read": "See revenue, occupancy and other analytics",
  "team.manage": "Invite and remove team members",
  "roles.manage": "Create and edit roles",
  "settings.manage": "Edit business settings",
  "ai.use": "Use MCP keys and the AI assistant",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

const READ_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "rooms.read",
  "calendar.read",
  "bookings.read",
  "guests.contact",
  "analytics.read",
  "ai.use",
]);

/** Narrows a permission set to its read-only part, used for read-only MCP keys. */
export function readOnly(permissions: ReadonlySet<Permission>): Set<Permission> {
  return new Set([...permissions].filter((permission) => READ_PERMISSIONS.has(permission)));
}

function isPermission(value: string): value is Permission {
  return value in PERMISSIONS;
}

export function toPermissions(values: readonly string[]): Set<Permission> {
  return new Set(values.filter(isPermission));
}

/** Returns the permissions in `requested` that `grantor` does not hold. Nobody can grant what they lack. */
export function findUngrantable(
  grantor: ReadonlySet<Permission>,
  requested: readonly Permission[],
): Permission[] {
  return requested.filter((permission) => !grantor.has(permission));
}

export const DEFAULT_ROLE_TEMPLATES: ReadonlyArray<{
  name: string;
  description: string;
  permissions: Permission[];
}> = [
  {
    name: "Manager",
    description: "Runs day-to-day operations and the team",
    permissions: ALL_PERMISSIONS.filter((p) => p !== "settings.manage"),
  },
  {
    name: "Front desk",
    description: "Handles bookings and guests",
    permissions: [
      "rooms.read",
      "calendar.read",
      "blocks.manage",
      "bookings.read",
      "bookings.decide",
      "guests.contact",
    ],
  },
  {
    name: "Housekeeping",
    description: "Sees who arrives and leaves",
    permissions: ["rooms.read", "calendar.read", "bookings.read"],
  },
];
