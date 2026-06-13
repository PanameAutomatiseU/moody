import type { Mood, MoodId, MoodWeights, PadPosition, ResolvedMood } from "./types";

/**
 * Each mood is a cost function over an itinerary. The router generates a
 * diverse set of candidate itineraries, then scores every candidate with the
 * active mood's weights (lower = better) and ranks them. Weights are expressed
 * in "minute-equivalents"; negative weights *reward* an attribute.
 */
export const MOODS: Record<MoodId, Mood> = {
  presse: {
    id: "presse",
    label: "Pressé·e",
    emoji: "⚡️",
    tagline: "Le plus rapide, point.",
    blurb: "On vise l'arrivée la plus tôt, quitte à enchaîner les correspondances.",
    accent: "#E8552D",
    weights: { time: 1, transfer: 4, walk: 0.15, bike: 0.15, underground: 0, money: 0.2 },
  },
  zen: {
    id: "zen",
    label: "Zen",
    emoji: "🧘",
    tagline: "Le moins de prise de tête.",
    blurb: "Une seule ligne si possible, zéro correspondance, on reste serein.",
    accent: "#3E7C78",
    weights: { time: 0.6, transfer: 16, walk: 0.3, bike: 0.25, underground: 0, money: 0.3 },
  },
  energie: {
    id: "energie",
    label: "Énergie",
    emoji: "🚴",
    tagline: "J'ai envie de bouger.",
    blurb: "Un max de Vélib et de marche, le métro juste pour combler les trous.",
    accent: "#C2410C",
    weights: { time: 0.5, transfer: 5, walk: -0.45, bike: -0.85, underground: 0.35, money: 0.1 },
  },
  flaneur: {
    id: "flaneur",
    label: "Flâneur·euse",
    emoji: "🌿",
    tagline: "Prendre l'air, voir la ville.",
    blurb: "On privilégie la surface — vélo, marche — et on évite de s'enterrer.",
    accent: "#6B8E23",
    weights: { time: 0.4, transfer: 7, walk: -0.55, bike: -0.35, underground: 0.85, money: 0.2 },
  },
  econome: {
    id: "econome",
    label: "Économe",
    emoji: "🪙",
    tagline: "Au meilleur prix.",
    blurb: "On limite les tickets : Vélib et marche d'abord, métro avec parcimonie.",
    accent: "#A16207",
    weights: { time: 0.5, transfer: 2, walk: -0.1, bike: -0.3, underground: 0, money: 7 },
  },
};

export const MOOD_LIST: Mood[] = Object.values(MOODS);

export const DEFAULT_MOOD: MoodId = "zen";

export function isMoodId(x: string): x is MoodId {
  return x in MOODS;
}

// ---------------------------------------------------------------------------
// Continuous mood — the 2D pad
//   x: 0 = vitesse  → 1 = tranquillité
//   y: 0 = souterrain (métro) → 1 = grand air (vélo / marche / surface)
// ---------------------------------------------------------------------------

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Where each preset sits on the pad (anchors shown on the pad + snap target). */
export const MOOD_ANCHORS: Record<MoodId, PadPosition> = {
  presse: { x: 0.08, y: 0.28 },
  zen: { x: 0.86, y: 0.42 },
  energie: { x: 0.42, y: 0.94 },
  flaneur: { x: 0.6, y: 0.76 },
  econome: { x: 0.74, y: 0.64 },
};

/** Map a pad position to continuous cost weights. */
export function weightsFromPad(p: PadPosition): MoodWeights {
  const x = clamp01(p.x);
  const y = clamp01(p.y);
  return {
    time: lerp(1.0, 0.4, x),
    transfer: lerp(3, 16, x),
    walk: lerp(0.15, -0.55, y),
    bike: lerp(0.15, -0.9, y),
    underground: lerp(0, 0.9, y),
    money: 0.4,
  };
}

export type BikePref = "fastest" | "recommended";

/** Derive the ORS cycling preference from the active weights (works for presets
 *  and custom pad moods): a bike-leaning, surface-leaning mood wants pistes cyclables. */
export function bikePreferenceFromWeights(w: MoodWeights): BikePref {
  return w.bike <= -0.4 || w.underground >= 0.4 ? "recommended" : "fastest";
}

export function presetMood(id: MoodId): ResolvedMood {
  const m = MOODS[id];
  return { id: m.id, label: m.label, emoji: m.emoji, accent: m.accent, weights: m.weights, pad: MOOD_ANCHORS[id] };
}

export function customMood(p: PadPosition): ResolvedMood {
  return {
    id: "custom",
    label: "Sur-mesure",
    emoji: "🎚️",
    accent: "#6D5AE6",
    weights: weightsFromPad(p),
    pad: { x: clamp01(p.x), y: clamp01(p.y) },
  };
}

/** Nearest preset to a pad position — used to label a custom spot ("proche de Zen"). */
export function nearestPreset(p: PadPosition): MoodId {
  let best: MoodId = DEFAULT_MOOD;
  let bestD = Infinity;
  for (const id of Object.keys(MOOD_ANCHORS) as MoodId[]) {
    const a = MOOD_ANCHORS[id];
    const d = (a.x - p.x) ** 2 + (a.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}
