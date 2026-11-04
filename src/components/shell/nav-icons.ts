import {
  BarChart3,
  BedDouble,
  Bell,
  CalendarCheck,
  CalendarDays,
  Compass,
  CreditCard,
  Home,
  KeyRound,
  LayoutDashboard,
  Link2,
  Search,
  Settings,
  Sparkles,
  Star,
  Tag,
  User,
  Users,
  Wallet,
} from "lucide-react";

// A menu item names its icon, and the shell finds it here. A server component cannot hand a component to a client
// one, and a name is plain data. A page that needs a new icon adds it to this list.
export const NAV_ICONS = {
  overview: LayoutDashboard,
  bookings: CalendarCheck,
  calendar: CalendarDays,
  rooms: BedDouble,
  channels: Link2,
  place: Home,
  reviews: Star,
  team: Users,
  assistant: Sparkles,
  keys: KeyRound,
  settings: Settings,
  offerings: Compass,
  billing: CreditCard,
  payouts: Wallet,
  analytics: BarChart3,
  profile: User,
  notifications: Bell,
  explore: Search,
  pricing: Tag,
};

export type NavIconName = keyof typeof NAV_ICONS;
