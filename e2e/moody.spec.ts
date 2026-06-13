import { test, expect } from "@playwright/test";

test.describe("Moody — end to end", () => {
  test("home loads with brand, tagline and a disabled CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Moody", exact: true })).toBeVisible();
    await expect(page.getByText("selon votre humeur")).toBeVisible();
    await expect(page.getByTestId("search")).toBeDisabled();
    // All five moods are offered.
    for (const id of ["presse", "zen", "energie", "flaneur", "econome"]) {
      await expect(page.getByTestId(`mood-${id}`)).toBeVisible();
    }
  });

  test("example trip 20e → Boulogne yields a single-line + Vélib itinerary (Zen)", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("example").click();

    const best = page.getByTestId("best-itinerary");
    await expect(best).toBeVisible({ timeout: 25_000 });

    const summary = page.getByTestId("itinerary-summary");
    await expect(summary).toContainText("Ligne 9");
    await expect(summary).toContainText("Vélib");
    await expect(page.getByTestId("itinerary-duration")).toContainText("min");

    // The interactive map is rendered.
    await expect(page.locator(".leaflet-container")).toBeVisible();

    // The itinerary timeline shows the Vélib and the metro legs.
    await expect(best.getByText(/Vélib jusqu'à/)).toBeVisible();
    await expect(best.getByText(/→/).first()).toBeVisible();

    // "Le mot de Moody" narration is present.
    await expect(page.getByTestId("moody-word")).toBeVisible();
  });

  test("switching mood to Pressé re-routes to the faster multi-line option", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("example").click();
    await expect(page.getByTestId("best-itinerary")).toBeVisible({ timeout: 25_000 });

    await page.getByTestId("mood-presse").click();
    // Pressé minimises time and accepts a correspondance (e.g. "3 → 9").
    await expect(page.getByTestId("itinerary-summary")).toContainText("→", { timeout: 20_000 });
    await expect(page.getByTestId("itinerary-duration")).toContainText("min");
  });

  test("alternatives are listed and selectable", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("example").click();
    await expect(page.getByTestId("best-itinerary")).toBeVisible({ timeout: 25_000 });

    const summary = page.getByTestId("itinerary-summary");
    const before = (await summary.innerText()).trim();

    const alternatives = page.getByTestId("alternatives");
    await expect(alternatives).toBeVisible();
    await alternatives.locator("button").first().click();

    await expect
      .poll(async () => (await summary.innerText()).trim(), { timeout: 10_000 })
      .not.toBe(before);
  });

  test("address autocomplete suggests real Paris addresses", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("origin").fill("République Paris");
    await expect(page.getByTestId("origin-option").first()).toBeVisible({ timeout: 15_000 });
  });

  test("comparator lists the five moods side by side", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("example").click();
    await expect(page.getByTestId("best-itinerary")).toBeVisible({ timeout: 25_000 });
    await page.getByTestId("compare-toggle").click();
    const list = page.getByTestId("compare-list");
    await expect(list).toBeVisible();
    await expect.poll(async () => list.locator("button").count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(5);
  });
});
