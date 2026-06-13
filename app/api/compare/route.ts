import { NextResponse } from "next/server";
import { planRoutes } from "@/lib/router";
import { liveVelibStations } from "@/lib/velib-live";
import { MOOD_LIST } from "@/lib/moods";
import type { Place } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 15;

export interface CompareItem {
  id: string;
  label: string;
  emoji: string;
  accent: string;
  available: boolean;
  durationMin?: number;
  transfers?: number;
  costEuro?: number;
  bikeMin?: number;
  walkMin?: number;
  summary?: string;
  tags?: string[];
}

function isPlace(x: unknown): x is Place {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  return typeof p.lat === "number" && typeof p.lon === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lon);
}

/** Best itinerary for each of the 5 mood presets on a single OD — powers the
 *  side-by-side comparator. Straight-line Vélib estimate (no ORS) to stay fast. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }
  const { origin, destination } = (body ?? {}) as { origin?: unknown; destination?: unknown };
  if (!isPlace(origin) || !isPlace(destination)) {
    return NextResponse.json({ error: "Départ et arrivée requis." }, { status: 400 });
  }

  const velib = await liveVelibStations();
  const results: CompareItem[] = MOOD_LIST.map((m) => {
    const r = planRoutes(origin, destination, m.weights, { velib });
    const base = { id: m.id, label: m.label, emoji: m.emoji, accent: m.accent };
    if (!r) return { ...base, available: false };
    const b = r.best;
    return {
      ...base,
      available: true,
      durationMin: b.durationMin,
      transfers: b.transfers,
      costEuro: b.costEuro,
      bikeMin: b.bikeMin,
      walkMin: b.walkMin,
      summary: b.summary,
      tags: b.tags,
    };
  });

  return NextResponse.json({ results });
}
