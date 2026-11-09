// The only door into this module for server code (routes, the worker, other modules). Anything not exported here is
// private to the module.
export {
  deleteMyAccount,
  exportMyData,
  findAccountByEmail,
  findAccountEmail,
  getMyProfile,
  setMyLocale,
  updateMyProfile,
} from "./server/account-service";
export { createVerifiedAccount } from "./server/invited-account";
export { markNotificationsSeen, notificationsSeenAt } from "./server/notifications-seen";
export { ensurePlatformAdmin } from "./server/platform-admin";
export { listPlatformPeople } from "./server/platform-people";
