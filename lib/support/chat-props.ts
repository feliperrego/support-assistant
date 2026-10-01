import { IS_MOCK, MODEL_LABEL } from "@/lib/ai/model";
import { RATE_LIMIT_PER_HOUR } from "@/lib/rate-limit";
import { personaOptions } from "./persona";

/**
 * The server-only values the live chat needs (template spec §5.6, §5.8): the model, the mode, the
 * commit and the hourly limit, plus the persona picker's customers (spec §1 item 4). The desk's
 * layout and /try pass them to their client components. Server-only.
 */
export function chatServerProps() {
  return {
    modelLabel: MODEL_LABEL,
    isMock: IS_MOCK,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    rateLimitPerHour: RATE_LIMIT_PER_HOUR,
    personas: personaOptions(),
  };
}
