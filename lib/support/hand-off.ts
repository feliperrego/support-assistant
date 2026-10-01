/**
 * Why a conversation goes to a human (spec §4): refunds, order changes and anything the policies
 * do not cover, with the two the help center sends to the team by name (delivery problems and
 * warranty claims, content/help-center/contacting-support.md). The handOff tool takes one of them,
 * so the hand-off card and the eval's outcome matrix can group hand-offs. Pure and client-safe.
 */
export const HAND_OFF_REASONS = [
  "refund",
  "order-change",
  "delivery-problem",
  "defect-claim",
  "not-covered",
] as const;
export type HandOffReason = (typeof HAND_OFF_REASONS)[number];

/** What the handOff tool tells the model happens next (content/help-center/contacting-support.md). */
export const HAND_OFF_NEXT = "A member of the support team replies by email within 1 business day.";
