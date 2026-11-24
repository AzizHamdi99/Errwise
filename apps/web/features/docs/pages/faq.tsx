import Link from "next/link";
import { DocTable } from "@/components/shared/article/doc-table";
import { CONTACT_URL } from "@/lib/site";
import type { DocPage } from "../types";

export const faq: DocPage = {
  slug: "faq",
  title: "FAQ and troubleshooting",
  description: "What to check when something does not work.",
  sections: [
    {
      id: "nothing-arrives",
      title: "Nothing arrives",
      body: (
        <>
          <p>
            Set <code>debug: true</code> and look for lines starting with{" "}
            <code>[errwise]</code>.
          </p>
          <DocTable
            head={["You see", "Cause"]}
            rows={[
              ["apiKey is missing or malformed", "The key is wrong, or your .env file is not loaded before init()"],
              ["The API key was rejected", "The key was revoked, or its project was deleted"],
              ["could not reach the API", "The API or your network is down. Events are kept and retried"],
              ["Nothing at all", "enabled is false, the error was a 4xx, or beforeSend dropped it"],
              ["init() was already called", "Initialize once per process, or call close() first"],
            ]}
          />
        </>
      ),
    },
    {
      id: "slow",
      title: "Can the SDK slow down or crash my app?",
      body: (
        <p>
          It is built not to. Capturing only adds to a bounded queue, sending
          happens in the background, and the failures of the SDK are swallowed.
        </p>
      ),
    },
    {
      id: "no-source",
      title: "Why is there no source code?",
      body: (
        <ul>
          <li>The GitHub integration or the Source code option is off.</li>
          <li>
            The event has no commit. See{" "}
            <Link href="/docs/sdk#init">the commit option</Link>.
          </li>
          <li>
            The frame points at compiled code. Start Node with{" "}
            <code>--enable-source-maps</code>.
          </li>
          <li>
            The installation has not accepted the Contents permission. Accept it
            at <code>github.com/settings/installations</code>.
          </li>
        </ul>
      ),
    },
    {
      id: "browser",
      title: "Does it work in the browser?",
      body: (
        <p>
          Not yet. The SDK is for Node.js. A browser SDK and source maps are
          coming soon.
        </p>
      ),
    },
    {
      id: "retention",
      title: "How long are events kept?",
      body: (
        <p>
          Events are not deleted automatically yet. Each project already has a
          retention setting, 30 days by default, for when this is enforced.
        </p>
      ),
    },
    {
      id: "help",
      title: "I need help",
      body: (
        <p>
          Open an issue on{" "}
          <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          . It is public, so leave keys and private data out.
        </p>
      ),
    },
  ],
};
