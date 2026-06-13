import { NextResponse } from "next/server";
import { planRoutes } from "@/lib/router";
import { enrichBikeLegs } from "@/lib/enrich";
import { withAvailability } from "@/lib/velib";
import { isMoodId } from "@/lib/moods";
import type { Place, RouteResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 20;

interface VelibRecord {
  stationcode: string | number;
  numbikesavailable?: number;
  numdocksavailable?: number;
}

/** Realtime Vélib availability from opendata.paris.fr (no key). Cached 60s.
 *  Returns an empty map on any failure — the router then assumes availability
 *  from the bundled snapshot, so a route is always produced. */
async function fetchVelibLive(): Promise<Map<string, { bikes: number; docks: number }>> {
  const map = new Map<string, { bikes: number; docks: number }>();
  try {
    const res = await fetch(
      "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json",
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return map;
    const rows = (await res.json()) as VelibRecord[];
    for (const r of rows) {
      map.set(String(r.stationcode), {
        bikes: r.numbikesavailable ?? 0,
        docks: r.numdocksavailable ?? 0,
      });
    }
  } catch {
    /* fall through to empty map */
  }
  return map;
}

async function fetchWeatherNote(lat: number, lon: number): Promise<string | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toFixed(3));
    url.searchParams.set("longitude", lon.toFixed(3));
    url.searchParams.set("current", "precipitation,temperature_2m");
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: { precipitation?: number; temperature_2m?: number };
    };
    const precip = data.current?.precipitation ?? 0;
    const temp = data.current?.temperature_2m;
    if (precip >= 0.2) return "🌧️ Il pleut sur Paris — un itinéraire plus couvert peut être plus agréable.";
    if (typeof temp === "number" && temp >= 26) return "☀️ Il fait chaud — pense à l'eau si tu pédales.";
    if (typeof temp === "number" && temp <= 3) return "🥶 Il fait froid — le métro te gardera au chaud.";
    return null;
  } catch {
    return null;
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
  if (typeof mood !== "string" || !isMoodId(mood)) {
    return NextResponse.json({ error: "Mood inconnu." }, { status: 400 });
  }

  const live = await fetchVelibLive();
  const velib = withAvailability(live);

  const result = planRoutes(origin, destination, mood, { velib });
  if (!result) {
    return NextResponse.json(
      { error: "Aucun itinéraire trouvé entre ces deux points." },
      { status: 422 },
    );
  }

  // Enrich Vélib legs with real ORS cycling routes (+ re-rank), in parallel with weather.
  const [ranked, weatherNote] = await Promise.all([
    enrichBikeLegs([result.best, ...result.alternatives], mood),
    fetchWeatherNote(origin.lat, origin.lon),
  ]);

  const payload: RouteResult = {
    origin,
    destination,
    mood,
    best: ranked[0],
    alternatives: ranked.slice(1),
    weatherNote,
    generatedAt: new Date().toISOString(),
  };
  return NextResponse.json(payload);
}
