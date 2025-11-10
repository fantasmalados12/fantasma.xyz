import { postgres } from "../../..";

export type LearnProgress = {
    id: number;
    account_id: string;
    vocab_set_id: number;
    shuffled_terms: string; // JSON string
    current_index: number;
    answered_terms: string; // JSON string (array of indices)
    correct_answers: number;
    incorrect_answers: number;
    incorrect_terms: string; // JSON string
    term_confidence: string; // JSON string (map)
    study_mode: string;
    question_type_preference: string;
    selected_pos: string; // JSON string (array)
    is_retrying: boolean;
    retry_attempt: number;
    created_at: Date;
    updated_at: Date;
};

// Get learn progress for a specific vocab set
export async function getLearnProgress(
    account_id: string,
    vocab_set_id: number
): Promise<LearnProgress | null> {
    const query = `SELECT * FROM learn_progress WHERE account_id = $1 AND vocab_set_id = $2`;
    const values = [account_id, vocab_set_id];
    const result = await postgres.query(query, values);

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}

// Save or update learn progress
export async function saveLearnProgress(
    account_id: string,
    vocab_set_id: number,
    progress: {
        shuffled_terms: any[];
        current_index: number;
        answered_terms: number[];
        correct_answers: number;
        incorrect_answers: number;
        incorrect_terms: any[];
        term_confidence: { [key: number]: number } | Map<number, number>;
        study_mode: string;
        question_type_preference: string;
        selected_pos: string[];
        is_retrying: boolean;
        retry_attempt: number;
    }
): Promise<boolean> {
    // Convert complex types to JSON strings
    const shuffledTermsJson = JSON.stringify(progress.shuffled_terms);
    const answeredTermsJson = JSON.stringify(progress.answered_terms);
    const incorrectTermsJson = JSON.stringify(progress.incorrect_terms);

    // Handle term_confidence - it could be a Map or already an object
    const termConfidenceObj = progress.term_confidence instanceof Map
        ? Object.fromEntries(progress.term_confidence)
        : progress.term_confidence;
    const termConfidenceJson = JSON.stringify(termConfidenceObj);

    const selectedPosJson = JSON.stringify(progress.selected_pos);

    // Use UPSERT (INSERT ... ON CONFLICT ... UPDATE)
    const query = `
        INSERT INTO learn_progress (
            account_id, vocab_set_id, shuffled_terms, current_index,
            answered_terms, correct_answers, incorrect_answers, incorrect_terms,
            term_confidence, study_mode, question_type_preference, selected_pos,
            is_retrying, retry_attempt, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        ON CONFLICT (account_id, vocab_set_id)
        DO UPDATE SET
            shuffled_terms = $3,
            current_index = $4,
            answered_terms = $5,
            correct_answers = $6,
            incorrect_answers = $7,
            incorrect_terms = $8,
            term_confidence = $9,
            study_mode = $10,
            question_type_preference = $11,
            selected_pos = $12,
            is_retrying = $13,
            retry_attempt = $14,
            updated_at = NOW()
    `;

    const values = [
        account_id,
        vocab_set_id,
        shuffledTermsJson,
        progress.current_index,
        answeredTermsJson,
        progress.correct_answers,
        progress.incorrect_answers,
        incorrectTermsJson,
        termConfidenceJson,
        progress.study_mode,
        progress.question_type_preference,
        selectedPosJson,
        progress.is_retrying,
        progress.retry_attempt,
    ];

    await postgres.query(query, values);
    return true;
}

// Delete learn progress (for restart)
export async function deleteLearnProgress(
    account_id: string,
    vocab_set_id: number
): Promise<boolean> {
    const query = `DELETE FROM learn_progress WHERE account_id = $1 AND vocab_set_id = $2`;
    const values = [account_id, vocab_set_id];
    await postgres.query(query, values);
    return true;
}
