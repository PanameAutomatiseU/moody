import { describe, it, expect } from "vitest";
import { planRoutes } from "./router";
import { MOOD_LIST } from "./moods";
import type { MoodId, Place } from "./types";

// Representative coordinates for the canonical demo trip.
const MAIRIE_20E: Place = { label: "Mairie du 20e, Paris", lat: 48.8653, lon: 2.3987 };
const BOULOGNE: Place = { label: "Boulogne-Billancourt", lat: 48.8352, lon: 2.2406 };
const REPUBLIQUE: Place = { label: "Place de la République, Paris", lat: 48.8675, lon: 2.3635 };
const NEARBY: Place = { label: "Père-Lachaise, Paris", lat: 48.8619, lon: 2.3936 };

function summarize(label: string, mood: MoodId) {
  const r = planRoutes(MAIRIE_20E, BOULOGNE, mood);
  if (!r) return `${label}: <no route>`;
  const b = r.best;
  return `${label.padEnd(9)} → ${b.summary.padEnd(26)} | ${Math.round(b.durationMin)}min | ${b.transfers} corresp | marche ${Math.round(b.walkMin)} vélo ${Math.round(b.bikeMin)} métro ${Math.round(b.transitMin)} | ${b.costEuro}€ | tags: ${b.tags.join(", ")}`;
}

describe("planRoutes — 20e → Boulogne", () => {
  it("returns a usable itinerary for every mood", () => {
    for (const mood of MOOD_LIST) {
      const r = planRoutes(MAIRIE_20E, BOULOGNE, mood.id);
      expect(r, `mood ${mood.id}`).not.toBeNull();
      expect(r!.best.legs.length).toBeGreaterThan(0);
      expect(r!.best.durationMin).toBeGreaterThan(10);
      expect(r!.best.durationMin).toBeLessThan(150);
    }
  });

  it("'Pressé' is never slower than any other mood (it minimises time)", () => {
    const presse = planRoutes(MAIRIE_20E, BOULOGNE, "presse")!;
    for (const mood of MOOD_LIST) {
      const r = planRoutes(MAIRIE_20E, BOULOGNE, mood.id)!;
      expect(r.best.durationMin).toBeGreaterThanOrEqual(presse.best.durationMin - 0.01);
    }
  });

  it("'Énergie' uses at least as much Vélib as 'Pressé'", () => {
    const presse = planRoutes(MAIRIE_20E, BOULOGNE, "presse")!;
    const energie = planRoutes(MAIRIE_20E, BOULOGNE, "energie")!;
    expect(energie.best.bikeMin).toBeGreaterThanOrEqual(presse.best.bikeMin - 0.01);
  });

  it("'Zen' keeps transfers minimal (≤ 1)", () => {
    const zen = planRoutes(MAIRIE_20E, BOULOGNE, "zen")!;
    expect(zen.best.transfers).toBeLessThanOrEqual(1);
  });

  it("offers distinct alternatives", () => {
    const r = planRoutes(MAIRIE_20E, BOULOGNE, "zen")!;
    expect(r.alternatives.length).toBeGreaterThanOrEqual(1);
    const summaries = new Set([r.best.summary, ...r.alternatives.map((a) => a.summary)]);
    expect(summaries.size).toBeGreaterThanOrEqual(2);
  });

  it("produces a single-metro-line + Vélib option somewhere in the results", () => {
    const r = planRoutes(MAIRIE_20E, BOULOGNE, "zen")!;
    const all = [r.best, ...r.alternatives];
    const single = all.find((it) => it.linesUsed.length === 1 && it.bikeMin > 0);
    expect(single, "expected a '1 line + Vélib' itinerary").toBeTruthy();
  });

  it("prints a human-readable comparison", () => {
    const lines = MOOD_LIST.map((m) => summarize(m.label, m.id));
    // eslint-disable-next-line no-console
    console.log("\n" + lines.join("\n") + "\n");
    expect(lines.length).toBe(5);
  });
});

describe("planRoutes — other shapes", () => {
  it("handles a short hop (walk/Vélib feasible)", () => {
    const r = planRoutes(NEARBY, MAIRIE_20E, "flaneur");
    expect(r).not.toBeNull();
    expect(r!.best.durationMin).toBeGreaterThan(0);
  });

  it("handles a central cross-town trip", () => {
    const r = planRoutes(REPUBLIQUE, BOULOGNE, "presse");
    expect(r).not.toBeNull();
    expect(r!.best.legs.length).toBeGreaterThan(0);
  });
});
