import { describe, expect, it } from "vitest";
import type { JobWithMetadata, QueueResult, Schedule, WipData } from "pg-boss";
import {
  assembleActivity,
  assembleSchedules,
  dateToIso,
  errorToText,
  mapJobActivity,
  mapScheduleInfo,
  mapWorkerLiveness,
  MAX_WAITING_PER_QUEUE,
  msToIso,
  unavailable,
} from "@/lib/jobs/activity-map";

// Pure read-model mapping for the jobs monitor (job-activity-monitor). The pg-boss I/O lives in
// the coverage-excluded facade (index.ts); these are the testable raw -> DTO mappers.

const queue = (over: Partial<QueueResult>): QueueResult =>
  ({
    name: "q",
    activeCount: 0,
    queuedCount: 0,
    deferredCount: 0,
    totalCount: 0,
    ...over,
  }) as unknown as QueueResult;

const wip = (over: Partial<WipData>): WipData =>
  ({
    name: "q",
    state: "active",
    count: 0,
    lastJobStartedOn: null,
    lastJobDuration: null,
    lastError: null,
    lastErrorOn: null,
    ...over,
  }) as unknown as WipData;

const job = (over: Partial<JobWithMetadata>): JobWithMetadata =>
  ({
    id: "id",
    state: "created",
    createdOn: new Date("2026-06-04T10:00:00.000Z"),
    startAfter: null,
    retryCount: 0,
    retryLimit: 2,
    ...over,
  }) as unknown as JobWithMetadata;

const schedule = (over: Partial<Schedule>): Schedule => ({
  name: "q",
  key: "k",
  cron: "* * * * *",
  timezone: "UTC",
  ...over,
});

describe("job-activity-monitor: timestamp helpers", () => {
  it("maps epoch ms and null", () => {
    expect(msToIso(null)).toBeNull();
    expect(msToIso(undefined)).toBeNull();
    expect(msToIso(1_700_000_000_000)).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it("maps Date and null", () => {
    expect(dateToIso(null)).toBeNull();
    expect(dateToIso(undefined)).toBeNull();
    const d = new Date("2026-06-04T10:00:00.000Z");
    expect(dateToIso(d)).toBe("2026-06-04T10:00:00.000Z");
  });
});

describe("job-activity-monitor: errorToText", () => {
  it("returns null for nullish", () => {
    expect(errorToText(null)).toBeNull();
    expect(errorToText(undefined)).toBeNull();
  });

  it("uses Error.message, raw strings, and object.message", () => {
    expect(errorToText(new Error("boom"))).toBe("boom");
    expect(errorToText("raw")).toBe("raw");
    expect(errorToText({ message: "shaped" })).toBe("shaped");
  });

  it("JSON-encodes a plain object and degrades on a circular one", () => {
    expect(errorToText({ code: 42 })).toBe('{"code":42}');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(errorToText(circular)).toBe("unserializable error value");
  });
});

describe("job-activity-monitor: worker + job mappers", () => {
  it("maps a worker's liveness, serializing its last error", () => {
    const live = mapWorkerLiveness(
      wip({
        name: "source-scan",
        state: "active",
        count: 2,
        lastJobStartedOn: 1_700_000_000_000,
        lastJobDuration: 1234,
        lastError: { message: "scan failed" },
        lastErrorOn: 1_700_000_500_000,
      }),
    );
    expect(live).toEqual({
      state: "active",
      inFlight: 2,
      lastJobStartedOn: new Date(1_700_000_000_000).toISOString(),
      lastJobDurationMs: 1234,
      lastError: "scan failed",
      lastErrorOn: new Date(1_700_000_500_000).toISOString(),
    });
  });

  it("maps a waiting job, including a null startAfter", () => {
    // The factory default leaves startAfter null, exercising the dateToIso null branch.
    const mapped = mapJobActivity(
      job({ id: "abc123", state: "retry", retryCount: 1, retryLimit: 3 }),
    );
    expect(mapped).toEqual({
      id: "abc123",
      state: "retry",
      createdOn: "2026-06-04T10:00:00.000Z",
      startAfter: null,
      retryCount: 1,
      retryLimit: 3,
    });
  });
});

describe("job-activity-monitor: assembleActivity", () => {
  it("joins counts, the in-process worker, and waiting jobs by queue name", () => {
    const queues = [
      queue({
        name: "source-scan",
        activeCount: 1,
        queuedCount: 2,
        deferredCount: 0,
        totalCount: 3,
      }),
      queue({ name: "draft", activeCount: 0, queuedCount: 0, deferredCount: 0, totalCount: 0 }),
    ];
    const wips = [wip({ name: "source-scan", count: 1, lastJobStartedOn: 1_700_000_000_000 })];
    const waiting = new Map<string, JobWithMetadata[]>([
      [
        "source-scan",
        [job({ id: "j1", state: "created" }), job({ id: "j2", state: "retry", retryCount: 1 })],
      ],
      ["draft", []],
    ]);

    const snap = assembleActivity(queues, wips, waiting);
    expect(snap.status).toBe("ok");
    if (snap.status !== "ok") return;

    const scan = snap.queues[0];
    expect(scan.activeCount).toBe(1);
    expect(scan.queuedCount).toBe(2);
    expect(scan.worker?.inFlight).toBe(1);
    expect(scan.waiting.map((w) => w.id)).toEqual(["j1", "j2"]);
    expect(scan.waitingTotal).toBe(2);

    const draft = snap.queues[1];
    expect(draft.worker).toBeNull(); // no worker registered for this queue in-process
    expect(draft.waiting).toEqual([]);
    expect(draft.waitingTotal).toBe(0);
  });

  it("excludes pg-boss internal queues while passing application queues through", () => {
    const snap = assembleActivity(
      [
        queue({ name: "__pgboss__send-it" }),
        queue({ name: "__pgboss__maintenance" }),
        queue({ name: "source-scan" }),
        queue({ name: "qualify" }),
        queue({ name: "enrich" }),
        queue({ name: "draft" }),
        queue({ name: "heartbeat" }),
      ],
      [],
      new Map(),
    );
    expect(snap.status).toBe("ok");
    if (snap.status !== "ok") return;
    expect(snap.queues.map((q) => q.name)).toEqual([
      "source-scan",
      "qualify",
      "enrich",
      "draft",
      "heartbeat",
    ]);
  });

  it("defaults waiting to empty when a queue has no findJobs entry", () => {
    const snap = assembleActivity([queue({ name: "enrich" })], [], new Map());
    expect(snap.status).toBe("ok");
    if (snap.status !== "ok") return;
    expect(snap.queues[0].waiting).toEqual([]);
    expect(snap.queues[0].waitingTotal).toBe(0);
    expect(snap.queues[0].worker).toBeNull();
  });

  it("caps the waiting rows per queue but reports the true backlog in waitingTotal", () => {
    const backlog = Array.from({ length: MAX_WAITING_PER_QUEUE + 5 }, (_, i) =>
      job({ id: `j${i}`, state: "created" }),
    );
    const snap = assembleActivity(
      [queue({ name: "source-scan", queuedCount: backlog.length })],
      [],
      new Map([["source-scan", backlog]]),
    );
    expect(snap.status).toBe("ok");
    if (snap.status !== "ok") return;
    expect(snap.queues[0].waiting).toHaveLength(MAX_WAITING_PER_QUEUE);
    expect(snap.queues[0].waitingTotal).toBe(MAX_WAITING_PER_QUEUE + 5);
  });
});

describe("job-activity-monitor: schedules + unavailable", () => {
  it("maps schedules to the queue/cron/timezone DTO", () => {
    const snap = assembleSchedules([
      schedule({ name: "heartbeat", cron: "* * * * *", timezone: "UTC" }),
    ]);
    expect(snap).toEqual({
      status: "ok",
      schedules: [{ queue: "heartbeat", cron: "* * * * *", timezone: "UTC" }],
    });
  });

  it("degrades any introspection error to a structured unavailable result", () => {
    expect(unavailable(new Error("Database not opened"))).toEqual({
      status: "unavailable",
      reason: "Database not opened",
    });
    expect(unavailable(null)).toEqual({
      status: "unavailable",
      reason: "background runtime not running",
    });
  });
});

describe("job-activity-monitor: schedule mapper", () => {
  it("maps a single schedule record", () => {
    expect(
      mapScheduleInfo(schedule({ name: "source-scan", cron: "0 * * * *", timezone: "Etc/UTC" })),
    ).toEqual({
      queue: "source-scan",
      cron: "0 * * * *",
      timezone: "Etc/UTC",
    });
  });
});
