export type CatLink = { label: string; href: string };

export type CatReply = {
  intent: string;
  text: string;
  links: CatLink[];
  suggestions: string[];
  /** false when the fallback was used, so the question gets logged for review. */
  answered: boolean;
};

export type CustomAnswer = { id: number; keywords: string; answer: string };

/**
 * Anything that can answer a visitor's question. The rule-based matcher is the
 * only implementation today; an AI-backed one can be dropped in later without
 * touching the API route or the frontend.
 */
export interface CatResponder {
  respond(question: string, customAnswers?: CustomAnswer[]): CatReply;
}
