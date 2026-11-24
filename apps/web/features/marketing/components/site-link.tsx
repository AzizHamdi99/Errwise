import Link from "next/link";
import type { NavLink } from "../nav";

interface Props {
  link: NavLink;
  className?: string;
  onClick?: () => void;
}

/** An internal link, or an external one that opens in a new tab. */
export function SiteLink({ link, className, onClick }: Props) {
  if (!link.external) {
    return (
      <Link href={link.href} className={className} onClick={onClick}>
        {link.label}
      </Link>
    );
  }
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={onClick}
    >
      {link.label}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
