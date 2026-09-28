'use strict';
/*
 * Lớp truy cập DB nội bộ (MySQL) — thay cho PostgREST của Supabase khi chạy trên
 * EKS nội bộ SHB (KE_HOACH_MIGRATION.md §3.2 điểm 2, §7c).
 *
 * Thiết kế để KHÔNG phải sửa loadData()/sbGet()/fbGet()/fetchLogs() trong từng
 * api/*-dashboard.js: cả 3 file đó đều gọi 1 hàm nội bộ dạng
 *   get('/rest/v1/<table>?select=a,alias:b&order=col.desc&limit=N&pos=eq.sent&offset=1000')
 * giống hệt cú pháp PostgREST thật đang dùng (kiểm bằng grep 3 file dashboard).
 * parsePath() dịch đúng tập con cú pháp đó sang SQL — hỗ trợ select/order/limit/
 * offset + filter eq./neq./in.(...)/ not.in.(...) (đủ cho những gì 3 dashboard gọi
 * hiện nay). KHÔNG phải PostgREST đầy đủ — filter khác (gt/lt/like/or...) sẽ throw
 * rõ ràng thay vì âm thầm bỏ qua, để lỗi lộ ra ngay lúc build/test thay vì ra
 * dashboard sai số liệu.
 *
 * Bật MySQL bằng cách set MYSQL_HOST (xem .env.example). Nếu không set, các file
 * gọi hàm này phải tự fallback về https Supabase như cũ — giữ được chạy song song
 * Vercel/Supabase trong giai đoạn cutover (§7 Giai đoạn 3) mà không cần 2 nhánh code.
 */
const mysql = require('mysql2/promise');

let pool = null;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: parseInt(process.env.MYSQL_POOL_SIZE || '5', 10),
      dateStrings: true, // trả timestamp dạng string như Supabase REST, để new Date(r.col) hoạt động y hệt
    });
  }
  return pool;
}

function isEnabled() {
  return !!(process.env.MYSQL_HOST || process.env.INGEST_API_URL);
}

const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function assertIdent(name, ctx) {
  if (!IDENT_RE.test(name)) throw new Error(`db-client: tên cột/bảng không hợp lệ "${name}" (${ctx})`);
  return name;
}

const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset']);

function parseFilter(col, raw) {
  if (raw.startsWith('eq.')) return { sql: '`' + col + '` = ?', values: [raw.slice(3)] };
  if (raw.startsWith('neq.')) return { sql: '`' + col + '` <> ?', values: [raw.slice(4)] };
  if (raw.startsWith('not.in.(') && raw.endsWith(')')) {
    const items = raw.slice('not.in.('.length, -1).split(',').filter((x) => x !== '');
    return { sql: '`' + col + '` NOT IN (' + items.map(() => '?').join(',') + ')', values: items };
  }
  if (raw.startsWith('in.(') && raw.endsWith(')')) {
    const items = raw.slice('in.('.length, -1).split(',').filter((x) => x !== '');
    return { sql: '`' + col + '` IN (' + items.map(() => '?').join(',') + ')', values: items };
  }
  throw new Error('db-client: filter operator chưa hỗ trợ "' + raw + '" (cột ' + col + ') — chỉ hỗ trợ eq./neq./in.()/not.in.()');
}

/** Dịch 1 path kiểu PostgREST sang {sql, values} chạy được bằng mysql2 (?-placeholder). */
function parsePath(path) {
  const qIdx = path.indexOf('?');
  const pathname = qIdx === -1 ? path : path.slice(0, qIdx);
  const qs = qIdx === -1 ? '' : path.slice(qIdx + 1);
  const tableMatch = pathname.match(/\/rest\/v1\/([a-zA-Z_][a-zA-Z0-9_]*)/);
  if (!tableMatch) throw new Error('db-client: không nhận ra table trong path "' + path + '"');
  const table = assertIdent(tableMatch[1], 'table');

  const params = new URLSearchParams(qs);

  const selectRaw = params.get('select') || '*';
  const selectSql = selectRaw.split(',').map((raw) => {
    const s = raw.trim();
    if (s === '*') return '*';
    if (s.includes(':')) {
      const [alias, col] = s.split(':').map((x) => x.trim());
      return '`' + assertIdent(col, 'select col') + '` AS `' + assertIdent(alias, 'select alias') + '`';
    }
    return '`' + assertIdent(s, 'select col') + '`';
  }).join(', ');

  const whereParts = [];
  const values = [];
  for (const [key, val] of params.entries()) {
    if (RESERVED_PARAMS.has(key)) continue;
    assertIdent(key, 'filter col');
    const f = parseFilter(key, val);
    whereParts.push(f.sql);
    values.push(...f.values);
  }
  const whereSql = whereParts.length ? ' WHERE ' + whereParts.join(' AND ') : '';

  let orderSql = '';
  const orderRaw = params.get('order');
  if (orderRaw) {
    const [col, dir] = orderRaw.split('.');
    orderSql = ' ORDER BY `' + assertIdent(col, 'order col') + '` ' + (/^desc/i.test(dir || '') ? 'DESC' : 'ASC');
  }

  let limitSql = '';
  const limitRaw = params.get('limit');
  if (limitRaw != null && limitRaw !== '') {
    const n = parseInt(limitRaw, 10);
    if (!Number.isFinite(n) || n < 0) throw new Error('db-client: limit không hợp lệ "' + limitRaw + '"');
    limitSql = ' LIMIT ' + n;
  }

  let offsetSql = '';
  const offsetRaw = params.get('offset');
  if (offsetRaw != null && offsetRaw !== '') {
    const n = parseInt(offsetRaw, 10);
    if (!Number.isFinite(n) || n < 0) throw new Error('db-client: offset không hợp lệ "' + offsetRaw + '"');
    if (!limitSql) throw new Error('db-client: offset cần đi kèm limit (MySQL yêu cầu LIMIT trước OFFSET)');
    offsetSql = ' OFFSET ' + n;
  }

  return { sql: 'SELECT ' + selectSql + ' FROM `' + table + '`' + whereSql + orderSql + limitSql + offsetSql, values };
}

/** Tương đương sbGet()/fbGet() cũ nhưng đọc MySQL nội bộ. Trả về mảng object giống JSON Supabase REST.
 * Nếu có INGEST_API_URL (vd job sync_data chạy trên GitLab runner, bị Security Group chặn
 * kết nối thẳng RDS) -> gọi qua route /dbquery của cm-dashboard-ingest (đang chạy trong
 * cluster, có đường mạng tới RDS) thay vì tự mở kết nối mysql2. Pod ingest tự nó KHÔNG set
 * INGEST_API_URL nên vẫn dùng đường trực tiếp như cũ, không tự gọi vòng lại chính nó. */
async function get(path) {
  if (process.env.INGEST_API_URL) {
    const url = process.env.INGEST_API_URL.replace(/\/$/, '') + '/dbquery?secret=' +
      encodeURIComponent(process.env.INGEST_SECRET || '') + '&path=' + encodeURIComponent(path);
    const res = await fetch(url);
    const body = await res.json();
    if (!res.ok) throw new Error('db-client(http): ' + (body && body.error || res.status));
    return body;
  }
  const { sql, values } = parsePath(path);
  const [rows] = await getPool().query(sql, values);
  return rows;
}

/* ── GHI (insert/upsert) — thay cho sbWrite/insertEvent gọi Supabase REST ─────
 * Chuẩn hoá giá trị cho MySQL:
 * - object/array (cột jsonb cũ -> JSON): stringify.
 * - chuỗi ISO-8601 (Supabase nhận thẳng, MySQL DATETIME không nhận hậu tố Z):
 *   đổi sang Date để mysql2 tự serialize đúng 'YYYY-MM-DD HH:MM:SS'.
 * - undefined -> null (cột vắng mặt trong 1 số row của cùng batch).
 */
function toSqlValue(v) {
  if (v === undefined) return null;
  if (v !== null && typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return v;
}

/** Dựng {sql, values} cho INSERT bulk (tách riêng để test không cần MySQL thật). */
function buildInsert(table, rows, opts = {}) {
  if (!Array.isArray(rows)) rows = [rows];
  if (!rows.length) return null;
  assertIdent(table, 'insert table');
  // Hợp nhất cột từ mọi row — normalize() của fb-ingest chỉ thêm created_time khi hợp lệ
  // nên các row trong cùng batch có thể lệch key nhau.
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  cols.forEach((c) => assertIdent(c, 'insert col'));
  const values = rows.map((r) => cols.map((c) => toSqlValue(r[c])));
  let sql = 'INSERT INTO `' + table + '` (' + cols.map((c) => '`' + c + '`').join(',') + ') VALUES ?';
  if (opts.upsert) {
    // VALUES() cũ nhưng tương thích rộng nhất (5.7 -> 8.x); khoá trùng xác định bởi
    // PRIMARY KEY/UNIQUE của bảng (fb_group_posts: post_id) — tương đương on_conflict
    // + merge-duplicates của Supabase. COALESCE: row nào thiếu cột (vd created_time
    // không parse được ở normalize()) thì GIỮ giá trị cũ thay vì ghi đè NULL.
    sql += ' ON DUPLICATE KEY UPDATE ' + cols.map((c) => '`' + c + '`=COALESCE(VALUES(`' + c + '`),`' + c + '`)').join(',');
  }
  return { sql, values };
}

// Tên cột suy ra từ thông báo lỗi MySQL "Unknown column 'xxx' in 'field list'"
// (ER_BAD_FIELD_ERROR) — dùng để tự bỏ cột đó và ghi lại, xem insert() dưới đây.
const UNKNOWN_COL_RE = /Unknown column '([a-zA-Z_][a-zA-Z0-9_]*)'/;

/** INSERT (bulk) — rows: object hoặc mảng object. opts.upsert=true -> ON DUPLICATE KEY UPDATE.
 * Tự BỎ QUA cột lạ (ER_BAD_FIELD_ERROR, vd cột `ip` mới thêm 25/09/2026 mà bảng
 * production CHƯA kịp chạy migration) rồi ghi lại KHÔNG có cột đó, thay vì để mất
 * trắng cả sự kiện — ưu tiên "còn dữ liệu (thiếu 1 cột)" hơn "mất cả sự kiện" (xem
 * mục 18 CLAUDE.md: không hy sinh dữ liệu). Chỉ retry 1 lần cho mỗi cột lạ phát
 * hiện được; lỗi khác (mất kết nối, cột hợp lệ nhưng sai kiểu...) vẫn ném ra như cũ
 * để insertEvent() phía trên log rõ, không âm thầm nuốt lỗi thật. */
async function insert(table, rows, opts = {}) {
  var built = buildInsert(table, rows, opts);
  if (!built) return 0;
  if (!Array.isArray(rows)) rows = [rows];
  var attemptRows = rows;
  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      var built2 = attempt === 0 ? built : buildInsert(table, attemptRows, opts);
      if (!built2) return 0;
      var res = (await getPool().query(built2.sql, [built2.values]))[0];
      return res.affectedRows;
    } catch (e) {
      var m = e && e.code === 'ER_BAD_FIELD_ERROR' && UNKNOWN_COL_RE.exec(e.message || '');
      if (!m) throw e;
      var badCol = m[1];
      console.error('[db-client] Cot "' + badCol + '" chua ton tai trong bang `' + table +
        '` (chua chay migration?) - GHI LAI khong co cot nay de khong mat du lieu.');
      attemptRows = attemptRows.map(function (r) {
        var r2 = Object.assign({}, r);
        delete r2[badCol];
        return r2;
      });
    }
  }
  throw new Error('db-client: insert that bai lap lai (qua nhieu cot la) vao bang ' + table);
}

// Danh sách cột "best-effort" nên có trên bảng `events` — tự thêm khi pod khởi
// động nếu user DB đang dùng có quyền DDL (ALTER). KHÔNG đảm bảo lúc nào cũng có
// quyền này (nhiều nơi chỉ cấp DML cho app user) — nếu thất bại, insert() ở trên
// vẫn tự bảo vệ được (bỏ cột lạ, không mất event), chỉ là cột `ip` sẽ trống cho
// tới khi ai đó có quyền DDL (vd anh Nam/DBA) chạy 1 dòng trong
// db/migrate_06_email_ip.sql. Gọi 1 lần lúc server khởi động, KHÔNG chặn server
// listen (best-effort, fire-and-forget) — xem server/ingest-server.js.
var EVENTS_OPTIONAL_COLUMNS = [
  { name: 'ip', ddl: 'VARCHAR(64)' },
];
async function ensureEventsColumns() {
  for (var i = 0; i < EVENTS_OPTIONAL_COLUMNS.length; i++) {
    var col = EVENTS_OPTIONAL_COLUMNS[i];
    try {
      await getPool().query('ALTER TABLE `events` ADD COLUMN IF NOT EXISTS `' + col.name + '` ' + col.ddl);
      console.log('[db-client] Da dam bao cot `events.' + col.name + '` ton tai.');
    } catch (e) {
      console.error('[db-client] KHONG THE tu them cot `events.' + col.name + '` (' +
        (e.code || '') + ' - ' + e.message + '). Se ghi thieu cot nay cho toi khi ai do co ' +
        'quyen DDL chay thu cong (xem db/migrate_06_email_ip.sql).');
    }
  }
}

async function end() {
  if (pool) { await pool.end(); pool = null; }
}

module.exports = { isEnabled, get, parsePath, getPool, end, insert, buildInsert, ensureEventsColumns };
