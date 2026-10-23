import { CopyButton } from "./copy-button";

export function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative rounded-lg border bg-background/60">
      <CopyButton
        value={code}
        variant="ghost"
        size="sm"
        className="absolute right-2 top-2"
      />
      {/* tabIndex lets keyboard users scroll long lines */}
      <pre
        tabIndex={0}
        className="overflow-x-auto p-4 font-mono text-[13px] leading-6"
      >
        <code>
          {code.split("\n").map((line, index) => (
            <span key={index} className="flex">
              <span
                aria-hidden
                className="w-8 shrink-0 select-none pr-4 text-right text-muted-foreground/50"
              >
                {index + 1}
              </span>
              <span className="whitespace-pre">{line || " "}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
