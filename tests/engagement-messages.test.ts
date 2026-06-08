import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { entryStatus } from "./helpers/entry-status";

// --- Integration: synchronous on-demand LinkedIn message generation + lifecycle (fake LLM) ---

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("engagement-messages (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
  let generate: typeof import("@/lib/messages/generate");
  let read: typeof import("@/lib/messages/read");
  let fakeLLM: typeof import("@/lib/llm/fake");

  async function truncateAll() {
    const db = getDb();
    await db.delete(schema.messages);
    await db.delete(schema.person);
  }

  async function makePerson(): Promise<string> {
    const [p] = await getDb()
      .insert(schema.person)
      .values({ origin: "manual", name: "Pat", ...(await entryStatus()) })
      .returning({ id: schema.person.id });
    return p.id;
  }

  // The fake echoes the message type back into the body so a test can assert the type reached the
  // prompt context, and reflects the request's promptVersion/model as provenance.
  const writer = () =>
    fakeLLM.createFakeLLM((req) => ({
      body: `drafted:${String((req.messages[0] as { content: string }).content).includes("connection_request") ? "connection_request" : "message"}`,
    }));

  beforeEach(async () => {
    ({ getDb, closeDb } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    generate = await import("@/lib/messages/generate");
    read = await import("@/lib/messages/read");
    fakeLLM = await import("@/lib/llm/fake");
    await truncateAll();
  });
  afterEach(truncateAll);
  afterAll(async () => {
    await closeDb();
  });

  it("generates a message row with type, body, status, and LLM provenance", async () => {
    const personId = await makePerson();
    const m = await generate.generateMessage(personId, "message", { llm: writer() });
    expect(m.body).toBe("drafted:message");
    const [row] = await getDb().select().from(schema.messages).where(eq(schema.messages.id, m.id));
    expect(row.type).toBe("message");
    expect(row.body).toBe("drafted:message");
    expect(row.status).toBe("generated");
    expect(row.provider).toBe("fake");
    expect(row.promptVersion).toBe("v1");
    expect(row.model).toBe("claude-opus-4-8");
  });

  it("connection_request and message are both valid types, each driving the prompt", async () => {
    const personId = await makePerson();
    const cr = await generate.generateMessage(personId, "connection_request", { llm: writer() });
    expect(cr.body).toBe("drafted:connection_request");
    const msg = await generate.generateMessage(personId, "message", { llm: writer() });
    expect(msg.body).toBe("drafted:message");
  });

  it("rejects an unknown message type", async () => {
    const personId = await makePerson();
    await expect(generate.generateMessage(personId, "bogus", { llm: writer() })).rejects.toThrow();
  });

  it("generation is synchronous and writes a NEW row each call (no idempotency)", async () => {
    const personId = await makePerson();
    const m1 = await generate.generateMessage(personId, "message", { llm: writer() });
    const m2 = await generate.generateMessage(personId, "message", { llm: writer() });
    expect(m2.id).not.toBe(m1.id);
    const all = await read.listMessagesForPerson(personId);
    expect(all).toHaveLength(2);
    expect(all.every((m) => m.status === "generated")).toBe(true);
  });

  it("the human marks a message sent by hand, or dismisses it (D2 - no auto-send)", async () => {
    const personId = await makePerson();
    const m = await generate.generateMessage(personId, "message", { llm: writer() });
    await read.markMessageSent(m.id);
    const [sent] = await getDb().select().from(schema.messages).where(eq(schema.messages.id, m.id));
    expect(sent.status).toBe("sent");

    const m2 = await generate.generateMessage(personId, "connection_request", { llm: writer() });
    await read.dismissMessage(m2.id);
    const [dismissed] = await getDb()
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, m2.id));
    expect(dismissed.status).toBe("dismissed");
  });

  it("generating a message for a missing person is a precondition error", async () => {
    await expect(
      generate.generateMessage("00000000-0000-0000-0000-000000000000", "message", {
        llm: writer(),
      }),
    ).rejects.toThrow(/not found/);
  });
});
