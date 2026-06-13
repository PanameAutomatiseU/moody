import { NextResponse } from "next/server";
import { planRoutes } from "@/lib/router";
import { enrichBikeLegs } from "@/lib/enrich";
import { liveVelibStations } from "@/lib/velib-live";
import { isMoodId, presetMood, bikePreferenceFromWeights } from "@/lib/moods";
import type { MoodWeights, Place, ResolvedMood, RouteResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 20;

async function fetchWeather(lat: number, lon: number): Promise<{ rain: boolean; note: string | null }> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toFixed(3));
    url.searchParams.set("longitude", lon.toFixed(3));
    url.searchParams.set("current", "precipitation,temperature_2m");
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return { rain: false, note: null };
    const data = (await res.json()) as { current?: { precipitation?: number; temperature_2m?: number } };
    const precip = data.current?.precipitation ?? 0;
    const temp = data.current?.temperature_2m;
    if (precip >= 0.2)
      return { rain: true, note: "🌧️ Il pleut sur Paris — Moody a allégé le Vélib et la marche." };
    if (typeof temp === "number" && temp >= 26)
      return { rain: false, note: "☀️ Il fait chaud — pense à l'eau si tu pédales." };
    if (typeof temp === "number" && temp <= 3)
      return { rain: false, note: "🥶 Il fait froid — le métro te gardera au chaud." };
    return { rain: false, note: null };
  } catch {
    return { rain: false, note: null };
  }
}

function isPlace(x: unknown): x is Place {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  return (
    typeof p.label === "string" &&
    typeof p.lat === "number" &&
    typeof p.lon === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon)
  );
}

/** Resolve the incoming `mood` field: a preset id (string) or an object { id }. */
function resolveMood(m: unknown): ResolvedMood | null {
  const id =
    typeof m === "string"
      ? m
      : m && typeof m === "object" && typeof (m as { id?: unknown }).id === "string"
        ? (m as { id: string }).id
        : null;
  return id && isMoodId(id) ? presetMood(id) : null;
}

function rainAdjust(w: MoodWeights): MoodWeights {
  return { ...w, bike: w.bike + 0.7, walk: w.walk + 0.4, underground: Math.min(w.underground, 0.1) };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { origin, destination, mood } = (body ?? {}) as {
    origin?: unknown;
    destination?: unknown;
    mood?: unknown;
  };

  if (!isPlace(origin) || !isPlace(destination)) {
    return NextResponse.json({ error: "Départ et arrivée requis." }, { status: 400 });
  }
  const resolved = resolveMood(mood);
  if (!resolved) {
    return NextResponse.json({ error: "Mood invalide." }, { status: 400 });
  }

  const [velib, weather] = await Promise.all([
    liveVelibStations(),
    fetchWeather(origin.lat, origin.lon),
  ]);

  const weights = weather.rain ? rainAdjust(resolved.weights) : resolved.weights;
  const preference = bikePreferenceFromWeights(weights);

  const result = planRoutes(origin, destination, weights, { velib });
  if (!result) {
    return NextResponse.json(
      { error: "Aucun itinéraire trouvé entre ces deux points." },
      { status: 422 },
    );
  }

  const ranked = await enrichBikeLegs([result.best, ...result.alternatives], weights, preference);

  const payload: RouteResult = {
    origin,
    destination,
    mood: { id: resolved.id, label: resolved.label, emoji: resolved.emoji, accent: resolved.accent },
    best: ranked[0],
    alternatives: ranked.slice(1),
    weatherNote: weather.note,
    generatedAt: new Date().toISOString(),
  };
  return NextResponse.json(payload);
}
