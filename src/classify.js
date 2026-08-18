const RX = {
  voice: /\b(narrat|voice ?over|voiceover|tts|text to speech|speak|say this|dub|audiobook|podcast voice)\w*/i,
  video: /\b(video|b-?roll|footage|clip|animate|animation|scene|cinematic|reel)\w*/i,
  image: /\b(image|photo|picture|illustration|thumbnail|logo|render|artwork|poster|mockup)\w*/i,
  music: /\b(music|song|soundtrack|beat|instrumental|score|jingle|theme tune)\w*/i,
  transcribe: /\b(transcri|caption|subtitle|srt|diariz)\w*/i,
  search: /\b(latest|current|recent|today|this week|news|up to date|who won|stock price|cite sources|look up)\w*/i,
  code: /\b(functions?|class(es)?|methods?|bugs?|stack ?traces?|apis?|endpoints?|typescript|javascript|python|rust|golang|sql|regexp?|compiles?|unit tests?|deploys?|docker|kubernetes|schemas?)\b/i,
  repo: /\b(codebase|repository|repo|monorepo|across files|whole project|entire project|all the files|migration)\w*/i,
  app: /\b(landing page|web app|build me a site|dashboard|prototype|crud|full stack)\w*/i,
  docs: /\b(my notes|our wiki|knowledge base|workspace|meeting notes|internal docs)\w*/i,
};

const DEEP = /\b(architect|design a system|prove|derive|root cause|trade-?off|refactor|migrate|optimi[sz]|security review|algorithm|race condition|distributed|why does|edge case|deep(ly)? analy|reason through|step by step|critique|strategy|forecast|model the)\w*/i;
const SHALLOW = /\b(summari[sz]|tl;?dr|rewrite|rephrase|translate|extract|classif|categori[sz]|tag|label|format|proofread|spellcheck|shorten|subject line|title for|bullet points|clean up)\w*/i;
const STAKES = /\b(production|customer facing|legal|contract|compliance|medical|clinical|diagnos|financial statement|audit|security|regulat|patient|liabilit)\w*/i;
const VOLUME = /\b(every|all of|bulk|batch|thousands|millions|\d{3,}\s*(rows|records|documents|tickets|emails|items)|at scale|per day|nightly)\w*/i;
const LONG_OUT = /\b(essay|report|whitepaper|long form|detailed write-?up|full draft|chapter|\d{3,}\s*words)\w*/i;
const SHORT_OUT = /\b(one line|single sentence|a word|yes or no|just the|only the|briefly|one paragraph)\w*/i;

const TIER_NAME = ['minimal', 'light', 'standard', 'frontier'];

export function classify(prompt) {
  const p = String(prompt || '');
  const hits = (rx) => (rx.test(p) ? 1 : 0);

  let mode = 'text';
  for (const m of ['voice', 'video', 'image', 'music', 'transcribe']) {
    if (RX[m].test(p)) { mode = m; break; }
  }
  if (mode === 'text') {
    if (RX.repo.test(p) || RX.app.test(p)) mode = 'repo';
    else if (RX.code.test(p)) mode = 'code';
    else if (RX.search.test(p)) mode = 'search';
    else if (RX.docs.test(p)) mode = 'docs';
  }

  const deep = hits(DEEP);
  const shallow = hits(SHALLOW);
  const stakes = hits(STAKES);
  const volume = hits(VOLUME);

  let tier = 1;
  if (deep) tier += 2;
  if (RX.repo.test(p) && RX.code.test(p)) tier += 1;
  if (shallow && !deep) tier -= 1;
  if (p.length > 900) tier += 1;
  tier = Math.max(0, Math.min(3, tier));

  // Stakes set a floor you cannot cost cut through. Volume pulls the ceiling
  // down, but only when nothing about the task says it has to be right.
  if (stakes) tier = Math.max(tier, 2);
  if (volume && !stakes && !deep) tier = Math.min(tier, 1);

  const promptTokens = Math.ceil(p.length / 4);
  let contextTokens = 0;
  if (RX.repo.test(p)) contextTokens = 60000;
  else if (RX.docs.test(p)) contextTokens = 20000;
  else if (/\b(attached|this document|the pdf|these files)\b/i.test(p)) contextTokens = 12000;

  let outTokens = 800;
  if (LONG_OUT.test(p)) outTokens = 3000;
  if (SHORT_OUT.test(p)) outTokens = 80;
  if (shallow && !LONG_OUT.test(p)) outTokens = Math.min(outTokens, 400);
  if (tier === 3) outTokens = Math.round(outTokens * 1.6);

  return {
    mode,
    tier,
    tierName: TIER_NAME[tier],
    signals: {
      deepReasoning: !!deep,
      shallowTransform: !!shallow,
      highStakes: !!stakes,
      highVolume: !!volume,
      needsRepoContext: RX.repo.test(p),
      needsLiveWeb: RX.search.test(p),
    },
    estimate: {
      inTokens: promptTokens + contextTokens,
      outTokens,
      chars: p.length,
      seconds: mode === 'video' ? 8 : 0,
      images: mode === 'image' ? 1 : 0,
      minutes: mode === 'transcribe' ? 10 : 0,
      tracks: mode === 'music' ? 1 : 0,
    },
  };
}

