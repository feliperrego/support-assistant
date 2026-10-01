"use client";

import { MessageCircle, X } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { AppChat, type AppChatProps } from "@/components/app-chat";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** The drawer's bar: its title and description, New chat and Close. */
function DrawerBar({ newChat }: { newChat: ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="flex shrink-0 items-start gap-2 border-b px-4 py-2">
      <div className="min-w-0 flex-1">
        <SheetTitle>{t.try.title}</SheetTitle>
        <SheetDescription className="text-xs">{t.try.description}</SheetDescription>
      </div>
      {newChat}
      <SheetClose
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.try.close}
            className="pointer-coarse:size-11"
          />
        }
      >
        <X />
      </SheetClose>
    </div>
  );
}

/**
 * "Try as a customer" (spec §1, item 4): a button in the desk's header that opens the live chat
 * in a drawer, live via /api/chat. The chat mounts on the first open and then stays mounted while
 * the drawer is closed, so its conversation survives closing it and moving between the desk's
 * pages; it lives in this tab's memory only (ROADMAP Q8). Esc closes the drawer, except while an
 * answer streams: then it stops the answer, the shell's rule (template spec §5.8).
 */
export function TryDrawer(props: Omit<AppChatProps, "top" | "leading">) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  return (
    <Sheet
      open={open}
      onOpenChange={(next, details) => {
        const streaming = popupRef.current?.querySelector('[role="log"][aria-busy="true"]');
        if (!next && details.reason === "escape-key" && streaming) {
          // Base UI leaves the event alone, so the chat's own Esc handler stops the answer.
          details.cancel();
          details.allowPropagation();
          return;
        }
        setOpen(next);
        if (next) setMounted(true);
      }}
    >
      <SheetTrigger
        render={<Button className="pointer-coarse:h-11 max-sm:aspect-square max-sm:px-0" />}
      >
        <MessageCircle />
        {/* Icon only below sm, so the header fits at 375 px; the accessible name stays. */}
        <span className="max-sm:sr-only">{t.try.open}</span>
      </SheetTrigger>
      <SheetContent
        ref={popupRef}
        keepMounted={mounted}
        showCloseButton={false}
        // The composer, except on touch, where focusing it would open the on-screen keyboard.
        initialFocus={(type) =>
          type === "touch" ? true : (popupRef.current?.querySelector("textarea") ?? true)
        }
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
      >
        {mounted && <AppChat {...props} top={(newChat) => <DrawerBar newChat={newChat} />} />}
      </SheetContent>
    </Sheet>
  );
}
