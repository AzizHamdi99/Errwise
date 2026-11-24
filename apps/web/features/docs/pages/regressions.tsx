import type { DocPage } from "../types";

export const regressions: DocPage = {
  slug: "regressions",
  title: "Regression detection",
  description: "What happens when an error you resolved comes back.",
  sections: [
    {
      id: "what-happens",
      title: "What happens",
      body: (
        <>
          <p>When a new event arrives on a resolved issue:</p>
          <ol>
            <li>The issue becomes unresolved again.</li>
            <li>
              The members who follow the project get one email, with the number
              of times the issue was reopened.
            </li>
            <li>
              If the linked GitHub issue is closed, Errwise reopens it and adds a
              comment.
            </li>
          </ol>
          <p>
            Use the <strong>Regressed</strong> filter to list the issues that
            came back.
          </p>
        </>
      ),
    },
    {
      id: "ignored",
      title: "Ignored issues",
      body: (
        <p>
          An ignored issue stays ignored. Its counter still moves, but nothing is
          reopened and nobody is emailed.
        </p>
      ),
    },
    {
      id: "retries",
      title: "Retried events",
      body: (
        <p>
          An event that the SDK sends twice is stored once. The copy cannot
          reopen an issue or move a counter.
        </p>
      ),
    },
    {
      id: "limits",
      title: "Good to know",
      body: (
        <p>
          The release is not compared. An old version of your app that is still
          running can reopen an issue you fixed in a newer one.
        </p>
      ),
    },
  ],
};
