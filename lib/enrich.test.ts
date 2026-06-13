import { describe, it, expect, beforeAll } from "vitest";
import { planRoutes } from "./router";
import { enrichBikeLegs } from "./enrich";
import { MOODS, bikePreferenceFromWeights } from "./moods";
import type { Place } from "./types";

const A: Place = { label: "Mairie du 20e, Paris", lat: 48.8653, lon: 2.3987 };
const B: Place = { label: "Boulogne-Billancourt", lat: 48.8352, lon: 2.2406 };

describe("enrichBikeLegs — ORS fallback (no network)", () => {
  beforeAll(() => {
    delete process.env.ORS_API_KEY; // force the offline fallback path
  });

  it("returns valid, re-ranked itineraries when ORS is unavailable", async () => {
    const w = MOODS.zen.weights;
    const r = planRoutes(A, B, w)!;
    const items = [r.best, ...r.alternatives];
    const out = await enrichBikeLegs(items, w, bikePreferenceFromWeights(w));

    expect(out.length).toBe(items.length);
    for (const it of out) {
      expect(it.legs.length).toBeGreaterThan(0);
      expect(it.durationMin).toBeGreaterThan(0);
      expect(Number.isFinite(it.score)).toBe(true);
    }
    for (let i = 1; i < out.length; i++) {
      expect(out[i].score).toBeGreaterThanOrEqual(out[i - 1].score - 1e-9);
    }
  });

  it("keeps the straight-line Vélib estimate when ORS is off", async () => {
    const w = MOODS.energie.weights;
    const r = planRoutes(A, B, w)!;
    const before = [r.best, ...r.alternatives];
    const velibLeg = before.flatMap((i) => i.legs).find((l) => l.mode === "velib");
    const beforePts = velibLeg ? velibLeg.polyline.length : 0;
    await enrichBikeLegs(before, w, bikePreferenceFromWeights(w));
    const velibLegAfter = before.flatMap((i) => i.legs).find((l) => l.mode === "velib");
    if (velibLegAfter) expect(velibLegAfter.polyline.length).toBe(beforePts);
  });
});
