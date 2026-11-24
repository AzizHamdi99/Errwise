import Link from "next/link";
import type { DocPage } from "../types";

export const alerts: DocPage = {
  slug: "alerts",
  title: "Alerts",
  description: "Who gets an email, and when.",
  sections: [
    {
      id: "follow",
      title: "Follow a project",
      body: (
        <>
          <p>
            Alerts are opt-in for each member and each project. Use{" "}
            <strong>Notify me</strong> on the project, or the{" "}
            <strong>Alerts</strong> page of the organization to manage all of
            them.
          </p>
          <p>
            The person who creates a project follows it from the start. Someone
            who leaves the organization stops getting its emails.
          </p>
        </>
      ),
    },
    {
      id: "when",
      title: "When an email is sent",
      body: (
        <ul>
          <li>
            <strong>New issue</strong>: once, the first time an error is seen.
            Later occurrences only move the counter.
          </li>
          <li>
            <strong>Regression</strong>: once each time a resolved issue happens
            again. See <Link href="/docs/regressions">Regressions</Link>.
          </li>
        </ul>
      ),
    },
    {
      id: "channels",
      title: "Channels",
      body: (
        <p>
          Email is the only channel today. Slack and Discord are coming soon.
        </p>
      ),
    },
  ],
};
