-- EcoServe database schema (PostgreSQL)
-- Applied automatically on server startup (idempotent — safe to run repeatedly).

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hotels (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  rooms INTEGER NOT NULL DEFAULT 50,
  tier TEXT NOT NULL DEFAULT 'boutique',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_entries (
  id SERIAL PRIMARY KEY,
  hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  occupancy_pct NUMERIC NOT NULL DEFAULT 0,
  electricity_kwh NUMERIC NOT NULL DEFAULT 0,
  water_l NUMERIC NOT NULL DEFAULT 0,
  food_kg NUMERIC NOT NULL DEFAULT 0,
  food_waste_kg NUMERIC NOT NULL DEFAULT 0,
  general_waste_kg NUMERIC NOT NULL DEFAULT 0,
  recycling_kg NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_usage_entries_hotel_date ON usage_entries(hotel_id, entry_date DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_hotel ON chat_messages(hotel_id, created_at);
