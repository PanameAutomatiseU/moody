import type { Mood, MoodId, MoodWeights, ResolvedMood } from "./types";

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

/** ORS cycling preference from the active weights: a bike/surface-leaning mood
 *  wants the cycle-friendly route (pistes cyclables), others want the direct one. */
export function bikePreferenceFromWeights(w: MoodWeights): "fastest" | "recommended" {
  return w.bike <= -0.4 || w.underground >= 0.4 ? "recommended" : "fastest";
}

export function presetMood(id: MoodId): ResolvedMood {
  const m = MOODS[id];
  return { id: m.id, label: m.label, emoji: m.emoji, accent: m.accent, weights: m.weights };
}
