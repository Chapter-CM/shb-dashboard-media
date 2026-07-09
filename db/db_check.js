// Script tạm để chẩn đoán kết nối MySQL nội bộ + chạy schema.mysql.sql.
// Gọi từ job `db_check` trong .gitlab-ci.yml (branch dev, KHÔNG merge vào main
// lâu dài — xoá cả file này + job db_check sau khi xác nhận DB xong).
const fs = require('fs');
const path = require('path');
const net = require('net');
const dns = require('dns').promises;
const mysql = require('mysql2/promise');

const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;

if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_PASSWORD) {
  console.error('Thieu MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD trong CI/CD Variables.');
  process.exit(1);
}

// Chẩn đoán tách bạch DNS vs TCP trước khi thử mysql2, để biết chính xác lỗi
// nằm ở bước nào (DNS không phân giải được, hay TCP bị Security Group chặn).
async function diagnose(host, port) {
  console.log(`--- Chan doan DNS: phan giai "${host}" ---`);
  let address;
  try {
    const res = await dns.lookup(host);
    address = res.address;
    console.log(`DNS OK -> ${address} (family IPv${res.family})`);
  } catch (e) {
    console.log(`DNS THAT BAI: ${e.code} - ${e.message}`);
    console.log('=> Runner khong phan giai duoc hostname nay. Kiem tra DNS noi bo / VPC DNS resolver co route toi domain RDS khong.');
    return;
  }

  console.log(`--- Chan doan TCP: connect toi ${address}:${port} (timeout 8s) ---`);
  await new Promise((resolve) => {
    const socket = net.createConnection({ host: address, port, timeout: 8000 });
    socket.on('connect', () => {
      console.log('TCP OK: bat tay duoc, cong dang mo va co the toi duoc tu runner.');
      socket.destroy();
      resolve();
    });
    socket.on('timeout', () => {
      console.log('TCP TIMEOUT: goi SYN nhung khong nhan duoc phan hoi (khong phai refused).');
      console.log('=> Rat co the do Security Group / NACL chan inbound port nay tu dai IP cua runner, hoac thieu route/peering toi VPC chua RDS.');
      socket.destroy();
      resolve();
    });
    socket.on('error', (e) => {
      console.log(`TCP LOI: ${e.code} - ${e.message}`);
      if (e.code === 'ECONNREFUSED') {
        console.log('=> Toi duoc mang nhung port dong/khong co service lang nghe (khac voi bi Security Group chan silent).');
      }
      resolve();
    });
  });
}

async function main() {
  const port = Number(MYSQL_PORT) || 3306;
  console.log('--- Ket noi MySQL ---', MYSQL_HOST, port);
  await diagnose(MYSQL_HOST, port);

  console.log('--- Thu ket noi that bang mysql2 (timeout 10s) ---');
  const conn = await mysql.createConnection({
    host: MYSQL_HOST,
    port,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    multipleStatements: true,
    connectTimeout: 10000,
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
  console.error('LOI:', err.code || '(no code)', '-', err.message);
  process.exit(1);
});
