import Link from "next/link";
import type { DocPage } from "../types";

export const introduction: DocPage = {
  slug: "",
  title: "Introduction",
  description:
    "Errwise collects the errors of your Node.js app and groups them into issues your team can act on.",
  sections: [
    {
      id: "what-it-does",
      title: "What it does",
      body: (
        <>
          <p>
            You add <code>@errwise/node</code> to your app. When an error
            happens, the SDK sends it to Errwise in the background. Errwise
            groups identical errors into one <strong>issue</strong> with a
            counter, alerts the people who follow the project, and shows the
            stack trace, environment, release and recent events.
          </p>
          <p>
            From there you can read the code around each frame, ask for an AI
            analysis, create a GitHub issue, or open a draft pull request with
            a suggested fix.
          </p>
        </>
      ),
    },
    {
      id: "concepts",
      title: "The words we use",
      body: (
        <ul>
          <li>
            <strong>Organization</strong>: your team. It owns projects and has
            members with a role.
          </li>
          <li>
            <strong>Project</strong>: one application. It has its own API keys,
            issues and settings.
          </li>
          <li>
            <strong>Event</strong>: one occurrence of an error.
          </li>
          <li>
            <strong>Issue</strong>: all the events with the same{" "}
            <Link href="/docs/grouping">fingerprint</Link>. It is unresolved,
            resolved or ignored.
          </li>
        </ul>
      ),
    },
    {
      id: "next",
      title: "Where to go next",
      body: (
        <ul>
          <li>
            <Link href="/docs/quickstart">Quickstart</Link>: your first error in
            about five minutes.
          </li>
          <li>
            <Link href="/docs/sdk">SDK reference</Link>: every option and
            method.
          </li>
          <li>
            <Link href="/docs/security">Security</Link>: what is sent, and what
            is masked.
          </li>
        </ul>
      ),
    },
  ],
};
