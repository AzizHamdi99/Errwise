import { CopyButton } from "@/components/shared/copy-button";
import { INSTALL_COMMAND } from "@/lib/site";

const START_MS = 400;
const PER_CHAR_MS = 55;

/**
 * Typed out with CSS only: every character is in the HTML from the start, so there is no
 * layout shift, nothing to hydrate, and it stays readable without JavaScript.
 */
export function InstallCommand() {
  const chars = Array.from(INSTALL_COMMAND);

  return (
    <div className="mx-auto flex w-full max-w-sm items-center gap-3 rounded-xl border bg-card/80 py-2 pr-2 pl-4 shadow-sm backdrop-blur-sm">
      <code className="min-w-0 flex-1 overflow-hidden text-left font-mono text-[13px] whitespace-pre sm:text-sm">
        <span className="sr-only">{INSTALL_COMMAND}</span>
        <span aria-hidden>
          <span className="text-brand-text">$ </span>
          {chars.map((char, index) => (
            <span
              key={index}
              className="typed-char"
              style={{ animationDelay: `${START_MS + index * PER_CHAR_MS}ms` }}
            >
              {char}
            </span>
          ))}
          <span className="typed-caret" />
        </span>
      </code>
      <CopyButton
        value={INSTALL_COMMAND}
        variant="ghost"
        size="sm"
        className="h-8"
      />
    </div>
  );
}
