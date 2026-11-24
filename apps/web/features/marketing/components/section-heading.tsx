import { Eyebrow } from "@/components/shared/eyebrow";
import { Reveal } from "./reveal";

interface Props {
  eyebrow: string;
  title: string;
  /** 3 when it sits inside another section. */
  level?: 2 | 3;
  children?: React.ReactNode;
}

export function SectionHeading({
  eyebrow,
  title,
  level = 2,
  children,
}: Props) {
  const Heading = level === 2 ? "h2" : "h3";

  return (
    <Reveal className="mx-auto max-w-2xl space-y-4 text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <Heading className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </Heading>
      {children ? (
        <p className="text-lg leading-relaxed text-pretty text-muted-foreground">
          {children}
        </p>
      ) : null}
    </Reveal>
  );
}
