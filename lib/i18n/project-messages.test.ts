import { describe, expect, it } from "vitest";
import { HAND_OFF_NEXT } from "@/lib/support/hand-off";
import { LOCALES } from "./locale";
import { messages } from "./messages";

// P1's own strings (spec §1, P-11). messages.test.ts checks both locales have the same keys and
// placeholders; this pins what the screens say on the project's behalf.
describe("project messages", () => {
  it("say in English exactly what the handOff tool tells the model happens next", () => {
    expect(messages.en.handOff.next).toBe(HAND_OFF_NEXT);
  });

  it.each(LOCALES)("offer four suggested prompts in %s", (locale) => {
    expect(messages[locale].prompts).toHaveLength(4);
  });
});
