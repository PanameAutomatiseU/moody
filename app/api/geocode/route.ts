import { NextResponse } from "next/server";
import type { Place } from "@/lib/types";

export const runtime = "nodejs";

// Address autocomplete via the French government Base Adresse Nationale (no key,
// open data). Results are biased towards central Paris.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json<Place[]>([]);

  const url = new URL("https://api-adresse.data.gouv.fr/search/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lat", "48.8566");
  url.searchParams.set("lon", "2.3522");

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return NextResponse.json<Place[]>([]);
    const data = (await res.json()) as {
      features: {
        properties: { label: string; context: string };
        geometry: { coordinates: [number, number] };
      }[];
    };
    const places: Place[] = data.features.map((f) => ({
      label: f.properties.label,
      context: f.properties.context,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
    }));
    return NextResponse.json(places);
  } catch {
    return NextResponse.json<Place[]>([]);
  }
}
