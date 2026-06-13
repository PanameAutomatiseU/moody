import type { Itinerary, MoodId } from "./types";
import { recomposeItinerary } from "./router";
import { routeBike, type BikePreference, type BikeRoute } from "./ors";
import { VELIB_OVERHEAD } from "./geo";

// Énergie/Pressé veulent du direct ; les moods plus posés privilégient les
// itinéraires cyclables (pistes), via la préférence "recommended" d'ORS.
const PREFERENCE: Record<MoodId, BikePreference> = {
  presse: "fastest",
  energie: "fastest",
  zen: "recommended",
  flaneur: "recommended",
  econome: "recommended",
};

const coordKey = (lat: number, lon: number) => `${lat.toFixed(5)},${lon.toFixed(5)}`;
const legKey = (from: { lat: number; lon: number }, to: { lat: number; lon: number }, pref: string) =>
  `${coordKey(from.lat, from.lon)}>${coordKey(to.lat, to.lon)}|${pref}`;

/**
 * Replace the straight-line Vélib legs with real OpenRouteService cycling routes
 * (geometry following streets & pistes cyclables, plus real distance/duration),
 * then recompute totals and re-rank by the active mood. Identical Vélib legs
 * shared across itineraries are routed only once. When ORS is unavailable the
 * legs keep their estimates — the result is always valid.
 */
export async function enrichBikeLegs(items: Itinerary[], moodId: MoodId): Promise<Itinerary[]> {
  const preference = PREFERENCE[moodId];

  const routes = new Map<string, Promise<BikeRoute | null>>();
  for (const it of items) {
    for (const leg of it.legs) {
      if (leg.mode !== "velib") continue;
      const k = legKey(leg.from, leg.to, preference);
      if (!routes.has(k)) routes.set(k, routeBike(leg.from, leg.to, preference));
    }
  }
  if (routes.size === 0) return items;

  await Promise.all(routes.values());

  for (const it of items) {
    for (const leg of it.legs) {
      if (leg.mode !== "velib") continue;
      const r = await routes.get(legKey(leg.from, leg.to, preference));
      if (r) {
        leg.polyline = r.coords;
        leg.distanceM = r.distanceM;
        leg.durationMin = r.durationMin + VELIB_OVERHEAD;
      }
    }
  }

  return items.map((it) => recomposeItinerary(it, moodId)).sort((a, b) => a.score - b.score);
}
