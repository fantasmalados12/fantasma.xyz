
CREATE TABLE IF NOT EXISTS vocab_images (
    id SERIAL PRIMARY KEY,
    vocab_set_id INTEGER REFERENCES vocab_sets(id) ON DELETE CASCADE,
    associated_term TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
