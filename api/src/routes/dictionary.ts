import { Router, Request, Response } from 'express';
import { DictionaryAPI, WordData } from '../utils/linguistic/DictionaryAPI';
import { redis, config } from '..';
import { rateLimit, requireFeature } from '../middlewares/security';

const router = Router();

// Initialize Dictionary API (Merriam-Webster key will be loaded from config)
const dictionaryAPI = new DictionaryAPI(config?.dictionary?.merriamWebsterApiKey);

// Cache TTL: 7 days (604800 seconds)
const CACHE_TTL = 604800;

/**
 * GET /api/dictionary/word/:word
 * Get comprehensive word data (definitions, examples, audio, etc.)
 */
router.get('/word/:word', rateLimit(60000, 100), async (req: Request, res: Response) => {
  try {
    const { word } = req.params;

    if (!word || word.trim().length === 0) {
      return res.status(400).json({ error: 'Word parameter is required' });
    }

    const normalizedWord = word.toLowerCase().trim();
    const cacheKey = `dictionary:word:${normalizedWord}`;

    // Check Redis cache first
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const wordData: WordData = JSON.parse(cached);
        wordData.source = 'cache';
        return res.json({
          success: true,
          data: wordData,
          cached: true
        });
      }
    } catch (cacheError) {
      console.error('Redis cache read error:', cacheError);
      // Continue to API fetch if cache fails
    }

    // Fetch from API
    const wordData = await dictionaryAPI.fetchWordData(normalizedWord);

    if (!wordData) {
      return res.status(404).json({
        success: false,
        error: 'Word not found',
        message: `No dictionary data found for "${normalizedWord}". The word might not exist or may be misspelled.`
      });
    }

    // Cache the result
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(wordData));
    } catch (cacheError) {
      console.error('Redis cache write error:', cacheError);
      // Continue even if caching fails
    }

    return res.json({
      success: true,
      data: wordData,
      cached: false
    });

  } catch (error) {
    console.error('Dictionary API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch word data. Please try again later.'
    });
  }
});

/**
 * GET /api/dictionary/examples/:word
 * Get just example sentences for a word
 */
router.get('/examples/:word', rateLimit(60000, 100), async (req: Request, res: Response) => {
  try {
    const { word } = req.params;

    if (!word || word.trim().length === 0) {
      return res.status(400).json({ error: 'Word parameter is required' });
    }

    const normalizedWord = word.toLowerCase().trim();
    const cacheKey = `dictionary:examples:${normalizedWord}`;

    // Check cache for examples
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          word: normalizedWord,
          examples: JSON.parse(cached),
          cached: true
        });
      }
    } catch (cacheError) {
      console.error('Redis cache read error:', cacheError);
    }

    // Check if we have full word data cached
    const wordCacheKey = `dictionary:word:${normalizedWord}`;
    try {
      const cachedWordData = await redis.get(wordCacheKey);
      if (cachedWordData) {
        const wordData: WordData = JSON.parse(cachedWordData);
        const examples = dictionaryAPI.getExampleSentences(wordData);

        // Cache just the examples separately
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(examples));

        return res.json({
          success: true,
          word: normalizedWord,
          examples,
          cached: true
        });
      }
    } catch (cacheError) {
      console.error('Redis cache error:', cacheError);
    }

    // Fetch real example sentences from Reverso Context
    const examples = await dictionaryAPI.fetchRealExampleSentences(normalizedWord);

    // Cache the examples
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(examples));
    } catch (cacheError) {
      console.error('Redis cache write error:', cacheError);
    }

    return res.json({
      success: true,
      word: normalizedWord,
      examples,
      cached: false
    });

  } catch (error) {
    console.error('Dictionary API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch example sentences. Please try again later.'
    });
  }
});

/**
 * GET /api/dictionary/definitions/:word
 * Get just definitions for a word
 */
router.get('/definitions/:word', rateLimit(60000, 100), async (req: Request, res: Response) => {
  try {
    const { word } = req.params;

    if (!word || word.trim().length === 0) {
      return res.status(400).json({ error: 'Word parameter is required' });
    }

    const normalizedWord = word.toLowerCase().trim();
    const cacheKey = `dictionary:definitions:${normalizedWord}`;

    // Check cache
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          word: normalizedWord,
          definitions: JSON.parse(cached),
          cached: true
        });
      }
    } catch (cacheError) {
      console.error('Redis cache read error:', cacheError);
    }

    // Check if we have full word data cached
    const wordCacheKey = `dictionary:word:${normalizedWord}`;
    try {
      const cachedWordData = await redis.get(wordCacheKey);
      if (cachedWordData) {
        const wordData: WordData = JSON.parse(cachedWordData);
        const definitions = dictionaryAPI.getDefinitions(wordData);

        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(definitions));

        return res.json({
          success: true,
          word: normalizedWord,
          definitions,
          cached: true
        });
      }
    } catch (cacheError) {
      console.error('Redis cache error:', cacheError);
    }

    // Fetch from API
    const wordData = await dictionaryAPI.fetchWordData(normalizedWord);

    if (!wordData) {
      return res.status(404).json({
        success: false,
        error: 'Word not found',
        message: `No definitions found for "${normalizedWord}".`
      });
    }

    const definitions = dictionaryAPI.getDefinitions(wordData);

    // Cache results
    try {
      await redis.setex(wordCacheKey, CACHE_TTL, JSON.stringify(wordData));
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(definitions));
    } catch (cacheError) {
      console.error('Redis cache write error:', cacheError);
    }

    return res.json({
      success: true,
      word: normalizedWord,
      definitions,
      cached: false
    });

  } catch (error) {
    console.error('Dictionary API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch definitions. Please try again later.'
    });
  }
});

/**
 * GET /api/dictionary/summary/:word
 * Get a quick summary (main definition + example) for a word
 */
router.get('/summary/:word', rateLimit(60000, 100), async (req: Request, res: Response) => {
  try {
    const { word } = req.params;

    if (!word || word.trim().length === 0) {
      return res.status(400).json({ error: 'Word parameter is required' });
    }

    const normalizedWord = word.toLowerCase().trim();
    const cacheKey = `dictionary:summary:${normalizedWord}`;

    // Check cache
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          ...JSON.parse(cached),
          cached: true
        });
      }
    } catch (cacheError) {
      console.error('Redis cache read error:', cacheError);
    }

    // Check if we have full word data cached
    const wordCacheKey = `dictionary:word:${normalizedWord}`;
    try {
      const cachedWordData = await redis.get(wordCacheKey);
      if (cachedWordData) {
        const wordData: WordData = JSON.parse(cachedWordData);
        const summary = dictionaryAPI.getSummary(wordData);

        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(summary));

        return res.json({
          success: true,
          ...summary,
          cached: true
        });
      }
    } catch (cacheError) {
      console.error('Redis cache error:', cacheError);
    }

    // Fetch from API
    const wordData = await dictionaryAPI.fetchWordData(normalizedWord);

    if (!wordData) {
      return res.status(404).json({
        success: false,
        error: 'Word not found',
        message: `No data found for "${normalizedWord}".`
      });
    }

    const summary = dictionaryAPI.getSummary(wordData);

    // Cache results
    try {
      await redis.setex(wordCacheKey, CACHE_TTL, JSON.stringify(wordData));
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(summary));
    } catch (cacheError) {
      console.error('Redis cache write error:', cacheError);
    }

    return res.json({
      success: true,
      ...summary,
      cached: false
    });

  } catch (error) {
    console.error('Dictionary API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch word summary. Please try again later.'
    });
  }
});

/**
 * POST /api/dictionary/batch
 * Get data for multiple words at once
 */
router.post('/batch', rateLimit(60000, 20), async (req: Request, res: Response) => {
  try {
    const { words } = req.body;

    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({
        error: 'Words array is required',
        message: 'Please provide an array of words to look up.'
      });
    }

    if (words.length > 50) {
      return res.status(400).json({
        error: 'Too many words',
        message: 'Maximum 50 words per batch request.'
      });
    }

    const results: Record<string, WordData | null> = {};
    const promises = words.map(async (word: string) => {
      const normalizedWord = word.toLowerCase().trim();
      const cacheKey = `dictionary:word:${normalizedWord}`;

      // Try cache first
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const wordData: WordData = JSON.parse(cached);
          wordData.source = 'cache';
          results[normalizedWord] = wordData;
          return;
        }
      } catch (cacheError) {
        console.error('Redis cache error:', cacheError);
      }

      // Fetch from API
      const wordData = await dictionaryAPI.fetchWordData(normalizedWord);
      results[normalizedWord] = wordData;

      // Cache if successful
      if (wordData) {
        try {
          await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(wordData));
        } catch (cacheError) {
          console.error('Redis cache write error:', cacheError);
        }
      }
    });

    await Promise.all(promises);

    return res.json({
      success: true,
      count: words.length,
      results
    });

  } catch (error) {
    console.error('Dictionary batch API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch word data. Please try again later.'
    });
  }
});

export default router;
