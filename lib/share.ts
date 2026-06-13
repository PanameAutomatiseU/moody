import type { Place, ResolvedMood } from "./types";

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

/** Build a shareable querystring for the current trip + mood. */
export function buildShareParams(
  origin: Place | null,
  destination: Place | null,
  mood: ResolvedMood,
): string {
  const p = new URLSearchParams();
  if (origin) p.set("o", encPlace(origin));
  if (destination) p.set("d", encPlace(destination));
  if (mood.id === "custom" && mood.pad) {
    p.set("px", mood.pad.x.toFixed(3));
    p.set("py", mood.pad.y.toFixed(3));
  } else {
    p.set("m", mood.id);
  }
  return p.toString();
}

export interface ParsedTrip {
  origin: Place | null;
  destination: Place | null;
  moodId: string | null;
  pad: { x: number; y: number } | null;
}

export function parseShareParams(params: URLSearchParams): ParsedTrip {
  const px = Number(params.get("px"));
  const py = Number(params.get("py"));
  const pad =
    Number.isFinite(px) && Number.isFinite(py) && params.has("px") ? { x: px, y: py } : null;
  return {
    origin: decPlace(params.get("o")),
    destination: decPlace(params.get("d")),
    moodId: params.get("m"),
    pad,
  };
}
