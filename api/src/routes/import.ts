import { Router, Request, Response } from 'express';
import { parseCSV, validateCSVSize } from '../utils/importing/CSVImporter';
import { generateVocabStats } from '../utils/linguistic/Stats';
import { config } from '..';
import { getImportCapabilities } from '../utils/types/ImportConfig';
import { requireFeature, rateLimit } from '../middlewares/security';

const router = Router();

// Apply rate limiting to import endpoint (60 requests per minute)
router.use(rateLimit(60000, 60));

/**
 * POST /api/import-csv
 * Import flashcard terms from CSV text
 *
 * Request body:
 * {
 *   csvText: string,
 *   title?: string
 * }
 *
 * Response:
 * {
 *   vocabStats: VocabStats,
 *   title: string
 * }
 */
router.post('/csv', requireFeature('csv_import'), async (req: Request, res: Response) => {
  try {
    // Check if CSV import is enabled
    const capabilities = getImportCapabilities(config);
    if (!capabilities.csvEnabled) {
      return res.status(403).json({
        error: 'CSV import is disabled',
        message: 'CSV import is currently disabled in the configuration'
      });
    }

    const { csvText, title } = req.body;

    if (!csvText) {
      return res.status(400).json({ error: 'csvText is required' });
    }

    if (typeof csvText !== 'string') {
      return res.status(400).json({ error: 'csvText must be a string' });
    }

    // Validate CSV size
    const maxSize = config.import?.csv?.max_size || 1000000;
    const sizeValidation = validateCSVSize(csvText, maxSize);

    if (!sizeValidation.valid) {
      return res.status(400).json({ error: sizeValidation.error });
    }

    // Parse CSV
    const maxTerms = config.import?.csv?.max_terms || 1000;
    const parseResult = parseCSV(csvText, { title, maxTerms });

    if (!parseResult.success || !parseResult.data) {
      return res.status(400).json({
        error: 'Failed to parse CSV',
        details: parseResult.error
      });
    }

    const quizletData = parseResult.data;

    if (quizletData.terms.length === 0) {
      return res.status(400).json({
        error: 'No terms found in CSV',
        details: 'Make sure your CSV has at least 2 columns: term,definition'
      });
    }

    // Generate vocab stats (same enrichment as scraping)
    const vocabStats = generateVocabStats(quizletData.terms);

    res.json({
      vocabStats,
      title: quizletData.title
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to import CSV',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
