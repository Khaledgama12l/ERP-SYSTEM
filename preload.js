const { contextBridge } = require('electron');
const db = require('./database');

contextBridge.exposeInMainWorld('dbAPI', {
    saveProduct: (prod) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO inventory (id, name, cat, buy, sell, qty)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run(prod.id || null, prod.name, prod.cat, prod.buy, prod.sell, prod.qty);
    },
    loadInventory: (filter) => {
        if(filter === 'all') return db.prepare("SELECT * FROM inventory").all();
        return db.prepare("SELECT * FROM inventory WHERE cat=?").all(filter);
    },
    deleteProduct: (id) => db.prepare("DELETE FROM inventory WHERE id=?").run(id),
    getCategories: () => db.prepare("SELECT * FROM categories").all(),
    addCategory: (name) => db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)").run(name),
    deleteCategory: (id) => db.prepare("DELETE FROM categories WHERE id=?").run(id)
});
