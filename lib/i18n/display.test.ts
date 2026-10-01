import { describe, expect, it } from "vitest";
import { formatDay, formatMoney, formatNumber, formatSeconds, formatStoreDay } from "./display";

// How the screens write dates, prices and numbers in each interface language (spec §1, P-11).
describe("display formats", () => {
  it("write a run's day in the interface language, in UTC", () => {
    expect(formatDay("2026-10-01T23:30:00.000Z", "en")).toBe("Oct 1, 2026");
    expect(formatDay("2026-10-01T23:30:00.000Z", "pt-BR")).toBe("1 de out. de 2026");
  });

  it("write a store date (step 2's long English form) in the interface language", () => {
    expect(formatStoreDay("September 22, 2026", "en")).toBe("Sep 22, 2026");
    expect(formatStoreDay("September 22, 2026", "pt-BR")).toBe("22 de set. de 2026");
  });

  it("write whole US-dollar prices", () => {
    expect(formatMoney(129, "en")).toBe("$129.00");
    expect(formatMoney(129, "pt-BR")).toMatch(/^US\$\s129,00$/);
  });

  it("write counts, scores and seconds with the locale's separators", () => {
    expect(formatNumber(12345, "en")).toBe("12,345");
    expect(formatNumber(12345, "pt-BR")).toBe("12.345");
    expect(formatNumber(0.36788, "en", 3)).toBe("0.368");
    expect(formatNumber(0.36788, "pt-BR", 3)).toBe("0,368");
    expect(formatSeconds(2841, "en")).toBe("2.8");
    expect(formatSeconds(2841, "pt-BR")).toBe("2,8");
  });
});
