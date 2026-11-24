import Link from "next/link";
import { Brand } from "@/components/shared/brand";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { MAIN_NAV } from "../nav";
import { MobileNav } from "./mobile-nav";
import { SiteLink } from "./site-link";

export function SiteNavbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="Errwise home"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <Brand />
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {MAIN_NAV.map((link) => (
              <li key={link.href}>
                <SiteLink
                  link={link}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                />
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="lg"
            className="hidden px-3 sm:inline-flex"
            render={<Link href="/login" />}
            nativeButton={false}
          >
            Login
          </Button>
          <Button
            size="lg"
            className="hidden px-4 sm:inline-flex"
            render={<Link href="/register" />}
            nativeButton={false}
          >
            Get started
          </Button>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
