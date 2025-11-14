
import * as SpanishVerbs from "spanish-verbs";
// @ts-ignore
import { exceptions } from "spanish-verbs/dist/exceptions";

const person1to5toOptions: any = {
    0: ['first', 'singular'],
    1: ['second', 'singular'],
    2: ['third', 'singular'],
    3: ['first', 'plural'],
    4: ['second', 'plural'],
    5: ['third', 'plural'],
};

const person1to5toPronouns: any = {
    0: 'yo',
    1: 'tú',
    2: 'él/ella/usted',
    3: 'nosotros/nosotras',
    4: 'vosotros/vosotras',
    5: 'ellos/ellas/ustedes',
}

const tenseToMoodTense: any = {
    INDICATIVE_PRESENT: ['indicative', 'present'],
    INDICATIVE_IMPERFECT: ['indicative', 'imperfect'],
    INDICATIVE_PRETERITE: ['indicative', 'preterite'],
    INDICATIVE_FUTURE: ['indicative', 'future'],
    INDICATIVE_PERFECT: ['indicative', 'perfect'],
    INDICATIVE_PLUPERFECT: ['indicative', 'pluperfect'],
    INDICATIVE_FUTURE_PERFECT: ['indicative', 'future perfect'],
    INDICATIVE_PRETERITE_PERFECT: ['indicative', 'preterite perfect'],
    SUBJUNCTIVE_PRESENT: ['subjunctive', 'present'],
    SUBJUNCTIVE_IMPERFECT_RA: ['subjunctive', 'imperfect -ra'],
    SUBJUNCTIVE_IMPERFECT_SE: ['subjunctive', 'imperfect -se'],
    SUBJUNCTIVE_FUTURE: ['subjunctive', 'future'],
    SUBJUNCTIVE_PERFECT: ['subjunctive', 'perfect'],
    SUBJUNCTIVE_PLUPERFECT: ['subjunctive', 'pluperfect'],
    SUBJUNCTIVE_FUTURE_PERFECT: ['subjunctive', 'future perfect'],
    CONDITIONAL_PRESENT: ['conditional', 'present'],
    CONDITIONAL_PERFECT: ['conditional', 'perfect'],
};

/**
 * Extract stem change notation from verb (e.g., "descender (ie)" → "ie")
 */
function extractStemChange(verb: string): string | null {
    const match = verb.match(/\(([^)]+)\)/);
    return match ? match[1] : null;
}

/**
 * Extract the base verb from a reflexive verb (tornarse → tornar)
 */
function getBaseVerb(verb: string): string {
    // Remove parenthetical stem changes like "(ue)"
    verb = verb.replace(/\([^)]*\)/g, '').trim();

    // Remove reflexive "se" ending
    if (verb.endsWith('rse')) {
        return verb.slice(0, -2); // Remove "se", keep "r"
    }

    return verb;
}

/**
 * Apply stem change to a conjugation if the library didn't do it
 * Example: "temblo" with stem change "ie" and base "temblar" → "tiemblo"
 */
function applyStemChange(conjugation: string, stemChange: string, baseVerb: string): string {
    if (!conjugation || !stemChange) return conjugation;

    // Map of stem change patterns
    // e -> ie, o -> ue, e -> i, etc.
    const stemChangeMap: Record<string, string> = {
        'ie': 'e',
        'ue': 'o',
        'i': 'e',
        'u': 'o'
    };

    const originalVowel = stemChangeMap[stemChange];
    if (!originalVowel) return conjugation;

    // Find where the original vowel appears in the base verb
    // This helps us identify which vowel to change in the conjugation
    const baseVowelIndex = baseVerb.indexOf(originalVowel);
    if (baseVowelIndex === -1) return conjugation;

    // For stem-changing verbs, the vowel that changes is typically in the stem
    // We'll find the last occurrence of the original vowel before the last 2 characters
    // (to avoid changing vowels in the ending)
    let vowelIndex = -1;
    let searchIndex = 0;

    while (searchIndex < conjugation.length - 2) {
        const idx = conjugation.indexOf(originalVowel, searchIndex);
        if (idx === -1 || idx >= conjugation.length - 2) break;
        vowelIndex = idx;
        searchIndex = idx + 1;
    }

    if (vowelIndex !== -1) {
        // Replace the vowel with the stem change
        return conjugation.slice(0, vowelIndex) +
               stemChange +
               conjugation.slice(vowelIndex + originalVowel.length);
    }

    return conjugation;
}

/**
 * Highlight stem changes in conjugated verb
 * Example: "tiemblo" with stem change "ie" → "t<strong style='...'>ie</strong>mblo"
 */
function highlightStemChange(conjugation: string, stemChange: string): string {
    if (!conjugation || !stemChange) return conjugation;

    // Find the stem change in the conjugation and wrap it in styled <strong> tags
    const index = conjugation.indexOf(stemChange);
    if (index !== -1) {
        return conjugation.slice(0, index) +
               '<strong style="color: #3b82f6; font-weight: 700; text-decoration: underline;">' +
               stemChange +
               '</strong>' +
               conjugation.slice(index + stemChange.length);
    }

    return conjugation;
}

/**
 * Get the reflexive pronoun for each person
 */
const reflexivePronouns: Record<number, string> = {
    0: 'me',     // yo
    1: 'te',     // tú
    2: 'se',     // él/ella/usted
    3: 'nos',    // nosotros/nosotras
    4: 'os',     // vosotros/vosotras
    5: 'se',     // ellos/ellas/ustedes
};

export function getEveryConjugationOfVerb(verb: string): any {
    // Extract stem change notation first (e.g., "(ie)", "(ue)")
    const stemChange = extractStemChange(verb);

    // Remove stem change notation from the verb for processing
    const verbWithoutStemChange = verb.replace(/\s*\([^)]+\)\s*/g, ' ').trim();

    // Handle multi-word idiomatic expressions (e.g., "declarar la guerra")
    const words = verbWithoutStemChange.split(/\s+/);
    const firstWord = words[0];
    const remainingWords = words.slice(1).join(' '); // "la guerra", "a muerte", etc.

    // Check if this is a reflexive verb
    const isReflexive = firstWord.endsWith('rse');

    // Get the base verb for conjugation
    const baseVerb = getBaseVerb(firstWord);

    let verbConjugations: any = {};

    for (const tense in tenseToMoodTense) {

        if (!tense) continue;

        let tenseConjugation: any = {}

        for (let i: number = 0; i < 6; i++) {

            // Get the type of conjugation
            const pronoun = person1to5toPronouns[i];

            // Get the conjugation of the base verb
            // @ts-ignore
            let conjugation = SpanishVerbs.getConjugation(baseVerb, tense, i);

            // Apply stem changes if present and applicable
            // Stem changes typically apply to present tense (indicative and subjunctive)
            // for all persons except nosotros/vosotros (indices 3 and 4)
            if (stemChange && conjugation) {
                const shouldApplyStemChange = (
                    (tense === 'INDICATIVE_PRESENT' || tense === 'SUBJUNCTIVE_PRESENT') &&
                    i !== 3 && i !== 4  // Not nosotros or vosotros
                );

                if (shouldApplyStemChange) {
                    conjugation = applyStemChange(conjugation, stemChange, baseVerb);
                }

                // Highlight the stem change regardless
                conjugation = highlightStemChange(conjugation, stemChange);
            }

            // Add reflexive pronoun if needed (before the conjugated verb)
            if (isReflexive && conjugation) {
                conjugation = reflexivePronouns[i] + ' ' + conjugation;
            }

            // Add remaining words for idiomatic expressions
            if (remainingWords && conjugation) {
                conjugation = conjugation + ' ' + remainingWords;
            }

            tenseConjugation[pronoun] = conjugation;

        }

        verbConjugations[tense] = tenseConjugation;

    }

    return verbConjugations;


}

export function isVerbIrregular(verb: string): boolean {
    // Extract the base verb (handle reflexives and multi-word expressions)
    const words = verb.trim().split(/\s+/);
    const firstWord = words[0];
    const baseVerb = getBaseVerb(firstWord);

    // Check if the base verb exists in the exceptions object
    // which contains all irregular verb conjugations
    return exceptions.hasOwnProperty(baseVerb.toLowerCase());
}

/**
 * Check if a verb has stem changes (e.g., "descender (ie)", "contar (ue)")
 */
export function isVerbStemChanging(verb: string): boolean {
    // Extract stem change notation if present
    const stemChange = extractStemChange(verb);
    return stemChange !== null;
}
