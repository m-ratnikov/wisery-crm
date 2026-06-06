import { NextResponse } from "next/server";
import { listJobActivity, listSchedules } from "@/lib/jobs";
import type { JobsMonitorData } from "@/lib/jobs/activity-view";
import { listScanHistory } from "@/lib/signals/scan-history";

// Live job state, so never cached: each poll re-reads the running snapshot.
export const dynamic = "force-dynamic";

// Read endpoint polled by the jobs monitor (job-activity-monitor). Returns the current
// background-job activity and the registered schedules through the jobs facade read-model.
//
// D1 (auth deferred, single-user MVP): this handler is intentionally unauthenticated, like
// the rest of the wired app. Job payloads can reference prospect data, so authorization MUST
// be added HERE at the productization milestone - this route is that single insertion point.
export async function GET() {
  const [activity, schedules, scanHistory] = await Promise.all([
    listJobActivity(),
    listSchedules(),
    listScanHistory(),
  ]);
  const body: JobsMonitorData = { activity, schedules, scanHistory };
  return NextResponse.json(body);
}
