import { NextResponse } from "next/server";
import { checkDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

// Walking-skeleton liveness probe: confirms the server is up and Postgres is
// reachable. No secret-bearing data crosses to the client.
export async function GET() {
  try {
    const dbOk = await checkDbConnection();
    return NextResponse.json(
      { status: dbOk ? "ok" : "degraded", db: dbOk },
      { status: dbOk ? 200 : 503 },
    );
  } catch {
    return NextResponse.json({ status: "error", db: false }, { status: 503 });
  }
}
