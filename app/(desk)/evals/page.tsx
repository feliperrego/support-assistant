import { EvalsView } from "@/components/evals/evals-view";
import { evalsData } from "@/lib/evals/view";
import { readShownRun } from "@/lib/inbox/run";
import { storeData } from "@/lib/store/customers";

/** The Evals page (spec §1 item 6, §5), read from the shown run file at build time (P-09). */
export default function Evals() {
  const { file, run } = readShownRun();
  return <EvalsView data={evalsData(run, file, storeData.customers)} />;
}
