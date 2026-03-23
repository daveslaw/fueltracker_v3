-- Add ocr_status to pos_submission_lines
-- Tracks whether a line was auto-extracted, manually overridden, or entered because photo was unreadable
alter table public.pos_submission_lines
  add column ocr_status text not null default 'auto'
    check (ocr_status in ('auto', 'manual_override', 'unreadable'));
