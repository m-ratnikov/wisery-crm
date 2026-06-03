import Link from "next/link";

// Shared chrome for the two auth screens (sign-in / sign-up): brand, centered card,
// the V2 Google SSO affordance, and a footer slot. One authoritative representation
// of the auth card rather than duplicating the shell across both screens. The form
// is a wireframe - inputs are uncontrolled and "submit" is a deep link into the app
// (nothing authenticates yet).
export function AuthShell({
  title,
  subtitle,
  children,
  submitLabel,
  submitHref,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  submitLabel: string;
  submitHref: string;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-lg font-semibold tracking-tight">Wisery CRM</p>
          <p className="mt-1 text-xs text-zinc-500">
            AI-native outreach, one approved message at a time
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-base font-semibold">{title}</h1>
          <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>

          <div className="mt-5 space-y-3">{children}</div>

          <Link
            href={submitHref}
            className="mt-5 flex w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {submitLabel}
          </Link>

          <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            or
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <button
            type="button"
            disabled
            title="Google SSO arrives in V2"
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-400 dark:border-zinc-700"
          >
            <span className="font-semibold">G</span>
            Continue with Google
            <span className="ml-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400 dark:bg-zinc-800">
              V2
            </span>
          </button>
        </div>

        <p className="mt-5 text-center text-xs text-zinc-500">{footer}</p>
      </div>
    </div>
  );
}

// A labelled wireframe input. Uncontrolled on purpose - the prototype does not auth.
export function AuthField({
  label,
  type = "text",
  placeholder,
}: {
  label: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
      />
    </label>
  );
}
