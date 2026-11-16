import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { generateIdeas, type GenerateIdeasOptions } from "@/lib/ideation/ai";

export const maxDuration = 180;

export const POST = route(async (req: Request) => generateIdeas(getDb(), await body<GenerateIdeasOptions>(req)));
