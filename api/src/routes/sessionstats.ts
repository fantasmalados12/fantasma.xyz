import { Router, Request, Response } from 'express';
import { saveSessionResult, getVocabSetStats } from '../utils/linguistic/vocab/SessionStats';

const router = Router();

// POST /api/sessionstats - Save session result
router.post('/', async (req: Request, res: Response) => {
    try {
        const { account_id, vocab_set_id, session_result } = req.body;

        if (!account_id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!vocab_set_id || !session_result) {
            return res.status(400).json({ error: 'vocab_set_id and session_result are required' });
        }

        await saveSessionResult({
            account_id,
            vocab_set_id,
            ...session_result,
        });

        return res.status(200).json({ message: 'Session result saved successfully' });
    } catch (error) {
        console.error('Error saving session result:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/sessionstats/:account_id/:vocab_set_id - Get stats for a vocab set
router.get('/:account_id/:vocab_set_id', async (req: Request, res: Response) => {
    try {
        const { account_id, vocab_set_id } = req.params;

        if (!account_id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const stats = await getVocabSetStats(account_id, parseInt(vocab_set_id));

        if (!stats) {
            return res.status(404).json({ error: 'No stats found' });
        }

        return res.json({ stats });
    } catch (error) {
        console.error('Error fetching session stats:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
