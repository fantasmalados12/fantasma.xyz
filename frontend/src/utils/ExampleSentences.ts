// Simple example sentence generator for vocabulary learning
// This creates contextual sentences to show word usage

import { getAPIUrlBasedOffEnviornment, getAuthHeaders } from './API';

/**
 * Word data from dictionary API
 */
export interface WordData {
    word: string;
    phonetic?: string;
    audioUrl?: string;
    meanings: Array<{
        partOfSpeech: string;
        definitions: Array<{
            definition: string;
            example?: string;
            synonyms?: string[];
            antonyms?: string[];
        }>;
    }>;
    origin?: string;
    source: 'free-dictionary' | 'merriam-webster' | 'cache';
}

/**
 * Fetch real word data from dictionary API
 */
export async function fetchWordData(word: string): Promise<WordData | null> {
    const apiUrl = getAPIUrlBasedOffEnviornment();
    const cacheKey = `dictionary:word:${word.toLowerCase()}`;

    // Check localStorage cache first (client-side caching)
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const parsedCache = JSON.parse(cached);
            const cacheAge = Date.now() - parsedCache.timestamp;
            const ONE_DAY = 24 * 60 * 60 * 1000; // 1 day in milliseconds

            // Use cache if less than 1 day old
            if (cacheAge < ONE_DAY) {
                return parsedCache.data;
            }
        }
    } catch (error) {
        console.error('localStorage cache read error:', error);
    }

    // Fetch from API
    try {
        const response = await fetch(`${apiUrl}/api/dictionary/word/${encodeURIComponent(word)}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            return null;
        }

        const result = await response.json();

        if (result.success && result.data) {
            // Cache the result in localStorage
            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: result.data,
                    timestamp: Date.now()
                }));
            } catch (error) {
                console.error('localStorage cache write error:', error);
            }

            return result.data;
        }

        return null;
    } catch (error) {
        console.error('Dictionary API fetch error:', error);
        return null;
    }
}

/**
 * Example sentence with translation
 */
export interface ExampleSentence {
    spanish: string;
    english: string;
}

/**
 * Fetch real example sentences from dictionary API
 */
export async function fetchRealExamples(word: string): Promise<ExampleSentence[]> {
    const apiUrl = getAPIUrlBasedOffEnviornment();
    const cacheKey = `dictionary:examples:${word.toLowerCase()}`;

    // Check localStorage cache
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const parsedCache = JSON.parse(cached);
            const cacheAge = Date.now() - parsedCache.timestamp;
            const ONE_DAY = 24 * 60 * 60 * 1000;

            if (cacheAge < ONE_DAY) {
                return parsedCache.examples;
            }
        }
    } catch (error) {
        console.error('localStorage cache read error:', error);
    }

    // Fetch from API
    try {
        const response = await fetch(`${apiUrl}/api/dictionary/examples/${encodeURIComponent(word)}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            return [];
        }

        const result = await response.json();

        if (result.success && result.examples) {
            // Cache the result
            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    examples: result.examples,
                    timestamp: Date.now()
                }));
            } catch (error) {
                console.error('localStorage cache write error:', error);
            }

            return result.examples;
        }

        return [];
    } catch (error) {
        console.error('Dictionary API fetch error:', error);
        return [];
    }
}

/**
 * Get a real example sentence from the API, with fallback to template-based generation
 */
export async function getSmartExample(term: string, definition: string, pos?: string): Promise<string> {
    // Try to fetch real examples from API
    const realExamples = await fetchRealExamples(term);

    if (realExamples.length > 0) {
        // Return a random real example (Spanish text only)
        const randomIndex = Math.floor(Math.random() * realExamples.length);
        return realExamples[randomIndex].spanish;
    }

    // Fallback to template-based generation
    return generateExampleSentence(term, definition, pos);
}

/**
 * Template-based example sentence generator (fallback)
 */
export function generateExampleSentence(term: string, definition: string, pos?: string): string {
    const cleanTerm = term.trim().toLowerCase();
    const cleanDef = definition.trim().toLowerCase();

    // Spanish-specific templates based on part of speech
    const templates = {
        noun: [
            `El ${cleanTerm} es muy importante en la vida diaria.`,
            `Me gusta el ${cleanTerm} porque es interesante.`,
            `Necesito un ${cleanTerm} para completar mi tarea.`,
            `El ${cleanTerm} está en la mesa.`,
            `¿Dónde está el ${cleanTerm}?`,
        ],
        verb: [
            `Me gusta ${cleanTerm} todos los días.`,
            `Necesito ${cleanTerm} más a menudo.`,
            `Voy a ${cleanTerm} mañana.`,
            `Es importante ${cleanTerm} bien.`,
            `Quiero ${cleanTerm} con mis amigos.`,
        ],
        adjective: [
            `La casa es muy ${cleanTerm}.`,
            `Este libro es ${cleanTerm} y interesante.`,
            `Me siento ${cleanTerm} hoy.`,
            `El día está ${cleanTerm}.`,
            `Eso es muy ${cleanTerm}.`,
        ],
        default: [
            `${term} - ${definition}`,
            `Ejemplo: ${term} se usa frecuentemente.`,
            `En contexto: ${term} es una palabra útil.`,
        ]
    };

    // Select templates based on POS
    let selectedTemplates = templates.default;
    if (pos) {
        const posLower = pos.toLowerCase();
        if (posLower.includes('noun') || posLower.includes('sustantivo')) {
            selectedTemplates = templates.noun;
        } else if (posLower.includes('verb') || posLower.includes('verbo')) {
            selectedTemplates = templates.verb;
        } else if (posLower.includes('adj') || posLower.includes('adjetivo')) {
            selectedTemplates = templates.adjective;
        }
    }

    // Return a random template
    const randomIndex = Math.floor(Math.random() * selectedTemplates.length);
    return selectedTemplates[randomIndex];
}

// Generate English example sentence
export function generateEnglishExample(term: string, definition: string, pos?: string): string {
    const templates = {
        noun: [
            `The ${term} is on the table.`,
            `I need a ${term} for this.`,
            `This ${term} is very useful.`,
            `Where is the ${term}?`,
            `The ${term} is important.`,
        ],
        verb: [
            `I ${term} every day.`,
            `They ${term} in the morning.`,
            `We should ${term} more often.`,
            `I like to ${term}.`,
            `Let's ${term} together.`,
        ],
        adjective: [
            `The house is very ${term}.`,
            `I feel ${term} today.`,
            `That's so ${term}!`,
            `The weather is ${term}.`,
            `This book is ${term}.`,
        ],
        default: [
            `For example: ${term} (${definition})`,
            `Usage: ${term} is commonly used.`,
            `Context: ${term} means ${definition}`,
        ]
    };

    let selectedTemplates = templates.default;
    if (pos) {
        const posLower = pos.toLowerCase();
        if (posLower.includes('noun')) {
            selectedTemplates = templates.noun;
        } else if (posLower.includes('verb')) {
            selectedTemplates = templates.verb;
        } else if (posLower.includes('adj')) {
            selectedTemplates = templates.adjective;
        }
    }

    const randomIndex = Math.floor(Math.random() * selectedTemplates.length);
    return selectedTemplates[randomIndex];
}

// Smart example generator that works for both term->def and def->term modes
export function generateSmartExample(
    displayTerm: string,
    hiddenTerm: string,
    pos?: string,
    mode: 'spanish' | 'english' = 'spanish'
): string {
    if (mode === 'spanish') {
        return generateExampleSentence(displayTerm, hiddenTerm, pos);
    } else {
        return generateEnglishExample(displayTerm, hiddenTerm, pos);
    }
}
