import Link from "next/link";
import type { ArticleSection } from "@/components/shared/article/types";
import { GITHUB_URL } from "@/lib/site";
import { CONTACT_EMAIL, GOVERNING_LAW, LEGAL_ENTITY } from "./details";

export const TERMS: ArticleSection[] = [
  {
    id: "acceptance",
    title: "1. Acceptance",
    body: (
      <>
        <p>
          These terms are an agreement between you and {LEGAL_ENTITY}
          {" (“Errwise”, “we”)"}. By creating an account or using the service
          you accept them, together with the{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
        <p>
          If you use Errwise for a company, you confirm that you may accept
          these terms for it.
        </p>
      </>
    ),
  },
  {
    id: "account",
    title: "2. Your account",
    body: (
      <ul>
        <li>Give accurate information and keep your password secret.</li>
        <li>
          You are responsible for what happens under your account and for the
          members you invite.
        </li>
        <li>Tell us quickly if you think someone else has access.</li>
      </ul>
    ),
  },
  {
    id: "acceptable-use",
    title: "3. Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>break the law or infringe the rights of others;</li>
          <li>
            send data or code you have no right to share, or try to reach the
            data of another organization;
          </li>
          <li>
            overload the service, avoid its limits, or test its security without
            our written permission;
          </li>
          <li>
            knowingly send special categories of personal data (such as health
            data), payment card data, or passwords.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "api-keys",
    title: "4. API keys",
    body: (
      <p>
        An API key lets anyone who holds it send events to your project. Keep it
        secret, and revoke it if it leaks. Events sent with your key count as
        yours.
      </p>
    ),
  },
  {
    id: "your-data",
    title: "5. Your data",
    body: (
      <>
        <p>
          You keep all rights to the events, code and other data you send
          (“Customer Data”). You give us a limited, non-exclusive right to host,
          process and display it, only to provide, secure and support the
          service for you. This right ends when the data is deleted.
        </p>
        <p>
          You confirm that you have the rights and permissions needed to send
          it. Errwise masks common secrets, but no filter catches everything:
          you are responsible for keeping secrets and personal data out of your
          error messages.
        </p>
      </>
    ),
  },
  {
    id: "source-code",
    title: "6. Source code and AI features",
    body: (
      <>
        <p>
          These features are optional and off by default. Only the organization
          owner can turn them on, for each project. By doing so you:
        </p>
        <ul>
          <li>
            confirm that you own the code or are authorized to give us access to
            the connected repository, and that this does not breach a contract,
            a license or a confidentiality duty;
          </li>
          <li>
            allow us to read the files needed to show and analyze an error, and
            to send scrubbed excerpts to our AI provider when a member asks for
            an analysis or a fix;
          </li>
          <li>
            if you also turn on AI fix pull requests, allow us to keep the few
            changed lines of a fix, and to create a branch and a draft pull
            request when an owner or admin asks for it.
          </li>
        </ul>
        <p>
          You can withdraw this at any time by turning the feature off or
          disconnecting GitHub. The code stored in suggested fixes is then
          deleted. Text already sent to the AI provider, stored analyses, and
          branches or pull requests already on GitHub are not removed by this.
        </p>
        <p>
          We claim no ownership of your code or of a suggested fix.{" "}
          <strong>AI output can be wrong, insecure, or similar to existing code.</strong>{" "}
          You must review and test it before using it, and you decide whether to
          merge it.
        </p>
      </>
    ),
  },
  {
    id: "license",
    title: "7. Software licenses",
    body: (
      <>
        <p>
          The source code of Errwise, including the SDK{" "}
          <code>@errwise/node</code>, is open source under the{" "}
          <a
            href={`${GITHUB_URL}/blob/main/LICENSE`}
            target="_blank"
            rel="noopener noreferrer"
          >
            MIT License
          </a>
          . That license applies to the code, and you may use it as it says.
        </p>
        <p>
          It does not cover the hosted service, which you use under these terms,
          or the Errwise name and logo. We give you a personal, revocable,
          non-transferable right to use the hosted service.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "8. Third-party services",
    body: (
      <p>
        Features that use GitHub, Google or an AI provider also depend on their
        terms. We are not responsible for their services.
      </p>
    ),
  },
  {
    id: "availability",
    title: "9. Availability and limits",
    body: (
      <p>
        Errwise is offered free of charge, without a service level agreement. We
        may apply rate limits and daily AI limits, and change or stop features.
        Events are not deleted automatically today; we may introduce retention
        limits with notice. Keep your own copy of anything you cannot lose.
      </p>
    ),
  },
  {
    id: "termination",
    title: "10. Ending the agreement",
    body: (
      <p>
        You can stop at any time and ask us to delete your account at{" "}
        {CONTACT_EMAIL}. We may suspend an account that breaks these terms or
        puts the service at risk, with notice when that is reasonable.
      </p>
    ),
  },
  {
    id: "warranty",
    title: "11. No warranty",
    body: (
      <p>
        As far as the law allows, the service and all AI output are provided “as
        is” and “as available”, without warranties of any kind. Errwise helps
        you find errors. It does not guarantee that it will detect or fix them.
      </p>
    ),
  },
  {
    id: "liability",
    title: "12. Limitation of liability",
    body: (
      <p>
        As far as the law allows, we are not liable for indirect or
        consequential losses, or for lost profit, revenue, data or goodwill. Our
        total liability is limited to [LIABILITY_CAP]. Nothing here limits
        liability that cannot be limited by law, or the mandatory rights of
        consumers.
      </p>
    ),
  },
  {
    id: "indemnity",
    title: "13. Claims about your data",
    body: (
      <p>
        If someone makes a claim against us because you sent data or code you
        had no right to share, or because you broke these terms, you will cover
        the reasonable costs and damages that result, as far as the law allows.
      </p>
    ),
  },
  {
    id: "changes",
    title: "14. Changes",
    body: (
      <p>
        We may update these terms. For important changes we will give notice in
        the product or by email before they apply, and ask you to accept again
        where the law requires it.
      </p>
    ),
  },
  {
    id: "law",
    title: "15. Governing law",
    body: (
      <p>
        These terms are governed by {GOVERNING_LAW}, without removing the
        protection that the law of your country gives you as a consumer.
      </p>
    ),
  },
  {
    id: "contact",
    title: "16. Contact",
    body: (
      <p>
        {LEGAL_ENTITY}, {CONTACT_EMAIL}
      </p>
    ),
  },
];
