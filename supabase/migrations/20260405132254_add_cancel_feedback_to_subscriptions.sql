ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS cancel_feedback text,
ADD COLUMN IF NOT EXISTS cancel_comment text;
