const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

const relativeFormats = {
  long: new Intl.RelativeTimeFormat("en", { numeric: "auto" }),
  narrow: new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
    style: "narrow",
  }),
};

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

export function formatRelative(
  iso: string,
  style: "long" | "narrow" = "long",
): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return relativeFormats[style].format(Math.round(seconds / size), unit);
    }
  }
  return "just now";
}

/** "Jane Developer" -> "JD", "Acme" -> "A" (with max 1). */
export function getInitials(value: string, max = 2): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "?");
  return letters.slice(0, max).toUpperCase();
}
