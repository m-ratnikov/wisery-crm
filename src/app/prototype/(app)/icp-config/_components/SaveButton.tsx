import { useState } from "react";

// A wireframe affordance: the config screen's message is that everything here is
// data you edit and save (config-as-data, D6). Nothing persists in the prototype,
// so the button just confirms the gesture.
export function SaveButton({ label = "Save changes" }: { label?: string }) {
  const [saved, setSaved] = useState(false);
  const onClick = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      {saved ? "Saved ✓" : label}
    </button>
  );
}
