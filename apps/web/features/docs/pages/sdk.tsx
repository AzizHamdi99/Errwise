import { DocTable } from "@/components/shared/article/doc-table";
import { CodeBlock } from "@/components/shared/code-block";
import type { DocPage } from "../types";

const c = (text: string) => <code>{text}</code>;

export const sdk: DocPage = {
  slug: "sdk",
  title: "SDK reference",
  description: "Every option and method of @errwise/node.",
  sections: [
    {
      id: "init",
      title: "Errwise.init(options)",
      body: (
        <>
          <p>
            Starts the SDK. Call it once. A wrong configuration never throws: a
            warning is printed and the SDK stays off.
          </p>
          <DocTable
            head={["Option", "Default", "Description"]}
            rows={[
              [c("apiKey"), "Required", "Your project key, ew_live_ followed by 32 characters."],
              [c("environment"), "NODE_ENV, or production", "Shown as a filter in the dashboard. 64 characters at most."],
              [c("release"), "ERRWISE_RELEASE", "Your app version. 128 characters at most."],
              [c("commit"), "Your host's variable", "The deployed Git commit, 7 to 64 hex characters. Needed to show source code."],
              [c("enabled"), "true", "Set to false to turn the SDK off, for example in tests."],
              [c("beforeSend"), "None", "Edit or drop an event before it is sent."],
              [c("captureUncaughtErrors"), "true", "Capture uncaught exceptions and unhandled rejections."],
              [c("endpoint"), "Errwise cloud", "The base URL of the API. Only set it if you self-host."],
              [c("debug"), "false", "Print what the SDK is doing."],
            ]}
          />
          <p>
            The commit is found automatically from the first of these variables
            that holds a Git hash: {c("ERRWISE_COMMIT_SHA")},{" "}
            {c("VERCEL_GIT_COMMIT_SHA")}, {c("GITHUB_SHA")},{" "}
            {c("RENDER_GIT_COMMIT")}, {c("RAILWAY_GIT_COMMIT_SHA")},{" "}
            {c("SOURCE_VERSION")} (Heroku), {c("CF_PAGES_COMMIT_SHA")}.
          </p>
        </>
      ),
    },
    {
      id: "capture-exception",
      title: "Errwise.captureException(error, options?)",
      body: (
        <>
          <p>
            Queues an error and returns at once. It never throws and never waits
            for the network. It returns the event id, or {c("undefined")} when
            the event was not accepted.
          </p>
          <CodeBlock
            language="ts"
            code={`Errwise.captureException(error, {
  level: "warning",
  extra: { orderId: 1234 },
});`}
          />
          <DocTable
            head={["Option", "Description"]}
            rows={[
              [c("level"), "fatal, error (default), warning or info."],
              [c("extra"), "JSON-serializable data shown with the event. Dropped if the context grows past 16,384 characters."],
            ]}
          />
        </>
      ),
    },
    {
      id: "before-send",
      title: "beforeSend",
      body: (
        <>
          <p>
            Return the event, changed or not, or {c("null")} to drop it. It must
            be synchronous. If it throws or returns something invalid, the event
            is dropped, so a broken filter never leaks data.
          </p>
          <CodeBlock
            language="ts"
            code={`Errwise.init({
  apiKey: process.env.ERRWISE_API_KEY,
  beforeSend(event) {
    if (event.message.includes("ECONNRESET")) return null;
    return { ...event, message: event.message.replace(/user-\\d+/g, "user") };
  },
});`}
          />
        </>
      ),
    },
    {
      id: "global-handlers",
      title: "Uncaught errors",
      body: (
        <ul>
          <li>
            If your app has no handler of its own, the SDK prints the error,
            sends it as {c("fatal")} for up to two seconds, and exits with code
            1, as Node would.
          </li>
          <li>
            If your app already listens to {c("uncaughtException")} or{" "}
            {c("unhandledRejection")}, the SDK only reports. Your handler
            decides what happens.
          </li>
          <li>
            With {c("--unhandled-rejections")} set, the behavior you chose is
            left alone.
          </li>
        </ul>
      ),
    },
    {
      id: "flush-close",
      title: "flush and close",
      body: (
        <>
          <p>
            {c("flush(timeoutMs = 5000)")} sends what is queued and resolves{" "}
            {c("true")} when nothing is left. {c("close(timeoutMs = 10000)")}{" "}
            flushes, then stops the SDK. Use them when the process may stop
            right after your code, as in scripts and serverless functions.
          </p>
          <CodeBlock
            language="ts"
            code={`process.on("SIGTERM", async () => {
  await Errwise.close();
  process.exit(0);
});`}
          />
        </>
      ),
    },
    {
      id: "delivery",
      title: "Delivery and limits",
      body: (
        <ul>
          <li>Events are sent in batches, every two seconds or every 50 events.</li>
          <li>
            The queue holds 100 events. When it is full, the oldest are dropped.
          </li>
          <li>
            At most 120 events per minute are accepted. Fatal events are never
            refused by this limit.
          </li>
          <li>
            Network errors and server errors are retried with a growing delay,
            from one second up to a minute.
          </li>
          <li>
            If the API key is rejected, the SDK stops sending until the app
            restarts.
          </li>
        </ul>
      ),
    },
  ],
};
