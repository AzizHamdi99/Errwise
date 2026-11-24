import { CodeBlock } from "@/components/shared/code-block";
import { EXPRESS_SNIPPET, NEST_SNIPPET } from "@/features/marketing/snippets";
import type { DocPage } from "../types";

export const integrations: DocPage = {
  slug: "integrations",
  title: "Express and NestJS",
  description: "Report unhandled request errors with one line of setup.",
  sections: [
    {
      id: "express",
      title: "Express",
      body: (
        <>
          <p>
            Register the handler after your routes and before your own error
            handler. It reports the error, then passes it on.
          </p>
          <CodeBlock code={EXPRESS_SNIPPET} language="ts" />
          <p>
            Express 5 forwards errors from async routes. Express 4 does not, so
            wrap async routes or upgrade.
          </p>
        </>
      ),
    },
    {
      id: "nestjs",
      title: "NestJS",
      body: (
        <>
          <p>
            Initialize in <code>main.ts</code> and register the filter in{" "}
            <code>app.module.ts</code>. The filter reports the error, then lets
            Nest answer exactly as before.
          </p>
          <CodeBlock code={NEST_SNIPPET} language="ts" />
          <p>
            Import the filter from <code>@errwise/node/nestjs</code>. If your key
            comes from <code>ConfigModule</code>, call <code>init()</code> after{" "}
            <code>NestFactory.create</code>.
          </p>
        </>
      ),
    },
    {
      id: "what-is-reported",
      title: "What is reported",
      body: (
        <>
          <p>
            Errors with a 4xx status are skipped, because they are the mistake
            of a client. Everything else is reported, with the HTTP method and
            path. The query string, headers, cookies and body are never sent.
          </p>
          <p>In Express you can change the rule:</p>
          <CodeBlock
            language="ts"
            code={`app.use(Errwise.expressErrorHandler({ shouldCapture: () => true }));`}
          />
        </>
      ),
    },
    {
      id: "compatibility",
      title: "Compatibility",
      body: (
        <p>
          Node.js 20 or newer, ESM and CommonJS, Express 4 and 5, NestJS 9 or
          newer.
        </p>
      ),
    },
  ],
};
