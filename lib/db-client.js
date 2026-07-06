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
  return !!process.env.MYSQL_HOST;
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

/** Tương đương sbGet()/fbGet() cũ nhưng đọc MySQL nội bộ. Trả về mảng object giống JSON Supabase REST. */
async function get(path) {
  const { sql, values } = parsePath(path);
  const [rows] = await getPool().query(sql, values);
  return rows;
}

async function end() {
  if (pool) { await pool.end(); pool = null; }
}

module.exports = { isEnabled, get, parsePath, getPool, end };
