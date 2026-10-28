import { createServer } from "node:http";
import type { IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";

export interface Received {
  url: string;
  headers: IncomingHttpHeaders;
  body: unknown;
  /** The status this request was answered with. */
  status: number;
}

export interface FakeServer {
  url: string;
  received: Received[];
  setStatus(code: number, headers?: Record<string, string>): void;
  setDelay(ms: number): void;
  close(): Promise<void>;
}

export async function startFakeServer(): Promise<FakeServer> {
  let status = 202;
  let headers: Record<string, string> = {};
  let delayMs = 0;
  const received: Received[] = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const answerWith = status;
      const answerHeaders = headers;
      received.push({
        url: req.url ?? "",
        headers: req.headers,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
        status: answerWith,
      });
      const respond = () => {
        res.writeHead(answerWith, {
          "content-type": "application/json",
          ...answerHeaders,
        });
        res.end(JSON.stringify({ accepted: 1, duplicates: 0 }));
      };
      if (delayMs > 0) setTimeout(respond, delayMs).unref();
      else respond();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    received,
    setStatus: (code, extraHeaders = {}) => {
      status = code;
      headers = extraHeaders;
    },
    setDelay: (ms) => {
      delayMs = ms;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
