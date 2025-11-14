import { Router, Request, Response } from 'express';
import { scrapeQuizlet } from '../utils/scraping/Scraper';
import { generateVocabStats } from '../utils/linguistic/Stats';
import { ProgressEmitter, ProgressEvent } from '../utils/scraping/ProgressEmitter';
import { config } from '..';
import { getImportCapabilities } from '../utils/types/ImportConfig';
import { requireFeature, rateLimit } from '../middlewares/security';

const router = Router();

// Apply rate limiting to streaming endpoint (30 requests per minute)
router.use(rateLimit(60000, 30));

/**
 * POST /api/scrape-stream
 *
 * Stream scraping progress via Server-Sent Events (SSE)
 *
 * Request body: { url: string }
 * Response: text/event-stream with progress events
 */
router.post('/', requireFeature('scraping'), async (req: Request, res: Response) => {
  // Check if scraping is enabled
  const capabilities = getImportCapabilities(config);
  if (!capabilities.scrapeEnabled) {
    res.status(403).json({
      error: 'Scraping is disabled',
      message: 'URL scraping is currently disabled in the configuration. Please use CSV import instead.'
    });
    return;
  }

  const { url } = req.body;

  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (error) {
    res.status(400).json({ error: 'Invalid URL format' });
    return;
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to scraper stream' })}\n\n`);

  // Create progress emitter
  const progressEmitter = new ProgressEmitter((event: ProgressEvent) => {
    // Send progress event to client
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  try {
    // Start scraping with progress emitter
    const takeScreenshots = process.env.NODE_ENV === 'development';
    const quizletData = await scrapeQuizlet(url, {
      takeScreenshots,
      progressEmitter,
    });

    // Generate vocab stats
    const vocabStats = generateVocabStats(quizletData.terms);

    // Send final success event with data
    const successEvent = {
      type: 'success',
      message: 'Scraping completed successfully',
      progress: 100,
      timestamp: Date.now(),
      data: {
        vocabStats,
        title: quizletData.title,
        termCount: quizletData.terms.length,
      },
    };

    res.write(`data: ${JSON.stringify(successEvent)}\n\n`);

    // End the stream
    res.end();
  } catch (error: any) {
    console.error('[SSE] Scraping error:', error.message);

    // Send error event
    const errorEvent = {
      type: 'error',
      message: error.message || 'An unknown error occurred',
      progress: 0,
      timestamp: Date.now(),
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
    };

    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);

    // End the stream
    res.end();
  }
});

export default router;
