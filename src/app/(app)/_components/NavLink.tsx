"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The only client component in the shell: active-route highlighting needs the current
// path (usePathname is a client hook). Active on an exact match for "/" and on a segment
// boundary for sub-trees, so /prospect-list/[id] keeps "Prospect list" active without a
// bare startsWith matching an unrelated "/prospect-list-archive".
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavLink({
  href,
  label,
  badge,
  icon,
}: {
  href: string;
  label: string;
  badge?: string;
  icon?: string;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  const base = "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors";
  const state = active
    ? "bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
    : "font-medium text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800";
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`${base} ${state}`}>
      {badge ? <span className="font-mono text-xs text-zinc-400">{badge}</span> : null}
      {icon ? (
        <span className="font-mono text-xs text-zinc-400" aria-hidden>
          {icon}
        </span>
      ) : null}
      {label}
    </Link>
  );
}
