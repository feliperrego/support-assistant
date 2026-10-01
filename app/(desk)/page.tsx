import { InboxView } from "@/components/inbox/inbox-view";
import { readShownRun } from "@/lib/inbox/run";
import { inboxData } from "@/lib/inbox/view";
import { storeData } from "@/lib/store/customers";

/**
 * The first screen (spec §1, item 1): the inbox of the last eval run, with its first conversation
 * open. Read at build time from the run file (P-09).
 */
export default function Inbox() {
  const data = inboxData(readShownRun().run, storeData.customers);
  if (data === null) throw new Error("The shown run has no tickets.");
  return <InboxView {...data} />;
}
