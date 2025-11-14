import { Router, Request, Response } from 'express';
import { getVocabSetsForAccount, createVocabSet, updateVocabSet, deleteVocabSet, TermSet, getRecentSets } from '../utils/linguistic/vocab/Sets';
import { getImageFromBingFromTerm } from '../utils/linguistic/vocab/ImageSearch';
import { postgres } from '..';

const router = Router();

// GET /api/vocab-sets - Get all vocab sets for authenticated user
router.get('/vocab-sets/:account_id', async (req: Request, res: Response) => {
    try {
        const account_id = req.params['account_id']; // Adjust based on your auth middleware
        
        if (!account_id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const vocabSets = await getVocabSetsForAccount(account_id);

        return res.json({ vocabSets: vocabSets})
    } catch (error) {
        console.error('Error fetching vocab sets:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/vocab-sets/vocab-image/:id", async (req: Request, res: Response) => {
    const set_id = req.params['id'];

    const query: string = "SELECT * FROM vocab_images WHERE vocab_set_id = $1";
    const values: any[] = [set_id];

    const result = await postgres.query(query, values);

    res.json({ images: result.rows });  

});

router.post('/vocab-sets/add-image', async (req: Request, res: Response) => {

    const set_id: number = req.body['id'];
    const term: string = req.body['term'];

    const check_query: string = `SELECT * FROM vocab_images WHERE associated_term=$1`;
    const check_values = [term];
    const checked_queries = await postgres.query(check_query, check_values);

    if (checked_queries.rows.length > 0) {
        return res.json({ success: true, prexist: true, image_url: checked_queries.rows[0].image_url});
    }

    const image_body: any = await getImageFromBingFromTerm(term);
    const image_url: string = image_body.data[0].thumbnail_url;

    const query: string = "INSERT INTO vocab_images (vocab_set_id, associated_term, image_url, created_at) VALUES ($1, $2, $3, NOW())";
    const values: any[] = [set_id, term, image_url];

    await postgres.query(query, values);

    // console.log(set_id, term, image_url);

    res.json({ success: true, image_url: image_url });

});


router.get('/vocab-sets/recents/:account_id', async (req: Request, res: Response) => {
    try {
        const account_id = req.params['account_id']; // Adjust based on your auth middleware
        
        if (!account_id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const vocabSets = await getRecentSets(account_id);

        return res.json({ recentVocabSets: vocabSets}) 
    }
    catch (error) {
        console.error('Error fetching recent vocab sets:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/vocab-sets - Create new vocab set
router.post('/vocab-sets', async (req: Request, res: Response) => {
    try {
        const account_id = req.body['account_id']; // Adjust based on your auth middleware
        
        if (!account_id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const { title, terms } = req.body;
        
        if (!title || !terms) {
            return res.status(400).json({ error: 'Title and terms are required' });
        }
        
        await createVocabSet(account_id, title, terms);
        return res.status(201).json({ message: 'Vocab set created successfully' });
    } catch (error) {
        console.error('Error creating vocab set:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/vocab-sets/:id - Update vocab set
router.put('/vocab-sets/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, terms } = req.body;
        
        if (!title || !terms) {
            return res.status(400).json({ error: 'Title and terms are required' });
        }
        
        await updateVocabSet(parseInt(id), title, terms);
        return res.status(200).json({ message: 'Vocab set updated successfully' });
    } catch (error) {
        console.error('Error updating vocab set:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/vocab-sets/:id - Delete vocab set
router.delete('/vocab-sets/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        await deleteVocabSet(parseInt(id));
        return res.status(200).json({ message: 'Vocab set deleted successfully' });
    } catch (error) {
        console.error('Error deleting vocab set:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;