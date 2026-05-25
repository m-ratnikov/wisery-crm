// Boots the in-process background-job runtime once per server start (ADR-0001).
// register() runs once before the server serves requests (Next 16 instrumentation
// file convention; this lives in src/ because the project uses a src folder).
// All Node-only work is dynamically imported inside the runtime guard, so nothing
// Node-specific is statically reachable from the Edge compile.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrapNodeRuntime } = await import("@/lib/runtime/bootstrap");
  await bootstrapNodeRuntime();
}
