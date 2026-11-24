import Link from "next/link";
import type { DocPage } from "../types";

export const security: DocPage = {
  slug: "security",
  title: "Security",
  description: "What is sent, what is masked, and how access is controlled.",
  sections: [
    {
      id: "what-is-sent",
      title: "What the SDK sends",
      body: (
        <>
          <p>
            The error type, message and stack, the environment, release and
            commit, the Node version, operating system and hostname, anything you
            pass as <code>extra</code>, and for a request its method and path.
          </p>
          <p>
            It never sends request bodies, headers, cookies or query strings.
          </p>
        </>
      ),
    },
    {
      id: "scrubbing",
      title: "Scrubbing",
      body: (
        <>
          <p>
            Before an event is stored, the server masks emails, bearer tokens and
            authorization headers, JWTs, the key formats of common providers,
            card numbers, and credentials in URLs. In <code>extra</code>, values
            under keys such as <code>password</code>, <code>token</code> or{" "}
            <code>cookie</code> are removed.
          </p>
          <p>
            No filter knows every secret. Keep them out of error messages, and
            remove what is specific to your app with{" "}
            <Link href="/docs/sdk#before-send">beforeSend</Link>, which runs
            before anything leaves your server.
          </p>
        </>
      ),
    },
    {
      id: "api-keys",
      title: "API keys",
      body: (
        <p>
          A key is shown once and stored only as a SHA-256 hash. It can only send
          events: it cannot read anything. Revoke it at any time in the{" "}
          <strong>API keys</strong> tab.
        </p>
      ),
    },
    {
      id: "tenants",
      title: "Tenant isolation",
      body: (
        <p>
          Every query is scoped to an organization or a project. Anything outside
          yours answers 404, so ids do not reveal what exists.
        </p>
      ),
    },
    {
      id: "accounts",
      title: "Accounts",
      body: (
        <p>
          Passwords are hashed with bcrypt. Sessions use httpOnly cookies and
          rotating tokens: replaying an old one revokes the whole session.
        </p>
      ),
    },
    {
      id: "ai",
      title: "AI and your code",
      body: (
        <p>
          See{" "}
          <Link href="/docs/source-and-ai">Source code and AI</Link> for what
          reaches the model, and how to turn it off.
        </p>
      ),
    },
  ],
};
