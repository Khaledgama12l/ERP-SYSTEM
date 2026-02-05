const sqlite3 = require('sqlite3').verbose();
// إنشاء أو فتح ملف قاعدة البيانات
const db = new sqlite3.Database('./accounting.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the SQLite database.');
});

// إنشاء جدول المستخدمين
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )`, (err) => {
        if (err) console.error("Error creating table", err.message);
        
        // إضافة مستخدم تجريبي إذا لم يكن موجوداً
        const stmt = db.prepare("INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)");
        stmt.run("user", "123456"); // الباسورد هنا (يُفضل تشفيره لاحقاً)
        stmt.finalize();
    });
});

module.exports = db;