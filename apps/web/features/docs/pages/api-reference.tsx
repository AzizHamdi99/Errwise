import Link from "next/link";
import { DocTable } from "@/components/shared/article/doc-table";
import { CodeBlock } from "@/components/shared/code-block";
import type { DocPage } from "../types";

const c = (text: string) => <code>{text}</code>;

export const apiReference: DocPage = {
  slug: "api-reference",
  title: "API reference",
  description: "POST /v1/events, the endpoint the SDK uses.",
  sections: [
    {
      id: "request",
      title: "Request",
      body: (
        <>
          <p>
            Send one event, or an array of 1 to 50. Most apps should use the{" "}
            <Link href="/docs/sdk">SDK</Link> instead.
          </p>
          <CodeBlock
            language="bash"
            code={`curl -X POST https://errwise-api.vercel.app/v1/events \\
  -H "content-type: application/json" \\
  -H "x-api-key: $ERRWISE_API_KEY" \\
  -d '{
    "eventId": "6f1c2a5e-8f0b-4c57-9b53-2f4f0f2f7a11",
    "type": "TypeError",
    "message": "Cannot read properties of undefined",
    "environment": "production"
  }'`}
          />
          <DocTable
            head={["Header", "Value"]}
            rows={[
              [c("x-api-key"), "Your project key. It decides the project: a project id in the body is ignored."],
              [c("content-type"), "application/json"],
            ]}
          />
        </>
      ),
    },
    {
      id: "fields",
      title: "Event fields",
      body: (
        <>
          <DocTable
            head={["Field", "Required", "Rules"]}
            rows={[
              [c("eventId"), "Yes", "UUID. Sending the same one again stores nothing."],
              [c("message"), "Yes", "1 to 5,000 characters."],
              [c("type"), "No", "Up to 200 characters. Error when missing."],
              [c("stack"), "No", "Up to 50,000 characters."],
              [c("level"), "No", "fatal, error (default), warning or info."],
              [c("timestamp"), "No", "ISO 8601 with an offset. See below."],
              [c("environment"), "No", "Up to 64 characters. production by default."],
              [c("release"), "No", "Up to 128 characters."],
              [c("commitSha"), "No", "7 to 64 hex characters. A malformed value is ignored."],
              [c("platform"), "No", "Up to 32 characters. node by default."],
              [c("sdk"), "No", "Up to 64 characters."],
              [c("context"), "No", "JSON object, up to 16,384 characters."],
            ]}
          />
          <p>
            A missing timestamp, one more than 5 minutes in the future or more
            than 30 days old is replaced by the time of reception. Unknown fields
            are dropped.
          </p>
        </>
      ),
    },
    {
      id: "responses",
      title: "Responses",
      body: (
        <>
          <DocTable
            head={["Status", "Meaning"]}
            rows={[
              [c("202"), "Stored. The body says how many events were new."],
              [c("400"), "Not valid. One bad event rejects the whole batch."],
              [c("401"), "The key is missing, unknown or revoked, or its project was deleted."],
              [c("429"), "Too many requests. Wait the number of seconds in Retry-After."],
            ]}
          />
          <CodeBlock
            language="json"
            code={`{ "accepted": 1, "duplicates": 0 }`}
          />
          <p>Every error has the same shape:</p>
          <CodeBlock
            language="json"
            code={`{
  "statusCode": 401,
  "message": "Invalid API key",
  "path": "/v1/events",
  "timestamp": "2026-11-24T09:00:00.000Z"
}`}
          />
        </>
      ),
    },
    {
      id: "rate-limit",
      title: "Rate limit",
      body: (
        <p>
          By default 300 requests per minute for each key. A batch counts as one
          request. The count is kept per server instance, so treat it as
          approximate.
        </p>
      ),
    },
    {
      id: "versioning",
      title: "Versioning",
      body: (
        <p>
          The version is in the URL. Only the ingestion endpoint is meant for
          public use today: the other routes serve the dashboard and may change.
        </p>
      ),
    },
  ],
};
