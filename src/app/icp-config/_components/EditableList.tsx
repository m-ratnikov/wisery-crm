"use client";

// Edits a list of short strings (ideal titles, signals, disqualifiers, ...). Controlled
// by the parent form component so the whole rubric serializes on submit.
export function EditableList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={item}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((it, j) => (j === i ? e.target.value : it)))}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="shrink-0 rounded-md border border-zinc-200 px-3 text-xs text-zinc-500 hover:text-red-600 dark:border-zinc-700"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        + Add
      </button>
    </div>
  );
}
