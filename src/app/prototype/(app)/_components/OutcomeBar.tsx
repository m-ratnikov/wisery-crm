import type { Outcome } from "../_data/review-queue";

const options: { value: Outcome; label: string }[] = [
  { value: "none", label: "Not acted" },
  { value: "sent", label: "Sent" },
  { value: "replied", label: "Replied" },
  { value: "booked", label: "Booked" },
];

export function OutcomeBar({
  value,
  onChange,
}: {
  value: Outcome;
  onChange: (outcome: Outcome) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-zinc-200 p-0.5 dark:border-zinc-700">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            value === option.value
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
