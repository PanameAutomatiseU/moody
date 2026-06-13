import type { LatLng } from "./types";

// Speeds & overheads (tuned for realistic Paris door-to-door times)
export const WALK_MPM = 80; // metres/minute (~4.8 km/h)
export const BIKE_MPM = 225; // metres/minute (~13.5 km/h, urban Vélib incl. lights)
export const WALK_DETOUR = 1.3; // straight-line -> street distance factor
export const BIKE_DETOUR = 1.25;
export const WAIT_FIRST = 3; // min, avg wait for the first train
export const WAIT_TRANSFER = 2; // min, extra wait added on each line change
export const VELIB_OVERHEAD = 2; // min, unlock + dock a Vélib

// Economics & footprint
export const TICKET_EURO = 2.5; // single metro/RER ticket (transfers within the network included)
export const VELIB_TRIP_EURO = 0; // assumed pass, mechanical bike under 30 min
export const METRO_CO2_PER_KM = 4; // g CO2e / passenger-km (low-carbon FR electricity)
export const CAR_CO2_PER_KM = 193; // g CO2e / km, average urban car (ADEME)

const R = 6371000; // earth radius, metres
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function walkDistanceM(a: LatLng, b: LatLng): number {
  return haversineM(a, b) * WALK_DETOUR;
}

export function walkMinutes(a: LatLng, b: LatLng): number {
  return walkDistanceM(a, b) / WALK_MPM;
}

export function bikeDistanceM(a: LatLng, b: LatLng): number {
  return haversineM(a, b) * BIKE_DETOUR;
}

export function bikeMinutes(a: LatLng, b: LatLng): number {
  return bikeDistanceM(a, b) / BIKE_MPM;
}

/** Normalise a station/place name for fuzzy matching. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const round = (n: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
