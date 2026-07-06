'use strict';
/*
 * Shim tối thiểu để chạy các handler viết theo kiểu Vercel (`module.exports = async (req,res)=>{}`,
 * dùng `req.query`, `req.body`, `res.status().json()`) trên Node http server thuần (nginx/EKS nội bộ),
 * không cần đổi code trong api/*.js.
 */
const { URL } = require('url');

function withQuery(req) {
  const u = new URL(req.url, 'http://internal');
  req.query = Object.fromEntries(u.searchParams.entries());
  return req;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => { buf += c; });
    req.on('end', () => {
      if (!buf) return resolve(null);
      try { resolve(JSON.parse(buf)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function withStatusJson(res) {
  res.status = function (code) { res.statusCode = code; return res; };
  res.json = function (obj) {
    const body = JSON.stringify(obj);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(body));
    }
    res.end(body);
    return res;
  };
  res.send = function (body) {
    if (typeof body === 'object' && body !== null && !Buffer.isBuffer(body)) return res.json(body);
    if (!res.headersSent) res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(body);
    return res;
  };
  return res;
}

/** Bọc 1 handler kiểu Vercel thành middleware Node http chuẩn (req,res)=>void. */
function wrap(handler) {
  return async (req, res) => {
    withQuery(req);
    withStatusJson(res);
    if (req.method === 'POST' || req.method === 'PUT') {
      try { req.body = await readJsonBody(req); }
      catch (e) { res.status(400).json({ error: 'invalid JSON body' }); return; }
    }
    try {
      await handler(req, res);
    } catch (e) {
      console.error('[handler error]', e && e.stack || e);
      if (!res.headersSent) res.status(500).json({ error: 'internal error' });
    }
  };
}

module.exports = { wrap, withQuery, withStatusJson, readJsonBody };
