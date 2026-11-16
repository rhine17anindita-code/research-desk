import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { findOpportunities } from "@/lib/ideation/opportunities";

export const GET = route(() => ({ ok: true, opportunities: findOpportunities(getDb(), { limit: 30 }) }));
