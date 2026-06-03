import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wisery CRM - prototype",
  description: "Clickable anchor-view mockups. Mock data, not wired to db/jobs.",
};

// Root of the prototype tree. Intentionally a passthrough: the signed-in app
// (sidebar chrome) lives in the (app) route group's layout, while the auth screens
// (sign-in / sign-up) render full-bleed with no sidebar. Both inherit only this.
export default function PrototypeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {children}
    </div>
  );
}
