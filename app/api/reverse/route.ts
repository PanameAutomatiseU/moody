import { NextResponse } from "next/server";
import type { Place } from "@/lib/types";

export const runtime = "nodejs";

/** Reverse-geocode a coordinate to a French address via the Base Adresse
 *  Nationale (no key). Used by the "ma position" button. */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "Coordonnées invalides." }, { status: 400 });
  }

  const url = new URL("https://api-adresse.data.gouv.fr/reverse/");
  url.searchParams.set("lat", lat.toFixed(6));
  url.searchParams.set("lon", lon.toFixed(6));

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ error: "Géocodage indisponible." }, { status: 502 });
    const data = (await res.json()) as {
      features?: {
        properties?: { label?: string; context?: string };
        geometry?: { coordinates?: [number, number] };
      }[];
    };
    const f = data.features?.[0];
    if (!f?.properties?.label || !f.geometry?.coordinates) {
      // No address found — still return the raw point so the trip can proceed.
      const fallback: Place = { label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon };
      return NextResponse.json(fallback);
    }
    const place: Place = {
      label: f.properties.label,
      context: f.properties.context,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
    };
    return NextResponse.json(place);
  } catch {
    return NextResponse.json({ error: "Géocodage indisponible." }, { status: 502 });
  }
}
