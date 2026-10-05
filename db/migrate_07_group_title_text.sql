-- Migration 07 — nang fb_group_posts.title tu VARCHAR(500) len MEDIUMTEXT (05/10/2026)
--
-- Ly do: noi dung bai bi cat ~500 ky tu nen mat hashtag cuoi bai (#sq1, #CDS...), bang "Du an / Squad"
-- cua dashboard Facebook khong phan loai duoc. Scraper da lay du noi dung (len toi >2000 ky tu).
-- KHONG BAT BUOC chay tay: lib/db-client.js#ensureGroupTitleWide tu chay lenh nay moi khi pod khoi dong.
-- Chi chay tay neu /healthz?debug=1 bao that bai (can quyen DDL). Chay lai 2 lan van an toan.
ALTER TABLE fb_group_posts MODIFY COLUMN title MEDIUMTEXT;
