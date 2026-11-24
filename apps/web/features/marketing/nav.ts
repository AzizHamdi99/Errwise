import { CONTACT_URL, GITHUB_URL, NPM_URL } from "@/lib/site";

export interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

export const MAIN_NAV: NavLink[] = [
  { label: "Features", href: "/#features" },
  { label: "Docs", href: "/docs" },
  { label: "GitHub", href: GITHUB_URL, external: true },
];

export const FOOTER_NAV: { title: string; links: NavLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Security", href: "/#security" },
      { label: "Coming soon", href: "/#roadmap" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Quickstart", href: "/docs/quickstart" },
      { label: "GitHub", href: GITHUB_URL, external: true },
      { label: "npm", href: NPM_URL, external: true },
    ],
  },
  {
    title: "Legal and contact",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Contact", href: CONTACT_URL, external: true },
    ],
  },
];
