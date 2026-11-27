"use client";

import { AppHeader, type NavItem } from "@enigmic-co/ui/AppHeader";
import { Home, Layers, Search } from "lucide-react";

const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/browse", label: "Browse", icon: Search },
  { href: "/sets", label: "Sets", icon: Layers },
];

// The shared Enigmic header (@enigmic-co/ui, styling guide D-064). card-web has
// no customer sign-in yet, so the right side is the theme control alone; on
// phones the three links stay in the bar and the theme control is in the footer.
export function AppNav() {
  return <AppHeader brand={{ href: "/", name: "Enigmic Cards" }} nav={navItems} />;
}
