import { afterEach, describe, expect, it, vi } from "vitest";
import { freshDb, MockProvider, useMock } from "./helpers";
import { createProject } from "@/lib/repo/projects";
import { askExpert, classify, gather, glance, getSolutionsBrief, keptExperts, lastRun, listExperts, recentLibraries, saveExpert, solutionsMaterial, writeSolutionsBrief } from "@/lib/experts";
import { getSources } from "@/lib/repo/sources";
import { projectItemIds } from "@/lib/repo/projects";
import { getProduction, updateProduction } from "@/lib/production";
import { writeScript } from "@/lib/production-ai";

afterEach(() => {
  useMock(null);
  vi.unstubAllGlobals();
});

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
<item><title>Lessons from Vietnam: how to reform garment worker safety - Brookings</title><link>https://www.brookings.edu/articles/garment-safety</link><pubDate>Mon, 03 Mar 2025 10:00:00 GMT</pubDate><description>Bangladesh should adopt independent inspections, the authors recommend.</description></item>
<item><title>Opinion: Garment worker safety needs more than inspections - The Daily Star</title><link>https://www.thedailystar.net/opinion/views/garment-safety</link><pubDate>Mon, 03 Mar 2025 10:00:00 GMT</pubDate><description>Garment worker safety reform must include unions.</description></item>
<item><title>Factory fire kills 3 garment workers - Some Paper</title><link>https://somepaper.test/news/fire</link><pubDate>Mon, 03 Mar 2025 10:00:00 GMT</pubDate><description>A fire.</description></item>
</channel></rss>`;

function stubNet() {
  vi.stubGlobal("fetch", async (u: string | URL) => {
    const url = String(u);
    if (url.includes("news.google.com")) return new Response(url.includes("site%3A") ? RSS.replace(/<item><title>(Opinion|Factory)[\s\S]*?<\/item>/g, "") : RSS, { status: 200, headers: { "content-type": "application/rss+xml" } });
    if (url.includes("openalex")) return new Response(JSON.stringify({ results: [{ id: "W1", display_name: "Garment worker safety after Rana Plaza: policy lessons from the Accord", publication_year: 2015, publication_date: "2015-04-01", doi: "https://doi.org/10.1/x", primary_location: { source: { display_name: "Journal of Labour" } }, authorships: [{ author: { display_name: "A. Researcher" } }], abstract_inverted_index: { Bangladesh: [0], should: [1], reform: [2], garment: [3], safety: [4] } }] }), { status: 200 });
    return new Response("{}", { status: 404 });
  });
}

describe("Solutions & expert views", () => {
  it("tags solutions, other countries, history and laws", () => {
    const c = classify({ title: "ILO Convention 190: lessons from Vietnam for Bangladesh garment safety reform", url: "https://ilo.org/x", year: 2013 }, "garment safety");
    expect(c.tags).toEqual(expect.arrayContaining(["solutions", "other countries", "history", "Bangladesh", "legal"]));
    expect(c.score).toBeGreaterThan(3);
  });

  it("gathers a topic library free, keeps real opinion and drops plain news", async () => {
    stubNet();
    const db = freshDb();
    const r = await gather(db, "topic", "garment worker safety");
    expect(r.query).toBe("garment worker safety");
    const items = listExperts(db, "topic", "garment worker safety");
    const titles = items.map((i) => i.title);
    expect(titles.some((t) => t.includes("Lessons from Vietnam"))).toBe(true);
    expect(items.find((i) => i.url.includes("brookings"))?.kind).toBe("policy");
    expect(items.find((i) => i.url.includes("/opinion/"))?.kind).toBe("opinion");
    expect(titles.some((t) => t.includes("Factory fire"))).toBe(false);
    expect(items.some((i) => i.kind === "research")).toBe(true);
    expect(lastRun(db, "topic", "garment worker safety")).not.toBeNull();
    expect(recentLibraries(db)[0].href).toBe("/experts?q=garment%20worker%20safety");
    // Cached for a week: a second gather is a no-op.
    expect((await gather(db, "topic", "garment worker safety")).added).toBe(0);
  }, 15000);

  it("gives a free at-a-glance summary pulled from the sources", async () => {
    stubNet();
    const db = freshDb();
    await gather(db, "topic", "garment worker safety");
    const g = glance(db, "topic", "garment worker safety")!;
    expect(g.total).toBeGreaterThan(1);
    expect(g.kinds.length).toBeGreaterThan(1);
    const sol = g.themes.find((t) => t.id === "solutions")!;
    expect(sol.points.length).toBeGreaterThan(0);
    // Word-for-word from a source, linked back to it, without the publisher tacked on.
    for (const p of g.themes.flatMap((t) => t.points)) {
      expect(p.url).toMatch(/^https?:/);
      expect(p.text).not.toMatch(/\n|Brookings$/);
    }
    expect(g.readFirst.length).toBeGreaterThan(0);
  }, 15000);

  it("asks AI about one item on request and keeps the answer", async () => {
    stubNet();
    const db = freshDb();
    await gather(db, "topic", "garment worker safety");
    const it0 = listExperts(db, "topic", "garment worker safety")[0];
    const mock = new MockProvider({ evidence: () => ({ answer: "A", key_points: ["k"], evidence: "case study", bangladesh: "Applies", caveats: ["abstract only"] }) });
    useMock(mock);
    expect(((await askExpert(db, it0.id, { estimateOnly: true })) as { estimate?: { model: string } }).estimate?.model).toMatch(/haiku/);
    expect(await askExpert(db, it0.id, { question: "Is it convincing?" })).toMatchObject({ ok: true });
    expect(mock.calls[0].user).toContain("QUESTION: Is it convincing?");
    expect(listExperts(db, "topic", "garment worker safety").find((x) => x.id === it0.id)?.aiNote?.answer).toBe("A");
  }, 15000);

  it("keeping an item in a project makes it a source the script can cite", async () => {
    stubNet();
    const db = freshDb();
    const p = createProject(db, { title: "Garment worker safety", thesis: "What would actually fix it" });
    await gather(db, "project", p.id);
    const it = listExperts(db, "project", p.id)[0];
    saveExpert(db, it.id, true);
    expect(keptExperts(db).map((x) => x.id)).toContain(it.id);
    expect(getSources(db, projectItemIds(db, p.id, "source")).some((s) => s.title === it.title)).toBe(true);
  }, 15000);

  it("writes a solutions brief and the script gets a solutions section when switched on", async () => {
    stubNet();
    const db = freshDb();
    const p = createProject(db, { title: "Garment worker safety", thesis: "What would actually fix it" });
    await gather(db, "project", p.id);
    const mock = new MockProvider({
      root_causes: () => ({
        problem: "Factories stay unsafe", root_causes: ["Weak inspection"],
        options: [{ option: "Independent inspections", who_acts: "Government + brands", how_it_works: "Binding accord", examples_elsewhere: "Vietnam", evidence: "E1", pros: ["Works"], cons: ["Costly"], feasibility: "Medium", sources: ["E1"] }],
        precedents: [], bangladesh_so_far: "The Accord", trade_offs: "Cost vs safety", what_to_watch: ["Renewal"],
      }),
      verify: () => ({ title: "T", script: "## Hook\nLine.\n\n## So what would actually fix this?\nInspections.", verify: [] }),
    });
    useMock(mock);
    const est = (await writeSolutionsBrief(db, "project", p.id, { estimateOnly: true })) as { estimate?: { usd: number } };
    expect(est.estimate?.usd).toBeGreaterThan(0);
    expect(await writeSolutionsBrief(db, "project", p.id)).toMatchObject({ ok: true });
    expect(getSolutionsBrief(db, "project", p.id)?.options[0].option).toBe("Independent inspections");
    expect(mock.calls[0].user).toContain("[E1]");
    expect(solutionsMaterial(db, p.id)).toContain("SOLUTIONS BRIEF");

    updateProduction(db, p.id, { docs: { solutions: "on" } });
    expect(getProduction(db, p.id)?.docs.solutions).toBe("on");
    await writeScript(db, p.id, { regenerate: true });
    const call = mock.calls.find((c) => c.system.includes("Write the full script"))!;
    expect(call.user).toContain("INCLUDE A SOLUTIONS SECTION");
    expect(call.user).toContain("Independent inspections");

    updateProduction(db, p.id, { docs: { solutions: "" } });
    await writeScript(db, p.id, { regenerate: true });
    expect(mock.calls.at(-1)!.user).not.toContain("INCLUDE A SOLUTIONS SECTION");
  }, 15000);
});
