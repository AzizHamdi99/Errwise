import Link from "next/link";
import { DocTable } from "@/components/shared/article/doc-table";
import type { ArticleSection } from "@/components/shared/article/types";
import {
  CONTACT_EMAIL,
  DATA_REGION,
  EMAIL_PROVIDER,
  LEGAL_ENTITY,
} from "./details";

export const PRIVACY: ArticleSection[] = [
  {
    id: "who",
    title: "1. Who we are",
    body: (
      <>
        <p>
          {LEGAL_ENTITY} runs Errwise and is responsible for your account data.
          Contact: {CONTACT_EMAIL}.
        </p>
        <p>
          For the error data that our customers send, the customer decides what
          is collected and we process it on their behalf. If your data is in an
          application that uses Errwise, contact that application first.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "2. What we collect",
    body: (
      <DocTable
        head={["Data", "Details"]}
        rows={[
          ["Account", "Email, name if given, a hash of your password, Google account id if you use Google, last login"],
          ["Sessions", "IP address and browser user agent of each session"],
          ["Team", "Organizations, roles, the emails you invite, alert choices"],
          ["Activity", "Audit log of changes to keys, members, projects and GitHub"],
          ["Error events", "Type, message, stack, environment, release, commit, Node version, operating system, hostname, HTTP method and path, and any extra data the customer adds"],
          ["GitHub", "Installation id, chosen repository, and links to issues and pull requests"],
          ["Source code", "Only if turned on. See section 5"],
        ]}
      />
    ),
  },
  {
    id: "use",
    title: "3. How we use it",
    body: (
      <>
        <ul>
          <li>
            To run the service: sign-in, grouping, alerts and integrations (our
            contract with you).
          </li>
          <li>
            To keep it secure: limits, sessions and the audit log (our
            legitimate interest).
          </li>
          <li>
            To read source code and use AI on it: only after the owner turns it
            on and a member asks.
          </li>
        </ul>
        <p>
          We do not sell personal data, show ads, or use your events or code to
          train AI models.
        </p>
      </>
    ),
  },
  {
    id: "scrubbing",
    title: "4. Masking",
    body: (
      <p>
        Before an event is stored we mask emails, tokens, common provider keys,
        card numbers and credentials in URLs. This reduces risk but cannot catch
        everything. The <Link href="/docs/security">security page</Link> has the
        details.
      </p>
    ),
  },
  {
    id: "source-code",
    title: "5. Source code and AI",
    body: (
      <ul>
        <li>
          <strong>Off by default.</strong> The organization owner turns it on
          for each project, and can turn it off at any time.
        </li>
        <li>
          <strong>Reading:</strong> code is read from GitHub when needed and
          kept in a short-lived memory cache. Whole files are not stored.
        </li>
        <li>
          <strong>AI:</strong> when a member asks for an analysis or a fix, we
          send the scrubbed error text and, if source code is on, scrubbed
          excerpts to our AI provider. The extra data of an event is never sent.
        </li>
        <li>
          <strong>Stored:</strong> the AI answer, which can quote or describe
          your code, and the changed lines of a suggested fix.
        </li>
        <li>
          <strong>Deleted:</strong> the stored code of fixes, when you turn
          either option off, disconnect GitHub, change the repository, or delete
          the project or organization.
        </li>
        <li>
          <strong>Not deleted by that:</strong> stored analyses, and what is
          already on GitHub or was already sent to the AI provider.
        </li>
      </ul>
    ),
  },
  {
    id: "providers",
    title: "6. Who processes data for us",
    body: (
      <>
        <DocTable
          head={["Provider", "Purpose", "Data"]}
          rows={[
            ["Vercel", "Hosting", "All traffic to the service"],
            ["Neon", "Database", "Everything we store"],
            [EMAIL_PROVIDER, "Sending email", "Email address and the content of the email"],
            ["Groq", "AI analysis and fixes", "Scrubbed error text, and code excerpts if turned on"],
            ["Google", "Sign-in, if you choose it", "Your Google account id, email and name"],
            ["GitHub", "Integration, if you connect it", "Issue and pull request content"],
          ]}
        />
        <p>
          Data is hosted in {DATA_REGION}. Some providers may process it in
          other countries, under the safeguards the law requires.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "7. How long we keep it",
    body: (
      <p>
        We keep data while your account is active. Events are not deleted
        automatically yet. Deleting a project or an organization hides it and
        stops its keys; to have the data erased, write to {CONTACT_EMAIL}.
      </p>
    ),
  },
  {
    id: "security",
    title: "8. Security",
    body: (
      <p>
        Passwords are hashed with bcrypt, API keys and session tokens are stored
        only as hashes, and every query is limited to your organization. No
        system is perfectly secure. If a breach affects your data we will tell
        you as the law requires.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "9. Cookies and local storage",
    body: (
      <>
        <DocTable
          head={["Name", "Purpose"]}
          rows={[
            [<code key="a">ew_access</code>, "Keeps you signed in (about 15 minutes)"],
            [<code key="b">ew_refresh</code>, "Renews your session (about 30 days)"],
            ["Local storage", "Your theme and the last organization you opened"],
          ]}
        />
        <p>They are needed for the service. We use no tracking cookies.</p>
      </>
    ),
  },
  {
    id: "rights",
    title: "10. Your rights",
    body: (
      <p>
        Depending on where you live, you can ask to access, correct, export or
        delete your data, object to its use, or withdraw consent. Write to{" "}
        {CONTACT_EMAIL}. You can also complain to your data protection
        authority.
      </p>
    ),
  },
  {
    id: "changes",
    title: "11. Changes",
    body: (
      <p>
        We will update the date at the top when this policy changes, and give
        notice of important changes in the product or by email.
      </p>
    ),
  },
];
