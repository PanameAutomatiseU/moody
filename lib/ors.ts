import type { LatLng } from "./types";

const ORS_BASE = "https://api.openrouteservice.org/v2/directions";

export type BikePreference = "fastest" | "recommended";

export interface BikeRoute {
  coords: LatLng[];
  distanceM: number;
  durationMin: number; // pure riding time (Vélib unlock/dock overhead added by caller)
}

export function hasOrsKey(): boolean {
  return Boolean(process.env.ORS_API_KEY);
}

/**
 * Real cycling route between two points via OpenRouteService.
 * `recommended` favours cycle-friendly ways (pistes cyclables), `fastest` is direct.
 * Returns null on any failure / missing key so callers fall back to estimates.
 */
export async function routeBike(
  from: LatLng,
  to: LatLng,
  preference: BikePreference,
): Promise<BikeRoute | null> {
  const key = process.env.ORS_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${ORS_BASE}/cycling-regular/geojson`, {
      method: "POST",
      headers: {
        Authorization: key,
        "Content-Type": "application/json",
        Accept: "application/geo+json",
      },
      body: JSON.stringify({
        coordinates: [
          [from.lon, from.lat],
          [to.lon, to.lat],
        ],
        preference,
        instructions: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: {
        geometry?: { coordinates?: [number, number][] };
        properties?: { summary?: { distance?: number; duration?: number } };
      }[];
    };
    const feat = data.features?.[0];
    const coords = feat?.geometry?.coordinates;
    const summary = feat?.properties?.summary;
    if (!coords || coords.length < 2 || summary?.distance == null || summary?.duration == null) {
      return null;
    }
    return {
      coords: coords.map(([lon, lat]) => ({ lat, lon })),
      distanceM: summary.distance,
      durationMin: summary.duration / 60,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
