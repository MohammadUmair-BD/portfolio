import { profile } from "@/lib/profile";
import { RuleBasedResponder } from "./rule-responder";
import type { CatResponder } from "./types";

/** Swap this for another CatResponder (e.g. an AI one) without touching the API route. */
export const catResponder: CatResponder = new RuleBasedResponder(profile);
