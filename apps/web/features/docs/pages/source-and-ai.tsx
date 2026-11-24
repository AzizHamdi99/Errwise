import Link from "next/link";
import type { DocPage } from "../types";

export const sourceAndAi: DocPage = {
  slug: "source-and-ai",
  title: "Source code and AI",
  description:
    "See the code around a frame, understand the error, and get a suggested fix.",
  sections: [
    {
      id: "source",
      title: "Source code",
      body: (
        <>
          <p>
            Each frame can open on the real lines of your repository, read from
            GitHub at the deployed commit. It is off until the organization owner
            turns on <strong>Source code</strong> for the project. It needs the{" "}
            <Link href="/docs/github">GitHub integration</Link> and a commit sent
            by the <Link href="/docs/sdk#init">SDK</Link>.
          </p>
          <p>
            Code is read when you open the issue and kept only in a short-lived
            memory cache. It is not stored. If your server runs compiled code,
            start Node with <code>--enable-source-maps</code>.
          </p>
        </>
      ),
    },
    {
      id: "analysis",
      title: "AI analysis",
      body: (
        <>
          <p>
            Any member can ask for one on the issue page. It gives a summary, the
            probable cause, a suggested fix and a confidence level. It can be
            wrong, so check it.
          </p>
          <p>
            The model receives the error type, message, stack, environment,
            release and Node version, scrubbed. It never receives the context of
            the event. It receives code only when source code is on, and the
            analysis lists the files that were read.
          </p>
        </>
      ),
    },
    {
      id: "fixes",
      title: "Suggested fixes and pull requests",
      body: (
        <ol>
          <li>
            The owner turns on <strong>AI fix pull requests</strong>. Source code
            must be on too.
          </li>
          <li>
            Any member asks for a fix and reviews it as a diff. Only JavaScript
            and TypeScript files are changed, never configuration or tests.
          </li>
          <li>
            An owner or admin opens it as a <strong>draft</strong> pull request.
            If the code changed and the fix no longer matches, nothing is opened.
          </li>
        </ol>
      ),
    },
    {
      id: "guarantees",
      title: "What it will not do",
      body: (
        <ul>
          <li>Run on its own. Every step is a click.</li>
          <li>Merge, or force-push.</li>
          <li>
            Keep a whole file. Only the few changed lines of a fix are stored,
            and they are deleted when you turn either option off, disconnect
            GitHub or change the repository.
          </li>
        </ul>
      ),
    },
    {
      id: "limits",
      title: "Limits",
      body: (
        <p>
          Analyses and fixes share a daily allowance per organization. The{" "}
          <strong>Usage</strong> page shows what is left. A stored result for the
          same error costs nothing. When the AI provider is busy, try again a
          little later.
        </p>
      ),
    },
  ],
};
