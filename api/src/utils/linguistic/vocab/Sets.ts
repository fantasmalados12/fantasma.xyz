import { postgres } from "../../..";

export type TermSet = {
    term: string,
    definition: string,
    cognateScore: number
};

export type VocabSet = {
    id: number,
    account_id: string,
    title: string,
    terms: TermSet,
    created_at: Date,
    updated_at: Date
};

// Get the vocab sets for account
export async function getVocabSetsForAccount(account_id: string): Promise<VocabSet[]> {

    // Query the database
    const query: string = `SELECT * FROM vocab_sets WHERE account_id = $1`;
    const values: any[] = [account_id];
    const vocab_sets = await postgres.query(query, values);

    // Placeholder for database fetch logic
    return vocab_sets.rows;
    
}

// Create vocab set
export async function createVocabSet(account_id: string, title: string, terms: any): Promise<boolean> {

    // Insert into database
    const query: string = `INSERT INTO vocab_sets (account_id, title, terms, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())`;
    const values: any[] = [account_id, title, JSON.stringify(terms)];
    await postgres.query(query, values);
    
    return true;        

}

// Update vocab set
export async function updateVocabSet(id: number, title: string, terms: TermSet): Promise<boolean> {

    // Update database
    const query: string = `UPDATE vocab_sets SET title = $1, terms = $2, updated_at = NOW() WHERE id = $3`;
    const values: any[] = [title, terms, id];
    await postgres.query(query, values);
    
    return true;        

}

// Delete vocab set
export async function deleteVocabSet(id: number): Promise<boolean> {

    // Delete from database
    const query: string = `DELETE FROM vocab_sets WHERE id = $1`;
    const values: any[] = [id];
    await postgres.query(query, values);
    
    return true;        

}

export async function getRecentSets(account_id: string): Promise<VocabSet[]> {

    // Query the database
    const query: string = `SELECT
        id,
        title,
        ROUND(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400, 1) AS days_since_update
    FROM vocab_sets
    WHERE account_id=$1
    ORDER BY updated_at DESC;
`;
    const values: any[] = [account_id];
    const vocab_sets = await postgres.query(query, values);

    // Placeholder for database fetch logic
    return vocab_sets.rows;
    
}   