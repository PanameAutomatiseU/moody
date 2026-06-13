"use client";

import { MOOD_LIST } from "@/lib/moods";
import type { MoodId } from "@/lib/types";

export function MoodPicker({
  value,
  onChange,
}: {
  value: MoodId;
  onChange: (m: MoodId) => void;
}) {
  const active = MOOD_LIST.find((m) => m.id === value)!;
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" role="radiogroup" aria-label="Choisis ton mood">
        {MOOD_LIST.map((m) => {
          const on = m.id === value;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              data-testid={`mood-${m.id}`}
              onClick={() => onChange(m.id)}
              className="shrink-0 rounded-full px-3.5 py-2 text-sm font-medium border transition-colors duration-150"
              style={
                on
                  ? { background: m.accent, color: "#fff", borderColor: m.accent }
                  : { background: "#fff", color: "var(--color-ink)", borderColor: "var(--color-hair)" }
              }
            >
              <span className="mr-1.5" aria-hidden>
                {m.emoji}
              </span>
              {m.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-sm leading-snug text-[color:var(--color-ink-soft)]">
        <span className="font-semibold text-[color:var(--color-ink)]">{active.tagline}</span>{" "}
        {active.blurb}
      </p>
    </div>
  );
}
