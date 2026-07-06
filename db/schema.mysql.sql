-- SHB CM Dashboard — schema MySQL nội bộ (thay cho Postgres/Supabase khi vào EKS SHB).
-- Dịch 1:1 từ db/schema.sql + db/migrate_0{1..5}_*.sql (Postgres) sang MySQL 8.
-- timestamptz -> DATETIME, jsonb -> JSON, bigserial -> BIGINT AUTO_INCREMENT.
--
-- ⚠️ Bảng `events` KHÔNG có file gốc trong repo này (thuộc repo email-tracker-data
-- cũ) — cột dưới đây suy ra từ payload thực tế api/email-track.js ghi (clip độ dài
-- theo đúng giới hạn trong code). Cross-check lại với schema Postgres gốc của
-- email-tracker-data trước khi chạy thật, đề phòng thiếu cột.

-- ── Facebook Page (nguồn phụ — api/fb-fetch.js đã BỎ theo Phương án A, giữ bảng
--    để không phá loadData() cũ nếu cần fallback) ──
CREATE TABLE IF NOT EXISTS fb_posts (
  post_id           VARCHAR(64) PRIMARY KEY,
  page_id           VARCHAR(64),
  message           TEXT,
  created_time      DATETIME,
  type              VARCHAR(20),
  permalink         VARCHAR(500),
  topic             VARCHAR(80),
  views             BIGINT DEFAULT 0,
  media_viewers     BIGINT DEFAULT 0,
  like_count        INT DEFAULT 0,
  love_count        INT DEFAULT 0,
  haha_count        INT DEFAULT 0,
  wow_count         INT DEFAULT 0,
  sad_count         INT DEFAULT 0,
  angry_count       INT DEFAULT 0,
  comments          INT DEFAULT 0,
  replies           INT DEFAULT 0,
  page_replies      INT DEFAULT 0,
  shares            INT DEFAULT 0,
  clicks            INT DEFAULT 0,
  first_comment_min INT,
  video             JSON,
  vel               JSON,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fb_snapshots (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  post_id     VARCHAR(64),
  captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  views       BIGINT,
  reactions   INT,
  comments    INT,
  shares      INT,
  clicks      INT,
  engagement  INT,
  FOREIGN KEY (post_id) REFERENCES fb_posts(post_id) ON DELETE CASCADE,
  INDEX fb_snapshots_post_time (post_id, captured_at)
);

CREATE TABLE IF NOT EXISTS fb_page_snapshots (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  page_id     VARCHAR(64),
  captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  followers   BIGINT,
  views       BIGINT,
  engagement  BIGINT,
  INDEX fb_page_snapshots_time (captured_at)
);

-- ── Facebook Group "SHB Một Nhà" (nguồn CHÍNH — userscript qua /api/ingest) ──
CREATE TABLE IF NOT EXISTS fb_group_posts (
  post_id      VARCHAR(64) PRIMARY KEY,
  group_id     VARCHAR(64),
  title        VARCHAR(500),
  permalink    VARCHAR(500),
  created_time DATETIME,
  post_type    VARCHAR(40),
  reach        BIGINT DEFAULT 0,
  viewers      BIGINT DEFAULT 0,
  engagement   BIGINT DEFAULT 0,
  comments     INT DEFAULT 0,
  source       VARCHAR(20) DEFAULT 'prodash',
  metrics      JSON,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fb_group_post_snapshots (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  post_id     VARCHAR(64),
  captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reach       BIGINT,
  viewers     BIGINT,
  engagement  BIGINT,
  comments    INT,
  FOREIGN KEY (post_id) REFERENCES fb_group_posts(post_id) ON DELETE CASCADE,
  INDEX fb_group_post_snap_time (post_id, captured_at)
);

CREATE TABLE IF NOT EXISTS fb_page_insights (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  date_range  VARCHAR(40),
  metrics     JSON,
  series      JSON,
  INDEX fb_page_insights_time (captured_at)
);

-- ── Email Tracker (nguồn: VBA beacon qua /api/track) ──
-- ⚠️ Suy ra từ code, xem cảnh báo đầu file.
CREATE TABLE IF NOT EXISTS events (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_id    VARCHAR(60),
  pos         VARCHAR(16),
  rcpt        VARCHAR(160),
  campaign    VARCHAR(80),
  subject     VARCHAR(160),
  msg_type    VARCHAR(16),
  initiative  VARCHAR(80),
  target_size INT,
  dept        VARCHAR(80),
  role        VARCHAR(80),
  loc         VARCHAR(80),
  link        VARCHAR(500),
  dest        VARCHAR(500),
  ua          VARCHAR(200),
  ts          DATETIME,
  dwell_s     INT,
  INDEX events_ts (ts),
  INDEX events_event_id (event_id),
  INDEX events_pos (pos)
);
