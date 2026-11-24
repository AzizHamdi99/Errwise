import {
  GITHUB_URL,
  NPM_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
} from "@/lib/site";
import { SITE_URL } from "@/lib/site-url";

/** No price and no ratings on purpose: there are none. */
const DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL.href,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Node.js 20 or newer",
  sameAs: [GITHUB_URL, NPM_URL],
};

export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        // Keeps a "</script>" in the data from closing the tag.
        __html: JSON.stringify(DATA).replace(/</g, "\\u003c"),
      }}
    />
  );
}
