import { Router, Request, Response } from 'express';
import { config, redis } from '..';
import { getImportCapabilities } from '../utils/types/ImportConfig';

const router = Router();

/**
 * GET /api/config/import
 * Get available import methods (respecting feature flags)
 *
 * Response:
 * {
 *   csvEnabled: boolean,
 *   scrapeEnabled: boolean
 * }
 */
router.get('/import', async (req: Request, res: Response) => {
  try {
    const capabilities = getImportCapabilities(config);

    // Check feature flags from Redis
    const csvFeature = await redis.hget('feature_flags', 'csv_import');
    const scrapeFeature = await redis.hget('feature_flags', 'scraping');

    // Override with feature flags if they're set to false
    const csvEnabled = csvFeature === 'false' ? false : capabilities.csvEnabled;
    const scrapeEnabled = scrapeFeature === 'false' ? false : capabilities.scrapeEnabled;

    res.json({
      csvEnabled,
      scrapeEnabled
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get import configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/config/features
 * Get all feature flags (public endpoint)
 *
 * Response:
 * {
 *   scraping: boolean,
 *   learning: boolean,
 *   image_upload: boolean,
 *   csv_import: boolean,
 *   registration: boolean,
 *   api_access: boolean
 * }
 */
router.get('/features', async (req: Request, res: Response) => {
  try {
    const features = await redis.hgetall('feature_flags');

    // Default features if none exist
    const defaultFeatures = {
      scraping: 'true',
      learning: 'true',
      image_upload: 'true',
      csv_import: 'true',
      registration: 'true',
      api_access: 'true'
    };

    const currentFeatures = Object.keys(defaultFeatures).reduce((acc, key) => {
      acc[key] = features[key] === 'false' ? false : true;
      return acc;
    }, {} as Record<string, boolean>);

    res.json(currentFeatures);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get feature flags',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
