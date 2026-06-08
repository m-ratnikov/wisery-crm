import { NavLink } from "./_components/NavLink";

// The signed-in app shell: persistent sidebar + main pane, wrapping every wired route via
// the (app) route group (group parens do not change the URL). Graduates the prototype shell
// (src/app/prototype/(app)/layout.tsx) into the wired app. The three anchor views are ordered
// as the daily loop runs: configure, then list, then queue (product-overview primary journey).
// api/health and the /prototype tree live outside this group and do not get the shell.
const anchorViews = [
  { href: "/icp-config", label: "ICP & source config", badge: "#1" },
  { href: "/queue", label: "Queue", badge: "T" },
  { href: "/prospect-list", label: "Person list", badge: "#3" },
  { href: "/feed", label: "Feed", badge: "#4" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <p className="text-sm font-semibold tracking-tight">Wisery CRM</p>
          <p className="text-xs text-zinc-500">Automate the intelligence</p>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          <NavLink href="/" label="The daily loop" icon="⌂" />
          <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Anchor views
          </p>
          {anchorViews.map((view) => (
            <NavLink key={view.href} {...view} />
          ))}
          <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Operations
          </p>
          <NavLink href="/jobs" label="Background jobs" icon="↻" />
          <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Account
          </p>
          <NavLink href="/settings" label="Settings" icon="⚙" />
        </nav>
        <div className="mt-auto border-t border-zinc-200 p-3 dark:border-zinc-800">
          <p className="px-3 text-[11px] leading-4 text-zinc-400">
            The system never sends - you act manually on the channel (D2).
          </p>
        </div>
      </aside>
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
