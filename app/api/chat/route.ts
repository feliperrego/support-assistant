import { createUIMessageStreamResponse } from "ai";
import { getModel, IS_MOCK } from "@/lib/ai/model";
import { validateAndClean } from "@/lib/chat/validate";
import { guardModelRoute } from "@/lib/http";
import { requestLocale } from "@/lib/i18n/locale";
import { loadIndex, readIndexFile } from "@/lib/rag/index-file";
import { createRetriever } from "@/lib/rag/retrieve";
import { PERSONA_ERROR, requestPersona } from "@/lib/support/persona";
import { streamSupportReply } from "@/lib/support/pipeline";

// Node.js runtime (the Next.js default; no `runtime` export). Vercel request cancellation needs
// it and `supportsCancellation` in vercel.json (template spec §5.1).
export const maxDuration = 60;

// Built at import, so a real-mode index that breaks a loading rule fails `next build` while it
// collects page data, and no deploy ships it (#2's rule, spec §4). Mock mode embeds the chunks at
// the first message.
const retriever = createRetriever(loadIndex(readIndexFile(), { mock: IS_MOCK }));

function badRequest(text: string): Response {
  return new Response(text, {
    status: 400,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: Request): Promise<Response> {
  // 1–2. Rate limit (429), then 415 for a non-JSON body, before the body is read
  // (template spec §5.7).
  const blocked = await guardModelRoute(req);
  if (blocked) return blocked;

  // 3. Parse.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid request: the body must be JSON.");
  }

  // 4. Validate and clean the history: text only, so a follow-up about an order calls the tool
  // again (template spec §5.8; spec §4, P-07). An invalid or missing locale is ignored, never a
  // 400; the persona must be one of the store's customers, so the model never chooses one
  // (spec §4).
  const validated = await validateAndClean(body);
  if (!validated.ok) return badRequest(validated.text);
  const customer = requestPersona(body);
  if (!customer) return badRequest(PERSONA_ERROR);
  const locale = requestLocale(body);

  // 5. Retrieve, then stream the answer with the scoped tools (lib/support/pipeline.ts).
  return createUIMessageStreamResponse({
    stream: streamSupportReply({
      model: getModel(),
      retriever,
      messages: validated.messages,
      customer,
      locale,
      abortSignal: req.signal,
    }),
  });
}
