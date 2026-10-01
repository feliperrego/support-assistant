import { describe, expect, it } from "vitest";
import { messages } from "@/lib/i18n/messages";
import type { RunLabel } from "@/lib/inbox/run";
import { evalsHeadline } from "./headline";

// The Evals headline (spec §5; ROADMAP Q11: measured numbers only). A mock run states that it
// measures nothing: a crop of the page must never read as a rate with its interval (D9, approved
// 2026-10-01).
describe("evalsHeadline", () => {
  const headline = { rate: 96, low: 88, high: 100, level: 95, passed: 23, tickets: 24 };
  const label = (mock: boolean): RunLabel => ({
    date: "2026-10-01T12:00:00.000Z",
    model: mock ? "mock" : "openai/gpt-5-mini",
    commit: "9dc512e",
    dirty: false,
    mock,
  });

  it("gives a real run its rate, its interval and its passed line", () => {
    expect(evalsHeadline({ run: label(false), headline }, messages.en)).toEqual({
      headline: "96% of 24 frozen tickets handled correctly",
      interval: "95% CI 88–100%",
      passed: "23 of 24 tickets passed",
    });
  });

  it("gives a mock run a statement that holds the passed count, with no rate and no interval", () => {
    const shown = evalsHeadline({ run: label(true), headline }, messages.en);
    expect(shown).toEqual({
      headline: "Mock run: 23 of 24 mock answers passed the grader. No measurement yet.",
      interval: null,
      passed: null,
    });
    expect(shown.headline).not.toContain("%");
  });

  it("says the same in Portuguese", () => {
    expect(evalsHeadline({ run: label(true), headline }, messages["pt-BR"]).headline).toBe(
      "Rodada simulada: 23 de 24 respostas simuladas passaram no avaliador. Ainda sem medição.",
    );
  });
});
