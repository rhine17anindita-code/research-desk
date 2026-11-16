import type { DB } from "../db";
import { getProject, listNotes, projectItemIds } from "../repo/projects";
import { getStory, getStoryArticles } from "../repo/stories";
import { answerEvidence, listAnswers, listQuestions } from "../repo/questions";
import { getSources, questionSources } from "../repo/sources";
import { getSetting } from "../repo/settings";
import { ANSWER_STATE_LABELS, type Source } from "../types";

/**
 * Everything in a project, gathered once, with one global numbered reference list.
 * Used by the Markdown export and the printable dossier. No AI.
 */
export function buildDossier(db: DB, projectId: string) {
  const project = getProject(db, projectId);
  if (!project) return null;
  const stages = getSetting(db, "pipeline.stages");
  const stories = projectItemIds(db, projectId, "cluster").map((id) => getStory(db, id)).filter((s): s is NonNullable<typeof s> => !!s);
  const questions = listQuestions(db, { projectId });
  const refs: Source[] = [];
  const refIndex = new Map<string, number>();
  const ref = (s: Source) => {
    if (!refIndex.has(s.id)) {
      refs.push(s);
      refIndex.set(s.id, refs.length);
    }
    return refIndex.get(s.id)!;
  };
  for (const s of getSources(db, projectItemIds(db, projectId, "source"))) ref(s);

  const qBlocks = questions.map((q) => {
    const answer = listAnswers(db, q.id).find((a) => !a.superseded) ?? null;
    const evidence = answer ? answerEvidence(db, answer.id) : [];
    const attached = questionSources(db, q.id, ["attached"]);
    const bySource = new Map([...attached, ...getSources(db, evidence.map((e) => e.sourceId))].map((s) => [s.id, s]));
    for (const s of bySource.values()) ref(s);
    return { q, answer, cite: (ids: string[]) => ids.map((id) => (bySource.has(id) ? refIndex.get(id) : undefined)).filter((n): n is number => !!n) };
  });

  const storyBlocks = stories.map((s) => ({ story: s, articles: getStoryArticles(db, s.id) }));
  const notes = listNotes(db, { projectId });
  return { project, stageLabel: stages.find((x) => x.id === project.stage)?.label ?? project.stage, storyBlocks, qBlocks, notes, refs };
}

export type Dossier = NonNullable<ReturnType<typeof buildDossier>>;

const cites = (ns: number[]) => (ns.length ? " " + ns.map((n) => `[${n}]`).join("") : "");

export function dossierMarkdown(d: Dossier): string {
  const L: string[] = [];
  const p = d.project;
  L.push(`# ${p.title}`, "");
  L.push(`*Stage: ${d.stageLabel} · Exported ${new Date().toISOString().slice(0, 10)} from Research Desk*`, "");
  if (p.thesis) L.push(`**Research question / thesis.** ${p.thesis}`, "");
  if (d.storyBlocks.length) {
    L.push("## Stories", "");
    for (const { story, articles } of d.storyBlocks) {
      L.push(`### ${story.headline}`, "");
      if (story.summary) L.push(story.summary, "");
      for (const a of articles) L.push(`- ${a.publisher ?? "Unknown"}, ${a.publishedAt?.slice(0, 10) ?? "undated"}: [${a.title}](${a.url})`);
      L.push("");
    }
  }
  if (d.qBlocks.length) {
    L.push("## Questions and findings", "");
    for (const { q, answer, cite } of d.qBlocks) {
      L.push(`### ${q.text}`, "");
      L.push(`*Status: ${ANSWER_STATE_LABELS[q.answerState] ?? q.answerState}*`, "");
      if (!answer) {
        L.push("_No answer recorded yet._", "");
        continue;
      }
      L.push(`${answer.summary}${answer.origin === "ai" ? " *(AI-drafted from cited sources)*" : " *(your finding)*"}`, "");
      for (const pt of answer.points) {
        const tag = pt.kind === "background" ? " *(unverified background)*" : pt.unsupported ? " *(unsourced)*" : "";
        L.push(`- **${pt.kind}:** ${pt.text}${cites(cite(pt.sourceIds))}${tag}`);
      }
      if (answer.brief) {
        for (const f of answer.brief.findings) L.push(`- **${f.heading}:** ${f.detail}${cites(cite(f.sourceIds))}`);
        if (answer.brief.competingExplanations.length) {
          L.push("", "**Competing explanations**");
          for (const c of answer.brief.competingExplanations) L.push(`- ${c.explanation}${cites(cite(c.sourceIds))} — for: ${c.evidenceFor}; against: ${c.evidenceAgainst}`);
        }
      }
      if (answer.caveats.length) L.push("", "**Qualifications:** " + answer.caveats.join(" "));
      if (answer.nextSteps.length) L.push("", "**To verify / go further:**", ...answer.nextSteps.map((s) => `- ${s}`));
      L.push("");
    }
  }
  if (p.gaps) L.push("## Remaining gaps", "", p.gaps, "");
  if (p.angles) L.push("## Editorial angles", "", p.angles, "");
  if (p.description) L.push("## Working notes / outline", "", p.description, "");
  if (d.notes.length) {
    L.push("## Notes", "");
    for (const n of d.notes) L.push(`- ${n.title ? `**${n.title}** ` : ""}${n.body.replace(/\n+/g, " ")}${n.origin === "assistant" ? " *(from the assistant, unverified)*" : ""}`);
    L.push("");
  }
  if (d.refs.length) {
    L.push("## References", "");
    d.refs.forEach((s, i) => {
      const meta = [s.authors, s.publisher, s.publishedAt?.slice(0, 10)].filter(Boolean).join(", ");
      L.push(`${i + 1}. ${s.title}${meta ? `. ${meta}` : ""}.${s.url ? ` ${s.url}` : ""}${s.doi ? ` (doi:${s.doi})` : ""} — via ${s.provider}, retrieved ${s.retrievedAt.slice(0, 10)}`);
    });
  }
  return L.join("\n");
}
