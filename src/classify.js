const RX = {
  voice: /\b(narrat|voice ?over|voiceover|tts|text to speech|speak|say this|dub|audiobook|podcast voice)\w*/i,
  video: /\b(video|b-?roll|footage|clip|animate|animation|scene|cinematic|reel)\w*/i,
  image: /\b(image|photo|picture|illustration|thumbnail|logo|render|artwork|poster|mockup)\w*/i,
  music: /\b(music|song|soundtrack|beat|instrumental|score|jingle|theme tune)\w*/i,
  transcribe: /\b(transcri|caption|subtitle|srt|diariz)\w*/i,
  search: /\b(latest|current|recent|today|this week|news|up to date|who won|stock price|cite sources|look up)\w*/i,
  code: /\b(functions?|class(es)?|methods?|bugs?|stack ?traces?|apis?|endpoints?|typescript|javascript|python|rust|golang|sql|regexp?|compiles?|unit tests?|deploys?|docker|kubernetes|schemas?|race conditions?|refactors?)\b/i,
  repo: /\b(codebase|repository|repo|monorepo|across files|whole project|entire project|all the files)\w*/i,
  app: /\b(landing page|web app|build me a site|dashboard|prototype|crud|full stack)\w*/i,
  docs: /\b(my notes|our wiki|knowledge base|workspace|meeting notes|internal docs)\w*/i,
};

const DEEP = /\b(architect|design a system|prove|derive|root cause|trade-?off|refactor|migrate|optimi[sz]|security review|algorithm|race condition|distributed|why does|edge case|deep(ly)? analy|reason through|step by step|critique|strategy|forecast|model the)\w*/i;
const GENERATIVE = /\b(draft|write (a|an|the|some|onboarding|docs|copy)|compose|author|create (a|an) (post|page|doc|guide|announcement)|announcement|changelog|onboarding|blog post|press release)\w*/i;
const SHALLOW = /\b(summari[sz]|tl;?dr|rewrite|rephrase|translate|extract|classif|categori[sz]|dedup|tags?\b|labels?\b|reformat|proofread|spellcheck|shorten|subject line|title for|bullet points|clean up)\w*/i;
const STAKES = /\b(production|customer facing|legal|contract|compliance|medical|clinical|diagnos|financial statement|audit|security|regulat|patient|liabilit)\w*/i;
const VOLUME = /\b(every|all of|bulk|batch|thousands|millions|\d{3,}\s*(rows|records|documents|tickets|emails|items)|at scale|per day|nightly)\w*/i;
const LONG_OUT = /\b(essay|report|whitepaper|long form|detailed write-?up|full draft|chapter|\d{3,}\s*words)\w*/i;
const SHORT_OUT = /\b(one line|single sentence|a word|yes or no|just the|only the|briefly|one paragraph)\w*/i;

const TIER_NAME = ['minimal', 'light', 'standard', 'frontier'];

export function classify(prompt) {
  const p = String(prompt || '');
  const hits = (rx) => (rx.test(p) ? 1 : 0);

  const at = (rx) => {
    const m = p.match(rx);
    return m ? m.index : Infinity;
  };
  const candidates = [
    ['voice', at(RX.voice)], ['video', at(RX.video)], ['image', at(RX.image)],
    ['music', at(RX.music)], ['transcribe', at(RX.transcribe)],
    ['repo', Math.min(at(RX.repo), at(RX.app))],
    ['search', at(RX.search)], ['code', at(RX.code)], ['docs', at(RX.docs)],
  ].filter(([, i]) => i !== Infinity).sort((a, b) => a[1] - b[1]);

  let mode = candidates.length ? candidates[0][0] : 'text';
  // A search question that happens to mention an api is still a search
  // question, so search outranks code when both are present.
  if (mode === 'code' && at(RX.search) !== Infinity) mode = 'search';
  // Repo scope is a superset of code work. "refactor across our monorepo"
  // leads with a code word but the monorepo is what decides the routing.
  if (mode === 'code' && (at(RX.repo) !== Infinity || at(RX.app) !== Infinity)) mode = 'repo';

  const deep = hits(DEEP);
  const shallow = hits(SHALLOW);
  const stakes = hits(STAKES);
  const volume = hits(VOLUME);

  const generative = hits(GENERATIVE);

  let tier = 1;
  if (generative && !shallow) tier = 2;
  if (deep) tier = 3;
  if (shallow && !deep) tier = 1;
  if (mode === 'repo') tier = RX.code.test(p) || deep ? 3 : 2;
  if (p.length > 900) tier += 1;
  tier = Math.max(0, Math.min(3, tier));

  // Stakes set a floor you cannot cost cut through. Volume pulls the ceiling
  // down, but only when nothing about the task says it has to be right, and
  // only all the way to the floor when the work is also shallow.
  if (stakes) tier = Math.max(tier, 2);
  if (volume && !stakes && !deep) tier = shallow ? 0 : Math.min(tier, 1);

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
      generative: !!generative,
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

