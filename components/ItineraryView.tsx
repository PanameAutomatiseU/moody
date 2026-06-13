"use client";

import { useState } from "react";
import type { Itinerary, Leg, Mood } from "@/lib/types";
import { fmtArrival, fmtCost, fmtDistance, fmtDuration, co2SavingPct } from "@/lib/format";
import {
  BikeGlyph,
  LineBadge,
  TrainGlyph,
  TransferGlyph,
  WalkGlyph,
} from "./icons";

const WALK = "#9c968b";
const GREEN = "#1f8a53";

function legColor(leg: Leg): string {
  if (leg.mode === "walk") return WALK;
  if (leg.mode === "velib") return GREEN;
  if (leg.line) return leg.line.color;
  return "#1c1b19";
}

function LegNode({ leg }: { leg: Leg }) {
  if ((leg.mode === "metro" || leg.mode === "rer") && leg.line) {
    return <LineBadge line={leg.line} size={30} />;
  }
  const color = legColor(leg);
  return (
    <span
      className="flex h-[30px] w-[30px] items-center justify-center rounded-full"
      style={{ background: `${color}1f`, color }}
    >
      {leg.mode === "velib" ? (
        <BikeGlyph />
      ) : leg.mode === "transfer" ? (
        <TransferGlyph />
      ) : (
        <WalkGlyph />
      )}
    </span>
  );
}

function legText(leg: Leg): { title: string; subtitle: string } {
  const dur = fmtDuration(leg.durationMin);
  if (leg.mode === "walk")
    return { title: `Marche jusqu'à ${leg.to.name}`, subtitle: `${dur} · ${fmtDistance(leg.distanceM)}` };
  if (leg.mode === "velib")
    return {
      title: `Vélib jusqu'à ${leg.to.name}`,
      subtitle: `${dur} · ${fmtDistance(leg.distanceM)}${leg.detail ? ` · ${leg.detail}` : ""}`,
    };
  if (leg.mode === "transfer")
    return { title: `Correspondance`, subtitle: `${leg.to.name} · ${dur}` };
  const stops = leg.stops?.length ?? 0;
  return {
    title: `${leg.from.name} → ${leg.to.name}`,
    subtitle: `${Math.max(1, stops - 1)} stations · ${dur}`,
  };
}

function LegRow({ leg, isLast }: { leg: Leg; isLast: boolean }) {
  const { title, subtitle } = legText(leg);
  const color = legColor(leg);
  const hasStops = (leg.mode === "metro" || leg.mode === "rer") && (leg.stops?.length ?? 0) > 2;
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center pt-0.5">
        <LegNode leg={leg} />
        {!isLast && (
          <span className="my-1 w-[2px] flex-1 rounded-full" style={{ background: color, opacity: 0.32 }} />
        )}
      </div>
      <div className={isLast ? "flex-1" : "flex-1 pb-5"}>
        <div className="text-[15px] font-medium leading-tight">{title}</div>
        <div className="mt-0.5 text-[13px] text-[color:var(--color-ink-soft)]">{subtitle}</div>
        {hasStops && (
          <details className="group mt-1">
            <summary className="cursor-pointer list-none text-[12px] font-medium text-[color:var(--color-ink-soft)] underline-offset-2 hover:underline">
              voir les arrêts
            </summary>
            <ol className="mt-1 border-l-2 pl-3 text-[12px] text-[color:var(--color-ink-soft)]" style={{ borderColor: `${color}55` }}>
              {leg.stops!.map((s, i) => (
                <li key={i} className="py-0.5">
                  {s}
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </li>
  );
}

function LegSequence({ legs }: { legs: Leg[] }) {
  const tokens: React.ReactNode[] = [];
  let prevWalk = false;
  legs.forEach((leg, i) => {
    if (leg.mode === "transfer") return;
    if (leg.mode === "walk") {
      if (prevWalk) return;
      prevWalk = true;
      tokens.push(
        <span key={i} className="flex h-[18px] w-[18px] items-center justify-center rounded-full" style={{ background: `${WALK}24`, color: WALK }}>
          <WalkGlyph className="h-3 w-3" />
        </span>,
      );
      return;
    }
    prevWalk = false;
    if (leg.mode === "velib") {
      tokens.push(
        <span key={i} className="flex h-[18px] w-[18px] items-center justify-center rounded-full" style={{ background: `${GREEN}24`, color: GREEN }}>
          <BikeGlyph className="h-3 w-3" />
        </span>,
      );
    } else if (leg.line) {
      tokens.push(<LineBadge key={i} line={leg.line} size={18} />);
    }
  });
  return (
    <div className="flex items-center gap-1">
      {tokens.map((t, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-[color:var(--color-ink-soft)]">›</span>}
          {t}
        </span>
      ))}
    </div>
  );
}

function StatChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[color:var(--color-hair)] bg-[color:var(--color-paper)] px-2.5 py-1 text-[12px] font-medium text-[color:var(--color-ink)]">
      {label}
    </span>
  );
}

export function ItineraryView({
  selected,
  options,
  onSelect,
  mood,
  weatherNote,
}: {
  selected: Itinerary;
  options: Itinerary[];
  onSelect: (id: string) => void;
  mood: Mood;
  weatherNote: string | null;
}) {
  const [now] = useState(() => new Date());
  const others = options.filter((o) => o.id !== selected.id);
  const saving = co2SavingPct(selected.co2g, selected.carCo2g);
  const isTrain = selected.legs.some((l) => l.mode === "rer");

  return (
    <div className="space-y-4">
      {weatherNote && (
        <div className="rounded-xl border border-[color:var(--color-hair)] bg-[color:var(--color-surface)] px-3.5 py-2.5 text-[13px] text-[color:var(--color-ink-soft)]">
          {weatherNote}
        </div>
      )}

      <article
        className="animate-rise overflow-hidden rounded-3xl border border-[color:var(--color-hair)] bg-[color:var(--color-surface)] shadow-[0_18px_50px_-24px_rgba(0,0,0,0.25)]"
        data-testid="best-itinerary"
      >
        <div className="px-5 pt-5 pb-4" style={{ background: `linear-gradient(180deg, ${mood.accent}10, transparent)` }}>
          <div className="flex items-center gap-2 text-[13px] font-medium" style={{ color: mood.accent }}>
            <span aria-hidden>{mood.emoji}</span>
            <span>Pensé pour ton mood {mood.label}</span>
          </div>
          <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight" data-testid="itinerary-summary">
            {isTrain ? <TrainGlyph /> : null}
            {selected.summary}
          </h2>
          <div className="mt-3 flex items-end gap-3">
            <span className="text-4xl font-semibold tracking-tight" data-testid="itinerary-duration">
              {fmtDuration(selected.durationMin)}
            </span>
            <span className="pb-1 text-sm text-[color:var(--color-ink-soft)]">
              arrivée ~{fmtArrival(selected.durationMin, now)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <StatChip label={`${selected.transfers} correspondance${selected.transfers > 1 ? "s" : ""}`} />
            <StatChip label={fmtCost(selected.costEuro)} />
            <StatChip label={fmtDistance(selected.distanceM)} />
            {saving > 0 && <StatChip label={`🌍 −${saving}% CO₂ vs voiture`} />}
          </div>
          {selected.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selected.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
                  style={{ background: `${mood.accent}18`, color: mood.accent }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 pt-4 pb-5">
          <ol>
            {selected.legs.map((leg, i) => (
              <LegRow key={i} leg={leg} isLast={i === selected.legs.length - 1} />
            ))}
          </ol>
        </div>
      </article>

      {others.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-soft)]">
            Autres options
          </h3>
          <div className="space-y-2" data-testid="alternatives">
            {others.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => onSelect(it.id)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[color:var(--color-hair)] bg-[color:var(--color-surface)] px-3.5 py-3 text-left transition-colors hover:border-[color:var(--color-ink)]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <LegSequence legs={it.legs} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{it.summary}</div>
                    <div className="text-[12px] text-[color:var(--color-ink-soft)]">
                      {it.transfers} corresp · {fmtCost(it.costEuro)}
                      {it.tags[0] ? ` · ${it.tags[0]}` : ""}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold">{fmtDuration(it.durationMin)}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
