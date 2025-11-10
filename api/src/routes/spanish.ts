import { Router, Request, Response } from 'express';
import { getEveryConjugationOfVerb, isVerbIrregular } from '../utils/linguistic/Conjugator';


const router = Router();

router.post('/conjugations', (req: Request, res: Response) => {

    const verb: string = req.body['verb'].toLowerCase();

    const allVerbConjugations = getEveryConjugationOfVerb(verb);

    res.json( allVerbConjugations );

});

router.post('/check-irregular', (req: Request, res: Response) => {

    const verb: string = req.body['verb'].toLowerCase();

    const irregular = isVerbIrregular(verb);

    res.json({ verb, irregular });

});

export default router;