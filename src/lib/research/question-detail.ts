import type { DB } from "../db";
import { answerEvidence, getQuestion, listAnswers, listQuestions } from "../repo/questions";
import { getSources, questionSources } from "../repo/sources";
import { linksFor } from "../repo/links";
import { listNotes, projectsContaining } from "../repo/projects";
import { getStory } from "../repo/stories";

/** Everything the question panel needs, in one read. No AI. */
export function questionDetail(db: DB, id: string) {
  const question = getQuestion(db, id);
  if (!question) return null;
  const answers = listAnswers(db, id).map((a) => ({ ...a, evidence: answerEvidence(db, a.id) }));
  const citedIds = [...new Set(answers.flatMap((a) => a.evidence.map((e) => e.sourceId)))];
  const sources = questionSources(db, id, ["attached", "candidate"]);
  const known = new Set(sources.map((s) => s.id));
  const cited = getSources(db, citedIds.filter((x) => !known.has(x)));
  const story = question.clusterId ? getStory(db, question.clusterId) : null;
  const followUps = (db.prepare("SELECT id FROM questions WHERE parent_id = ? AND archived = 0").all(id) as { id: string }[]).map((r) => r.id);
  return {
    question,
    story: story ? { id: story.id, headline: story.headline } : null,
    parent: question.parentId ? getQuestion(db, question.parentId) : null,
    answers,
    sources: [...sources, ...cited.map((s) => ({ ...s, status: "attached" as const, foundBy: "cited in answer" }))],
    links: linksFor(db, "question", id),
    followUps: listQuestions(db, { ids: followUps }),
    projects: projectsContaining(db, "question", id),
    notes: listNotes(db, { questionId: id }),
  };
}
export type QuestionDetail = NonNullable<ReturnType<typeof questionDetail>>;
