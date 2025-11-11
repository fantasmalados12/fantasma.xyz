import { Router, Request, Response } from 'express';
import { scrapeQuizlet } from '../utils/scraping/Scraper';
import { Parser } from 'json2csv';
import { generateVocabStats } from '../utils/linguistic/Stats';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!url.includes('quizlet.com')) {
      return res.status(400).json({ error: 'Invalid Quizlet URL' });
    }

  const takeScreenshots = false;
  const quizletData = await scrapeQuizlet(url, { takeScreenshots });

    if (quizletData.terms.length === 0) {
      return res.status(404).json({
        error: 'No terms found. The set might be private or the page structure has changed.'
      });
    }

    // const parser = new Parser({ fields: ['term', 'definition'] });
    // const csv = parser.parse(quizletData.terms);

    // res.header('Content-Type', 'text/csv');
    // res.attachment('quizlet-export.csv');
    // res.send(csv);

    const vocabStats = generateVocabStats(quizletData.terms);

    res.json({ vocabStats, title: quizletData.title });

  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to scrape Quizlet',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;