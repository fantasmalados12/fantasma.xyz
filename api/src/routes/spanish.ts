import { Router, Request, Response } from 'express';
import { getEveryConjugationOfVerb, isVerbIrregular, isVerbStemChanging } from '../utils/linguistic/Conjugator';


const router = Router();

router.post('/conjugations', (req: Request, res: Response) => {

    const verb: string = req.body['verb'].toLowerCase();

    const allVerbConjugations = getEveryConjugationOfVerb(verb);

    res.json( allVerbConjugations );

});

router.get('/conjugations/:verb', (req: Request, res: Response) => {

    const verb: string = req.params.verb.toLowerCase();

    const allVerbConjugations = getEveryConjugationOfVerb(verb);

    res.json({ conjugations: allVerbConjugations });

});

router.post('/check-irregular', (req: Request, res: Response) => {

    const verb: string = req.body['verb'].toLowerCase();

    const irregular = isVerbIrregular(verb);

    res.json({ verb, irregular });

});

router.post('/check-stem-changing', (req: Request, res: Response) => {

    const verb: string = req.body['verb'].toLowerCase();

    const stemChanging = isVerbStemChanging(verb);

    res.json({ verb, stemChanging });

});

export default router;