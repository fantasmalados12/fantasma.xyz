
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

export function getEveryConjugationOfVerb(verb: string): any {

    let verbConjugations: any = {};
    
    for (const tense in tenseToMoodTense) {

        if (!tense) continue;

        let tenseConjugation: any = {}

        for (let i: number = 0; i < 6; i++) {

            // Get the type of conjugation
            const pronoun = person1to5toPronouns[i];
            
            // Get the conjugation
            // @ts-ignore
            const conjugation = SpanishVerbs.getConjugation(verb, tense, i); 

            tenseConjugation[pronoun] = conjugation;

        }

        verbConjugations[tense] = tenseConjugation;

    }

    return verbConjugations;


}

export function isVerbIrregular(verb: string): boolean {
    // Check if the verb exists in the exceptions object
    // which contains all irregular verb conjugations
    return exceptions.hasOwnProperty(verb.toLowerCase());
}
