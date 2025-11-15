import { Pool } from 'pg';

export interface VelocityData {
  date: string;
  wordsLearned: number;
}

export interface WeakArea {
  term: string;
  definition: string;
  attempts: number;
  accuracy: number;
}

export interface StudyPattern {
  hour: number;
  avgAccuracy: number;
  sessionCount: number;
}

export interface POSPerformance {
  pos: string;
  avgAccuracy: number;
  totalTerms: number;
  correctCount: number;
  incorrectCount: number;
}

export interface CEFREstimate {
  level: string;
  confidence: number;
  vocabSize: number;
  nextLevel: string | null;
  wordsToNextLevel: number;
}

export interface ComparisonData {
  userPercentile: number;
  userStats: {
    avgAccuracy: number;
    totalSessions: number;
    totalStudyTime: number;
    vocabSize: number;
  };
  avgStats: {
    avgAccuracy: number;
    totalSessions: number;
    totalStudyTime: number;
    vocabSize: number;
  };
}

export interface SessionTrend {
  date: string;
  accuracy: number;
  duration: number;
  mode: string;
  questionsAnswered: number;
}

export interface RetentionData {
  term: string;
  definition: string;
  firstSeen: string;
  lastAccuracy: number;
  retentionRate: number;
  timesReviewed: number;
}

export class AnalyticsEngine {
  constructor(private pool: Pool) {}

  /**
   * Calculate learning velocity (words learned per day)
   */
  async calculateVelocity(accountId: string, days: number = 30): Promise<VelocityData[]> {
    const query = `
      WITH date_series AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '${days} days',
          CURRENT_DATE,
          '1 day'::interval
        )::date AS date
      ),
      daily_mastered AS (
        SELECT
          DATE(session_date) as session_day,
          jsonb_array_elements_text(mastered_terms::jsonb) as term
        FROM learning_sessions
        WHERE account_id = $1
          AND session_date >= CURRENT_DATE - INTERVAL '${days} days'
      ),
      unique_daily_words AS (
        SELECT
          session_day,
          COUNT(DISTINCT term) as words_learned
        FROM daily_mastered
        GROUP BY session_day
      )
      SELECT
        ds.date::text,
        COALESCE(udw.words_learned, 0) as words_learned
      FROM date_series ds
      LEFT JOIN unique_daily_words udw ON ds.date = udw.session_day
      ORDER BY ds.date;
    `;

    const result = await this.pool.query(query, [accountId]);
    return result.rows.map(row => ({
      date: row.date,
      wordsLearned: parseInt(row.words_learned)
    }));
  }

  /**
   * Identify weak areas (most struggled terms)
   */
  async identifyWeakAreas(accountId: string, limit: number = 10): Promise<WeakArea[]> {
    const query = `
      WITH struggled AS (
        SELECT
          jsonb_array_elements(struggled_terms::jsonb) as term_data
        FROM learning_sessions
        WHERE account_id = $1
      ),
      term_stats AS (
        SELECT
          term_data->>'term' as term,
          term_data->>'definition' as definition,
          COUNT(*) as attempts,
          AVG(
            CASE
              WHEN (term_data->>'wasCorrect')::boolean THEN 100
              ELSE 0
            END
          ) as avg_accuracy
        FROM struggled
        WHERE term_data->>'term' IS NOT NULL
        GROUP BY term_data->>'term', term_data->>'definition'
      )
      SELECT
        term,
        definition,
        attempts::integer,
        ROUND(avg_accuracy::numeric, 2)::float as accuracy
      FROM term_stats
      ORDER BY avg_accuracy ASC, attempts DESC
      LIMIT $2;
    `;

    const result = await this.pool.query(query, [accountId, limit]);
    return result.rows;
  }

  /**
   * Analyze study time patterns (performance by hour of day)
   */
  async analyzeStudyPatterns(accountId: string): Promise<StudyPattern[]> {
    const query = `
      SELECT
        EXTRACT(HOUR FROM session_date)::integer as hour,
        AVG(accuracy)::float as avg_accuracy,
        COUNT(*)::integer as session_count
      FROM learning_sessions
      WHERE account_id = $1
      GROUP BY EXTRACT(HOUR FROM session_date)
      ORDER BY hour;
    `;

    const result = await this.pool.query(query, [accountId]);
    return result.rows.map(row => ({
      hour: row.hour,
      avgAccuracy: parseFloat(row.avg_accuracy?.toFixed(2) || '0'),
      sessionCount: row.session_count
    }));
  }

  /**
   * Calculate performance by part of speech
   */
  async calculatePOSPerformance(accountId: string): Promise<POSPerformance[]> {
    const query = `
      WITH session_terms AS (
        SELECT
          ls.accuracy,
          ls.total_questions,
          ls.correct_answers,
          ls.incorrect_answers,
          vs.terms
        FROM learning_sessions ls
        JOIN vocab_sets vs ON ls.vocab_set_id = vs.id
        WHERE ls.account_id = $1
      ),
      pos_data AS (
        SELECT
          jsonb_array_elements(st.terms::jsonb)->>'pos' as pos,
          st.accuracy,
          st.correct_answers,
          st.incorrect_answers
        FROM session_terms st
      )
      SELECT
        COALESCE(pos, 'unknown') as pos,
        AVG(accuracy)::float as avg_accuracy,
        COUNT(*)::integer as total_terms,
        SUM(correct_answers)::integer as correct_count,
        SUM(incorrect_answers)::integer as incorrect_count
      FROM pos_data
      WHERE pos IS NOT NULL
      GROUP BY pos
      ORDER BY avg_accuracy DESC;
    `;

    const result = await this.pool.query(query, [accountId]);
    return result.rows.map(row => ({
      pos: row.pos,
      avgAccuracy: parseFloat(row.avg_accuracy?.toFixed(2) || '0'),
      totalTerms: row.total_terms,
      correctCount: row.correct_count || 0,
      incorrectCount: row.incorrect_count || 0
    }));
  }

  /**
   * Estimate CEFR level based on vocabulary size and performance
   */
  async estimateCEFRLevel(accountId: string): Promise<CEFREstimate> {
    // Get unique mastered terms count
    const vocabQuery = `
      SELECT COUNT(DISTINCT term) as vocab_size
      FROM (
        SELECT jsonb_array_elements_text(mastered_terms::jsonb) as term
        FROM learning_sessions
        WHERE account_id = $1
      ) mastered;
    `;

    const accuracyQuery = `
      SELECT AVG(accuracy)::float as avg_accuracy
      FROM learning_sessions
      WHERE account_id = $1;
    `;

    const [vocabResult, accuracyResult] = await Promise.all([
      this.pool.query(vocabQuery, [accountId]),
      this.pool.query(accuracyQuery, [accountId])
    ]);

    const vocabSize = parseInt(vocabResult.rows[0]?.vocab_size || '0');
    const avgAccuracy = parseFloat(accuracyResult.rows[0]?.avg_accuracy || '0');

    // CEFR mapping based on vocabulary size
    const cefrLevels = [
      { level: 'A1', minWords: 0, maxWords: 500 },
      { level: 'A2', minWords: 500, maxWords: 1000 },
      { level: 'B1', minWords: 1000, maxWords: 2000 },
      { level: 'B2', minWords: 2000, maxWords: 3500 },
      { level: 'C1', minWords: 3500, maxWords: 5000 },
      { level: 'C2', minWords: 5000, maxWords: Infinity }
    ];

    const currentLevel = cefrLevels.find(l => vocabSize >= l.minWords && vocabSize < l.maxWords) || cefrLevels[0];
    const currentIndex = cefrLevels.findIndex(l => l.level === currentLevel.level);
    const nextLevel = currentIndex < cefrLevels.length - 1 ? cefrLevels[currentIndex + 1] : null;

    // Confidence based on accuracy (higher accuracy = higher confidence in level)
    const confidence = Math.min(avgAccuracy / 100, 1);

    return {
      level: currentLevel.level,
      confidence: parseFloat(confidence.toFixed(2)),
      vocabSize,
      nextLevel: nextLevel?.level || null,
      wordsToNextLevel: nextLevel ? Math.max(0, nextLevel.minWords - vocabSize) : 0
    };
  }

  /**
   * Compare user to similar learners
   */
  async compareToSimilarLearners(accountId: string): Promise<ComparisonData> {
    // Get user stats
    const userQuery = `
      SELECT
        AVG(accuracy)::float as avg_accuracy,
        COUNT(*)::integer as total_sessions,
        SUM(session_duration)::integer as total_study_time
      FROM learning_sessions
      WHERE account_id = $1;
    `;

    const userVocabQuery = `
      SELECT COUNT(DISTINCT term) as vocab_size
      FROM (
        SELECT jsonb_array_elements_text(mastered_terms::jsonb) as term
        FROM learning_sessions
        WHERE account_id = $1
      ) mastered;
    `;

    // Get average stats for all users
    const avgQuery = `
      SELECT
        AVG(accuracy)::float as avg_accuracy,
        AVG(session_count)::float as avg_sessions,
        AVG(total_time)::float as avg_study_time
      FROM (
        SELECT
          account_id,
          AVG(accuracy) as accuracy,
          COUNT(*) as session_count,
          SUM(session_duration) as total_time
        FROM learning_sessions
        GROUP BY account_id
      ) user_stats;
    `;

    const avgVocabQuery = `
      SELECT AVG(vocab_size)::float as avg_vocab_size
      FROM (
        SELECT
          account_id,
          COUNT(DISTINCT term) as vocab_size
        FROM (
          SELECT
            account_id,
            jsonb_array_elements_text(mastered_terms::jsonb) as term
          FROM learning_sessions
        ) all_mastered
        GROUP BY account_id
      ) user_vocab;
    `;

    const [userResult, userVocabResult, avgResult, avgVocabResult] = await Promise.all([
      this.pool.query(userQuery, [accountId]),
      this.pool.query(userVocabQuery, [accountId]),
      this.pool.query(avgQuery),
      this.pool.query(avgVocabQuery)
    ]);

    const userStats = {
      avgAccuracy: parseFloat(userResult.rows[0]?.avg_accuracy || '0'),
      totalSessions: userResult.rows[0]?.total_sessions || 0,
      totalStudyTime: userResult.rows[0]?.total_study_time || 0,
      vocabSize: parseInt(userVocabResult.rows[0]?.vocab_size || '0')
    };

    const avgStats = {
      avgAccuracy: parseFloat(avgResult.rows[0]?.avg_accuracy || '0'),
      totalSessions: Math.round(avgResult.rows[0]?.avg_sessions || 0),
      totalStudyTime: Math.round(avgResult.rows[0]?.avg_study_time || 0),
      vocabSize: Math.round(avgVocabResult.rows[0]?.avg_vocab_size || 0)
    };

    // Calculate percentile (simplified: based on accuracy)
    const percentileQuery = `
      SELECT
        CASE
          WHEN (SELECT COUNT(DISTINCT account_id) FROM learning_sessions) = 0 THEN 0
          ELSE COUNT(*)::float / NULLIF((SELECT COUNT(DISTINCT account_id)::float FROM learning_sessions), 0)
        END as percentile
      FROM (
        SELECT account_id, AVG(accuracy) as avg_accuracy
        FROM learning_sessions
        GROUP BY account_id
        HAVING AVG(accuracy) <= $1
      ) lower_performers;
    `;

    const percentileResult = await this.pool.query(percentileQuery, [userStats.avgAccuracy]);
    const userPercentile = Math.round((percentileResult.rows[0]?.percentile || 0) * 100);

    return {
      userPercentile,
      userStats,
      avgStats
    };
  }

  /**
   * Get session trends over time
   */
  async getSessionTrends(accountId: string, limit: number = 30): Promise<SessionTrend[]> {
    const query = `
      SELECT
        DATE(session_date)::text as date,
        AVG(accuracy)::float as accuracy,
        AVG(session_duration)::integer as duration,
        study_mode as mode,
        SUM(total_questions)::integer as questions_answered
      FROM learning_sessions
      WHERE account_id = $1
      GROUP BY DATE(session_date), study_mode
      ORDER BY DATE(session_date) DESC
      LIMIT $2;
    `;

    const result = await this.pool.query(query, [accountId, limit]);
    return result.rows.map(row => ({
      date: row.date,
      accuracy: parseFloat(row.accuracy?.toFixed(2) || '0'),
      duration: row.duration,
      mode: row.mode,
      questionsAnswered: row.questions_answered
    })).reverse(); // Reverse to get chronological order
  }

  /**
   * Calculate retention rates for previously mastered terms
   */
  async calculateRetention(accountId: string, limit: number = 20): Promise<RetentionData[]> {
    const query = `
      WITH term_appearances AS (
        SELECT
          term_data->>'term' as term,
          term_data->>'definition' as definition,
          (term_data->>'wasCorrect')::boolean as was_correct,
          session_date,
          ROW_NUMBER() OVER (PARTITION BY term_data->>'term' ORDER BY session_date) as appearance_num
        FROM learning_sessions,
        jsonb_array_elements(
          COALESCE(mastered_terms::jsonb, '[]'::jsonb) ||
          COALESCE(struggled_terms::jsonb, '[]'::jsonb)
        ) as term_data
        WHERE account_id = $1
          AND term_data->>'term' IS NOT NULL
      ),
      term_stats AS (
        SELECT
          term,
          definition,
          MIN(session_date) as first_seen,
          COUNT(*) as times_reviewed,
          SUM(CASE WHEN was_correct THEN 1 ELSE 0 END)::float / COUNT(*)::float as retention_rate,
          (array_agg(was_correct ORDER BY session_date DESC))[1] as last_was_correct
        FROM term_appearances
        WHERE appearance_num > 1  -- Only terms reviewed more than once
        GROUP BY term, definition
        HAVING COUNT(*) >= 2  -- At least 2 reviews
      )
      SELECT
        term,
        definition,
        first_seen::text,
        CASE WHEN last_was_correct THEN 100.0 ELSE 0.0 END as last_accuracy,
        ROUND((retention_rate * 100)::numeric, 2)::float as retention_rate,
        times_reviewed::integer
      FROM term_stats
      ORDER BY retention_rate ASC, times_reviewed DESC
      LIMIT $2;
    `;

    const result = await this.pool.query(query, [accountId, limit]);
    return result.rows;
  }

  /**
   * Get overall analytics overview
   */
  async getOverview(accountId: string) {
    const [
      velocity,
      cefr,
      recentSessions,
      totalStats
    ] = await Promise.all([
      this.calculateVelocity(accountId, 7), // Last 7 days
      this.estimateCEFRLevel(accountId),
      this.getSessionTrends(accountId, 5),
      this.pool.query(`
        SELECT
          COUNT(*)::integer as total_sessions,
          AVG(accuracy)::float as avg_accuracy,
          SUM(session_duration)::integer as total_study_time,
          MAX(DATE(session_date)) as last_session_date
        FROM learning_sessions
        WHERE account_id = $1
      `, [accountId])
    ]);

    const totalWordsLearned = velocity.reduce((sum, day) => sum + day.wordsLearned, 0);

    return {
      totalSessions: totalStats.rows[0]?.total_sessions || 0,
      avgAccuracy: parseFloat(totalStats.rows[0]?.avg_accuracy?.toFixed(2) || '0'),
      totalStudyTime: totalStats.rows[0]?.total_study_time || 0,
      lastSessionDate: totalStats.rows[0]?.last_session_date,
      wordsLearnedThisWeek: totalWordsLearned,
      cefrLevel: cefr,
      recentSessions
    };
  }
}
