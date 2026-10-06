import { expect, test, type Locator, type Page } from "@playwright/test";
import { SLOW_TRIGGER } from "@/lib/ai/mock-scenarios";
import { headlineNumbers } from "@/lib/eval/summary";
import { readShownRun } from "@/lib/inbox/run";
import type { Source } from "@/lib/rag/message";
import type { CitationStatus } from "@/lib/rag/verify";
import { fulfillSse, isChatPost, sse, textLength } from "./helpers/chat";
import { MIN_TEXT_CONTRAST, ownTexts, textContrast } from "./helpers/contrast";
import { PROMPTS_EN } from "./helpers/fixtures";
import { expectNoEnglish, expectPortuguese, waitForHydration } from "./helpers/i18n";

// Smoke e2e of P1's support desk (spec §6; ROADMAP S8: one smoke e2e per main flow): the inbox
// shows a recorded conversation; the drawer gets a mock cited answer with a verified badge and
// its Analysis; a hand-off shows its card; the Evals page renders the headline. Plus Esc around a
// drawer closed while its answer streams (the template's X-02 design, X2-29), the contrast of the
// pass/fail badges (spec §7, M3), of the citation popover, the Evals matrix's counts and
// the open conversation's row (spec §7, E1), Ctrl+B and Cmd+B left to the browser (spec §7, M3),
// the phone (S7) and the pt-BR interface (P-11). The production build in mock mode shows the shown
// run of lib/inbox/run.ts: the newest real run, or while none exists the committed mock run, whose
// transcripts CI's `pnpm eval --check` has just checked against the pipeline (lib/eval/check.ts).
// The drawer's answers come from the mock model either way, except where a test stubs one.

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

test("a drawer closed by an outside click keeps streaming; an Esc on the desk leaves the answer alone, one in the reopened drawer stops it", async ({
  page,
}) => {
  const panel = await openDrawer(page);
  // The popup by its slot, not by its role: closed, it stays mounted but hidden, and role
  // locators skip hidden elements. The inbox's thread has an assistant message of its own.
  const popup = page.locator('[data-slot="sheet-content"]');
  const answer = popup.locator('[data-message-role="assistant"]');
  const log = popup.getByRole("log", { includeHidden: true });
  const stopped = answer.getByText("Stopped", { exact: true });

  // [[slow]] streams for about 9 s (lib/ai/mock-scenarios.ts), long enough for every step below.
  await panel.getByRole("textbox").fill(`${PROMPTS_EN[0]} ${SLOW_TRIGGER}`);
  await panel.getByRole("button", { name: "Send message" }).click();
  await expect(answer).toHaveCount(1);
  await expect(log).toHaveAttribute("aria-busy", "true");

  // A click on the backdrop, left of the drawer, closes it; Esc would stop the answer instead.
  await page.mouse.click(40, 360);
  await expect(popup).toBeHidden();
  const hiddenAt = await textLength(answer);
  await expect.poll(() => textLength(answer)).toBeGreaterThan(hiddenAt);

  // An Esc on the desk, with the drawer closed. After the time a stop takes to land (as
  // chat.spec.ts's expectStoppedMidAnswer waits), the hidden answer is still streaming.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const afterEsc = await textLength(answer);
  await expect.poll(() => textLength(answer)).toBeGreaterThan(afterEsc);
  await expect(log).toHaveAttribute("aria-busy", "true");
  await expect(stopped).toHaveCount(0);

  // Reopened, the drawer shows the answer still streaming; there an Esc stops it and leaves the
  // drawer open (components/try/try-drawer.tsx).
  await page.getByRole("button", { name: "Try as a customer" }).click();
  await expect(panel.getByRole("button", { name: "Stop generating" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(stopped).toBeVisible();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "Send message" })).toBeVisible();
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

test("every pass/fail badge the desk shows reads at 4.5:1 or more, on the page and in the open conversation's row", async ({
  page,
}) => {
  // "/" opens the run's first ticket, whose row has the selected background (bg-muted); the
  // first ticket of the other verdict is opened on its own page, so each verdict is read in a
  // selected row too. A run with one verdict only shows no badge of the other anywhere.
  const [first] = run.results;
  const other = run.results.find(({ pass }) => pass !== first.pass);
  const paths = ["/", ...(other ? [`/inbox/${other.id}`] : []), "/evals"];
  const where = (badge: Locator) =>
    badge.evaluate((element) => {
      const verdict = element.getAttribute("data-verdict");
      const row = element.closest("[data-ticket]");
      if (row) {
        const open = row.hasAttribute("aria-current") ? ", open" : "";
        return `${verdict} badge in row ${row.getAttribute("data-ticket")}${open}`;
      }
      const box = element.closest("[data-testid]")?.getAttribute("data-testid") ?? "panel";
      return `${verdict} badge in ${box}`;
    });

  for (const path of paths) {
    await page.goto(path);
    await waitForHydration(page);
    if (path !== "/evals") {
      const open = run.results.find(({ id }) => path.endsWith(`/${id}`)) ?? first;
      await expect(
        conversationList(page).locator('[aria-current="page"] [data-verdict]'),
      ).toHaveAttribute("data-verdict", open.pass ? "pass" : "fail");
    }
    const badges = page.locator("[data-verdict]").filter({ visible: true });
    await expect(badges.first()).toBeVisible();
    for (const badge of await badges.all()) {
      const label = `${path}: ${await where(badge)}`;
      expect.soft(await textContrast(badge), label).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  }
});

// E1 (spec §7): the texts the X-02 reviews measured below 4.5:1 in the desk's only theme, light,
// read from the colours the browser computed (helpers/contrast.ts).

/** The one passage of the stubbed answer below, as the data-sources part carries it. */
const PASSAGE: Source = {
  number: 1,
  article: "returns",
  file: "returns.md",
  heading: "Return window",
  startLine: 1,
  endLine: 2,
  text: "You can return an item within 30 days of its delivery.",
  url: "/help-center/returns#return-window",
  score: 0.8,
};

/** A citation of each status, in the order the stubbed answer makes them (lib/rag/verify.ts). */
const STUBBED_CITATIONS: readonly (readonly [CitationStatus, string])[] = [
  ["verified", '[1: "You can return an item within 30 days of its delivery."]'],
  ["not-found", '[1: "Worn items can be returned."]'],
  // The answer got one passage, so there is no source 2.
  ["unknown-source", '[2: "Shipping is free."]'],
  // A bracketed number with no quote.
  ["malformed", "[3]"],
];

test("every text in a citation's popover reads at 4.5:1 or more, whatever the citation's status", async ({
  page,
}) => {
  // The mock model quotes only what it retrieved, so the failing statuses need a stubbed answer.
  const answer = STUBBED_CITATIONS.map(([, citation], i) => `Sentence ${i + 1} ${citation}.`);
  await page.route("**/api/chat", (route) =>
    fulfillSse(
      route,
      sse([
        { type: "start" },
        { type: "start-step" },
        { type: "data-sources", data: [PASSAGE] },
        { type: "text-start", id: "t" },
        { type: "text-delta", id: "t", delta: answer.join(" ") },
        { type: "text-end", id: "t" },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ]),
    ),
  );
  const panel = await openDrawer(page);
  await panel.getByRole("textbox").fill(PROMPTS_EN[0]);
  await panel.getByRole("button", { name: "Send message" }).click();
  await expect(panel.getByRole("button", { name: "Send message" })).toBeVisible();

  const triggers = panel.locator('[data-message-role="assistant"] [data-citation-verified]');
  await expect(triggers).toHaveCount(STUBBED_CITATIONS.length);
  const popover = page.locator('[data-slot="popover-content"]');
  for (const [i, [status]] of STUBBED_CITATIONS.entries()) {
    await triggers.nth(i).click();
    await expect(popover.locator("[data-citation-status]")).toHaveAttribute(
      "data-citation-status",
      status,
    );
    for (const { element, text } of await ownTexts(popover)) {
      const label = `${status} popover: "${text.slice(0, 40)}"`;
      expect.soft(await textContrast(element), label).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
  }
});

test("every count in the Evals matrix reads at 4.5:1 or more", async ({ page }) => {
  // A count off the diagonal is a mismatch, on a red tint, and a zero is grey
  // (components/evals/evals-view.tsx); the run's summary says how many of each there are. Each
  // count is read on its row and again with the row hovered, since a table row greys on hover.
  const counts = Object.entries(run.summary!.matrix).flatMap(([expected, row]) =>
    Object.entries(row).map(([actual, count]) => ({ mismatch: actual !== expected, count })),
  );
  await page.goto("/evals");
  await waitForHydration(page);
  const cells = page.getByTestId("matrix").locator("tbody td");
  await expect(cells).toHaveCount(16);

  const places = await Promise.all(
    (await cells.all()).map(async (cell) => ({
      cell,
      ...(await cell.evaluate((element) => {
        const td = element as HTMLTableCellElement;
        const row = td.parentElement as HTMLTableRowElement;
        const column = td.closest("table")?.querySelectorAll("thead th")[td.cellIndex];
        const expected = row.querySelector("th")?.textContent;
        return {
          count: Number(td.textContent),
          mismatch: td.cellIndex !== row.sectionRowIndex + 1,
          label: `expected ${expected}, actual ${column?.textContent}: ${td.textContent}`,
        };
      })),
    })),
  );
  expect(places.filter(({ count }) => count === 0)).toHaveLength(
    counts.filter(({ count }) => count === 0).length,
  );
  expect(places.filter(({ mismatch, count }) => mismatch && count > 0)).toHaveLength(
    counts.filter(({ mismatch, count }) => mismatch && count > 0).length,
  );

  // Out of the table, so no row is hovered.
  await page.mouse.move(0, 0);
  for (const { cell, label } of places) {
    expect.soft(await textContrast(cell), label).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  }
  for (const { cell, label } of places) {
    await cell.hover();
    // The row's background eases in (transition-colors); read it once it has settled.
    await cell.evaluate((td) =>
      Promise.all(td.parentElement!.getAnimations().map(({ finished }) => finished)),
    );
    expect
      .soft(await textContrast(cell), `hovered row, ${label}`)
      .toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  }
});

test("every text in the open conversation's row reads at 4.5:1 or more on its grey", async ({
  page,
}) => {
  // "/" opens the run's first ticket, whose row has the selected background, bg-muted
  // (components/inbox/conversation-list.tsx): the customer, the ticket id, the message preview and
  // the chip's and badge's labels.
  await page.goto("/");
  await waitForHydration(page);
  const row = conversationList(page).locator('[aria-current="page"]');
  await expect(row).toHaveAttribute("data-ticket", run.results[0].id);
  const texts = await ownTexts(row);
  expect(texts.map(({ text }) => text)).toEqual(
    expect.arrayContaining([run.results[0].id, run.results[0].message]),
  );
  for (const { element, text } of texts) {
    const label = `open row ${run.results[0].id}: "${text.slice(0, 40)}"`;
    expect.soft(await textContrast(element), label).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  }
});

// The desk leaves Ctrl+B and Cmd+B to the browser and to the page, such as bold in a text field:
// the generated sidebar's shortcut, which toggled a sidebar the desk holds open from md up, is
// removed (spec §7, M3; components/ui/sidebar.tsx).
test("at desktop width the desk takes neither Ctrl+B nor Cmd+B", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  // From md up the sidebar is shown, not a sheet behind the header's nav button.
  await expect(page.getByRole("button", { name: "Open the navigation" })).toBeHidden();
  // Added after every listener the page's own code added on window, so it runs last.
  await page.evaluate(() => {
    const prevented: boolean[] = [];
    Object.assign(window, { boldKeysPrevented: prevented });
    window.addEventListener("keydown", (event) => {
      if (event.key === "b") prevented.push(event.defaultPrevented);
    });
  });
  await page.keyboard.press("Control+b");
  await page.keyboard.press("Meta+b");
  const prevented = await page.evaluate(
    () => (window as unknown as { boldKeysPrevented: boolean[] }).boldKeysPrevented,
  );
  expect(prevented).toEqual([false, false]);
  // Nor does either key store a sidebar state, as the shortcut's toggle did on every press.
  expect(await page.evaluate(() => document.cookie)).not.toContain("sidebar_state");
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
