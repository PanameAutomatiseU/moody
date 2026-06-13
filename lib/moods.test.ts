import { describe, it, expect } from "vitest";
import { MOODS, MOOD_LIST, DEFAULT_MOOD, isMoodId, presetMood, bikePreferenceFromWeights } from "./moods";

describe("moods", () => {
  it("exposes the five presets", () => {
    expect(MOOD_LIST).toHaveLength(5);
    expect(isMoodId(DEFAULT_MOOD)).toBe(true);
    expect(isMoodId("nope")).toBe(false);
  });

  it("presetMood carries the display identity and the preset weights", () => {
    const m = presetMood("zen");
    expect(m.id).toBe("zen");
    expect(m.label).toBe("Zen");
    expect(m.weights).toEqual(MOODS.zen.weights);
  });

  it("bike preference is 'recommended' for bike/surface moods, 'fastest' otherwise", () => {
    expect(bikePreferenceFromWeights(MOODS.flaneur.weights)).toBe("recommended"); // surface
    expect(bikePreferenceFromWeights(MOODS.energie.weights)).toBe("recommended"); // bike
    expect(bikePreferenceFromWeights(MOODS.presse.weights)).toBe("fastest");
  });
});
