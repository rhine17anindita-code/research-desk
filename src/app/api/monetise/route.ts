import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { getMonSettings, listItems, listProposals, listSeries, listSponsors, rateCard, updateMonSettings, type MonSettings } from "@/lib/monetise";

export const GET = route(() => {
  const db = getDb();
  return { ok: true, settings: getMonSettings(db), items: listItems(db), sponsors: listSponsors(db), series: listSeries(db), proposals: listProposals(db), rates: rateCard(db) };
});

/** Goals, brands to avoid, rates, contact details. */
export const PATCH = route(async (req: Request) => ({ ok: true, settings: updateMonSettings(getDb(), await body<Partial<MonSettings>>(req)) }));
