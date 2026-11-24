/**
 * The public origin, for canonical links, the sitemap and social images.
 * NEXT_PUBLIC_SITE_URL wins (a custom domain). On Vercel the production host is known
 * at build time, so nothing has to be configured there. Server only: the Vercel variable
 * does not exist in the browser.
 */
function resolveSiteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelHost) return new URL(`https://${vercelHost}`);

  return new URL("http://localhost:3000");
}

export const SITE_URL = resolveSiteUrl();
