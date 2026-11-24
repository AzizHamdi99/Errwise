import { DocTable } from "@/components/shared/article/doc-table";
import type { DocPage } from "../types";

export const grouping: DocPage = {
  slug: "grouping",
  title: "How grouping works",
  description: "How Errwise decides that two errors are the same issue.",
  sections: [
    {
      id: "fingerprint",
      title: "The fingerprint",
      body: (
        <>
          <p>
            Each event gets a fingerprint, a SHA-256 hash of three things. Events
            of one project with the same fingerprint are one issue.
          </p>
          <ul>
            <li>
              The error type, such as <code>TypeError</code>.
            </li>
            <li>The message, with its changing parts replaced.</li>
            <li>The first stack frame that belongs to your own code.</li>
          </ul>
        </>
      ),
    },
    {
      id: "message",
      title: "The message",
      body: (
        <>
          <p>
            The message is lowercased, and the first 1,000 characters count.
          </p>
          <DocTable
            head={["Replaced", "Example", "Becomes"]}
            rows={[
              ["Quoted values", <code key="a">{'field "email" missing'}</code>, <code key="b">{"field <str> missing"}</code>],
              ["UUIDs", <code key="a">order 018f2c4e-...</code>, <code key="b">{"order <uuid>"}</code>],
              ["Hex values", <code key="a">at 0x7ffe</code>, <code key="b">{"at <hex>"}</code>],
              ["Numbers", <code key="a">timeout after 5000ms</code>, <code key="b">{"timeout after <n>ms"}</code>],
            ]}
          />
        </>
      ),
    },
    {
      id: "frame",
      title: "The stack frame",
      body: (
        <p>
          Frames from <code>node_modules</code> and from Node itself are skipped.
          Only the function name and the last three parts of the path count, so
          your laptop, Docker and production agree. Line numbers are ignored: a
          small edit above the bug does not create a new issue.
        </p>
      ),
    },
    {
      id: "splits",
      title: "When an issue splits",
      body: (
        <p>
          Renaming the function, moving the file or rewriting the error message
          gives a new fingerprint, and so a new issue. The old one keeps its
          history.
        </p>
      ),
    },
  ],
};
