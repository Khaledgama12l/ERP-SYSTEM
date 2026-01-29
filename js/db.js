const Database = require('better-sqlite3');
const db = new Database('shop_data.db'); // ده الملف اللي هيتخزن فيه كل حاجة

// إنشاء الجداول لو مش موجودة
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    barcode TEXT UNIQUE,
    quantity INTEGER DEFAULT 0,
    price REAL
    );

    CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT,
    supplier_name TEXT, -- لو الفاتورة واردة
    type TEXT, -- 'in' للوارد و 'out' للصادر
    total REAL,
    date TEXT
    );
`);

module.exports = db;