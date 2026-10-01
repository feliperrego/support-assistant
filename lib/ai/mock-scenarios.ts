import type { MockLanguageModelV4 } from "ai/test";
import { readPassages } from "@/lib/rag/prompt";
import { withoutMarkdownLinks } from "@/lib/rag/verify";
import type { HandOffReason } from "@/lib/support/hand-off";

/**
 * Per-request behaviour of the mock model (template spec §5.2; spec §4: mock scenarios for a cited
 * answer, an order lookup, a hand-off and a refusal, so CI and Preview are free). The mock's
 * doStream reads the prompt, so getModel() never takes arguments: the last user message picks the
 * scenario, the instructions carry the passages it quotes, and a tool result at the end of the
 * prompt makes the next step. Nothing here imports lib/chat/, so the mock survives the removal
 * recipe of a non-chat project (template spec §9 step 6b).
 */

/** The prompt a V4 model receives in doStream(options).prompt. */
export type MockPrompt = Parameters<MockLanguageModelV4["doStream"]>[0]["prompt"];

export type MockScenarioName =
  "cited-answer" | "order-lookup" | "hand-off" | "refusal" | "slow" | "error";

/** What one model call of the mock does: stream text, call a tool, or one of the shell's tests. */
export type MockStep =
  | { kind: "text"; text: string }
  | { kind: "tool-call"; toolCallId: string; toolName: string; input: Record<string, unknown> }
  | { kind: "slow" }
  | { kind: "error" };

export type MockTiming = { initialDelayInMs: number; chunkDelayInMs: number };

export const SLOW_TRIGGER = "[[slow]]";
export const ERROR_TRIGGER = "[[error]]";

/** Timing of every scenario, as literals: the template mock's defaults (template spec §5.2). */
export const MOCK_SCENARIO_TIMING: MockTiming = { initialDelayInMs: 600, chunkDelayInMs: 30 };

/** [[slow]]: 300 short lines, far taller than an 800 px viewport (~9 s at 30 ms per chunk). */
export const SLOW_CHUNKS: readonly string[] = Array.from(
  { length: 300 },
  (_, i) => `Line ${i + 1} of the slow mock answer.\n`,
);

/** [[error]]: the text streamed before the mock fails. */
export const ERROR_CHUNKS: readonly string[] = ["This ", "answer ", "fails "];

/** The raw error the [[error]] scenario emits; the route must never send it to the client. */
export const MOCK_ERROR_MESSAGE = "Mock model failure ([[error]] scenario)";

/** The cited answer's first and last sentences; the e2e fixtures match its whole text by them. */
export const CITED_ANSWER_START =
  "This answer comes from the mock model, which copies each quote from the help-center passages it received.";
export const CITED_ANSWER_END = "A real model answers the question itself.";

/** The refusal: it names nothing of any customer, so no ticket's mustNotAppear can match it. */
export const MOCK_REFUSAL =
  "I'm sorry, but I can only help with Acme Outfitters questions and with the orders on your own account.";

// The cues, checked in this order: a refusal first (another person, a rule change, off topic),
// then a hand-off, then an order lookup; anything else gets the cited answer. They are a mock's
// guesses from words, so a real model's choice can differ: the eval measures the real one. A few
// Portuguese cues let the pt-BR suggested prompts reach the four outcomes too (spec §1, item 4).
const REFUSAL_CUES: readonly RegExp[] = [
  /\b(?:friend|someone else|another customer|other customers|every customer|all customers)\b/i,
  /\b(?:outro cliente|outra cliente|outros clientes|todos os clientes|amig[oa]s?)\b/i,
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/,
  /\b(?:ignore (?:your|all|the|previous)|admin mode|developer mode|new rule|system prompt)\b/i,
  /\b(?:mountain|weather|recipe|capital of|president|football|movie)\b/i,
];

/** The hand-off cues and the reason each one gives, in order. */
const HAND_OFF_CUES: readonly (readonly [RegExp, HandOffReason])[] = [
  [
    /\b(?:(?:like|want|need|get|request) (?:a |my )?refund|refund (?:me|my|please)|my money back)\b/i,
    "refund",
  ],
  [/\breembols/i, "refund"],
  [
    /\b(?:cracked|broken|broke|defective|damaged|torn|ripped|leaks|stopped working|faulty)\b/i,
    "defect-claim",
  ],
  [
    /\b(?:isn't at my door|not at my door|never arrived|hasn't arrived|stolen|lost my package)\b/i,
    "delivery-problem",
  ],
  [
    /\b(?:please (?:change|cancel|switch|swap|update)|(?:i want|i'd like|i need) to (?:change|cancel))\b/i,
    "order-change",
  ],
  [/\b(?:discount|coupon|promo code|voucher|price match)\b/i, "not-covered"],
];

const ORDER_ID = /\bAO-?(\d{5})\b/i;
const ORDER_CUES: readonly RegExp[] = [
  ORDER_ID,
  /\b(?:tracking number|where is my|when should my|arrive|delivered|shipped|status of my|my orders|reach your warehouse)\b/i,
  /\b(?:onde está|meu pedido|meus pedidos|rastreio|rastreamento)/i,
];

// Question texts that already produced the [[error]] scenario in this server process. The first
// request with a given text fails; Retry (same text) gets the answer.
const seenErrorPrompts = new Set<string>();

/** Text of the last user message in the prompt, or "" when there is none. */
export function lastUserText(prompt: MockPrompt): string {
  for (let i = prompt.length - 1; i >= 0; i--) {
    const message = prompt[i];
    if (message.role === "user") {
      return message.content.map((part) => (part.type === "text" ? part.text : "")).join("");
    }
  }
  return "";
}

/** The instructions: the prompt's system messages, joined with a blank line. */
export function instructionsText(prompt: MockPrompt): string {
  return prompt
    .flatMap((message) => (message.role === "system" ? [message.content] : []))
    .join("\n\n");
}

/** The scenario a user message asks for, by its cues (spec §4's four, plus the shell's two). */
export function scenarioOf(text: string): Exclude<MockScenarioName, "error"> {
  if (text.includes(SLOW_TRIGGER)) return "slow";
  if (REFUSAL_CUES.some((cue) => cue.test(text))) return "refusal";
  if (HAND_OFF_CUES.some(([cue]) => cue.test(text))) return "hand-off";
  if (ORDER_CUES.some((cue) => cue.test(text))) return "order-lookup";
  return "cited-answer";
}

/**
 * Picks the scenario for a user message. [[error]] wins, but only the first time this process sees
 * that exact text, and records it as seen.
 */
export function selectScenario(prompt: MockPrompt): MockScenarioName {
  const text = lastUserText(prompt);
  if (text.includes(ERROR_TRIGGER) && !seenErrorPrompts.has(text)) {
    seenErrorPrompts.add(text);
    return "error";
  }
  return scenarioOf(text);
}

/** Test helper: forget which [[error]] prompts were already seen. */
export function resetMockScenarios(): void {
  seenErrorPrompts.clear();
}

/** The reason the mock hands off with: the first matching cue's, else "not-covered". */
export function handOffReasonOf(text: string): HandOffReason {
  return HAND_OFF_CUES.find(([cue]) => cue.test(text))?.[1] ?? "not-covered";
}

const QUOTE_WORDS = 12;
const MIN_QUOTE_WORDS = 3;
const FENCE = /^\s*(```|~~~)/;

/**
 * The quote the mock copies from a passage (#2's mockQuote): the first 12 words of its first prose
 * line, a line outside code fences that starts with a letter and has at least 3 words. Without
 * such a line, the passage's first 12 words; null when the passage has fewer than 3.
 */
export function mockQuote(passage: string): string | null {
  const readable = withoutMarkdownLinks(passage).split("\n");
  let inFence = false;
  for (const [i, line] of passage.split("\n").entries()) {
    if (FENCE.test(line)) inFence = !inFence;
    const words = readable[i].trim().split(/\s+/);
    if (!inFence && /^[A-Za-z]/.test(line) && words.length >= MIN_QUOTE_WORDS) {
      return words.slice(0, QUOTE_WORDS).join(" ");
    }
  }
  const words = withoutMarkdownLinks(passage).trim().split(/\s+/);
  return words.length >= MIN_QUOTE_WORDS ? words.slice(0, QUOTE_WORDS).join(" ") : null;
}

/** The cited answer (#2's default): two citations, each quote copied from its passage. */
export function citedAnswer(passages: readonly string[]): string {
  const [first, second] = passages
    .flatMap((passage, i) => {
      const quote = mockQuote(passage);
      return quote === null ? [] : [{ n: i + 1, quote }];
    })
    .slice(0, 2);
  const sentences = [CITED_ANSWER_START];
  if (first) sentences.push(`One passage says [${first.n}: "${first.quote}"].`);
  if (second) sentences.push(`Another adds [${second.n}: "${second.quote}"].`);
  sentences.push(CITED_ANSWER_END);
  return sentences.join(" ");
}

type ToolResult = { toolName: string; value: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The tool results of the prompt's last message, when it is a tool message. */
function lastToolResults(prompt: MockPrompt): ToolResult[] {
  const last = prompt.at(-1);
  if (last?.role !== "tool") return [];
  return last.content.flatMap((part) =>
    part.type === "tool-result" && part.output.type === "json"
      ? [{ toolName: part.toolName, value: part.output.value }]
      : [],
  );
}

/** How many tool messages the prompt holds: the next call id is one more. */
function nextCallId(prompt: MockPrompt): string {
  return `mock-call-${prompt.filter((message) => message.role === "tool").length + 1}`;
}

const STOP_WORDS = new Set(["acme", "with", "pack"]);

/** The words of a text that may name a product: lower case, 4 letters or more. */
function productWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  return new Set(words.filter((word) => !STOP_WORDS.has(word)));
}

/** The order of a listMyOrders result whose items share the most words with the message. */
function pickOrder(orders: readonly Record<string, unknown>[], message: string): string | null {
  const asked = productWords(message);
  let best: { id: string; score: number } | null = null;
  for (const order of orders) {
    if (typeof order.id !== "string") continue;
    const names = Array.isArray(order.items)
      ? order.items.map((item) => (isRecord(item) ? String(item.name) : "")).join(" ")
      : "";
    const score = [...productWords(names)].filter((word) => asked.has(word)).length;
    if (best === null || score > best.score) best = { id: order.id, score };
  }
  return best?.id ?? null;
}

/** The mock's reply to a getOrder result: every status, date and tracking number it holds. */
export function orderAnswer(lookup: unknown): string {
  if (!isRecord(lookup) || lookup.found !== true || !isRecord(lookup.order)) {
    const id =
      isRecord(lookup) && typeof lookup.orderId === "string"
        ? `order ${lookup.orderId}`
        : "that order";
    return `I couldn't find ${id} on your account. Please check the order number.`;
  }
  const order = lookup.order;
  const items = Array.isArray(order.items)
    ? order.items.map((item) => (isRecord(item) ? String(item.name) : "")).join(", ")
    : "";
  const sentences = [`Order ${order.id} (${items}) is ${order.status}.`];
  if (order.shippedOn) {
    sentences.push(
      `It shipped on ${order.shippedOn}` +
        (order.trackingNumber ? `, with tracking number ${order.trackingNumber}.` : "."),
    );
  }
  if (order.estimatedDelivery) {
    sentences.push(`The estimated delivery date is ${order.estimatedDelivery}.`);
  }
  if (order.deliveredOn) sentences.push(`It was delivered on ${order.deliveredOn}.`);
  if (order.returnReceivedOn) {
    sentences.push(`Your return reached our warehouse on ${order.returnReceivedOn}.`);
  }
  return sentences.join(" ");
}

/** The mock's reply after handOff: the hand-off and what the tool says happens next. */
export function handOffAnswer(result: unknown): string {
  const next = isRecord(result) && typeof result.next === "string" ? ` ${result.next}` : "";
  return `I've passed your request to our support team, with a short summary.${next}`;
}

/**
 * The mock's next step for this prompt. After a tool result it continues that scenario: from
 * listMyOrders to getOrder for the order the message names, from getOrder or handOff to the
 * reply. Otherwise the scenario of the last user message starts.
 */
export function mockStep(prompt: MockPrompt): MockStep {
  const results = lastToolResults(prompt);
  const message = lastUserText(prompt);
  const last = results.at(-1);
  if (last !== undefined) {
    if (last.toolName === "listMyOrders") {
      const orders =
        isRecord(last.value) && Array.isArray(last.value.orders)
          ? last.value.orders.filter(isRecord)
          : [];
      const orderId = pickOrder(orders, message);
      if (orderId === null)
        return { kind: "text", text: "I couldn't find any orders on your account." };
      return {
        kind: "tool-call",
        toolCallId: nextCallId(prompt),
        toolName: "getOrder",
        input: { orderId },
      };
    }
    if (last.toolName === "getOrder") return { kind: "text", text: orderAnswer(last.value) };
    if (last.toolName === "handOff") return { kind: "text", text: handOffAnswer(last.value) };
  }

  const scenario = selectScenario(prompt);
  const toolCallId = nextCallId(prompt);
  switch (scenario) {
    case "slow":
    case "error":
      return { kind: scenario };
    case "refusal":
      return { kind: "text", text: MOCK_REFUSAL };
    case "hand-off":
      return {
        kind: "tool-call",
        toolCallId,
        toolName: "handOff",
        input: {
          reason: handOffReasonOf(message),
          summary: `The customer wrote: ${message}`.slice(0, 500),
        },
      };
    case "order-lookup": {
      const id = ORDER_ID.exec(message);
      return id
        ? { kind: "tool-call", toolCallId, toolName: "getOrder", input: { orderId: `AO-${id[1]}` } }
        : { kind: "tool-call", toolCallId, toolName: "listMyOrders", input: {} };
    }
    case "cited-answer":
      return { kind: "text", text: citedAnswer(readPassages(instructionsText(prompt))) };
  }
}
