"use client";

import { BookOpen, ChartColumn, Inbox, LifeBuoy, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import type { AppChatProps } from "@/components/app-chat";
import { FictionalBanner } from "@/components/desk/fictional-banner";
import { Footer } from "@/components/footer";
import { useLocale } from "@/components/i18n/locale-provider";
import { SiteHeader } from "@/components/site-header";
import { TryDrawer } from "@/components/try/try-drawer";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Messages } from "@/lib/i18n/messages";
import { PRODUCT_NAME } from "@/lib/project";

type NavItem = {
  href: string;
  label: (t: Messages) => string;
  icon: ComponentType;
  /** The item is current on this path. */
  matches: (pathname: string) => boolean;
};

/** The left nav of spec §1: Inbox, Help Center, Evals. */
const NAV: readonly NavItem[] = [
  {
    href: "/",
    label: (t) => t.nav.inbox,
    icon: Inbox,
    matches: (pathname) => pathname === "/" || pathname.startsWith("/inbox/"),
  },
  {
    href: "/help-center",
    label: (t) => t.nav.helpCenter,
    icon: BookOpen,
    matches: (pathname) => pathname.startsWith("/help-center"),
  },
  {
    href: "/evals",
    label: (t) => t.nav.evals,
    icon: ChartColumn,
    matches: (pathname) => pathname.startsWith("/evals"),
  },
];

function DeskSidebar() {
  const { t } = useLocale();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar mobileTitle={t.nav.title} mobileDescription={t.nav.description}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          {/* A generic support icon, not a store logo (spec §3). */}
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LifeBuoy className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{PRODUCT_NAME}</span>
            <span className="truncate text-xs text-muted-foreground">{t.nav.tagline}</span>
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t.nav.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ href, label, icon: Icon, matches }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    isActive={matches(pathname)}
                    className="pointer-coarse:h-11"
                    render={
                      <Link
                        href={href}
                        aria-current={matches(pathname) ? "page" : undefined}
                        onClick={() => setOpenMobile(false)}
                      />
                    }
                  >
                    <Icon />
                    <span>{label(t)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

/** Opens the nav on a phone, where the sidebar is a sheet; from md up the sidebar is always shown. */
function NavTrigger() {
  const { t } = useLocale();
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t.nav.open}
      className="md:hidden pointer-coarse:size-11"
      onClick={toggleSidebar}
    >
      <Menu />
    </Button>
  );
}

// From md up the sidebar stays open: a controlled state that never changes, so the sidebar's
// keyboard shortcut cannot hide it with no button to bring it back.
const ALWAYS = () => {};

/**
 * The support desk's frame (spec §1), in the style of the Quickchat reference: the left nav, the
 * site header with "Try as a customer", the fictional-store banner, the page and the footer. From
 * lg up it fills the window and the page scrolls inside it, so the inbox's columns can scroll on
 * their own; below lg everything stacks and the window scrolls (ROADMAP S7).
 */
export function DeskShell({
  children,
  ...chat
}: Omit<AppChatProps, "top" | "leading"> & {
  children: ReactNode;
}) {
  return (
    <SidebarProvider open onOpenChange={ALWAYS}>
      <DeskSidebar />
      <div className="flex min-h-svh min-w-0 flex-1 flex-col lg:h-svh lg:min-h-0">
        <SiteHeader
          modelLabel={chat.modelLabel}
          isMock={chat.isMock}
          commit={chat.commit}
          actions={
            <>
              <NavTrigger />
              <TryDrawer {...chat} />
            </>
          }
        />
        <FictionalBanner />
        <main className="flex min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-y-auto">
          {children}
        </main>
        <Footer />
      </div>
    </SidebarProvider>
  );
}
