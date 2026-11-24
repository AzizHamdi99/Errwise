import { Brand } from "@/components/shared/brand";
import { SITE_TAGLINE } from "@/lib/site";
import { FOOTER_NAV } from "../nav";
import { SiteLink } from "./site-link";

// A constant, because new Date() cannot run while a static page is prerendered.
const COPYRIGHT_YEAR = 2026;

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[2fr_3fr]">
        <div className="space-y-4">
          <Brand />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {SITE_TAGLINE}. Install the SDK, see every crash grouped in one
            dashboard.
          </p>
        </div>

        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-8 sm:grid-cols-3"
        >
          {FOOTER_NAV.map((group) => (
            <div key={group.title} className="space-y-4">
              <h2 className="text-sm font-medium">{group.title}</h2>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <SiteLink
                      link={link}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6">
          © {COPYRIGHT_YEAR} Errwise. The SDK is MIT licensed.
        </p>
      </div>
    </footer>
  );
}
