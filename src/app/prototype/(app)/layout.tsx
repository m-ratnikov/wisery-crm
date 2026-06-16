import Link from "next/link";

// The signed-in app shell: sidebar + main. Scoped to the (app) route group so the
// auth screens (one level up, outside this group) render without it. The anchor
// views the product commits to (product-overview section 2), ordered as the daily
// loop runs: configure, triage the Queue, work people, engage from the Feed.
const anchorViews = [
  { href: "/prototype/queue", label: "Queue", badge: "◧", live: true },
  { href: "/prototype/people", label: "People & companies", badge: "◍", live: true },
  { href: "/prototype/feed", label: "Feed", badge: "≋", live: true },
  { href: "/prototype/icp-config", label: "ICP & source config", badge: "⚒", live: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <p className="text-sm font-semibold tracking-tight">Wisery CRM</p>
          <p className="text-xs text-zinc-500">Anchor-view prototype</p>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          <Link
            href="/prototype"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <span className="font-mono text-xs text-zinc-400" aria-hidden>
              ⌂
            </span>
            The daily loop
          </Link>
          <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Anchor views
          </p>
          {anchorViews.map((view) => (
            <AppNavLink key={view.href} {...view} />
          ))}
          <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Account
          </p>
          <Link
            href="/prototype/settings"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <span className="font-mono text-xs text-zinc-400" aria-hidden>
              ⚙
            </span>
            Settings
          </Link>
        </nav>
        <div className="mt-auto border-t border-zinc-200 p-3 dark:border-zinc-800">
          <Link
            href="/prototype/sign-in"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <span className="font-mono text-xs text-zinc-400" aria-hidden>
              &rarr;]
            </span>
            Sign out
          </Link>
          <p className="px-3 pt-2 text-[11px] leading-4 text-zinc-400">
            Mock data only. Nothing here sends - the human acts manually (D2).
          </p>
        </div>
      </aside>
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}

function AppNavLink({
  href,
  label,
  badge,
  live,
}: {
  href: string;
  label: string;
  badge: string;
  live: boolean;
}) {
  const base = "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors";
  if (!live) {
    return (
      <span className={`${base} cursor-not-allowed text-zinc-400`}>
        <span className="font-mono text-xs text-zinc-300 dark:text-zinc-600">{badge}</span>
        {label}
        <span className="ml-auto text-[10px] uppercase tracking-wide text-zinc-300 dark:text-zinc-600">
          soon
        </span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} font-medium text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800`}
    >
      <span className="font-mono text-xs text-zinc-400">{badge}</span>
      {label}
    </Link>
  );
}
