"use client";

import { useFormStatus } from "react-dom";

// Submit button that reflects the enclosing form's pending state (Next 16 / React 19).
// Must render inside the <form> it reports on.
export function SaveBar({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex justify-end">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Saving..." : label}
      </button>
    </div>
  );
}
