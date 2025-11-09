interface VocabEntry {
  term: string;
  definition: string;
  cognateScore?: number;
}

interface VocabStats {
  totalTerms: number;
  singleWordTerms: number;
  multiWordTerms: number;
  averageCognateScore: number;
  highCognates: number;      // >70%
  lowCognates: number;       // <30%
  topCognates: { term: string; definition: string; score: number }[];
  suffixCounts: Record<string, number>;
  verbs: number;
  nouns: number;
  adjectives: number;
  multiDefinitionTerms: number;
  terms: { 
    term: string; 
    definition: string; 
    cognateScore: number;
    pos: 'verb' | 'noun' | 'adjective';
    estimatedIterations: number;
  }[];
}

/**
 * Stem Spanish verbs (basic)
 */
const stemSpanishVerb = (word: string) => word.replace(/(ar|er|ir)$/i, '');

/**
 * Normalize string for comparison
 */
const normalize = (w: string) =>
  w.toLowerCase()
   .normalize("NFD")
   .replace(/[\u0300-\u036f]/g, "")
   .replace(/[^a-z]/g, "")
   .trim();

/**
 * Compute Levenshtein distance
 */
const levDistance = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
};

/**
 * Compute cognate score between a Spanish term and its English definition
 */
const getCognateScore = (spanishTerm: string, englishDefinition: string): number => {
  const esOriginal = normalize(spanishTerm);
  const esRoot = stemSpanishVerb(esOriginal);

  const englishOptions = englishDefinition.split("/").map(opt => normalize(opt));

  const maxSimilarity = englishOptions.reduce((max, en) => {
    if (!en.length) return max;
    const maxLen = Math.max(esRoot.length, en.length);
    const similarity = 1 - levDistance(esRoot, en) / maxLen;

    // Suffix boost patterns
    const suffixBoosts: [RegExp, RegExp, number][] = [
      [/cion$/, /tion$/, 0.1],
      [/dad$/, /ty$/, 0.1],
      [/tad$/, /ty$/, 0.1],
      [/ario$/, /ary$/, 0.1],
      [/oso$/, /ous$/, 0.1],
      [/ista$/, /ist$/, 0.1],
      [/ico$/, /ic$/, 0.1],
      [/ica$/, /ic$/, 0.1],
      [/(ar|er|ir)$/, /tion$/, 0.2],
      [/(ar|er|ir)$/, /ize$/, 0.2],
    ];

    let boost = 0;
    for (const [sufEs, sufEn, w] of suffixBoosts) {
      if (sufEs.test(esOriginal) && sufEn.test(en)) boost += w;
    }

    return Math.max(max, Math.min(1, similarity + boost));
  }, 0);

  return Math.round(maxSimilarity * 100);
};

/**
 * Determine basic part-of-speech from Spanish term (approximation)
 */
const detectPOS = (term: string): 'verb' | 'noun' | 'adjective' => {
  if (/(ar|er|ir)$/.test(term)) return 'verb';
  if (/ado$|ido$|oso$|osa$|ante$|ente$|ico$|ica$|al$|ble$/.test(term)) return 'adjective';
  return 'noun';
};

/**
 * Analyze suffix usage in Spanish terms
 */
const getSuffixCounts = (terms: string[]): Record<string, number> => {
  const suffixes = ['cion','dad','tad','ario','oso','ista','ico','ica','ar','er','ir'];
  const counts: Record<string, number> = {};
  suffixes.forEach(suf => counts[suf] = 0);

  terms.forEach(term => {
    const clean = normalize(term);
    suffixes.forEach(suf => { if (clean.endsWith(suf)) counts[suf]++; });
  });

  return counts;
};

const estimateIterations = (term: string, cognateScore: number) => {
  // Base iterations for an "average difficulty" word
  const base = 3;

  // Cognate adjustment: higher score → fewer iterations (range ~0.5–1.5)
  const cognateAdj = 1 - cognateScore / 150; // score 100 → 0.33x, score 0 → 1x

  // Length adjustment: multi-word or long words add a little difficulty
  const words = term.trim().split(/\s+/).length;
  const lengthAdj = Math.min(1 + (term.replace(/\s+/g,'').length / 10) * 0.3, 2); // cap at 2x

  // Word type adjustment (optional)
  // const posAdj = term.endsWith("ar") || term.endsWith("er") || term.endsWith("ir") ? 1.1 : 1;

  const total = Math.ceil(base * cognateAdj * lengthAdj /* * posAdj */);

  // Minimum 1 iteration
  return Math.max(total, 1);
};

export function generateVocabStats(dataset: VocabEntry[]): VocabStats {
  const scoredDataset = dataset.map(entry => {
    const score = getCognateScore(entry.term, entry.definition);
    const pos = detectPOS(entry.term) as 'verb' | 'noun' | 'adjective';
    const iterations = estimateIterations(entry.term, score);

    return {
      ...entry,
      cognateScore: score,
      pos,
      estimatedIterations: iterations
    };
  });

  const totalTerms = scoredDataset.length;
  const singleWordTerms = scoredDataset.filter(e => e.term.split(' ').length === 1).length;
  const multiWordTerms = totalTerms - singleWordTerms;
  const multiDefinitionTerms = scoredDataset.filter(e => e.definition.includes('/')).length;

  const averageCognateScore = Math.round(
    scoredDataset.reduce((sum, e) => sum + (e.cognateScore || 0), 0) / totalTerms
  );

  const highCognates = scoredDataset.filter(e => (e.cognateScore || 0) > 53).length;
  const lowCognates = scoredDataset.filter(e => (e.cognateScore || 0) < 30).length;

  const topCognates = scoredDataset
    .sort((a, b) => (b.cognateScore || 0) - (a.cognateScore || 0))
    .slice(0, 5)
    .map(e => ({ term: e.term, definition: e.definition, score: e.cognateScore || 0 }));

  const posCounts = { verbs: 0, nouns: 0, adjectives: 0 };
  scoredDataset.forEach(e => {
    if (e.pos === 'verb') posCounts.verbs++;
    if (e.pos === 'noun') posCounts.nouns++;
    if (e.pos === 'adjective') posCounts.adjectives++;
  });

  const suffixCounts = getSuffixCounts(scoredDataset.map(e => e.term));

  return {
    totalTerms,
    singleWordTerms,
    multiWordTerms,
    averageCognateScore,
    highCognates,
    lowCognates,
    topCognates,
    suffixCounts,
    verbs: posCounts.verbs,
    nouns: posCounts.nouns,
    adjectives: posCounts.adjectives,
    multiDefinitionTerms,
    terms: scoredDataset.map(e => ({
      term: e.term,
      definition: e.definition,
      cognateScore: e.cognateScore || 0,
      pos: e.pos,
      estimatedIterations: e.estimatedIterations
    })),
  };
}
