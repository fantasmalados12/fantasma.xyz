import { Router, Request, Response } from 'express';
import { getEveryConjugationOfVerb } from '../utils/linguistic/Conjugator';


const router = Router();

router.post('/conjugations', (req: Request, res: Response) => {

    const verb: string = req.body['verb'].toLowerCase();

    const allVerbConjugations = getEveryConjugationOfVerb(verb);

    res.json( allVerbConjugations );

});

export default router;