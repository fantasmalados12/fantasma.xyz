CREATE TABLE IF NOT EXISTS learning_sessions (
    id SERIAL PRIMARY KEY,
    account_id TEXT NOT NULL,
    vocab_set_id INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    incorrect_answers INTEGER NOT NULL,
    accuracy DECIMAL(5,2),
    session_duration INTEGER,
    study_mode TEXT,
    question_types_used TEXT,
    struggled_terms TEXT,
    mastered_terms TEXT,
    session_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries by account and vocab set
CREATE INDEX IF NOT EXISTS idx_sessions_account_vocab
ON learning_sessions(account_id, vocab_set_id);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_sessions_date
ON learning_sessions(session_date DESC);
