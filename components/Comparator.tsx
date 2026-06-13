"use client";

import { useEffect, useState } from "react";
import type { Place } from "@/lib/types";
import { fmtCost, fmtDuration } from "@/lib/format";

interface CompareItem {
  id: string;
  label: string;
  emoji: string;
  accent: string;
  available: boolean;
  durationMin?: number;
  transfers?: number;
  costEuro?: number;
}

export function Comparator({
  origin,
  destination,
  activeMoodId,
  onPick,
}: {
  origin: Place | null;
  destination: Place | null;
  activeMoodId: string;
  onPick: (moodId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CompareItem[]>([]);
  const [loading, setLoading] = useState(false);

  const canCompare = !!origin && !!destination;
  const odKey = canCompare ? `${origin!.lat},${origin!.lon}>${destination!.lat},${destination!.lon}` : "";

  useEffect(() => {
    if (!open || !canCompare) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin, destination }),
        });
        const data = await res.json();
        if (!cancelled) setItems(data.results ?? []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, odKey]);

  if (!canCompare) return null;

  const fastestId = items
    .filter((i) => i.available)
    .reduce<CompareItem | null>((m, i) => (!m || (i.durationMin ?? 1e9) < (m.durationMin ?? 1e9) ? i : m), null)?.id;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="compare-toggle"
        className="flex w-full items-center justify-between rounded-xl border border-[color:var(--color-hair)] bg-white px-3.5 py-2.5 text-sm font-medium transition-colors hover:border-[color:var(--color-ink)]"
      >
        <span>⚖️ Comparer les 5 ambiances</span>
        <span className="text-[color:var(--color-ink-soft)]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-1.5" data-testid="compare-list">
          {loading && (
            <div className="h-28 animate-pulse rounded-xl bg-[color:var(--color-hair)]/50" />
          )}
          {!loading &&
            items.map((it) => {
              const active = it.id === activeMoodId;
              return (
                <button
                  key={it.id}
                  type="button"
                  disabled={!it.available}
                  onClick={() => it.available && onPick(it.id)}
                  className="flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-50"
                  style={{
                    borderColor: active ? it.accent : "var(--color-hair)",
                    background: active ? `${it.accent}10` : "#fff",
                  }}
                >
                  <span className="text-lg" aria-hidden>
                    {it.emoji}
                  </span>
                  <span className="w-24 shrink-0 text-sm font-medium">{it.label}</span>
                  <span className="flex-1 text-[13px] text-[color:var(--color-ink-soft)]">
                    {it.available ? `${it.transfers} corresp · ${fmtCost(it.costEuro ?? 0)}` : "indisponible"}
                  </span>
                  {it.available && (
                    <span className="shrink-0 text-right">
                      <span className="font-semibold">{fmtDuration(it.durationMin ?? 0)}</span>
                      {it.id === fastestId && (
                        <span className="ml-1.5 text-[11px] font-medium" style={{ color: it.accent }}>
                          ⚡
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
