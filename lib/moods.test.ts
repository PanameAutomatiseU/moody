import { describe, it, expect } from "vitest";
import {
  weightsFromPad,
  bikePreferenceFromWeights,
  MOOD_ANCHORS,
  nearestPreset,
  customMood,
} from "./moods";

describe("mood pad", () => {
  it("vitesse weights time more; tranquillité penalises transfers more", () => {
    const vite = weightsFromPad({ x: 0, y: 0 });
    const calme = weightsFromPad({ x: 1, y: 0 });
    expect(vite.time).toBeGreaterThan(calme.time);
    expect(calme.transfer).toBeGreaterThan(vite.transfer);
  });

  it("grand air rewards vélo (negative) and penalises underground", () => {
    const air = weightsFromPad({ x: 0.5, y: 1 });
    const sous = weightsFromPad({ x: 0.5, y: 0 });
    expect(air.bike).toBeLessThan(sous.bike);
    expect(air.underground).toBeGreaterThan(sous.underground);
  });

  it("bike preference flips to 'recommended' in grand air, 'fastest' in vitesse/souterrain", () => {
    expect(bikePreferenceFromWeights(weightsFromPad({ x: 0.5, y: 1 }))).toBe("recommended");
    expect(bikePreferenceFromWeights(weightsFromPad({ x: 0, y: 0 }))).toBe("fastest");
  });

  it("clamps out-of-range pad positions", () => {
    const w = weightsFromPad({ x: 5, y: -3 });
    expect(Number.isFinite(w.time)).toBe(true);
    expect(w.underground).toBe(0); // y clamped to 0
  });

  it("nearestPreset returns a preset id at its own anchor", () => {
    expect(nearestPreset(MOOD_ANCHORS.energie)).toBe("energie");
    expect(nearestPreset(MOOD_ANCHORS.presse)).toBe("presse");
  });

  it("customMood is well-formed", () => {
    const c = customMood({ x: 0.5, y: 0.5 });
    expect(c.id).toBe("custom");
    expect(c.label).toBe("Sur-mesure");
    expect(Number.isFinite(c.weights.time)).toBe(true);
    expect(c.pad).toEqual({ x: 0.5, y: 0.5 });
  });
});
