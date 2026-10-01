# Acme Outfitters Support — tickets handled correctly: pending the first eval run

[![CI](https://github.com/feliperrego/support-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/feliperrego/support-assistant/actions/workflows/ci.yml) · **[Live demo](<demo URL>)** · Part of the [feliperrego.com](https://feliperrego.com) portfolio

## Problem
A support assistant must answer from the store's own policies, look up only the asking customer's orders, and pass to a human what it may not do, such as a refund. This demo is the support desk of Acme Outfitters, a fictional outdoor-gear store: the inbox holds the transcripts of the last eval run, and "Try as a customer" chats with the live model, which answers from the help center with verified citations, looks up the chosen customer's orders, hands off refunds and order changes, and refuses other customers' data. The store, its customers and its orders are fictional.

## Decisions
- **The model chooses between answering, the order tools, hand-off and refusal** instead of a similarity gate before the model: a gate needs a calibration set and per-language thresholds, and the eval measures the model's choice.
- **Tickets scored by a script on the server** instead of an LLM judge: each outcome has a rule a script can check (a verified citation of the right article, the order's status or date word for word, a hand-off call, no other customer's data).
- **The inbox shows the last eval run's transcripts**, dated, with the model and commit, instead of written sample conversations: everything on screen is recorded or measured.

## How it's measured
Pending: the first eval run prints this line, with the 95% CI, the model, the date and a link to the raw data.
The share of 24 frozen English tickets (8 policy questions, 6 order questions, 5 hand-offs, 5 refusals) handled correctly, scored by a script on the server that runs the chat's pipeline once with the real model: `<eval command>`. The outcome matrix, the citation-verified rate, and cost and latency per ticket are supporting data. Caveat: Portuguese answers are checked by hand, not measured.

## Run it
`pnpm install && pnpm dev:mock` (no API key needed)

## Stack
Next.js · AI SDK · AI Gateway · shadcn/ui · Upstash · Playwright
