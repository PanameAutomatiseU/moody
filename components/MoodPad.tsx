"use client";

import { useRef } from "react";
import {
  MOODS,
  MOOD_ANCHORS,
  MOOD_LIST,
  customMood,
  nearestPreset,
  presetMood,
} from "@/lib/moods";
import type { MoodId, ResolvedMood } from "@/lib/types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function MoodPad({
  value,
  onChange,
  onCommit,
}: {
  value: ResolvedMood;
  onChange: (m: ResolvedMood) => void;
  onCommit: (m: ResolvedMood) => void;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const pad = value.pad ?? MOOD_ANCHORS[(value.id as MoodId) in MOODS ? (value.id as MoodId) : "zen"];
  const isCustom = value.id === "custom";
  const near = isCustom ? MOODS[nearestPreset(pad)] : null;

  function posFromEvent(e: React.PointerEvent) {
    const rect = surfaceRef.current!.getBoundingClientRect();
    const x = clamp01((e.clientX - rect.left) / rect.width);
    const yScreen = clamp01((e.clientY - rect.top) / rect.height);
    return { x, y: 1 - yScreen };
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-soft)]">
          Ton mood
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: value.accent }}>
          <span aria-hidden>{value.emoji}</span>
          {value.label}
          {isCustom && near && (
            <span className="font-normal text-[color:var(--color-ink-soft)]">· proche de {near.label}</span>
          )}
        </span>
      </div>

      <div
        ref={surfaceRef}
        role="application"
        aria-label="Réglage du mood sur deux axes : vitesse-tranquillité et souterrain-grand air"
        onPointerDown={(e) => {
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          onChange(customMood(posFromEvent(e)));
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) onChange(customMood(posFromEvent(e)));
        }}
        onPointerUp={(e) => {
          if (!draggingRef.current) return;
          draggingRef.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
          onCommit(customMood(posFromEvent(e)));
        }}
        className="relative aspect-square w-full touch-none overflow-hidden rounded-2xl border border-[color:var(--color-hair)] select-none"
        style={{
          background:
            "linear-gradient(180deg,#eef4ee 0%,#f6f5f1 55%,#f1eee9 100%)",
          cursor: "crosshair",
        }}
      >
        {/* gridlines */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/5" />
        <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-black/5" />

        {/* axis labels */}
        <span className="pointer-events-none absolute left-1/2 top-1.5 -translate-x-1/2 text-[10px] font-medium text-[color:var(--color-ink-soft)]">
          Grand air 🌿
        </span>
        <span className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-[color:var(--color-ink-soft)]">
          Souterrain 🚇
        </span>
        <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-medium text-[color:var(--color-ink-soft)]">
          Vitesse
        </span>
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rotate-90 text-[10px] font-medium text-[color:var(--color-ink-soft)]">
          Tranquillité
        </span>

        {/* preset anchors */}
        {MOOD_LIST.map((m) => {
          const a = MOOD_ANCHORS[m.id];
          const active = value.id === m.id;
          return (
            <button
              key={m.id}
              type="button"
              title={`${m.label} — ${m.tagline}`}
              data-testid={`anchor-${m.id}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                const picked = presetMood(m.id);
                onChange(picked);
                onCommit(picked);
              }}
              className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-white/90 text-[13px] shadow-sm transition-transform hover:scale-110"
              style={{
                left: `${a.x * 100}%`,
                top: `${(1 - a.y) * 100}%`,
                borderColor: active ? m.accent : "var(--color-hair)",
                boxShadow: active ? `0 0 0 2px ${m.accent}` : undefined,
              }}
            >
              <span aria-hidden>{m.emoji}</span>
            </button>
          );
        })}

        {/* thumb */}
        <span
          className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
          style={{
            left: `${pad.x * 100}%`,
            top: `${(1 - pad.y) * 100}%`,
            background: value.accent,
          }}
        />
      </div>

      {/* quick presets */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {MOOD_LIST.map((m) => {
          const on = value.id === m.id;
          return (
            <button
              key={m.id}
              type="button"
              data-testid={`mood-${m.id}`}
              onClick={() => {
                const picked = presetMood(m.id);
                onChange(picked);
                onCommit(picked);
              }}
              className="rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors"
              style={
                on
                  ? { background: m.accent, color: "#fff", borderColor: m.accent }
                  : { background: "#fff", color: "var(--color-ink)", borderColor: "var(--color-hair)" }
              }
            >
              <span className="mr-1" aria-hidden>
                {m.emoji}
              </span>
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
