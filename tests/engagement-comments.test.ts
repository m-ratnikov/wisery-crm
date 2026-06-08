import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

// --- Integration: comment guidance + synchronous generation + lifecycle (fake LLM, no network) ---

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("engagement-comments (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
  let guidance: typeof import("@/lib/comments/guidance");
  let generate: typeof import("@/lib/comments/generate");
  let read: typeof import("@/lib/comments/read");
  let fakeLLM: typeof import("@/lib/llm/fake");

  async function truncateAll() {
    const db = getDb();
    await db.delete(schema.comments);
    await db.delete(schema.posts);
    await db.delete(schema.person);
    await db.delete(schema.commentGuidance);
  }

  async function makePost(): Promise<string> {
    const [p] = await getDb()
      .insert(schema.person)
      .values({ origin: "manual", name: "Pat", status: "new" })
      .returning({ id: schema.person.id });
    const [post] = await getDb()
      .insert(schema.posts)
      .values({
        personId: p.id,
        externalUrl: "https://li.com/p/1",
        dedupKey: "k1",
        content: "a post about scaling a team",
      })
      .returning({ id: schema.posts.id });
    return post.id;
  }

  // The fake reports whether the guidance tone reached the prompt context.
  const commenter = () =>
    fakeLLM.createFakeLLM((req) => ({
      body: String((req.messages[0] as { content: string }).content).includes("crisp-and-warm")
        ? "grounded-in-guidance"
        : "default-comment",
    }));

  beforeEach(async () => {
    ({ getDb, closeDb } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    guidance = await import("@/lib/comments/guidance");
    generate = await import("@/lib/comments/generate");
    read = await import("@/lib/comments/read");
    fakeLLM = await import("@/lib/llm/fake");
    await truncateAll();
  });
  afterEach(truncateAll);
  afterAll(async () => {
    await closeDb();
  });

  it("comment guidance is config-as-data: null until set, then the active version", async () => {
    expect(await guidance.getActiveGuidance()).toBeNull();
    await guidance.saveGuidance({ tone: "crisp-and-warm", rules: ["no pitch"] });
    const active = await guidance.getActiveGuidance();
    expect(active?.guidance.tone).toBe("crisp-and-warm");
    expect(active?.guidance.rules).toEqual(["no pitch"]);
    expect(active?.version).toBe(1);
  });

  it("generates a comment grounded in the guidance, writing a NEW row each call", async () => {
    const postId = await makePost();
    await guidance.saveGuidance({ tone: "crisp-and-warm", rules: [] });
    const c1 = await generate.generateComment(postId, { llm: commenter() });
    expect(c1.body).toBe("grounded-in-guidance");
    const c2 = await generate.generateComment(postId, { llm: commenter() });
    expect(c2.id).not.toBe(c1.id); // regenerate is a new row, not an overwrite
    const all = await read.listCommentsForPost(postId);
    expect(all).toHaveLength(2);
    expect(all.every((c) => c.status === "generated")).toBe(true);
  });

  it("comments work with no guidance set (a default tone is used)", async () => {
    const postId = await makePost();
    const c = await generate.generateComment(postId, { llm: commenter() });
    expect(c.body).toBe("default-comment");
  });

  it("the human marks a comment posted by hand, or dismisses it (D2 - no auto-post)", async () => {
    const postId = await makePost();
    const c = await generate.generateComment(postId, { llm: commenter() });
    await read.markCommentPosted(c.id);
    const [posted] = await getDb()
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.id, c.id));
    expect(posted.status).toBe("posted");

    const c2 = await generate.generateComment(postId, { llm: commenter() });
    await read.dismissComment(c2.id);
    const [dismissed] = await getDb()
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.id, c2.id));
    expect(dismissed.status).toBe("dismissed");
  });

  it("generating a comment on a missing post is a precondition error", async () => {
    await expect(
      generate.generateComment("00000000-0000-0000-0000-000000000000", { llm: commenter() }),
    ).rejects.toThrow(/not found/);
  });
});
