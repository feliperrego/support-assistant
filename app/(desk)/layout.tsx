import type { ReactNode } from "react";
import { DeskShell } from "@/components/desk/desk-shell";
import { chatServerProps } from "@/lib/support/chat-props";

/**
 * The support desk's pages (spec §1): Inbox, Help Center and Evals in one frame, with the
 * "Try as a customer" drawer. A server component: the chat's server-only values reach the
 * client frame as props. The drawer lives in this layout, so its conversation survives moving
 * between the desk's pages.
 */
export default function DeskLayout({ children }: { children: ReactNode }) {
  return <DeskShell {...chatServerProps()}>{children}</DeskShell>;
}
