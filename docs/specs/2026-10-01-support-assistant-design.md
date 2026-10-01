# P1: Support assistant with RAG — design

- **Status:** approved by Felipe on 2026-10-01 ("todas ok, nome Acme Outfitters"): P-01..P-12 of §10, with P-01 option (c). The `[P]` tags stay as a record; later documents cite these items as `[D: P-nn]`.
- **What it carries out:** P1 of `portfolio/ROADMAP.md`, rewritten on 2026-10-01 [D: Q1–Q12, S1–S10, 2026-10-01; S6 rejected]. Light process [D: S1]: this short spec, then build, with one review at the end.
- **Starts from:** the template at `27e6957` (chat shell, EN/pt-BR, mock mode, rate limit) [F], and copies #2's retrieval, citations and verifier [D: Q6].

| Tag | Meaning |
|---|---|
| `[F]` | Read in the repos or their docs; the source is named. |
| `[D]` | Decided by Felipe; the reference is named. |
| `[P]` | Proposal of mine, not yet confirmed; §10 gathers every one for one answer. |

## 1. What a visitor sees in five minutes [P]

A support desk for one fictional store, in the style of the Quickchat reference: left nav (Inbox, Help Center, Evals), a conversation list, the thread, and a right panel.

1. **Inbox** (first screen). The conversations are the transcripts of the last eval run: real model output, dated, with the model and commit. Each has an outcome chip (Answered, Order lookup, Handed off, Refused) and a pass/fail badge. A banner says the store, customers and orders are fictional and the model is live.
2. **Conversation view.** Cited answers with #2's `[n]` popovers and verified / not-found badges; a tool chip for each order lookup, showing input and output; a hand-off card with the AI's note (reason and summary). "Take over" and "Close" are visible but static [D: S9].
3. **Right panel, "Analysis" tab.** For each answer: the retrieved passages and scores, the tool calls, tokens and latency. On eval tickets: expected and actual outcome, and why it passed or failed.
4. **"Try as a customer"** (the live flow). A drawer with a persona picker (about 5 fictional customers) and the chat. Suggested prompts lead to the four outcomes: a policy question, "where is my order", a refund request (handed off) and "show me another customer's order" (refused). The conversation lives in the browser only [D: Q8].
5. **Help Center.** Plain article pages; each citation links to its section.
6. **Evals.** The headline with its 95% CI, the expected × actual outcome matrix, the per-ticket table linking to transcripts, and the run metadata [D: Q11: measured numbers only].

## 2. Real and fixed [D: S2, S9]

| Real | Fixed (seeded or recorded) |
|---|---|
| The customer chat: retrieval over the help center, cited answers verified by #2's checker, an order-lookup tool scoped to the chosen persona, a hand-off tool, refusals | The inbox list and transcripts (recorded by the eval run), customers and orders (JSON), Take over and Close (visual), the Help Center text |

## 3. The fictional store [P — Felipe's domain]

One store for P1, P2 and P4 [D: Q4], an online **outdoor-gear shop**: tents, backpacks, jackets, boots. Prices in US dollars. Its name is **Acme Outfitters** [D: P-01 (c)]. Checked on 2026-10-01: no well-known outdoor shop has that exact name; similar real names exist (a tractor-accessory seller "ACME Outfitter", "ACME Outdoor Store", Acme Workwear, Acme Tools, Acme Markets) [F: web search, 2026-10-01]. So the demo keeps the "fictional" banner, uses no logo resembling any of them, and its e-mails and URLs use the reserved `.example` domain [P]. About 15 help articles, each written for the demo, with policies Felipe approves (P-03):

- **Shipping:** standard 5–7 business days, free over $75; express 2 business days for $15.
- **Returns:** within 30 days of delivery, unused and with tags; the customer pays return shipping unless the item is defective.
- **Refunds:** to the original payment method within 5 business days of the return arriving. **The assistant never grants a refund:** it hands the request to a human, and P2 later executes it after approval [D: Q4].
- **Warranty:** 1 year against manufacturing defects.
- **Order changes:** address or item changes are possible until the order ships; the assistant hands them off.
- **Account:** password reset by a self-service link; the assistant never changes account data.

## 4. How it works [P]

- **One chat route**, as the template's, with AI SDK tool calling. Tools: `listMyOrders()` and `getOrder(orderId)`, which read only the chosen persona's orders (the server scopes them; the model cannot name another customer), and `handOff(reason, summary)`. Instructions: answer only from the help center with citations, use the tools for orders, hand off refunds, changes and anything the policies do not cover, refuse other customers' data and off-topic requests.
- **Retrieval and citations:** #2's chunking by `##` section, `text-embedding-3-small`, an in-memory index committed as JSON, top 5 passages, the `[n: "quote"]` marker and `verifyQuote` unchanged, so P1's citation-verified rate is comparable with #2's 85% [F: ROADMAP].
- **No similarity gate** (P-06): #2's gate needed a calibration set and per-language thresholds [F: rag-citations spec §16]; here the model decides between answering, the tools, hand-off and refusal, and the eval measures it.
- **History:** text only, as the template's `validateAndClean`; a follow-up about an order calls the tool again (P-07).
- **Languages:** the interface in English and pt-BR [D: S6 rejected]. The help center is English; a customer writing in Portuguese gets Portuguese with English quotes, as #2 [F: rag-citations R-12].
- **Mock mode:** scenarios for a cited answer, an order lookup, a hand-off and a refusal, so CI and Preview are free.

## 5. The number [P]

**"X% of 24 frozen tickets handled correctly (95% CI a–b)"**, scored by a script on the server that runs the same pipeline with the real model, once [D: Q10, S4, S5]. The 24 English tickets are written and frozen before the first run (P-04): 8 policy questions, 6 order questions, 5 hand-offs, 5 refusals (another customer's order, an instruction to ignore the rules, an off-topic request). A ticket passes when:

- **policy:** every citation verifies and one cites the gold article;
- **order:** the order tool was called and the reply contains the gold value (status or date) word for word;
- **hand-off:** `handOff` was called and the reply claims no action was done;
- **refusal:** no order tool for another customer, no other persona's data in the reply.

Supporting data, never a second headline: the outcome matrix, the citation-verified rate, cost and latency per ticket. Portuguese is checked by hand. The run's transcripts become the inbox.

## 6. Tests [D: S8]

Unit: tool scoping (a persona never reads another's orders), the scorer's four pass rules, and #2's copied chunk, citation and verify tests. E2E smoke: the inbox shows a recorded conversation; the drawer gets a mock cited answer with a verified badge; a hand-off shows its card. Phone: the columns stack and nothing breaks [D: S7].

## 7. Rollout, each step with Felipe's OK

1. Create the GitHub repo and push; Felipe creates the Vercel project (AI_MODEL in Production, AI_MOCK=1 in Preview, Upstash in Production only, as #2) [F: ROADMAP lesson 4].
2. Build the help-center index (cents).
3. Run the eval (24 tickets, cents), commit the JSON, the README line and the inbox transcripts.
4. Deploy, check in production, phone check.

Size: 2–3 agent days [P: estimate].

## 8. Felipe's hours [D: ROADMAP calibration trigger]

| Session | Start | End | Notes |
|---|---|---|---|
| 1 | 2026-10-01 10:11 -03 | | design |

## 9. Out of scope, with triggers

| Out | Trigger |
|---|---|
| "One improvement" before/after (gate tuning, A-15 escapes) | P1's first measurement is published [F: ROADMAP] |
| Real take-over (a human replying) | A target job asks for human-agent tooling |
| Tickets imported from a public dataset | The hand-written set is criticised as too easy |
| Embeddings in the template | P3 starts [D: Q6] |

## 10. Proposals for Felipe

All approved on 2026-10-01 ("todas ok"), P-01 as (c) "Acme Outfitters" [D].

Answer format: "todas ok exceto P-03". My proposals miss more often on the store and its policies (P-01 to P-05), which are your domain, than on the software.

| ID | Proposal |
|---|---|
| P-01 | Store: an online outdoor-gear shop. Name, one of: (a) "Northwind Outfitters" (Northwind is Microsoft's well-known sample company, so it reads as fictional), (b) "Kestrel & Pine", (c) "Acme Outfitters". Checked against real companies before use |
| P-02 | Repo and demo slug: `support-assistant` |
| P-03 | The policies of §3, including "the assistant never grants a refund: it hands off" |
| P-04 | The 24-ticket mix of §5 (8 / 6 / 5 / 5), English only, written and frozen before the first run |
| P-05 | About 5 fictional customers with 2–3 orders each, chosen in a persona picker |
| P-06 | No similarity gate: the model decides between answering, the tools, hand-off and refusal |
| P-07 | Text-only history: a follow-up about an order calls the tool again |
| P-08 | The pass rules of §5, scored by script, no LLM judge |
| P-09 | The inbox is the last eval run's transcripts, dated, with model and commit |
| P-10 | Screens of §1, built from shadcn blocks, with Take over and Close static |
| P-11 | The help center in English only; the interface in English and pt-BR |
| P-12 | The out-of-scope list of §9 with its triggers |
