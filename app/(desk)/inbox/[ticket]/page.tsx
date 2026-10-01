import { notFound } from "next/navigation";
import { InboxView } from "@/components/inbox/inbox-view";
import { readShownRun } from "@/lib/inbox/run";
import { inboxData } from "@/lib/inbox/view";
import { storeData } from "@/lib/store/customers";

// One page per recorded conversation, built at build time; any other id is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return readShownRun().run.results.map(({ id }) => ({ ticket: id }));
}

/** The inbox with one recorded conversation open (spec §1 items 1–3), linked from the Evals page. */
export default async function Conversation({ params }: PageProps<"/inbox/[ticket]">) {
  const { ticket } = await params;
  const data = inboxData(readShownRun().run, storeData.customers, ticket);
  if (data === null) notFound();
  return <InboxView {...data} />;
}
