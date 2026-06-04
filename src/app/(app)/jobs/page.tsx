import type { Metadata } from "next";
import { listJobActivity, listSchedules } from "@/lib/jobs";
import type { JobsMonitorData } from "@/lib/jobs/activity";
import { JobsMonitor } from "./_components/JobsMonitor";

// Operations view (job-activity-monitor): a read-only monitor of the in-process pg-boss
// pipeline. NOT an anchor view - observability, not a high-judgment surface. Server Component
// renders the first snapshot through the jobs facade read-model; the client poller keeps it live.
export const metadata: Metadata = {
  title: "Background jobs - Wisery CRM",
};

// Live job state must not be cached at the route level.
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const [activity, schedules] = await Promise.all([listJobActivity(), listSchedules()]);
  const initialData: JobsMonitorData = { activity, schedules };
  return <JobsMonitor initialData={initialData} />;
}
