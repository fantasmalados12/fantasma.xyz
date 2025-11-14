
import axios from "axios";
import { getAPIUrlBasedOffEnviornment } from "./API";

export async function getRecentVocabSets(account_id: string): Promise<any> {

    try {
        const response = await axios.get(`${getAPIUrlBasedOffEnviornment()}/api/vocabsets/vocab-sets/recents/${account_id}`);

        console.log(response);
        return response.data;

    } catch(e) {

        console.log(e);
        return [];

    }   
}

export async function getIrregularVerbs(verb: any): Promise<any> {

    const response = await axios.post(`${getAPIUrlBasedOffEnviornment()}/api/spanish/check-irregular`, {
        verb: verb
    });

    return response.data;

}

export async function getStemChangingVerbs(verb: any): Promise<any> {

    const response = await axios.post(`${getAPIUrlBasedOffEnviornment()}/api/spanish/check-stem-changing`, {
        verb: verb
    });

    return response.data;

}

export async function getImagesFromSet(set_id: number): Promise<any> {

    try {
        const response = await axios.get(`${getAPIUrlBasedOffEnviornment()}/api/vocabsets/vocab-sets/vocab-image/${set_id}`);

        return response.data;

    } catch(e) {

        console.log(e);
        return [];

    }   
}

export async function addImageToTerm(set_id: any, term: string): Promise<any> {

    try {
        const response = await axios.post(`${getAPIUrlBasedOffEnviornment()}/api/vocabsets/vocab-sets/add-image`, {
            id: set_id,
            term: term
        });

        return response.data;

    } catch(e) {

        console.log(e);
        return null;

    }   
}

export async function addLibrarySet(setName: string, terms: any, userId: string): Promise<boolean> {

    try {

        // Placeholder for adding set to library logic

        await axios.post(`${getAPIUrlBasedOffEnviornment()}/api/vocabsets/vocab-sets`, {
            account_id: userId,
            title: setName,
            terms: terms
        });


        return true;

    } catch(e) {

        return false;

    }

}   

export async function getLibrarySets(account_id: string): Promise<any> {

    try {
        const response = await axios.get(`${getAPIUrlBasedOffEnviornment()}/api/vocabsets/vocab-sets/${account_id}`);

        return response.data;

    } catch(e) {

        console.log(e);
        return [];

    }

}

export async function deleteLibrarySet(setId: any): Promise<boolean> {

    try {
        await axios.delete(`${getAPIUrlBasedOffEnviornment()}/api/vocabsets/vocab-sets/${setId}`);
        return true;

    } catch(e) {

        console.log(e);
        return false;

    }

}   
