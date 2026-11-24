import Link from "next/link";
import { DocTable } from "@/components/shared/article/doc-table";
import type { DocPage } from "../types";

export const github: DocPage = {
  slug: "github",
  title: "GitHub integration",
  description: "Create GitHub issues from errors, and keep both in sync.",
  sections: [
    {
      id: "connect",
      title: "Connect a project",
      body: (
        <ol>
          <li>
            As the organization owner, open the <strong>Integrations</strong> tab
            of the project.
          </li>
          <li>Install the Errwise GitHub App on your account or organization.</li>
          <li>
            Back in Errwise, choose one repository. Each project has one
            repository.
          </li>
        </ol>
      ),
    },
    {
      id: "create",
      title: "Create a GitHub issue",
      body: (
        <p>
          Any member can create one from an Errwise issue, in one click. If it
          already exists, you get the same link. When an{" "}
          <Link href="/docs/source-and-ai">AI analysis</Link> is stored, it is
          included, marked as such. Labels are <code>errwise</code>,{" "}
          <code>bug</code>, the level and the environment.
        </p>
      ),
    },
    {
      id: "sync",
      title: "What is kept in sync",
      body: (
        <>
          <DocTable
            head={["When", "Then"]}
            rows={[
              ["The GitHub issue is closed", "An unresolved Errwise issue is resolved"],
              ["The GitHub issue is reopened", "A resolved Errwise issue is unresolved again"],
              ["A resolved error happens again", "The closed GitHub issue is reopened, with a comment"],
            ]}
          />
          <p>
            Resolving an issue in Errwise does not close the GitHub issue: GitHub
            decides who fixes what. An ignored issue stays ignored.
          </p>
        </>
      ),
    },
    {
      id: "permissions",
      title: "Permissions",
      body: (
        <>
          <p>
            The app asks for read and write access to Issues, Contents and Pull
            requests. Errwise requests a token for one purpose and one
            repository at a time, so creating an issue never uses a token that
            can write code.
          </p>
          <p>
            Contents and Pull requests are used only if the owner turns on{" "}
            <Link href="/docs/source-and-ai">source code or fixes</Link>. After a
            permission change, the owner of the installation accepts it at{" "}
            <code>github.com/settings/installations</code>.
          </p>
        </>
      ),
    },
    {
      id: "disconnect",
      title: "Disconnect",
      body: (
        <p>
          The owner can disconnect at any time. Links to existing GitHub issues
          are kept, source code and fixes are turned off, and the code stored in
          suggested fixes is deleted.
        </p>
      ),
    },
  ],
};
