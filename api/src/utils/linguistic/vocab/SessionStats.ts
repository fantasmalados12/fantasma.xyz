import { postgres } from "../../..";

export type SessionResult = {
    account_id: string;
    vocab_set_id: number;
    total_questions: number;
    correct_answers: number;
    incorrect_answers: number;
    accuracy: number;
    session_duration?: number;
    study_mode: string;
    question_types_used: string;
    struggled_terms: any[];
    mastered_terms: any[];
};

export type VocabSetStats = {
    total_sessions: number;
    average_accuracy: number;
    total_questions_answered: number;
    total_correct: number;
    total_incorrect: number;
    best_accuracy: number;
    recent_sessions: any[];
    most_struggled_terms: any[];
    most_mastered_terms: any[];
    study_mode_breakdown: any;
    accuracy_trend: any[];
    total_study_time: number;
    average_session_duration: number;
};

// Save a learning session result
export async function saveSessionResult(result: SessionResult): Promise<boolean> {
    const query = `
        INSERT INTO learning_sessions (
            account_id, vocab_set_id, total_questions, correct_answers,
            incorrect_answers, accuracy, session_duration, study_mode,
            question_types_used, struggled_terms, mastered_terms, session_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    `;

    const values = [
        result.account_id,
        result.vocab_set_id,
        result.total_questions,
        result.correct_answers,
        result.incorrect_answers,
        result.accuracy,
        result.session_duration || 0,
        result.study_mode,
        result.question_types_used,
        JSON.stringify(result.struggled_terms),
        JSON.stringify(result.mastered_terms),
    ];

    await postgres.query(query, values);
    return true;
}

// Get comprehensive statistics for a vocab set
export async function getVocabSetStats(
    account_id: string,
    vocab_set_id: number
): Promise<VocabSetStats | null> {
    // Get all sessions for this vocab set
    const sessionsQuery = `
        SELECT * FROM learning_sessions
        WHERE account_id = $1 AND vocab_set_id = $2
        ORDER BY session_date DESC
    `;
    const sessionsResult = await postgres.query(sessionsQuery, [account_id, vocab_set_id]);
    const sessions = sessionsResult.rows;

    if (sessions.length === 0) {
        return null;
    }

    // Calculate aggregate statistics
    const totalSessions = sessions.length;
    const totalQuestions = sessions.reduce((sum, s) => sum + s.total_questions, 0);
    const totalCorrect = sessions.reduce((sum, s) => sum + s.correct_answers, 0);
    const totalIncorrect = sessions.reduce((sum, s) => sum + s.incorrect_answers, 0);
    const averageAccuracy = sessions.reduce((sum, s) => sum + parseFloat(s.accuracy), 0) / totalSessions;
    const bestAccuracy = Math.max(...sessions.map(s => parseFloat(s.accuracy)));
    const totalStudyTime = sessions.reduce((sum, s) => sum + (s.session_duration || 0), 0);
    const averageSessionDuration = totalStudyTime / totalSessions;

    // Get recent 5 sessions
    const recentSessions = sessions.slice(0, 5).map(s => ({
        date: s.session_date,
        accuracy: parseFloat(s.accuracy),
        correct: s.correct_answers,
        incorrect: s.incorrect_answers,
        total: s.total_questions,
    }));

    // Calculate most struggled terms (terms that appear most in struggled_terms)
    const struggledTermsMap = new Map<string, number>();
    sessions.forEach(s => {
        try {
            const terms = JSON.parse(s.struggled_terms);
            terms.forEach((term: any) => {
                const key = term.term;
                struggledTermsMap.set(key, (struggledTermsMap.get(key) || 0) + 1);
            });
        } catch (e) {}
    });

    const mostStruggledTerms = Array.from(struggledTermsMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([term, count]) => ({ term, count }));

    // Calculate most mastered terms
    const masteredTermsMap = new Map<string, number>();
    sessions.forEach(s => {
        try {
            const terms = JSON.parse(s.mastered_terms);
            terms.forEach((term: any) => {
                const key = term.term;
                masteredTermsMap.set(key, (masteredTermsMap.get(key) || 0) + 1);
            });
        } catch (e) {}
    });

    const mostMasteredTerms = Array.from(masteredTermsMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([term, count]) => ({ term, count }));

    // Study mode breakdown
    const studyModeBreakdown: any = {};
    sessions.forEach(s => {
        studyModeBreakdown[s.study_mode] = (studyModeBreakdown[s.study_mode] || 0) + 1;
    });

    // Accuracy trend (last 10 sessions)
    const accuracyTrend = sessions.slice(0, 10).reverse().map((s, idx) => ({
        session: idx + 1,
        accuracy: parseFloat(s.accuracy),
    }));

    return {
        total_sessions: totalSessions,
        average_accuracy: Math.round(averageAccuracy * 100) / 100,
        total_questions_answered: totalQuestions,
        total_correct: totalCorrect,
        total_incorrect: totalIncorrect,
        best_accuracy: Math.round(bestAccuracy * 100) / 100,
        recent_sessions: recentSessions,
        most_struggled_terms: mostStruggledTerms,
        most_mastered_terms: mostMasteredTerms,
        study_mode_breakdown: studyModeBreakdown,
        accuracy_trend: accuracyTrend,
        total_study_time: totalStudyTime,
        average_session_duration: Math.round(averageSessionDuration),
    };
}
