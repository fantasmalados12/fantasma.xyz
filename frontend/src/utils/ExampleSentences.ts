// Simple example sentence generator for vocabulary learning
// This creates contextual sentences to show word usage

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
