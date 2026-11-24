import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Pages behind a session, or opened from a link in an email.
      disallow: [
        "/v1/",
        "/organizations",
        "/account",
        "/onboarding",
        "/invitations",
        "/integrations",
        "/verify-email",
        "/reset-password",
      ],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).href,
  };
}
