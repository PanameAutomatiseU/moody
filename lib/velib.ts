import rawVelib from "@/data/velib-stations.json";
import type { LatLng } from "./types";
import { haversineM } from "./geo";

export interface VelibStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  cap: number;
  /** live bikes available; undefined => unknown (assumed available) */
  bikes?: number;
  /** live docks available; undefined => unknown (assumed available) */
  docks?: number;
}

interface RawVelib {
  id: string;
  name: string;
  lat: number;
  lon: number;
  cap: number;
}

/** Bundled snapshot of every Vélib station — the resilient fallback used when
 *  the realtime feed is unreachable, and the deterministic source for tests. */
export const VELIB_STATIONS: VelibStation[] = (rawVelib as RawVelib[]).map((s) => ({
  ...s,
}));

export interface NearVelib {
  station: VelibStation;
  distanceM: number;
}

export function nearestVelib(
  stations: VelibStation[],
  point: LatLng,
  maxM: number,
  k: number,
  need: "bike" | "dock",
): NearVelib[] {
  const out: NearVelib[] = [];
  for (const s of stations) {
    if (need === "bike" && s.bikes !== undefined && s.bikes <= 0) continue;
    if (need === "dock" && s.docks !== undefined && s.docks <= 0) continue;
    const d = haversineM(point, s);
    if (d <= maxM) out.push({ station: s, distanceM: d });
  }
  out.sort((a, b) => a.distanceM - b.distanceM);
  return out.slice(0, k);
}

/** Merge realtime availability (by station id) into a copy of the snapshot. */
export function withAvailability(
  live: Map<string, { bikes: number; docks: number }>,
): VelibStation[] {
  if (live.size === 0) return VELIB_STATIONS;
  return VELIB_STATIONS.map((s) => {
    const a = live.get(s.id);
    return a ? { ...s, bikes: a.bikes, docks: a.docks } : s;
  });
}
