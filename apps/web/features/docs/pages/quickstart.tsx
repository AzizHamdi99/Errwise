import Link from "next/link";
import { CodeBlock } from "@/components/shared/code-block";
import { INSTALL_COMMAND } from "@/lib/site";
import type { DocPage } from "../types";

export const quickstart: DocPage = {
  slug: "quickstart",
  title: "Quickstart",
  description: "From an empty account to your first error in the dashboard.",
  sections: [
    {
      id: "account",
      title: "1. Create an account",
      body: (
        <p>
          <Link href="/register">Sign up</Link> with email and password or with
          Google. With a password, open the link in the verification email
          before you log in. It is valid for 24 hours.
        </p>
      ),
    },
    {
      id: "project",
      title: "2. Create an organization and a project",
      body: (
        <p>
          The onboarding asks for an organization name, then for a project and
          its platform: Node, Express or NestJS.
        </p>
      ),
    },
    {
      id: "api-key",
      title: "3. Copy your API key",
      body: (
        <>
          <p>
            A key starts with <code>ew_live_</code> and is shown once. If you
            lose it, revoke it and create another one in the{" "}
            <strong>API keys</strong> tab of the project. Only the organization
            owner can do that.
          </p>
          <CodeBlock code="ERRWISE_API_KEY=ew_live_..." />
          <p>
            The SDK reads <code>process.env</code> but does not load{" "}
            <code>.env</code> files. With plain Node, run{" "}
            <code>node --env-file=.env app.js</code>.
          </p>
        </>
      ),
    },
    {
      id: "install",
      title: "4. Install the SDK",
      body: (
        <>
          <CodeBlock code={INSTALL_COMMAND} language="bash" />
          <p>Node.js 20 or newer is required.</p>
        </>
      ),
    },
    {
      id: "init",
      title: "5. Initialize it",
      body: (
        <>
          <p>Do it once, as early as possible in your app.</p>
          <CodeBlock
            language="ts"
            code={`import { Errwise } from "@errwise/node";

Errwise.init({
  apiKey: process.env.ERRWISE_API_KEY,
  environment: "production",
  release: "1.0.0",
});`}
          />
          <p>
            Using a framework? See{" "}
            <Link href="/docs/integrations">Express and NestJS</Link>.
          </p>
        </>
      ),
    },
    {
      id: "first-error",
      title: "6. Send your first error",
      body: (
        <>
          <CodeBlock
            language="ts"
            code={`Errwise.captureException(new Error("Hello from Errwise"));`}
          />
          <p>
            Run your app and open the <strong>Issues</strong> tab. The error is
            there within a few seconds. If it is not, see{" "}
            <Link href="/docs/faq#nothing-arrives">Nothing arrives</Link>.
          </p>
        </>
      ),
    },
  ],
};
