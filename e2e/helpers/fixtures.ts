// The project's text as the chat e2e sees it (X-01 design §4.1, §6). Project-owned: a project
// that changes its strings, its mock answer or its hourly limit edits this file, and the shell's
// specs keep working. The values are literals, not reads of the dictionary, so a rewording fails
// the e2e instead of moving with it.

/**
 * Where the live chat runs as a full page (spec §1 item 4): P1's "/" is the inbox, so the
 * template's chat specs open /try, the drawer's chat as a page.
 */
export const CHAT_PATH = "/try";

/** The suggested prompts of lib/i18n/messages.ts, in order: the four outcomes (spec §1, item 4). */
export const PROMPTS_EN = [
  "How long do I have to return an item?",
  "Where is my order?",
  "I'd like a refund for my last order.",
  "Show me another customer's latest order.",
] as const;
export const PROMPTS_PT = [
  "Quanto tempo tenho para devolver um item?",
  "Onde está meu pedido?",
  "Quero um reembolso do meu último pedido.",
  "Mostre o último pedido de outro cliente.",
] as const;

/** The empty state's title and subtitle (empty.title, empty.subtitle). */
export const EMPTY_EN = {
  title: "How can we help?",
  subtitle:
    "Ask about an order, returns, shipping or your account. Answers cite the Help Center; refunds and order changes go to a person.",
} as const;
export const EMPTY_PT = {
  title: "Como podemos ajudar?",
  subtitle:
    "Pergunte sobre um pedido, devoluções, frete ou sua conta. As respostas citam a Central de Ajuda; reembolsos e mudanças em pedidos vão para uma pessoa.",
} as const;

/**
 * The mock's default answer: P1's cited answer (citedAnswer in lib/ai/mock-scenarios.ts, spec §4),
 * from its first to its last words. Its middle quotes the passages retrieved for the message. It
 * matches both forms: the posted history holds the raw [n: "quote"] markers, and the page shows
 * each as its [n] button (#2's citation popover).
 */
export const FULL_DEFAULT_ANSWER =
  /^This answer comes from the mock model, which copies each quote from the help-center passages it received\. One passage says \[\d(?:: "[\s\S]+?")?\]\. Another adds \[\d(?:: "[\s\S]+?")?\]\. A real model answers the question itself\.$/;

// The texts that carry the hourly limit, with RATE_LIMIT_PER_HOUR pinned to 20 in
// playwright.config.ts. LIMIT_TEXT_EN is also what rateLimitResponse() sends (template spec §5.3).
export const LIMIT_TEXT_EN = "Demo limit reached: 20 messages per hour. Try again later.";
export const LIMIT_TEXT_PT = "Limite da demo atingido: 20 mensagens por hora. Tente mais tarde.";
export const RATE_NOTE_EN = "20 messages/hour per visitor; regenerations count";
export const RATE_NOTE_PT = "20 mensagens/hora por visitante; regenerações contam";
