-- Add dropbox_cursor column to files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS dropbox_cursor TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_files_dropbox_cursor ON files(dropbox_cursor);
