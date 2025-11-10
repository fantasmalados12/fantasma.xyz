import { Router, Request, Response } from 'express';
import { getLearnProgress, saveLearnProgress, deleteLearnProgress } from '../utils/linguistic/vocab/LearnProgress';

const router = Router();

// GET /api/learnprogress/:account_id/:vocab_set_id - Get progress for a vocab set
router.get('/:account_id/:vocab_set_id', async (req: Request, res: Response) => {
    try {
        const { account_id, vocab_set_id } = req.params;

        if (!account_id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const progress = await getLearnProgress(account_id, parseInt(vocab_set_id));

        if (!progress) {
            return res.status(404).json({ error: 'No progress found' });
        }

        return res.json({ progress });
    } catch (error) {
        console.error('Error fetching learn progress:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/learnprogress - Save or update progress
router.post('/', async (req: Request, res: Response) => {
    try {
        const { account_id, vocab_set_id, progress } = req.body;

        if (!account_id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!vocab_set_id || !progress) {
            return res.status(400).json({ error: 'vocab_set_id and progress are required' });
        }

        await saveLearnProgress(account_id, vocab_set_id, progress);
        return res.status(200).json({ message: 'Progress saved successfully' });
    } catch (error) {
        console.error('Error saving learn progress:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/learnprogress/:account_id/:vocab_set_id - Delete progress (restart)
router.delete('/:account_id/:vocab_set_id', async (req: Request, res: Response) => {
    try {
        const { account_id, vocab_set_id } = req.params;

        if (!account_id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        await deleteLearnProgress(account_id, parseInt(vocab_set_id));
        return res.status(200).json({ message: 'Progress deleted successfully' });
    } catch (error) {
        console.error('Error deleting learn progress:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
