import { expect, test, type Locator, type Page } from "@playwright/test";
import { headlineNumbers } from "@/lib/eval/summary";
import { readShownRun } from "@/lib/inbox/run";
import { isChatPost } from "./helpers/chat";
import { PROMPTS_EN } from "./helpers/fixtures";
import { expectNoEnglish, expectPortuguese, waitForHydration } from "./helpers/i18n";

// Smoke e2e of P1's support desk (spec §6; ROADMAP S8: one smoke e2e per main flow): the inbox
// shows a recorded conversation; the drawer gets a mock cited answer with a verified badge and
// its Analysis; a hand-off shows its card; the Evals page renders the headline. Plus the phone
// (S7) and the pt-BR interface (P-11). The production build in mock mode shows the committed mock
// run, whose transcripts CI's `pnpm eval --check` has just checked against the pipeline
// (lib/eval/check.ts).

const { run } = readShownRun();

const conversationList = (page: Page) => page.getByRole("navigation", { name: "Conversations" });
const thread = (page: Page) => page.getByTestId("thread");
const drawer = (page: Page) => page.getByRole("dialog", { name: "Try as a customer" });

async function openDrawer(page: Page): Promise<Locator> {
  await page.goto("/");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Try as a customer" }).click();
  await expect(drawer(page)).toBeVisible();
  return drawer(page);
}

/** Clicks a suggested prompt in the drawer and returns the persona the request carried. */
async function sendPrompt(page: Page, panel: Locator, prompt: string): Promise<unknown> {
  const posted = page.waitForRequest(isChatPost);
  await panel.getByRole("button", { name: prompt, exact: true }).click();
  const body = (await posted).postDataJSON() as { persona?: unknown };
  // The request is over when Stop has turned back into Send.
  await expect(panel.getByRole("button", { name: "Send message" })).toBeVisible({
    timeout: 20_000,
  });
  return body.persona;
}

test("the inbox shows a recorded conversation with its chips, badge, panel and fictional banner", async ({
  page,
}) => {
  await page.goto("/");
  await waitForHydration(page);
  await expect(page.getByTestId("fictional-banner")).toContainText("fictional store");
  await expect(conversationList(page).getByRole("link")).toHaveCount(run.results.length);
  await expect(page.getByTestId("run-label").first()).toContainText(run.commit.sha.slice(0, 7));

  // The first ticket is open: the customer's message and the recorded answer.
  const [first] = run.results;
  await expect(thread(page).getByRole("heading", { level: 2, name: "Liam Walsh" })).toBeVisible();
  await expect(thread(page).locator('[data-message-role="user"]')).toHaveText(first.message);
  await expect(thread(page).locator('[data-message-role="assistant"]')).toHaveCount(1);
  await expect(thread(page).locator(`[data-outcome="${first.actual}"]`)).toBeVisible();
  await expect(thread(page).locator("[data-verdict]")).toHaveText(first.pass ? "Passed" : "Failed");
  // Take over and Close are visible but static (spec §1; ROADMAP S9).
  await expect(thread(page).getByRole("button", { name: "Take over" })).toBeDisabled();
  await expect(thread(page).getByRole("button", { name: "Close" })).toBeDisabled();

  // The Analysis tab: why it passed, and the five retrieved passages with their scores.
  await expect(page.getByTestId("checks").locator("li")).toHaveCount(first.checks.length);
  await expect(page.locator("[data-passage]")).toHaveCount(5);

  // Another conversation: a recorded hand-off shows its card. The ticket comes from the run, since
  // a real run need not hand off on any given ticket.
  const handedOff = run.results.find(({ actual }) => actual === "handed-off");
  expect(handedOff, "the shown run has a hand-off to show").toBeDefined();
  await conversationList(page).locator(`[data-ticket="${handedOff!.id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/inbox/${handedOff!.id}`));
  await expect(thread(page).locator('[data-hand-off="done"]')).toContainText(
    "Handed off to a person",
  );
});

test("Try as a customer: the drawer gets a mock cited answer with a verified badge, as the chosen persona", async ({
  page,
}) => {
  const panel = await openDrawer(page);
  await expect(panel.getByTestId("persona-picker")).toContainText("Maya Chen");

  expect(await sendPrompt(page, panel, PROMPTS_EN[0])).toBe("cus-01");
  const answer = panel.locator('[data-message-role="assistant"]');
  await expect(answer).toHaveCount(1);
  const citation = answer.getByRole("button", { name: "Source 1" });
  await expect(citation).toHaveAttribute("data-citation-verified", "true");
  await citation.click();
  await expect(page.getByText("Quote verified", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  // The Sources list links each passage to its Help Center section (spec §1, item 5).
  await expect(answer.getByRole("link").first()).toHaveAttribute(
    "href",
    /^\/help-center\/[a-z-]+#[a-z0-9-]+$/,
  );
  // The live answer's Analysis (spec §1, item 3): the five passages with their scores, then the
  // tokens and latency the finish chunk carried.
  await answer.getByRole("button", { name: "Analysis", exact: true }).click();
  const analysis = answer.getByTestId("answer-analysis");
  await expect(analysis.locator("[data-passage]")).toHaveCount(5);
  await expect(analysis.getByTestId("usage")).toContainText("Latency");
  await expect(analysis.getByTestId("usage")).not.toContainText("not reported");

  // Another persona starts a new chat, and its order lookup reads that customer's orders only.
  await panel.getByRole("combobox").click();
  await page.getByRole("option", { name: "Sofia Ramirez" }).click();
  await expect(panel.locator('[data-message-role="assistant"]')).toHaveCount(0);
  expect(await sendPrompt(page, panel, PROMPTS_EN[1])).toBe("cus-03");
  await expect(panel.locator('[data-tool="listMyOrders"][data-tool-state="done"]')).toBeVisible();
  await expect(panel.locator('[data-tool="getOrder"]')).toContainText("AO-10589");
  // Its Analysis lists both tool calls.
  const lookup = panel.locator('[data-message-role="assistant"]');
  await lookup.getByRole("button", { name: "Analysis", exact: true }).click();
  await expect(lookup.getByTestId("answer-analysis").locator("[data-tool]")).toHaveCount(2);
});

test("a hand-off shows its card, and the drawer keeps it across closing and the desk's pages", async ({
  page,
}) => {
  const panel = await openDrawer(page);
  await sendPrompt(page, panel, PROMPTS_EN[2]);
  const card = panel.locator('[data-hand-off="done"]');
  await expect(card).toContainText("Handed off to a person");
  await expect(card).toContainText("Refund");
  await expect(card).toContainText("AI note for the team");

  await panel.getByRole("button", { name: "Close the chat" }).click();
  await expect(drawer(page)).toBeHidden();
  await page.getByRole("link", { name: "Evals" }).click();
  await expect(page).toHaveURL("/evals");
  await page.getByRole("button", { name: "Try as a customer" }).click();
  await expect(drawer(page).locator('[data-hand-off="done"]')).toBeVisible();
});

test("the Evals page renders the headline (a real run's CI, or a mock statement), the matrix and a row per ticket", async ({
  page,
}) => {
  const { rate, tickets, passed, level, low, high } = headlineNumbers(run.summary!);
  await page.goto("/evals");
  await waitForHydration(page);
  if (run.mock) {
    // D9: a mock run shows no rate and no interval (lib/evals/headline.ts).
    await expect(page.getByTestId("headline")).toHaveText(
      `Mock run: ${passed} of ${tickets} mock answers passed the grader. No measurement yet.`,
    );
    await expect(page.getByTestId("interval")).toHaveCount(0);
    // N4: nor the method of an interval the page does not show.
    await expect(page.getByText("Percentile bootstrap", { exact: false })).toHaveCount(0);
  } else {
    await expect(page.getByTestId("headline")).toHaveText(
      `${rate}% of ${tickets} frozen tickets handled correctly`,
    );
    await expect(page.getByTestId("interval")).toHaveText(`${level}% CI ${low}–${high}%`);
  }
  await expect(page.getByTestId("matrix").locator("tbody tr")).toHaveCount(4);
  await expect(page.getByTestId("tickets").locator("tbody tr")).toHaveCount(run.results.length);
  await page.getByRole("link", { name: "Open the transcript of ticket t02" }).click();
  await expect(page).toHaveURL(/\/inbox\/t02/);
  await expect(thread(page).getByRole("heading", { level: 2, name: "Maya Chen" })).toBeVisible();
});

test("in Portuguese the desk shows no English interface text", async ({ page }) => {
  for (const path of ["/inbox/t15", "/inbox/t09", "/evals", "/help-center/returns"]) {
    await page.goto(`${path}?lang=pt-BR`);
    await expectPortuguese(page);
    await expectNoEnglish(page);
  }
});

test.describe("a phone at 375×812 with touch", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("the desk's columns stack with no sideways scroll; the nav and the drawer open from the header", async ({
    page,
  }) => {
    for (const path of ["/", "/inbox/t09", "/evals", "/help-center", "/help-center/returns"]) {
      await page.goto(path);
      await waitForHydration(page);
      const widths = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(widths.scroll, `sideways scroll on ${path}`).toBeLessThanOrEqual(widths.client);
    }

    await page.getByRole("button", { name: "Open the navigation" }).tap();
    await page.getByRole("link", { name: "Evals" }).tap();
    await expect(page).toHaveURL("/evals");

    // The drawer takes the whole width, once it has slid in. boundingBox() carries float error
    // (375.0000038 px), as helpers/i18n.ts MIN_TARGET_PX notes.
    await page.getByRole("button", { name: "Try as a customer" }).tap();
    await expect(drawer(page).getByRole("textbox")).toBeVisible();
    await expect.poll(async () => (await drawer(page).boundingBox())?.x).toBeCloseTo(0, 1);
    expect((await drawer(page).boundingBox())?.width).toBeCloseTo(375, 1);
  });
});
