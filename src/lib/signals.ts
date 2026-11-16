/**
 * Editorial signals: characteristics that make a story worth investigating,
 * independent of its topic. Detection here is deliberately cheap and transparent
 * (phrase cues over headline + description). Users can tune weights, add their
 * own signals with their own cues, and feedback adjusts a learned weight.
 * Optional AI assessment (explicit, batched) can add signals the cues miss.
 */
export interface SignalDef {
  id: string;
  label: string;
  description: string;
  cues: string[];
}

export const BUILTIN_SIGNALS: SignalDef[] = [
  {
    id: "unclear-meaning",
    label: "Announcement, unclear meaning",
    description: "An important announcement whose practical meaning, mechanism or detail is left unclear.",
    cues: [
      "announce", "unveil", "framework", "memorandum", "roadmap", "pledge", "plans to", "intends to",
      "details (were|are) not", "did not (say|specify|disclose)", "without (giving|providing) details",
      "yet to be (announced|finalised|finalized|clarified)", "unclear", "vague", "in principle", "proposal",
    ],
  },
  {
    id: "unexpected-relationship",
    label: "Unexpected relationship",
    description: "A surprising link between institutions, countries, industries or individuals.",
    cues: [
      "partnership", "alliance", "joint venture", "teams up", "deal with", "agreement with", "rapprochement",
      "unlikely", "surprise", "first-ever", "rare (meeting|visit|deal)", "ties with", "backed by", "stake in",
    ],
  },
  {
    id: "unexamined-consequences",
    label: "Unexamined consequences",
    description: "Suggests downstream effects that ordinary reporting has not fully examined.",
    cues: [
      "could (lead|affect|trigger|force|mean)", "knock-on", "ripple", "implications", "fallout",
      "consequences", "may (force|reshape|affect)", "long-term", "spillover", "unintended", "risk of",
    ],
  },
  {
    id: "contradiction",
    label: "Contradiction or dispute",
    description: "Official statements conflict with evidence, or credible parties dispute the account.",
    cues: [
      "denie[sd]", "dispute[sd]?", "contradict", "despite (claims|assurances|denials)", "rejects? (claims|allegations|report)",
      "challenged", "inconsistent", "conflicting", "misleading", "false claim", "fact-check", "questioned",
      "allegation", "alleged", "accus",
    ],
  },
  {
    id: "power-incentives",
    label: "Who benefits, who loses",
    description: "Raises questions of incentives, influence, winners and losers.",
    cues: [
      "lobby", "contract", "subsid", "tariff", "sanction", "funding", "donor", "investor", "profit",
      "windfall", "monopoly", "concession", "influence", "conflict of interest", "bailout", "tender",
    ],
  },
  {
    id: "historical-context",
    label: "Historical significance",
    description: "Unusual development with meaningful precedent or historical context.",
    cues: [
      "first (time )?since", "for the first time", "unprecedented", "decades", "historic", "record (high|low)",
      "since (19|20)\\d\\d", "anniversary", "landmark", "reversal", "end of an era", "years? after",
    ],
  },
  {
    id: "structural-problem",
    label: "Structural problem or opportunity",
    description: "Reveals an overlooked systemic problem, gap or opportunity.",
    cues: [
      "shortage", "backlog", "systemic", "crisis", "gap", "bottleneck", "overlooked", "neglected",
      "underfunded", "collapse", "failure", "loophole", "reform", "infrastructure", "supply chain",
    ],
  },
  {
    id: "original-angle",
    label: "Original story potential",
    description: "Strong potential for an explainer, investigation or short-form video.",
    cues: [
      "why ", "how ", "explained", "what (we know|it means)", "inside", "investigation", "leaked",
      "documents (show|reveal)", "obtained by", "revealed", "data (shows|reveals)", "analysis",
    ],
  },
];

export interface SignalMatch {
  signalId: string;
  matches: string[];
}

const regexCache = new Map<string, RegExp>();
function cueRegex(cue: string): RegExp {
  let re = regexCache.get(cue);
  if (!re) {
    // Cues are short regex sources; a leading word boundary keeps "gap" out of "Singapore".
    try {
      re = new RegExp(`\\b${cue}`, "i");
    } catch {
      re = new RegExp(`\\b${cue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    }
    regexCache.set(cue, re);
  }
  return re;
}

/** Detect which signals' cues appear in a piece of text. */
export function detectSignals(text: string, signals: { id: string; cues: string[] }[]): SignalMatch[] {
  const out: SignalMatch[] = [];
  for (const s of signals) {
    const matches: string[] = [];
    for (const cue of s.cues) {
      const m = text.match(cueRegex(cue));
      if (m) matches.push(m[0].trim().toLowerCase());
    }
    if (matches.length) out.push({ signalId: s.id, matches: [...new Set(matches)].slice(0, 4) });
  }
  return out;
}
