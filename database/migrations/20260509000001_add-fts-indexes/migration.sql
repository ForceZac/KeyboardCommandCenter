-- Full-text search GIN indexes for KeyboardCommandCenter
-- Applies after: 20260509000000_init-shortcut-schema
--
-- Uses PostgreSQL GIN indexes with to_tsvector for full-text search on:
--   shortcuts.command  — the human-readable command description
--   applications.name  — the application name
--
-- Also adds btree indexes on FK columns per Reviewer recommendation from TASK-0001 TRD:
-- "FK columns on shortcut_key_bindings and shortcut_key_steps lack @@index decorators."
-- Adding these here keeps all performance indexes in one migration and avoids
-- an additional schema.prisma change.

-- Full-text search: shortcuts.command
CREATE INDEX IF NOT EXISTS shortcuts_command_fts_idx
  ON shortcuts USING gin (to_tsvector('english', command));

-- Full-text search: applications.name
CREATE INDEX IF NOT EXISTS applications_name_fts_idx
  ON applications USING gin (to_tsvector('english', name));

-- FK performance indexes on shortcut_key_bindings
CREATE INDEX IF NOT EXISTS skb_shortcut_id_idx
  ON shortcut_key_bindings ("shortcutId");

CREATE INDEX IF NOT EXISTS skb_platform_id_idx
  ON shortcut_key_bindings ("platformId");

-- FK performance indexes on shortcut_key_steps
CREATE INDEX IF NOT EXISTS sks_binding_id_idx
  ON shortcut_key_steps ("bindingId");

-- FK performance indexes on shortcuts
CREATE INDEX IF NOT EXISTS shortcuts_application_id_idx
  ON shortcuts ("applicationId");

-- FK performance index on applications
CREATE INDEX IF NOT EXISTS applications_category_id_idx
  ON applications ("categoryId");
