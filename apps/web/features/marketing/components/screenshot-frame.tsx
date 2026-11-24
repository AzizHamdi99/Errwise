import Image from "next/image";
import { cn } from "@/lib/utils";
import { getScreenshot } from "../screenshots";
import type { ScreenshotFile, ScreenshotName } from "../screenshots";

interface Props {
  name: ScreenshotName;
  alt: string;
  /** How wide the image is on screen, for the browser to pick a file. */
  sizes: string;
  /** The text of the address bar. */
  label?: string;
  /** For the one image that is visible first. */
  important?: boolean;
  className?: string;
}

/** A real capture in a browser frame, with a variant per theme. */
export function ScreenshotFrame({
  name,
  alt,
  sizes,
  label = "errwise",
  important = false,
  className,
}: Props) {
  const shot = getScreenshot(name);
  const image = { alt, sizes, important };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-frame",
        className,
      )}
    >
      <div
        aria-hidden
        className="flex h-10 items-center gap-2 border-b bg-muted/60 px-4"
      >
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="mx-auto rounded-md bg-background/70 px-6 py-1 font-mono text-[11px] text-muted-foreground">
          {label}
        </span>
        <span className="w-10" />
      </div>

      {shot ? (
        <>
          <Capture
            {...image}
            file={shot.dark}
            className="hidden dark:block"
          />
          <Capture {...image} file={shot.light} className="dark:hidden" />
        </>
      ) : (
        <Pending name={name} />
      )}
    </div>
  );
}

function Capture({
  file,
  alt,
  sizes,
  important,
  className,
}: {
  file: ScreenshotFile;
  alt: string;
  sizes: string;
  important: boolean;
  className: string;
}) {
  return (
    <Image
      src={file.src}
      width={file.width}
      height={file.height}
      alt={alt}
      sizes={sizes}
      placeholder="blur"
      blurDataURL={file.blurDataURL}
      // Not preload or eager: both themes are in the HTML and only the visible one may load.
      fetchPriority={important ? "high" : undefined}
      className={cn("h-auto w-full", className)}
    />
  );
}

/** Same ratio as a capture, so nothing moves when the real file arrives. */
function Pending({ name }: { name: ScreenshotName }) {
  return (
    <div
      aria-hidden
      className="grid aspect-[16/10] place-items-center bg-muted/30"
    >
      {process.env.NODE_ENV === "development" ? (
        <p className="px-4 text-center font-mono text-xs text-muted-foreground">
          Pending screenshot: {name}
        </p>
      ) : null}
    </div>
  );
}
