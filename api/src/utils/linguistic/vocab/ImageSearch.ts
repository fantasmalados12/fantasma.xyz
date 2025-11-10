
import axios from "axios";

export async function getImageFromBingFromTerm(term: string): Promise<any> {

        const options = {
        method: 'GET',
        url: 'https://real-time-image-search.p.rapidapi.com/search',
        params: {
            query: term,
            limit: '1',
            size: 'any',
            color: 'any',
            type: 'any',
            time: 'any',
            usage_rights: 'any',
            file_type: 'any',
            aspect_ratio: 'any',
            safe_search: 'off',
            region: 'us'
        },
        headers: {
            'x-rapidapi-key': '141bf5a5admsh10a9cc334089fccp19225fjsn4f016830d173',
            'x-rapidapi-host': 'real-time-image-search.p.rapidapi.com'
        }
        };

    const response = await axios.request(options);

    return response.data;


}
