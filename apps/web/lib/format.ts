const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

/** "Jane Developer" -> "JD", "Acme" -> "A" (with max 1). */
export function getInitials(value: string, max = 2): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "?");
  return letters.slice(0, max).toUpperCase();
}
