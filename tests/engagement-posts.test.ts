import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { canonicalizePermalink, dedupKeyFor } from "@/lib/posts/dedup";

// --- Unit: dedup-key derivation (no DB) ---

describe("engagement-posts: dedup key", () => {
  it("prefers the provider's stable post id", () => {
    expect(dedupKeyFor({ providerPostId: "urn:activity:42", externalUrl: "https://x/y" })).toBe(
      "urn:activity:42",
    );
  });

  it("canonicalizes the permalink when there is no stable id (strip query/fragment, lowercase host, drop trailing slash)", () => {
    expect(
      dedupKeyFor({
        providerPostId: null,
        externalUrl: "HTTPS://www.LinkedIn.com/feed/update/abc/?utm_source=x#frag",
      }),
    ).toBe("https://www.linkedin.com/feed/update/abc");
  });

  it("re-fetched variants of the same permalink collapse to one key", () => {
    const a = canonicalizePermalink("https://li.com/p/1?a=1");
    const b = canonicalizePermalink("https://li.com/p/1?b=2#x");
    expect(a).toBe(b);
  });

  it("drops an item with no stable identifier (unparseable url, no id)", () => {
    expect(dedupKeyFor({ providerPostId: "  ", externalUrl: "not a url" })).toBeNull();
  });
});

// --- Integration: the posts pipeline + Feed read-models (fake provider, no network) ---

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("engagement-posts: pipeline + feed (integration)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let closeDb: typeof import("@/lib/db").closeDb;
  let schema: typeof import("@/lib/db/schema");
  let pipeline: typeof import("@/lib/posts/pipeline");
  let read: typeof import("@/lib/posts/read");
  let fake: typeof import("@/lib/enrich/fake");

  async function truncateAll() {
    const db = getDb();
    await db.delete(schema.posts);
    await db.delete(schema.person);
  }

  async function makePerson(name: string, monitored: boolean): Promise<string> {
    const [p] = await getDb()
      .insert(schema.person)
      .values({ origin: "manual", name, status: "new", monitored })
      .returning();
    return p.id;
  }

  const provider = () =>
    fake.createFakeEnrichment(
      () => ({}),
      () => [
        { providerPostId: "p1", externalUrl: "https://li.com/p/1", content: "first" },
        { providerPostId: "p2", externalUrl: "https://li.com/p/2", content: "second" },
        // No stable id + unparseable url -> dropped, never stored.
        { providerPostId: null, externalUrl: "garbage", content: "ghost" },
      ],
    );

  beforeEach(async () => {
    ({ getDb, closeDb } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    pipeline = await import("@/lib/posts/pipeline");
    read = await import("@/lib/posts/read");
    fake = await import("@/lib/enrich/fake");
    await truncateAll();
  });
  afterEach(truncateAll);
  afterAll(async () => {
    await closeDb();
  });

  it("stores posts with a stable key and drops items without one", async () => {
    const personId = await makePerson("Jane", true);
    const out = await pipeline.fetchAndStorePosts(personId, { provider: provider() });
    expect(out).toMatchObject({ fetched: 3, stored: 2, dropped: 1 });
    const rows = await getDb()
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.personId, personId));
    expect(rows).toHaveLength(2);
  });

  it("re-fetching is idempotent on (person_id, dedup_key) - no duplicates", async () => {
    const personId = await makePerson("Jane", true);
    await pipeline.fetchAndStorePosts(personId, { provider: provider() });
    await pipeline.fetchAndStorePosts(personId, { provider: provider() });
    const rows = await getDb()
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.personId, personId));
    expect(rows).toHaveLength(2);
  });

  it("the Feed lists monitored people's posts with a resolved name, filterable by person", async () => {
    const jane = await makePerson("Jane", true);
    const bob = await makePerson("Bob", false); // not monitored -> absent from the Feed
    await pipeline.fetchAndStorePosts(jane, { provider: provider() });
    await pipeline.fetchAndStorePosts(bob, { provider: provider() });

    const feed = await read.listFeed();
    expect(feed).toHaveLength(2);
    expect(feed.every((p) => p.personName === "Jane")).toBe(true);

    const filtered = await read.listFeed({ personId: jane });
    expect(filtered).toHaveLength(2);

    // A person's own posts read works regardless of monitored.
    expect(await read.listPostsForPerson(bob)).toHaveLength(2);
  });

  it("setMonitored toggles a person into and out of the Feed", async () => {
    const bob = await makePerson("Bob", false);
    await pipeline.fetchAndStorePosts(bob, { provider: provider() });
    expect(await read.listFeed()).toHaveLength(0);
    await pipeline.setMonitored(bob, true);
    expect(await read.listFeed()).toHaveLength(2);
  });
});
