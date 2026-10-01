import { Footer } from "@/components/footer";
import { TryPage } from "@/components/try/try-page";
import { chatServerProps } from "@/lib/support/chat-props";

/**
 * /try: "Try as a customer" as a full page (spec §1, item 4), the template's chat page (template
 * spec §5.6) with P1's persona picker. Project-owned. A server component: lib/ai/model.ts and
 * lib/rate-limit.ts are server-only, so their values reach the client chat as props. The locale
 * is resolved on the client (LocaleProvider, in the layout), so the page still prerenders in
 * English.
 */
export default function Try() {
  return (
    <div className="flex h-dvh flex-col">
      <TryPage {...chatServerProps()} />
      <Footer />
    </div>
  );
}
