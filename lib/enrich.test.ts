import { describe, it, expect, beforeAll } from "vitest";
import { planRoutes } from "./router";
import { enrichBikeLegs } from "./enrich";
import type { Place } from "./types";

const A: Place = { label: "Mairie du 20e, Paris", lat: 48.8653, lon: 2.3987 };
const B: Place = { label: "Boulogne-Billancourt", lat: 48.8352, lon: 2.2406 };

describe("enrichBikeLegs — ORS fallback (no network)", () => {
  beforeAll(() => {
    delete process.env.ORS_API_KEY; // force the offline fallback path
  });

  it("returns valid, re-ranked itineraries when ORS is unavailable", async () => {
    const r = planRoutes(A, B, "zen")!;
    const items = [r.best, ...r.alternatives];
    const out = await enrichBikeLegs(items, "zen");

    expect(out.length).toBe(items.length);
    for (const it of out) {
      expect(it.legs.length).toBeGreaterThan(0);
      expect(it.durationMin).toBeGreaterThan(0);
      expect(Number.isFinite(it.score)).toBe(true);
    }
    // results are sorted ascending by mood score
    for (let i = 1; i < out.length; i++) {
      expect(out[i].score).toBeGreaterThanOrEqual(out[i - 1].score - 1e-9);
    }
  });

  it("keeps the straight-line Vélib estimate when ORS is off", async () => {
    const r = planRoutes(A, B, "energie")!;
    const before = [r.best, ...r.alternatives];
    const velibLeg = before.flatMap((i) => i.legs).find((l) => l.mode === "velib");
    const beforePts = velibLeg ? velibLeg.polyline.length : 0;
    await enrichBikeLegs(before, "energie");
    const velibLegAfter = before.flatMap((i) => i.legs).find((l) => l.mode === "velib");
    // unchanged geometry (2-point straight line) since ORS returned nothing
    if (velibLegAfter) expect(velibLegAfter.polyline.length).toBe(beforePts);
  });
});
