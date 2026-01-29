const Database = require('better-sqlite3');
const db = new Database('inventory_app.db');

// جدول الأقسام
db.prepare(`
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
)
`).run();

// جدول المخزن
db.prepare(`
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    cat TEXT,
    buy REAL,
    sell REAL,
    qty INTEGER
)
`).run();

// سجل المبيعات والوارد
db.prepare(`
CREATE TABLE IF NOT EXISTS sales_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    type TEXT,
    party TEXT,
    total REAL,
    itemsCount INTEGER
)
`).run();

// تفاصيل كل فاتورة
db.prepare(`
CREATE TABLE IF NOT EXISTS sales_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_id INTEGER,
    name TEXT,
    qty INTEGER,
    price REAL,
    FOREIGN KEY(sale_id) REFERENCES sales_history(id),
    FOREIGN KEY(product_id) REFERENCES inventory(id)
)
`).run();

module.exports = db;

