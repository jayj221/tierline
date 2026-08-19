// Labelled prompts used by the eval harness and the rankings page.
//
// Each entry is a prompt someone might plausibly send, with the mode and tier
// a human would assign. These are the ground truth the classifier is scored
// against, so add adversarial cases rather than easy ones.

export const CORPUS = [
  // minimal, tier 0
  { p: 'classify every inbound email into one of six categories', mode: 'text', tier: 0 },
  { p: 'tag all 90000 product records with a category, nightly', mode: 'text', tier: 0 },
  { p: 'extract the invoice number from every attachment in bulk', mode: 'text', tier: 0 },
  { p: 'dedupe these support tickets at scale, we run it per day', mode: 'text', tier: 0 },
  { p: 'label the sentiment of every review, thousands per day', mode: 'text', tier: 0 },

  // light, tier 1
  { p: 'summarise this article', mode: 'text', tier: 1 },
  { p: 'rewrite this paragraph to be shorter', mode: 'text', tier: 1 },
  { p: 'translate this page into German', mode: 'text', tier: 1 },
  { p: 'write a subject line for this email', mode: 'text', tier: 1 },
  { p: 'give me a tl;dr of these meeting notes', mode: 'docs', tier: 1 },
  { p: 'proofread this blog post', mode: 'text', tier: 1 },

  // standard, tier 2
  { p: 'draft a product announcement for our new pricing', mode: 'text', tier: 2 },
  { p: 'write onboarding docs for this internal service', mode: 'text', tier: 2 },
  { p: 'turn these bullet points into a customer facing changelog', mode: 'text', tier: 2 },
  { p: 'write a python function to parse this log format', mode: 'code', tier: 2 },
  { p: 'write unit tests for this typescript module', mode: 'code', tier: 2 },

  // frontier, tier 3
  { p: 'architect a multi region failover for our payment service and reason through the trade-offs', mode: 'text', tier: 3 },
  { p: 'derive the complexity of this algorithm and prove the bound', mode: 'text', tier: 3 },
  { p: 'find the root cause of this race condition, it only shows in production', mode: 'code', tier: 3 },
  { p: 'design a schema migration strategy for zero downtime and reason through the edge cases', mode: 'code', tier: 3 },
  { p: 'critique this go to market strategy and model the downside', mode: 'text', tier: 3 },

  // repo scope
  { p: 'refactor the auth module across our monorepo', mode: 'repo', tier: 3 },
  { p: 'migrate the whole codebase off the deprecated api', mode: 'repo', tier: 3 },
  { p: 'build me a landing page with a signup form', mode: 'repo', tier: 2 },

  // stakes, floor applies
  { p: 'review this vendor contract for liability exposure before we sign', mode: 'text', tier: 2 },
  { p: 'check this clinical note for anything that needs escalation', mode: 'text', tier: 2 },
  { p: 'audit this financial statement for compliance issues', mode: 'text', tier: 2 },
  { p: 'review every patient record for clinical risk, daily', mode: 'text', tier: 2 },

  // voice
  { p: 'narrate this 60 second script with a warm tone', mode: 'voice', tier: 1 },
  { p: 'read this audiobook chapter aloud', mode: 'voice', tier: 1 },
  { p: 'dub this clip into Spanish', mode: 'voice', tier: 1 },

  // video, image, music, transcription
  { p: 'generate b-roll for each beat of this script', mode: 'video', tier: 1 },
  { p: 'animate this still into a cinematic clip', mode: 'video', tier: 1 },
  { p: 'make a thumbnail for this video', mode: 'image', tier: 1 },
  { p: 'render a product photo on a white background', mode: 'image', tier: 1 },
  { p: 'write an instrumental soundtrack for this ad', mode: 'music', tier: 1 },
  { p: 'transcribe this recording and give me captions', mode: 'transcribe', tier: 1 },

  // search
  { p: 'what are the latest changes to this api, cite sources', mode: 'search', tier: 1 },
  { p: 'look up recent news on this company', mode: 'search', tier: 1 },
];

export const byMode = (mode) => CORPUS.filter((c) => c.mode === mode);
