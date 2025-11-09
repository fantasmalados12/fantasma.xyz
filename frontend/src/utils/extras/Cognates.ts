/**
 * Computes the cognate likelihood between a Spanish term and an English definition.
 * If the definition contains multiple options separated by "/", the highest match is returned.
 */
/**
 * Computes a cognate likelihood percentage between a Spanish term and English definition.
 * Automatically handles verbs, nouns, adjectives, and multiple English definitions.
 */
export function getCognateScore(spanishTerm: string, englishDefinition: string): number {
  if (!spanishTerm || !englishDefinition) return 0;

  // --- Normalize text ---
  const normalize = (w: string) =>
    w.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z]/g, "")
      .trim();

  const stemSpanishVerb = (w: string) => w.replace(/(ar|er|ir)$/i, '');

  const esOriginal = normalize(spanishTerm);
  const esRoot = stemSpanishVerb(esOriginal);

  const englishOptions = englishDefinition.split("/").map(opt => normalize(opt));

  // --- Levenshtein distance ---
  const levDistance = (a: string, b: string): number => {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1,
                            dp[i][j - 1] + 1,
                            dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  };

  // --- Compute highest similarity across all English options ---
  const maxSimilarity = englishOptions.reduce((max, en) => {
    if (!en.length) return max;
    const maxLen = Math.max(esRoot.length, en.length);
    const similarity = 1 - levDistance(esRoot, en) / maxLen;

    // --- Suffix boost rules for cognates ---
    const suffixBoosts: [RegExp, RegExp, number][] = [
      // General Latin/Greek endings
      [/cion$/, /tion$/, 0.1],
      [/dad$/, /ty$/, 0.1],
      [/tad$/, /ty$/, 0.1],
      [/ario$/, /ary$/, 0.1],
      [/oso$/, /ous$/, 0.1],
      [/ista$/, /ist$/, 0.1],
      [/ico$/, /ic$/, 0.1],
      [/ica$/, /ic$/, 0.1],
      // Verb-specific endings
      [/(ar|er|ir)$/, /tion$/, 0.2],
      [/(ar|er|ir)$/, /ize$/, 0.2],
    ];

    let boost = 0;
    for (const [sufEs, sufEn, w] of suffixBoosts) {
      if (sufEs.test(esOriginal) && sufEn.test(en)) boost += w;
    }

    // Clamp similarity + boost between 0 and 1
    return Math.max(max, Math.min(1, similarity + boost));
  }, 0);

  return Math.round(maxSimilarity * 100);
}