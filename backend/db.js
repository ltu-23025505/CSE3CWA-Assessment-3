// SQLite connection and schema initialisation.
//
// SQLite is the minimum storage the brief allows, and it keeps the deployment to
// a single web service. Note that on the free hosting plan the filesystem is
// EPHEMERAL: the file is erased on restart, redeploy and idle spin-down, so
// records do not survive the instance being recycled. See the README limitation.

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const SCHEMA_FILE = path.join(__dirname, 'init.sql');

// Opens (creating if necessary) the SQLite database at the given path.
function openDatabase(databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  return new sqlite3.Database(databasePath);
}

// Promise wrappers around the sqlite3 callback API.
function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this); // `this` carries lastID and changes
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

// init.sql is a single idempotent script (CREATE TABLE IF NOT EXISTS ...).
async function initSchema(db) {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  await run(db, schema);
}

module.exports = { openDatabase, initSchema, run, get, all };
