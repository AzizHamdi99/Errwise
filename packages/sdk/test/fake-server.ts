import { createServer } from "node:http";
import type { IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";

export interface Received {
  url: string;
  headers: IncomingHttpHeaders;
  body: unknown;
}

export interface FakeServer {
  url: string;
  received: Received[];
  setStatus(code: number): void;
  close(): Promise<void>;
}

export async function startFakeServer(): Promise<FakeServer> {
  let status = 202;
  const received: Received[] = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      received.push({
        url: req.url ?? "",
        headers: req.headers,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
      });
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify({ accepted: 1, duplicates: 0 }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    received,
    setStatus: (code) => {
      status = code;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
