"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AppChat, type AppChatProps } from "@/components/app-chat";
import { FictionalBanner } from "@/components/desk/fictional-banner";
import { useLocale } from "@/components/i18n/locale-provider";
import { SiteHeader } from "@/components/site-header";

/**
 * /try: the drawer's live chat as a full page, for a direct link and a phone, under the site
 * header as the template's chat page (template spec §5.6). The template's chat e2e runs here.
 */
export function TryPage(props: Omit<AppChatProps, "top" | "leading">) {
  const { t } = useLocale();
  const { modelLabel, isMock, commit } = props;
  return (
    <AppChat
      {...props}
      top={(newChat) => (
        <>
          <SiteHeader modelLabel={modelLabel} isMock={isMock} commit={commit} actions={newChat} />
          <FictionalBanner />
        </>
      )}
      leading={
        <Link
          href="/"
          className="inline-flex items-center gap-1 underline-offset-4 hover:underline pointer-coarse:min-h-11"
        >
          <ArrowLeft className="size-4" />
          {t.try.back}
        </Link>
      }
    />
  );
}
