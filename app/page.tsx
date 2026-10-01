import { AppChat } from "@/components/app-chat";
import { Footer } from "@/components/footer";
import { IS_MOCK, MODEL_LABEL } from "@/lib/ai/model";
import { RATE_LIMIT_PER_HOUR } from "@/lib/rate-limit";

/**
 * The chat page (X-01 design §4.5). Project-owned. A server component: lib/ai/model.ts and
 * lib/rate-limit.ts are server-only, so their values reach the client chat as props. The locale
 * is resolved on the client (LocaleProvider, in the layout), so the page still prerenders in
 * English.
 */
export default function Home() {
  return (
    <div className="flex h-dvh flex-col">
      <AppChat
        modelLabel={MODEL_LABEL}
        isMock={IS_MOCK}
        commit={process.env.VERCEL_GIT_COMMIT_SHA ?? "local"}
        rateLimitPerHour={RATE_LIMIT_PER_HOUR}
      />
      <Footer />
    </div>
  );
}
