// Script tạm để chẩn đoán kết nối MySQL nội bộ + chạy schema.mysql.sql.
// Gọi từ job `db_check` trong .gitlab-ci.yml (branch dev, KHÔNG merge vào main
// lâu dài — xoá cả file này + job db_check sau khi xác nhận DB xong).
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;

if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_PASSWORD) {
  console.error('Thieu MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD trong CI/CD Variables.');
  process.exit(1);
}

async function main() {
  console.log('--- Ket noi MySQL ---', MYSQL_HOST, MYSQL_PORT || 3306);
  const conn = await mysql.createConnection({
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT) || 3306,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    multipleStatements: true,
  });

  const [dbs] = await conn.query('SHOW DATABASES;');
  console.log('--- SHOW DATABASES (tim ten schema) ---');
  console.log(dbs.map((r) => r.Database).join('\n'));

  if (MYSQL_DATABASE) {
    console.log(`--- Chay db/schema.mysql.sql vao ${MYSQL_DATABASE} ---`);
    await conn.changeUser({ database: MYSQL_DATABASE });
    const sql = fs.readFileSync(path.join(__dirname, 'schema.mysql.sql'), 'utf8');
    await conn.query(sql);
    const [tables] = await conn.query('SHOW TABLES;');
    console.log('--- SHOW TABLES sau khi chay schema ---');
    console.log(tables.map((r) => Object.values(r)[0]).join('\n'));
  } else {
    console.log('Chua co MYSQL_DATABASE trong CI/CD Variables - dien ten schema sau khi xac dinh o buoc SHOW DATABASES o tren roi chay lai job nay.');
  }

  await conn.end();
}

main().catch((err) => {
  console.error('LOI:', err.message);
  process.exit(1);
});
