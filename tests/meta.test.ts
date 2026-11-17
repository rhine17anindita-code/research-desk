import { afterEach, describe, expect, it, vi } from "vitest";
import { freshDb } from "./helpers";
import { metaStatus, syncMeta } from "@/lib/performance/meta";
import { listComments, listDaily, listPosts } from "@/lib/performance/store";

type Handler = (path: string, q: URLSearchParams) => unknown;
function fakeGraph(h: Handler) {
  vi.stubGlobal("fetch", async (input: URL | string) => {
    const u = new URL(String(input));
    const path = u.pathname.replace(/^\/v\d+\.\d+\//, "");
    const body = h(path, u.searchParams);
    const err = (body as { error?: unknown })?.error;
    return new Response(JSON.stringify(body), { status: err ? 400 : 200, headers: { "content-type": "application/json" } });
  });
}

const userToken: Handler = (path, q) => {
  if (path === "me") return q.get("fields")?.includes("instagram_business_account") ? { error: { message: "(#100) Tried accessing nonexisting field (instagram_business_account) on node type (User)", code: 100 } } : { id: "u1", name: "Anindita" };
  if (path === "debug_token") return { data: { is_valid: true, expires_at: Math.floor(Date.now() / 1000) + 50 * 86400, scopes: ["pages_show_list", "pages_read_engagement", "read_insights", "instagram_basic", "instagram_manage_insights", "instagram_manage_comments"] } };
  if (path === "me/accounts") return { data: [{ id: "p1", name: "Anindita Rhine", access_token: "PAGE_TOKEN", instagram_business_account: { id: "ig1", username: "anindita.rhine" } }] };
  if (path === "ig1") return { followers_count: 5400, media_count: 2 };
  if (path === "ig1/media")
    return {
      data: [
        { id: "m1", caption: "Why is Dhaka sinking?", media_type: "VIDEO", media_product_type: "REELS", permalink: "https://www.instagram.com/reel/AAA/", timestamp: "2026-11-01T12:00:00+0000", like_count: 900, comments_count: 2 },
        { id: "m2", caption: "Rally photos", media_type: "CAROUSEL_ALBUM", media_product_type: "FEED", permalink: "https://www.instagram.com/p/BBB/", timestamp: "2026-10-20T12:00:00+0000", like_count: 80, comments_count: 0 },
      ],
    };
  if (path === "m1/insights") return { data: [{ name: "views", values: [{ value: 25000 }] }, { name: "reach", values: [{ value: 18000 }] }, { name: "saved", values: [{ value: 300 }] }, { name: "shares", values: [{ value: 120 }] }] };
  if (path === "m2/insights") return q.get("metric")!.includes("views") ? { error: { message: "(#100) metric views not supported", code: 100 } } : { data: [{ name: "reach", values: [{ value: 2000 }] }] };
  if (path === "m1/comments") return { data: [{ id: "c1", text: "Please do one on the metro!", username: "x", like_count: 4, timestamp: "2026-11-02T10:00:00+0000" }] };
  if (path === "p1") return { followers_count: 12000 };
  if (path === "p1/posts")
    return {
      data: [
        {
          id: "p1_9", message: "Who owns the garment factories?", created_time: "2026-11-03T15:00:00+0000", permalink_url: "https://www.facebook.com/reel/9", shares: { count: 40 },
          reactions: { summary: { total_count: 500 } }, comments: { summary: { total_count: 30 } }, attachments: { data: [{ media_type: "video", type: "video_inline" }] },
          insights: { data: [{ name: "post_media_view", values: [{ value: 41000 }] }, { name: "post_total_media_view_unique", values: [{ value: 30000 }] }] },
        },
      ],
    };
  return { error: { message: `unexpected ${path}` } };
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.META_ACCESS_TOKEN;
});

describe("direct Meta connection", () => {
  it("reports not configured without a token", async () => {
    const s = await metaStatus(freshDb());
    expect(s.configured).toBe(false);
  });

  it("finds the Page and Instagram from a user token, with expiry", async () => {
    process.env.META_ACCESS_TOKEN = "USER_TOKEN";
    fakeGraph(userToken);
    const s = await metaStatus(freshDb());
    expect(s.ok).toBe(true);
    expect(s.tokenKind).toBe("user");
    expect(s.page?.name).toBe("Anindita Rhine");
    expect(s.instagram?.username).toBe("anindita.rhine");
    expect(s.missingScopes).toEqual([]);
    expect(s.expiresAt).toBeTruthy();
  });

  it("syncs Instagram and Facebook posts, followers and comments, falling back when a metric isn't supported", async () => {
    process.env.META_ACCESS_TOKEN = "USER_TOKEN";
    fakeGraph(userToken);
    const db = freshDb();
    const r = await syncMeta(db);
    expect(r).toMatchObject({ instagram: 2, facebook: 1, comments: 1 });
    const ig = listPosts(db, { platform: "instagram" });
    const reel = ig.find((p) => p.postId === "m1")!;
    expect(reel).toMatchObject({ kind: "reel", views: 25000, reach: 18000, saves: 300, shares: 120, likes: 900 });
    expect(ig.find((p) => p.postId === "m2")).toMatchObject({ kind: "carousel", reach: 2000, views: null });
    expect(listPosts(db, { platform: "facebook" })[0]).toMatchObject({ kind: "video", views: 41000, reach: 30000, likes: 500, comments: 30, shares: 40 });
    expect(listDaily(db, "instagram", 5)[0].followers).toBe(5400);
    expect(listDaily(db, "facebook", 5)[0].followers).toBe(12000);
    expect(listComments(db)[0].text).toContain("metro");
  });

  it("recognises a Page token, and explains an expired token without leaking it", async () => {
    process.env.META_ACCESS_TOKEN = "PAGE_TOKEN";
    fakeGraph((path, q) => {
      if (path === "me") return { id: "p1", name: "Anindita Rhine", instagram_business_account: { id: "ig1", username: "anindita.rhine" } };
      if (path === "debug_token") return { data: { is_valid: true, expires_at: 0, scopes: [] } };
      return userToken(path, q);
    });
    const s = await metaStatus(freshDb());
    expect(s.tokenKind).toBe("page");
    expect(s.instagram?.id).toBe("ig1");

    fakeGraph(() => ({ error: { message: "Error validating access token: Session has expired. access_token=PAGE_TOKEN", code: 190 } }));
    const bad = await metaStatus(freshDb());
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain("expired");
    expect(bad.error).not.toContain("PAGE_TOKEN");
  });
});
