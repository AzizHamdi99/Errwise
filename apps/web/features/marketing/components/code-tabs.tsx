import { CodeBlock } from "@/components/shared/code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EXPRESS_SNIPPET, NEST_SNIPPET, NODE_SNIPPET } from "../snippets";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const TABS = [
  { id: "node", label: "Node.js", code: NODE_SNIPPET },
  { id: "express", label: "Express", code: EXPRESS_SNIPPET },
  { id: "nestjs", label: "NestJS", code: NEST_SNIPPET },
];

export function CodeTabs() {
  return (
    <section className="border-t px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="SDK" title="A few lines, then forget about it">
          The SDK never throws into your app and never waits for the network.
          It batches, retries and flushes before a crash.
        </SectionHeading>
        <Reveal className="mt-12">
          <Tabs defaultValue="node">
            <TabsList className="mx-auto mb-2">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="px-4">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {/* One height for all tabs, so switching does not move the page */}
            {TABS.map((tab) => (
              <TabsContent
                key={tab.id}
                value={tab.id}
                className="min-w-0 sm:min-h-[570px]"
              >
                <CodeBlock code={tab.code} language="ts" />
              </TabsContent>
            ))}
          </Tabs>
        </Reveal>
      </div>
    </section>
  );
}
