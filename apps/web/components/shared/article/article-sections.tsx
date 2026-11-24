import type { ArticleSection } from "./types";

const PROSE =
  "space-y-4 leading-7 text-foreground/90 [&_a]:text-brand-text [&_a]:underline [&_a]:underline-offset-4 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.85em] [&_:not(pre)>code]:break-words [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_h3]:pt-2 [&_h3]:font-medium";

export function ArticleSections({ sections }: { sections: ArticleSection[] }) {
  return (
    <div className="space-y-12">
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={section.id}>
          <h2
            id={section.id}
            className="group mb-4 scroll-mt-24 text-2xl [overflow-wrap:anywhere] font-semibold tracking-tight"
          >
            {section.title}
            <a
              href={`#${section.id}`}
              aria-label={`Link to ${section.title}`}
              className="ml-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              #
            </a>
          </h2>
          <div className={PROSE}>{section.body}</div>
        </section>
      ))}
    </div>
  );
}
