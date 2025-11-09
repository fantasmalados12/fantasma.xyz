
import axios from "axios";

import { getAPIUrlBasedOffEnviornment } from "./API";

export async function scrapeURL(url: string): Promise<any> {

    try {

        const data = await axios.post(`${getAPIUrlBasedOffEnviornment()}/api/scrape`, {
            url: url
        });
        return data.data;

    } catch(e) {

    }

}

export async function getVerbConjugations(verb: string): Promise<any> {

    try {

        const data = await axios.post(`${getAPIUrlBasedOffEnviornment()}/api/spanish/conjugations`, {
            verb: verb
        });
        return data.data;

    } catch(e) {

    }

}   
