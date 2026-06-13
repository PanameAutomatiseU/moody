import { withAvailability, type VelibStation } from "./velib";

interface VelibRecord {
  stationcode: string | number;
  numbikesavailable?: number;
  numdocksavailable?: number;
}

/** Realtime Vélib availability from opendata.paris.fr (no key, cached 60s).
 *  Empty map on failure → the bundled snapshot is used instead. */
export async function fetchVelibLive(): Promise<Map<string, { bikes: number; docks: number }>> {
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
    /* fall through */
  }
  return map;
}

/** Bundled Vélib snapshot merged with realtime availability. */
export async function liveVelibStations(): Promise<VelibStation[]> {
  return withAvailability(await fetchVelibLive());
}
