import type { Place } from "./types";

function encPlace(p: Place): string {
  return `${p.lat.toFixed(5)},${p.lon.toFixed(5)},${encodeURIComponent(p.label)}`;
}

function decPlace(s: string | null): Place | null {
  if (!s) return null;
  const i1 = s.indexOf(",");
  const i2 = s.indexOf(",", i1 + 1);
  if (i1 < 0 || i2 < 0) return null;
  const lat = Number(s.slice(0, i1));
  const lon = Number(s.slice(i1 + 1, i2));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let label = s.slice(i2 + 1);
  try {
    label = decodeURIComponent(label);
  } catch {
    /* keep raw */
  }
  return { label, lat, lon };
}

/** Build a shareable querystring for the current trip + mood preset. */
export function buildShareParams(
  origin: Place | null,
  destination: Place | null,
  moodId: string,
): string {
  const p = new URLSearchParams();
  if (origin) p.set("o", encPlace(origin));
  if (destination) p.set("d", encPlace(destination));
  p.set("m", moodId);
  return p.toString();
}

export interface ParsedTrip {
  origin: Place | null;
  destination: Place | null;
  moodId: string | null;
}

export function parseShareParams(params: URLSearchParams): ParsedTrip {
  return {
    origin: decPlace(params.get("o")),
    destination: decPlace(params.get("d")),
    moodId: params.get("m"),
  };
}
