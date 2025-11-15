import { Router, Request, Response } from 'express';
import { postgres } from '../index.js';
import { AnalyticsEngine } from '../utils/analytics/AnalyticsEngine.js';

const router = Router();
const analytics = new AnalyticsEngine(postgres);

  /**
   * GET /api/analytics/velocity/:account_id
   * Get learning velocity (words learned per day)
   */
  router.get('/velocity/:account_id', async (req: Request, res: Response) => {
    try {
      const { account_id } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      if (!account_id) {
        return res.status(400).json({ error: 'Account ID is required' });
      }

      const velocity = await analytics.calculateVelocity(account_id, days);
      res.json(velocity);
    } catch (error) {
      console.error('Error fetching velocity data:', error);
      res.status(500).json({ error: 'Failed to fetch velocity data' });
    }
  });

  /**
   * GET /api/analytics/weak-areas/:account_id
   * Get most struggled terms
   */
  router.get('/weak-areas/:account_id', async (req: Request, res: Response) => {
    try {
      const { account_id } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!account_id) {
        return res.status(400).json({ error: 'Account ID is required' });
      }

      const weakAreas = await analytics.identifyWeakAreas(account_id, limit);
      res.json(weakAreas);
    } catch (error) {
      console.error('Error fetching weak areas:', error);
      res.status(500).json({ error: 'Failed to fetch weak areas' });
    }
  });

  /**
   * GET /api/analytics/study-patterns/:account_id
   * Get performance by hour of day
   */
  router.get('/study-patterns/:account_id', async (req: Request, res: Response) => {
    try {
      const { account_id } = req.params;

      if (!account_id) {
        return res.status(400).json({ error: 'Account ID is required' });
      }

      const patterns = await analytics.analyzeStudyPatterns(account_id);
      res.json(patterns);
    } catch (error) {
      console.error('Error fetching study patterns:', error);
      res.status(500).json({ error: 'Failed to fetch study patterns' });
    }
  });

  /**
   * GET /api/analytics/pos-performance/:account_id
   * Get performance breakdown by part of speech
   */
  router.get('/pos-performance/:account_id', async (req: Request, res: Response) => {
    try {
      const { account_id } = req.params;

      if (!account_id) {
        return res.status(400).json({ error: 'Account ID is required' });
      }

      const posPerformance = await analytics.calculatePOSPerformance(account_id);
      res.json(posPerformance);
    } catch (error) {
      console.error('Error fetching POS performance:', error);
      res.status(500).json({ error: 'Failed to fetch POS performance' });
    }
  });

  /**
   * GET /api/analytics/cefr-estimate/:account_id
   * Get estimated CEFR level
   */
  router.get('/cefr-estimate/:account_id', async (req: Request, res: Response) => {
    try {
      const { account_id } = req.params;

      if (!account_id) {
        return res.status(400).json({ error: 'Account ID is required' });
      }

      const cefrEstimate = await analytics.estimateCEFRLevel(account_id);
      res.json(cefrEstimate);
    } catch (error) {
      console.error('Error estimating CEFR level:', error);
      res.status(500).json({ error: 'Failed to estimate CEFR level' });
    }
  });

  /**
   * GET /api/analytics/comparison/:account_id
   * Compare user to similar learners
   */
  router.get('/comparison/:account_id', async (req: Request, res: Response) => {
    try {
      const { account_id } = req.params;

      if (!account_id) {
        return res.status(400).json({ error: 'Account ID is required' });
      }

      const comparison = await analytics.compareToSimilarLearners(account_id);
      res.json(comparison);
    } catch (error) {
      console.error('Error comparing to similar learners:', error);
      res.status(500).json({ error: 'Failed to compare to similar learners' });
    }
  });

  /**
   * GET /api/analytics/session-trends/:account_id
   * Get session history with trends
   */
  router.get('/session-trends/:account_id', async (req: Request, res: Response) => {
    try {
      const { account_id } = req.params;
      const limit = parseInt(req.query.limit as string) || 30;

      if (!account_id) {
        return res.status(400).json({ error: 'Account ID is required' });
      }

      const trends = await analytics.getSessionTrends(account_id, limit);
      res.json(trends);
    } catch (error) {
      console.error('Error fetching session trends:', error);
      res.status(500).json({ error: 'Failed to fetch session trends' });
    }
  });

  /**
   * GET /api/analytics/retention/:account_id
   * Get vocabulary retention rates
   */
  router.get('/retention/:account_id', async (req: Request, res: Response) => {
    try {
      const { account_id } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!account_id) {
        return res.status(400).json({ error: 'Account ID is required' });
      }

      const retention = await analytics.calculateRetention(account_id, limit);
      res.json(retention);
    } catch (error) {
      console.error('Error fetching retention data:', error);
      res.status(500).json({ error: 'Failed to fetch retention data' });
    }
  });

  /**
   * GET /api/analytics/overview/:account_id
   * Get overall analytics overview
   */
  router.get('/overview/:account_id', async (req: Request, res: Response) => {
    try {
      const { account_id } = req.params;

      if (!account_id) {
        return res.status(400).json({ error: 'Account ID is required' });
      }

      const overview = await analytics.getOverview(account_id);
      res.json(overview);
    } catch (error) {
      console.error('Error fetching analytics overview:', error);
      res.status(500).json({ error: 'Failed to fetch analytics overview' });
    }
  });

export default router;
