export interface LatLng {
  lat: number;
  lon: number;
}

export interface Place extends LatLng {
  label: string;
  context?: string;
}

export type LegMode = "walk" | "velib" | "metro" | "rer" | "transfer";

export interface LineInfo {
  id: string;
  label: string;
  color: string;
  text: string;
  mode: "metro" | "rer";
}

export interface Leg {
  mode: LegMode;
  from: { name: string } & LatLng;
  to: { name: string } & LatLng;
  line?: LineInfo;
  distanceM: number;
  durationMin: number;
  polyline: LatLng[];
  stops?: string[];
  instruction: string;
  detail?: string;
}

export type MoodId = "presse" | "zen" | "energie" | "flaneur" | "econome";

export interface MoodWeights {
  time: number;
  transfer: number;
  walk: number;
  bike: number;
  underground: number;
  money: number;
}

export interface Mood {
  id: MoodId;
  label: string;
  emoji: string;
  tagline: string;
  blurb: string;
  accent: string;
  weights: MoodWeights;
}

export interface Itinerary {
  id: string;
  legs: Leg[];
  durationMin: number;
  walkMin: number;
  bikeMin: number;
  transitMin: number;
  transfers: number;
  linesUsed: LineInfo[];
  distanceM: number;
  costEuro: number;
  co2g: number;
  carCo2g: number;
  summary: string;
  tags: string[];
  score: number;
  kind: string;
}

export interface RouteResult {
  origin: Place;
  destination: Place;
  mood: MoodId;
  best: Itinerary;
  alternatives: Itinerary[];
  weatherNote: string | null;
  generatedAt: string;
}
