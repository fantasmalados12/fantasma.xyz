import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Response structure from Free Dictionary API
 */
interface FreeDictionaryResponse {
  word: string;
  phonetic?: string;
  phonetics?: Array<{
    text?: string;
    audio?: string;
  }>;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      example?: string;
      synonyms?: string[];
      antonyms?: string[];
    }>;
    synonyms?: string[];
    antonyms?: string[];
  }>;
  origin?: string;
}

/**
 * Response structure from Merriam-Webster API
 */
interface MerriamWebsterResponse {
  meta?: {
    id: string;
    uuid: string;
    lang: string;
    stems: string[];
    offensive: boolean;
  };
  hwi?: {
    hw: string;
    prs?: Array<{
      mw: string;
      sound?: {
        audio: string;
      };
    }>;
  };
  fl?: string; // Part of speech
  shortdef?: string[];
  def?: Array<{
    sseq: any[];
  }>;
}

/**
 * Normalized word data structure
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
 * Configuration for Merriam-Webster API
 */
interface MerriamWebsterConfig {
  apiKey?: string;
  enabled: boolean;
}

export class DictionaryAPI {
  private freeDictionaryBaseURL = 'https://api.dictionaryapi.dev/api/v2/entries';
  private merriamWebsterBaseURL = 'https://www.dictionaryapi.com/api/v3/references/spanish/json';
  private merriamWebsterConfig: MerriamWebsterConfig;

  constructor(merriamWebsterApiKey?: string) {
    this.merriamWebsterConfig = {
      apiKey: merriamWebsterApiKey,
      enabled: !!merriamWebsterApiKey
    };
  }

  /**
   * Fetch word data using Free Dictionary API
   * Note: Works well for English, limited Spanish support
   */
  private async fetchFromFreeDictionary(word: string, lang: 'es' | 'en' = 'es'): Promise<WordData | null> {
    try {
      const response = await axios.get<FreeDictionaryResponse[]>(
        `${this.freeDictionaryBaseURL}/${lang}/${encodeURIComponent(word)}`,
        { timeout: 5000 }
      );

      if (!response.data || response.data.length === 0) {
        return null;
      }

      const data = response.data[0];

      return {
        word: data.word,
        phonetic: data.phonetic || data.phonetics?.[0]?.text,
        audioUrl: data.phonetics?.find(p => p.audio)?.audio,
        meanings: data.meanings.map(meaning => ({
          partOfSpeech: meaning.partOfSpeech,
          definitions: meaning.definitions.map(def => ({
            definition: def.definition,
            example: def.example,
            synonyms: def.synonyms,
            antonyms: def.antonyms
          }))
        })),
        origin: data.origin,
        source: 'free-dictionary'
      };
    } catch (error) {
      // API returned error (404, network issue, etc.)
      return null;
    }
  }

  /**
   * Fetch Spanish word data using Spanish Dict unofficial API
   * This provides Spanish-Spanish definitions
   */
  private async fetchFromSpanishDict(word: string): Promise<WordData | null> {
    try {
      // Try unofficial Spanish dictionary API
      const response = await axios.get(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        { timeout: 5000 }
      );

      if (!response.data || response.data.length === 0) {
        return null;
      }

      const data = response.data[0];

      // For now, this gives us English definitions which can be useful for learning
      // In future, we could translate these or use a proper Spanish dictionary
      return {
        word: data.word,
        phonetic: data.phonetic || data.phonetics?.[0]?.text,
        audioUrl: data.phonetics?.find((p: any) => p.audio)?.audio,
        meanings: data.meanings.map((meaning: any) => ({
          partOfSpeech: meaning.partOfSpeech,
          definitions: meaning.definitions.map((def: any) => ({
            definition: def.definition,
            example: def.example,
            synonyms: def.synonyms,
            antonyms: def.antonyms
          }))
        })),
        origin: data.origin,
        source: 'free-dictionary'
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch word data using Merriam-Webster Spanish-English Dictionary API
   */
  private async fetchFromMerriamWebster(word: string): Promise<WordData | null> {
    if (!this.merriamWebsterConfig.enabled || !this.merriamWebsterConfig.apiKey) {
      return null;
    }

    try {
      const response = await axios.get<MerriamWebsterResponse[]>(
        `${this.merriamWebsterBaseURL}/${encodeURIComponent(word)}`,
        {
          params: { key: this.merriamWebsterConfig.apiKey },
          timeout: 5000
        }
      );

      if (!response.data || response.data.length === 0) {
        return null;
      }

      const data = response.data[0];

      // Check if response is a valid entry (not just suggestions)
      if (!data.meta || !data.shortdef) {
        return null;
      }

      // Extract audio URL if available
      let audioUrl: string | undefined;
      if (data.hwi?.prs?.[0]?.sound?.audio) {
        const audioFile = data.hwi.prs[0].sound.audio;
        // Merriam-Webster audio URL construction
        const subdirectory = audioFile.startsWith('bix') ? 'bix' :
                           audioFile.startsWith('gg') ? 'gg' :
                           audioFile[0];
        audioUrl = `https://media.merriam-webster.com/audio/prons/es/es/mp3/${subdirectory}/${audioFile}.mp3`;
      }

      return {
        word: data.meta.id,
        phonetic: data.hwi?.prs?.[0]?.mw,
        audioUrl,
        meanings: [{
          partOfSpeech: data.fl || 'unknown',
          definitions: data.shortdef.map(def => ({
            definition: def,
            example: undefined,
            synonyms: undefined,
            antonyms: undefined
          }))
        }],
        source: 'merriam-webster'
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch word data with fallback strategy
   * 1. Try Free Dictionary API (Spanish)
   * 2. Try Merriam-Webster API (if configured)
   * 3. Return null if all fail
   */
  async fetchWordData(word: string): Promise<WordData | null> {
    // Try Free Dictionary API first (unlimited, free)
    let data = await this.fetchFromFreeDictionary(word, 'es');
    if (data) return data;

    // Fallback to Merriam-Webster if configured
    if (this.merriamWebsterConfig.enabled) {
      data = await this.fetchFromMerriamWebster(word);
      if (data) return data;
    }

    // All APIs failed
    return null;
  }

  /**
   * Extract just example sentences from word data
   */
  getExampleSentences(wordData: WordData): string[] {
    const examples: string[] = [];

    for (const meaning of wordData.meanings) {
      for (const definition of meaning.definitions) {
        if (definition.example) {
          examples.push(definition.example);
        }
      }
    }

    return examples;
  }

  /**
   * Extract all definitions from word data
   */
  getDefinitions(wordData: WordData): Array<{ definition: string; partOfSpeech: string }> {
    const definitions: Array<{ definition: string; partOfSpeech: string }> = [];

    for (const meaning of wordData.meanings) {
      for (const definition of meaning.definitions) {
        definitions.push({
          definition: definition.definition,
          partOfSpeech: meaning.partOfSpeech
        });
      }
    }

    return definitions;
  }

  /**
   * Get a simple summary of the word
   */
  getSummary(wordData: WordData): {
    word: string;
    mainDefinition: string;
    partOfSpeech: string;
    exampleSentence?: string;
  } {
    const firstMeaning = wordData.meanings[0];
    const firstDefinition = firstMeaning.definitions[0];

    return {
      word: wordData.word,
      mainDefinition: firstDefinition.definition,
      partOfSpeech: firstMeaning.partOfSpeech,
      exampleSentence: firstDefinition.example
    };
  }

  /**
   * Fetch real example sentences from SpanishDict.com
   * This provides actual Spanish sentences used in context with English translations
   */
  async fetchRealExampleSentences(word: string): Promise<Array<{ spanish: string; english: string }>> {
    try {
      // Scrape SpanishDict for real example sentences
      const url = `https://www.spanishdict.com/translate/${encodeURIComponent(word)}`;
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const examples: Array<{ spanish: string; english: string }> = [];
      const seenSpanish = new Set<string>();

      // Find Spanish example sentences and their English translations
      // SpanishDict pairs Spanish [lang="es"] with English [lang="en"] as siblings
      $('[lang="es"]').each((_i, elem) => {
        const spanish = $(elem).text().trim();

        // Filter for actual sentences (reasonable length, contains space, not too long)
        if (spanish && spanish.length > 20 && spanish.length < 200 && spanish.includes(' ') && !seenSpanish.has(spanish)) {
          // Look for English translation as a sibling
          const englishSibling = $(elem).siblings('[lang="en"]');

          if (englishSibling.length > 0) {
            const english = englishSibling.first().text().trim();

            // Only add if we found a valid English translation
            if (english && english.length > 0 && english.length < 200) {
              seenSpanish.add(spanish);
              examples.push({ spanish, english });
            }
          }
        }
      });

      // Return up to 10 unique examples
      return examples.slice(0, 10);
    } catch (error) {
      console.error('SpanishDict scraping error:', error);
      return [];
    }
  }
}
