import { expect, test } from "@playwright/test";

test("page shows the mock model and the footer", async ({ page }) => {
  await page.goto("/");
  const header = page.locator("header[data-model]");
  await expect(header).toHaveAttribute("data-model", "mock");
  await expect(header).toHaveAttribute("data-mock", "");
  // Scoped to the header, as the other specs do: P1's "/" is the inbox, whose recorded mock
  // answers also say "mock model" (P1 spec §1, item 1).
  await expect(header.getByText("Mock model", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Felipe Rêgo" })).toHaveAttribute(
    "href",
    "https://feliperrego.com",
  );
});

test("health route reports mock mode with the limiter off", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ ok: true, model: "mock", mock: true, rateLimit: "off" });
});
