// استبدال الـ alert التقليدي بـ showToast أوتوماتيكياً
window.alert = function(message) {
    if (typeof showToast === 'function') {
        showToast(message, "info"); // أو "success" حسب ذوقك
    } else {
        console.log("Alert:", message);
    }
};
// 1. المتغيرات العامة وقاعدة البيانات
let db;
let currentManageMode = ''; 
let currentEditId = null; // عشان نعرف إحنا بنعدل أي منتج حالياً
// تعريف مصفوفة الفاتورة في بداية الملف
let selectedProductTemp = null;
let currentFocus = -1; // لمتابعة العنصر المختار في القائمة
let purchaseItems = []; // مصفوفة مؤقتة للأصناف
window.currentPurchaseItems = [];
let currentPurchaseList = []; // مصفوفة مؤقتة للأصناف في شاشة المشتريات
let currentOriginalItems = []; // متغير عالمي لحفظ أصناف الفاتورة الأصلية للمقارنة

let saleTabs = [
    { 
        id: 1, 
        name: "فاتورة 1", 
        cart: [], 
        customerName: "", 
        customerPhone: "",
        discount: 0,
        paymentType: "cash" 
    }
];





function updateLiveDateTime() {
    const now = new Date();
    
    // تنسيق التاريخ (يوم/شهر/سنة)
    const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const dateStr = now.toLocaleDateString('ar-EG', dateOptions); // en-GB عشان يظهر DD/MM/YYYY
    
    // تنسيق الساعة (ساعة:دقيقة:ثانية)
    const timeStr = now.toLocaleTimeString('ar-EG', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true // خليه false لو عايز نظام 24 ساعة
    });

    // حقن البيانات في الـ HTML
    const dateEl = document.getElementById('welcome-date');
    const timeEl = document.getElementById('welcome-time');
    
    if (dateEl) dateEl.innerText = dateStr;
    if (timeEl) timeEl.innerText = timeStr;
}


// 3. تهيئة SQLite
// تهيئة SQLite وإنشاء الجداول بالكامل
async function initDatabase() {
    try {
        console.log("🎬 بدء تشغيل نظام إدارة المخازن...");

        // 1. تهيئة مكتبة SQL.js
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/${file}`
        });

        let dataToLoad = null;

        // 2. محاولة التحميل من الهارد (Electron)
        try {
            if (typeof ipcRenderer !== 'undefined') {
                const diskData = await ipcRenderer.invoke('load-db-from-disk');
                if (diskData && diskData.length > 0) {
                    dataToLoad = new Uint8Array(diskData);
                }
            }
        } catch (ipcErr) {
            console.warn("⚠️ فشل التحميل من الهارد، جاري البحث في localStorage");
        }

        // 3. لو مفيش هارد، شوف الـ localStorage
        if (!dataToLoad) {
            const savedDb = localStorage.getItem('warehouse_sqlite_db');
            if (savedDb) {
                try {
                    dataToLoad = new Uint8Array(JSON.parse(savedDb));
                    console.log("⚠️ تم التحميل من الـ localStorage");
                } catch (e) {
                    console.error("❌ داتا الـ localStorage تالفة");
                }
            }
        }

        // 4. تشغيل قاعدة البيانات في الـ RAM
        if (dataToLoad) {
            window.db = new SQL.Database(dataToLoad);
        } else {
            window.db = new SQL.Database();
            console.log("🆕 تم إنشاء قاعدة بيانات جديدة تماماً");
        }

        // ضمان وجود المتغير global
        db = window.db;

        // 5. بناء هيكل الجداول (تأكد إن الجداول موجودة قبل أي عملية قراءة)
        createTablesSchema(); 

        // 6. نداء الإعدادات فوراً بعد استقرار الداتا بيز وقبل الـ setTimeout
        if (typeof loadSettings === 'function') {
            loadSettings(); 
        }

        // 7. اللمسات النهائية للواجهة (رندر البيانات)
        setTimeout(() => {
            if (window.db) {
                // تحديث شاشة البيع (إخفاء/إظهار حقول الضريبة والخصم)
                if (typeof applySalesScreenSettings === 'function') {
                    applySalesScreenSettings();
                }

                // رندر البيانات الأساسية
                if (typeof renderInventory === 'function') renderInventory();
                if (typeof updateDashboardStats === 'function') updateDashboardStats();
            }
        }, 100); // قللت الوقت لـ 100 مللي ثانية عشان السرعة

    } catch (err) {
        console.error("❌ خطأ فادح في تشغيل النظام:", err);
        alert("فشل تشغيل قاعدة البيانات، يرجى مراجعة الـ Console");
    }
        if (typeof loadCustomersDebt === 'function') {
            loadCustomersDebt(); // تحميل مديونية العملاء فوراً بعد تحميل الإعدادات
        }
}
// 1. خليه فوق خالص مرة واحدة بس
const { ipcRenderer } = require('electron');
const { shell } = require('electron'); // سطر إضافي لتعريف shell
async function checkForUpdates() {
    try {
        const updateInfo = await ipcRenderer.invoke('check-for-update');
        
        if (updateInfo.isUpdateAvailable) {
            const updateBanner = document.createElement('div');
            updateBanner.id = "update-container";
            
            // ستايل هادئ واحترافي
            updateBanner.style.cssText = `
                position: fixed; 
                top: 25px; 
                left: 50%; 
                transform: translateX(-50%);
                background: #ffffff; 
                color: #333; 
                padding: 18px 25px; 
                border-radius: 10px;
                z-index: 10000; 
                direction: rtl; 
                min-width: 360px; 
                box-shadow: 0 5px 25px rgba(0,0,0,0.1);
                text-align: center; 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                border: 1px solid #e0e0e0;
            `;

            updateBanner.innerHTML = `
                <div id="status-text" style="margin-bottom: 12px; font-size: 15px; color: #555;">
                    📦 يتوفر إصدار جديد <strong style="color: #2980b9;">${updateInfo.newVersion}</strong>
                </div>
                
                <div id="prog-bg" style="display:none; background: #f0f0f0; height: 6px; border-radius: 10px; margin: 15px 0; overflow: hidden;">
                    <div id="prog-fill" style="background: #3498db; width: 0%; height: 100%; transition: width 0.3s ease;"></div>
                </div>

                <div style="display: flex; justify-content: center; gap: 12px; margin-top: 5px;">
                    <button id="btn-start" style="background: #3498db; color: white; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-size: 14px; transition: 0.2s;">تحديث الآن</button>
                    <button id="btn-cancel" style="display:none; background: #ecf0f1; color: #e74c3c; border: 1px solid #fab1a0; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-size: 14px;">إلغاء</button>
                    <button id="btn-later" style="background: transparent; color: #95a5a6; border: none; padding: 8px 18px; cursor: pointer; font-size: 14px;">لاحقاً</button>
                </div>
            `;

            document.body.appendChild(updateBanner);

            // إضافة تأثير Hover بسيط للأزرار
            const btnStart = document.getElementById('btn-start');
            btnStart.onmouseover = () => btnStart.style.background = '#2980b9';
            btnStart.onmouseout = () => btnStart.style.background = '#3498db';

            // زر البدء
            document.getElementById('btn-start').addEventListener('click', async () => {
                document.getElementById('btn-start').style.display = 'none';
                document.getElementById('btn-later').style.display = 'none';
                document.getElementById('btn-cancel').style.display = 'inline-block';
                document.getElementById('prog-bg').style.display = 'block';
                
                const result = await ipcRenderer.invoke('download-and-install', updateInfo.updateUrl);
                if (result && !result.success && result.error !== "تم إلغاء التحميل بواسطة المستخدم") {
                    alert("فشل التحميل: " + result.error);
                    updateBanner.remove();
                }
            });

            // زر الإلغاء
            document.getElementById('btn-cancel').addEventListener('click', () => {
                ipcRenderer.send('cancel-download-action');
                updateBanner.remove();
            });

            // زر لاحقاً
            document.getElementById('btn-later').addEventListener('click', () => {
                updateBanner.remove();
            });
        }
    } catch (err) { console.error(err); }
}

// تحديث نسبة التحميل
ipcRenderer.on('download-progress', (event, progress) => {
    const fill = document.getElementById('prog-fill');
    const status = document.getElementById('status-text');
    if(fill) fill.style.width = progress + '%';
    if(status) status.innerText = `جاري التحميل... ${progress}%`;
});

setTimeout(checkForUpdates, 3000);


// دالة منفصلة للجداول عشان الكود ميبقاش "سلطة"
function createTablesSchema() {

    // 1. المستخدمين
    db.run(`CREATE TABLE IF NOT EXISTS system_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'cashier')`);
    try { db.run("ALTER TABLE system_users ADD COLUMN role TEXT DEFAULT 'cashier'"); } catch (e) {}
    db.run("INSERT OR IGNORE INTO system_users (username, password, role) VALUES ('admin', '123', 'admin')");
    try {
    db.run("ALTER TABLE system_users ADD COLUMN permissions TEXT");
} catch(e) { /* العمود موجود بالفعل */ }

    // 2. الأصناف والمخازن
    db.run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, name TEXT, warehouse TEXT, category TEXT, quantity INTEGER DEFAULT 0, buyPrice REAL DEFAULT 0, sellPrice REAL DEFAULT 0, date TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)`);
    db.run(`CREATE TABLE IF NOT EXISTS warehouses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)`);

    // 3. الموردين والعملاء (تأكد من وجود الـ balance للمديونية)
    db.run(`CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, phone TEXT, address TEXT, balance REAL DEFAULT 0, added_date TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, phone TEXT, address TEXT, balance REAL DEFAULT 0, added_date TEXT)`);
    try { db.run("ALTER TABLE customers ADD COLUMN balance REAL DEFAULT 0"); } catch (e) {}
    try { db.run("ALTER TABLE customers ADD COLUMN credit_limit REAL DEFAULT 0"); } catch (e) {}
// ... (الجزء اللي فوق في الدالة زي ما هو)

    // 4. سجل الفواتير (تحديث شامل لكل الأعمدة المطلوبة)
    db.run(`CREATE TABLE IF NOT EXISTS sales_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        customer_name TEXT, 
        customer_phone TEXT, 
        total REAL, 
        discount_value REAL DEFAULT 0,
        tax_value REAL DEFAULT 0,
        final_total REAL DEFAULT 0,
        paid_amount REAL DEFAULT 0,
        remaining_amount REAL DEFAULT 0,
        items_json TEXT,
        payment_method TEXT, 
        date TEXT, 
        net_profit REAL, 
        type TEXT DEFAULT 'sale',
        original_invoice_id INTEGER,
        representative_id INTEGER,
        commission_amount REAL DEFAULT 0,
        warranty_status TEXT,
        discount_scope TEXT DEFAULT 'total'
    )`);

    // ✅ التعديل هنا: ضفنا discount_scope للمصفوفة عشان يضاف للجداول القديمة
    const salesColumns = [
        "customer_phone TEXT", "type TEXT DEFAULT 'sale'", "paid_amount REAL DEFAULT 0",
        "remaining_amount REAL DEFAULT 0", "items_json TEXT", "original_invoice_id INTEGER",
        "discount_value REAL DEFAULT 0", "tax_value REAL DEFAULT 0", "final_total REAL DEFAULT 0",
        "discount_scope TEXT DEFAULT 'total'" // <-- السطر ده كان ناقص وهو سبب المشكلة
    ];
    salesColumns.forEach(col => { try { db.run(`ALTER TABLE sales_history ADD COLUMN ${col}`); } catch (e) {} });

// ... (بقية الدالة زي ما هي)
    // 5. سجل حركات مديونية العملاء (التحصيل والدفع)
    db.run(`CREATE TABLE IF NOT EXISTS customer_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        amount REAL,
        payment_method TEXT,
        note TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    

    // 6. سجل المشتريات
    db.run(`CREATE TABLE IF NOT EXISTS purchase_history (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_name TEXT, total REAL, date TEXT, type TEXT DEFAULT 'purchase')`);

    // 7. المصاريف، الأرباح، الشفتات، واللوجز
    db.run(`CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, reason TEXT, amount REAL, date TEXT, category TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS profit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT UNIQUE, daily_profit REAL DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, message TEXT, type TEXT, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT UNIQUE, value TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS system_shifts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, start_time TEXT, end_time TEXT, cash_total REAL DEFAULT 0, visa_total REAL DEFAULT 0, expenses_total REAL DEFAULT 0, status TEXT DEFAULT 'open')`);
    db.run(`CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT, details TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);

    // 8. الهالك والحجوزات والضمان
    db.run(`CREATE TABLE IF NOT EXISTS damaged_products (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER, quantity REAL, reason TEXT, loss_amount REAL, date TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS reservations (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_name TEXT, product_id INTEGER, quantity REAL, deposit REAL, status TEXT DEFAULT 'pending', date TEXT)`);

    // --- الإعدادات الافتراضية ---
    const today = new Date().toISOString().split('T')[0];
    const defaultSettings = [
        ['company_name', 'اسم المؤسسة'], ['tax_percent', '14'], ['tax_status', '0'],
        ['currency_symbol', 'ج.م'], ['discount_status', '0'], ['discount_type', 'amount'],
        ['stock_alert_limit', '5'], ['auto_print', '0'], ['return_policy_days', '14'], ['invoice_footer', 'شكراً لتعاملكم معنا']
    ];
    defaultSettings.forEach(s => db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [s[0], s[1]]));

    db.run("INSERT OR IGNORE INTO categories (name) VALUES ('عام')");
    db.run("INSERT OR IGNORE INTO warehouses (name) VALUES ('المخزن الرئيسي')");
    db.run("INSERT OR IGNORE INTO customers (name, added_date) VALUES ('عميل نقدي', ?)", [today]);

    if (typeof loadSettings === 'function') loadSettings();
    
}


function saveDbToLocal() {
    const data = db.export();
    localStorage.setItem('warehouse_sqlite_db', JSON.stringify(Array.from(data)));
}

// 4. دالة التشغيل الأساسية
async function initApp() {
    console.log("البرنامج جاهز للعمل بنظام SQLite...");

    // 1. استنى تحميل القاعدة
    await initDatabase(); 
    
    // 2. تحديث الوقت
    updateDateTime(); 
    setInterval(updateDateTime, 1000); 
    updateLiveDateTime();
    
    // 3. سحب اسم الشركة (الكود بتاعك زي ما هو...)
    try {
        const tableCheck = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'");
        if (tableCheck.length > 0) {
            const res = db.exec("SELECT value FROM settings WHERE key = 'company_name'");
            let companyName = "اسم الشركة"; 
            if (res.length > 0 && res[0].values.length > 0) {
                companyName = res[0].values[0][0];
            }
            const companyElem = document.getElementById('display-company-name');
            const sidebarLogoName = document.getElementById('sidebar-logo-name');
            if (companyElem) companyElem.innerText = companyName;
            if (sidebarLogoName) sidebarLogoName.innerText = companyName;
            document.title = companyName;
        }
    } catch (e) {
        console.error("خطأ في تحميل اسم الشركة:", e);
    }

    // --- التعديل الجوهري هنا ---
    
    // 4. تشغيل المبيعات وفتح أول فاتورة أوتوماتيكياً
    if (typeof saleTabs !== 'undefined') {
        // لو المصفوفة فاضية، افتح أول تاب فوراً
        if (saleTabs.length === 0) {
            addNewSaleTab(); 
            console.log("✅ تم فتح الفاتورة الأولى بنجاح");
        } else {
            // لو كانت موجودة بس مش مرسومة، ارسمها
            renderTabsUI();
            switchTab(saleTabs[0].id);
        }
    }

    if (typeof loadMyCategories === 'function') loadMyCategories();
    if (typeof renderReports === 'function') {
        renderReports(); 
    }
}
// دالة لتجهيز الجداول وحل مشكلة الـ Conflict
function fixDatabaseStructure() {
    if (typeof db === 'undefined' || !db) {
        setTimeout(fixDatabaseStructure, 500);
        return;
    }
    try {
        // 1. إضافة Index فريد للاسم عشان الـ ON CONFLICT تشتغل (حل إيرور image_81bfd9)
        db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_prod_name ON products(name)");
        
        // 2. إنشاء جدول سجل المشتريات (عشان الكود والتاريخ)
        db.run(`CREATE TABLE IF NOT EXISTS purchase_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT,
            date TEXT,
            supplier TEXT,
            product TEXT,
            quantity REAL,
            buyPrice REAL,
            total REAL
        )`);
    } catch (e) { console.error("Database Fix Error:", e); }
}
fixDatabaseStructure();

// مثال لتحسين فتح القاعدة
async function startDatabase() {
    const SQL = await initSqlJs({ locateFile: file => `./path/to/${file}` });
    const data = await fetch("./yourdb.db").then(res => res.arrayBuffer());
    db = new SQL.Database(new Uint8Array(data));
    console.log("قاعدة البيانات جاهزة فعلياً الآن");
    
    // الآن فقط ابدأ تحميل البيانات
    initApp(); 
    loadMyCategories();
}
// في ملف script4.js
async function start() {
    await initDatabase(); // الدالة التي تفتح الملف
    initApp(); // الآن استدعي وظائف التطبيق
}





window.checkInventoryAlerts = function() {
    // هنجيب الأصناف اللي كميتها أقل من 5 (ممكن تخلي الـ 5 دي متغيرة بعدين)
    const lowStockProducts = db.exec("SELECT name, quantity FROM products WHERE quantity <= 5");
    
    if (lowStockProducts.length > 0 && lowStockProducts[0].values.length > 0) {
        lowStockProducts[0].values.forEach(prod => {
            const productName = prod[0];
            const qty = prod[1];
            
            // تسجيل تنبيه في قاعدة البيانات لو مش موجود
            db.run("INSERT INTO notifications (title, message, type) VALUES (?, ?, ?)", 
            ['نقص مخزون', `الصنف [${productName}] اقترب من النفاد (المتبقي: ${qty})`, 'warning']);
        });
        
        console.log("⚠️ تم تحديث تنبيهات النواقص");
    }
};














































// 6. العمليات على المنتجات
function saveProduct() {
    const name = document.getElementById('p-name').value.trim();
    const wh = document.getElementById('p-warehouse-select').value;
    const cat = document.getElementById('p-category-select').value;
    const newQty = parseInt(document.getElementById('p-qty').value) || 0;
    const buy = parseFloat(document.getElementById('p-buy').value) || 0;
    const sell = parseFloat(document.getElementById('p-sell').value) || 0;

    if (!name) { alert("يرجى إدخال اسم المنتج"); return; }

    // 1. البحث عما إذا كان المنتج موجود مسبقاً في نفس المخزن
    const checkExist = db.exec("SELECT id, quantity FROM products WHERE name = ? AND warehouse = ?", [name, wh]);

    if (checkExist.length > 0) {
        // المنتج موجود -> تحديث الكمية (الكمية الحالية + الكمية المدخلة)
        const existingId = checkExist[0].values[0][0];
        const existingQty = checkExist[0].values[0][1];
        const updatedQty = existingQty + newQty;

        db.run(`UPDATE products SET 
                quantity = ?, 
                buyPrice = ?, 
                sellPrice = ?,
                category = ?
                WHERE id = ?`, [updatedQty, buy, sell, cat, existingId]);
        
        console.log(`تم تحديث كمية المنتج: ${name}. الكمية الجديدة: ${updatedQty}`);
    } else {
        // المنتج غير موجود -> إضافة كمنتج جديد
        const autoCode = "P-" + Date.now().toString().slice(-6);
        const today = new Date().toISOString().split('T')[0];

        db.run(`INSERT INTO products (code, name, warehouse, category, quantity, buyPrice, sellPrice, date) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [autoCode, name, wh, cat, newQty, buy, sell, today]);
        
        console.log(`تم إضافة منتج جديد: ${name}`);
    }

    saveDbToLocal();
    renderInventory();
    closeAllModals();
}
function editProduct(id) {
    currentEditId = id; // تخزين الـ ID
    
    // جلب بيانات المنتج من القاعدة
    const res = db.exec("SELECT * FROM products WHERE id = ?", [id]);
    if (res.length > 0) {
        const p = res[0].values[0]; // صف المنتج

        // فتح المودال وتعبئة البيانات
        document.getElementById('modal-product').style.display = 'flex';
        fillSelects(); // عشان الـ selects تملأ الأول

        // تعبئة الحقول (row[2] هو الاسم، row[5] الكمية، إلخ)
        document.getElementById('p-name').value = p[2];
        document.getElementById('p-warehouse-select').value = p[3];
        document.getElementById('p-category-select').value = p[4];
        document.getElementById('p-qty').value = p[5];
        document.getElementById('p-buy').value = p[6];
        document.getElementById('p-sell').value = p[7];

        // تغيير شكل المودال ليكون وضع "تعديل"
        document.querySelector('#modal-product h2').innerText = "تعديل منتج";
        const saveBtn = document.querySelector('#modal-product .btn-green');
        saveBtn.innerText = "تحديث البيانات";
        saveBtn.onclick = updateProduct; // نغير وظيفة الزرار
    }
}
function updateProduct() {
    const name = document.getElementById('p-name').value;
    const wh = document.getElementById('p-warehouse-select').value;
    const cat = document.getElementById('p-category-select').value;
    const qty = parseInt(document.getElementById('p-qty').value) || 0;
    const buy = parseFloat(document.getElementById('p-buy').value) || 0;
    const sell = parseFloat(document.getElementById('p-sell').value) || 0;

    // أمر الـ SQL للتحديث
    db.run(`UPDATE products SET 
            name = ?, warehouse = ?, category = ?, 
            quantity = ?, buyPrice = ?, sellPrice = ? 
            WHERE id = ?`, 
            [name, wh, cat, qty, buy, sell, currentEditId]);

    saveDbToLocal(); // حفظ التغييرات
    renderInventory(); // تحديث الجدول
    closeAllModals();
    
    // إعادة المودال لوضعه الطبيعي (إضافة)
    resetProductModal();
}

function resetProductModal() {
    currentEditId = null;
    document.querySelector('#modal-product h2').innerText = "إضافة منتج جديد";
    const saveBtn = document.querySelector('#modal-product .btn-green');
    saveBtn.innerText = "حفظ المنتج";
    saveBtn.onclick = saveProduct;
    clearProductFields();
}

function renderInventory() {
    const tbody = document.querySelector("#inventory-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    // 1. جلب إعدادات حد الأمان من القاعدة
    const alertLimit = parseInt(getSetting('stock_alert_limit')) || 5;
    const isAlertActive = getSetting('stock_alert_status') === '1';

    const res = db.exec("SELECT * FROM products");
    if (res.length > 0) {
        res[0].values.forEach(row => {
            // الكمية موجودة في row[5] حسب كودك
            const qty = Number(row[5]); 
            
            // 2. فحص هل الكمية وصلت لحد الأمان؟
            const isLow = isAlertActive && qty <= alertLimit;
            
            // 3. تحديد كلاس التنبيه أو الستايل
            // لو الكمية قليلة هنضيف كلاس low-stock ونخلي الخلفية حمراء خفيفة
            const alertClass = isLow ? 'low-stock-alert' : '';
            const alertStyle = isLow ? 'background-color: #ffeaea; color: #d63031; font-weight: bold;' : '';

            tbody.innerHTML += `
                <tr style="${alertStyle}" class="${alertClass}">
                    <td>${row[1]}</td> 
                    <td>${row[2]}</td>
                    <td><span class="badge-warehouse">${row[3]}</span></td>
                    <td>${row[4]}</td>
                    <td style="font-size: 1.1em;">
                        ${qty} 
                        ${isLow ? '<i class="fas fa-exclamation-triangle" title="مخزون منخفض!"></i>' : ''}
                    </td>
                    <td>${Number(row[6]).toFixed(2)}</td>
                    <td>${Number(row[7]).toFixed(2)}</td>
                    <td>${row[8]}</td>
                    <td>
                        <button class="action-btn edit" onclick="editProduct(${row[0]})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="deleteProduct(event, ${row[0]})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
        });
    }
}

window.deleteProduct = function(event, productId) {
    if (event) event.stopPropagation();

    // 1. قفش الصف (المنتج) فوراً قبل أي حاجة
    if (!event) return;
if (!event) return;
const btnClicked = event.currentTarget;
    const rowToDelete = btnClicked.closest('tr') || btnClicked.closest('li');

    // 2. تنظيف أي بوكس قديم
    const oldBox = document.querySelector('.inline-confirm-box');
    if (oldBox) oldBox.remove();

    // 3. إنشاء المربعات الرقيقة
    const box = document.createElement('div');
    box.className = 'inline-confirm-box';
    
    Object.assign(box.style, {
        position: 'absolute',
        backgroundColor: '#ffffff',
        padding: '6px',
        borderRadius: '10px',
        display: 'flex',
        gap: '8px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
        zIndex: '100000',
        border: '1px solid #f0f0f0',
        transform: 'translate(-50%, -130%)'
    });

    box.innerHTML = `
        <button id="ok-prod" style="background:#e3f9e5; color:#27ae60; border:none; width:32px; height:32px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fas fa-check"></i></button>
        <button id="no-prod" style="background:#feeaea; color:#e74c3c; border:none; width:32px; height:32px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fas fa-times"></i></button>
    `;

    // 4. تحديد المكان فوق الزرار
    const rect = btnClicked.getBoundingClientRect();
    box.style.left = (rect.left + rect.width / 2 + window.scrollX) + 'px';
    box.style.top = (rect.top + window.scrollY) + 'px';

    document.body.appendChild(box);

    // 5. تنفيذ الحذف عند الضغط على صح
    document.getElementById('ok-prod').onclick = function() {
        try {
            // حذف من جدول المنتجات
            db.run(`DELETE FROM products WHERE id = ?`, [productId]);
            saveDbToLocal();
            
            // مسح الصف من الشاشة بـ "رقة"
            if (rowToDelete) {
                rowToDelete.style.transition = '0.3s';
                rowToDelete.style.opacity = '0';
                setTimeout(() => rowToDelete.remove(), 300);
            }

            // تحديث القائمة لو الدالة موجودة
            if (typeof renderProducts === 'function') renderProducts();

            box.remove();
            showToast("تم حذف المنتج بنجاح ✅");
        } catch (e) {
            console.error("خطأ حذف المنتج:", e);
            showToast("حدث خطأ أثناء الحذف", "error");
        }
    };

    // 6. إلغاء
    document.getElementById('no-prod').onclick = () => box.remove();

    // إغلاق عند الضغط بعيداً
    setTimeout(() => {
        const closeBox = (e) => {
            if (!box.contains(e.target)) {
                box.remove();
                document.removeEventListener('click', closeBox);
            }
        };
        document.addEventListener('click', closeBox);
    }, 10);
};


// ادارة الاقسام 


window.openCatModal = function() {
    currentManageMode = 'category'; // تحديد إننا شغالين على الأقسام
    document.getElementById('manage-title').innerText = "إدارة الأقسام";
    
    // جلب الأقسام من الـ SQL
    const res = db.exec("SELECT rowid, name FROM categories");
    const listHtml = document.getElementById('items-list');
    
    if (res.length > 0) {
        listHtml.innerHTML = res[0].values.map(row => `
            <li>
                <span>${row[1]}</span>
                <button class="delete-item-btn" onclick="deleteCategory(${row[0]})">
                    <i class="fas fa-times"></i>
                </button>
            </li>
        `).join('');
    } else {
        listHtml.innerHTML = "<li>لا توجد أقسام مضافة</li>";
    }

    document.getElementById('modal-manage').style.display = 'flex';
};

window.addNewItem = function() {
    const input = document.getElementById('new-item-input');
    const val = input.value.trim();
    
    if (!val) return;

    if (currentManageMode === 'category') {
        // إدخال القسم الجديد في SQL
        db.run("INSERT INTO categories (name) VALUES (?)", [val]);
        saveDbToLocal(); // حفظ القاعدة
        openCatModal(); // إعادة تحميل القائمة في المودال
    } else if (currentManageMode === 'warehouse') {
        db.run("INSERT INTO warehouses (name) VALUES (?)", [val]);
        saveDbToLocal();
        openWarehouseModal(); 
    }
    
    input.value = ''; // تنظيف الحقل
    fillSelects(); // تحديث القوائم اللي جوه مودال إضافة المنتج
};

window.deleteCategory = function(id) {
    if (confirm("هل أنت متأكد من حذف هذا القسم؟")) {
        db.run("DELETE FROM categories WHERE rowid = ?", [id]);
        saveDbToLocal();
        openCatModal();
        fillSelects();
    }
};


// ادارة المخازن

window.openWarehouseModal = function() {
    currentManageMode = 'warehouse'; // تحديد الوضع
    document.getElementById('manage-title').innerText = "إدارة المخازن";
    
    // جلب المخازن من SQLite
    const res = db.exec("SELECT rowid, name FROM warehouses");
    const listHtml = document.getElementById('items-list');
    
    if (res.length > 0) {
        listHtml.innerHTML = res[0].values.map(row => `
            <li>
                <span>${row[1]}</span>
                <button class="delete-item-btn" onclick="deleteWarehouse(${row[0]})">
                    <i class="fas fa-times"></i>
                </button>
            </li>
        `).join('');
    } else {
        listHtml.innerHTML = "<li>لا توجد مخازن مضافة</li>";
    }

    document.getElementById('modal-manage').style.display = 'flex';
};




window.fillSelects = function() {
    const catSelect = document.getElementById('p-category-select');
    const whSelect = document.getElementById('p-warehouse-select');

    // جلب الأقسام
    const cRes = db.exec("SELECT name FROM categories");
    if (cRes.length > 0 && catSelect) {
        catSelect.innerHTML = cRes[0].values.map(v => `<option value="${v[0]}">${v[0]}</option>`).join('');
    }

    // جلب المخازن
    const wRes = db.exec("SELECT name FROM warehouses");
    if (wRes.length > 0 && whSelect) {
        whSelect.innerHTML = wRes[0].values.map(v => `<option value="${v[0]}">${v[0]}</option>`).join('');
    }
};

window.deleteWarehouse = function(id) {
    if (confirm("هل أنت متأكد من حذف هذا المخزن؟")) {
        db.run("DELETE FROM warehouses WHERE rowid = ?", [id]);
        saveDbToLocal(); // حفظ التغيير
        openWarehouseModal(); // تحديث القائمة في المودال
        fillSelects(); // تحديث القوائم المنسدلة في شاشة إضافة المنتج
    }
};

window.filterByWarehouse = function(whName) {
    let query = "SELECT * FROM products";
    let params = [];

    if (whName !== "all") {
        query += " WHERE warehouse = ?";
        params.push(whName);
    }

    const res = db.exec(query, params);
    renderTableFromData(res); // دالة بتعرض البيانات المفلترة
};

function renderTableFromData(res) {
    const tbody = document.querySelector("#inventory-table tbody");
    tbody.innerHTML = "";
    if (res.length > 0) {
        res[0].values.forEach(row => {
            // نفس كود الـ render اللي عملناه قبل كدة
            tbody.innerHTML += `<tr>...</tr>`; 
        });
    }
}

// الفرز 

window.openSortModal = function() {
    const wSelect = document.getElementById('filter-warehouse');
    const cSelect = document.getElementById('filter-category');

    // جلب المخازن والأقسام من القاعدة
    const wRes = db.exec("SELECT DISTINCT name FROM warehouses");
    const cRes = db.exec("SELECT DISTINCT name FROM categories");

    if (wSelect) {
        wSelect.innerHTML = `<option value="all">كل المخازن</option>` + 
            (wRes.length > 0 ? wRes[0].values.map(v => `<option value="${v[0]}">${v[0]}</option>`).join('') : '');
    }
    
    if (cSelect) {
        cSelect.innerHTML = `<option value="all">كل الأقسام</option>` + 
            (cRes.length > 0 ? cRes[0].values.map(v => `<option value="${v[0]}">${v[0]}</option>`).join('') : '');
    }

    document.getElementById('modal-filter').style.display = 'flex';
};

// ضيف كلمة window لضمان إن الـ HTML يشوفها
window.applyAdvancedFilter = function() {
    // 1. جلب القيم من القوائم
    const wh = document.getElementById('filter-warehouse').value;
    const cat = document.getElementById('filter-category').value;
    
    // 2. تغيير الكلمة (الطريقة المضمونة)
    const titleElement = document.getElementById('current-view-title');
    if (titleElement) {
        let newTitle = (wh === 'all') ? 'كل المخازن' : wh;
        if (cat !== 'all') newTitle += ` - قسم ${cat}`;
        
        titleElement.innerText = newTitle; // هنا التغيير الفعلي
    }

    // 3. كود الـ SQL اللي شغال عندك
    let query = "SELECT * FROM products WHERE 1=1";
    let params = [];
    if (wh !== "all") { query += " AND warehouse = ?"; params.push(wh); }
    if (cat !== "all") { query += " AND category = ?"; params.push(cat); }

    const res = db.exec(query, params);
    renderInventoryFromData(res);
    closeAllModals();
};

function clearProductFields() {
    const fields = ['p-name', 'p-qty', 'p-buy', 'p-sell'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function renderInventoryFromData(res) {
    const tbody = document.querySelector("#inventory-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (res && res.length > 0) {
        res[0].values.forEach(row => {
            tbody.innerHTML += `
                <tr>
                    <td>${row[1]}</td> <td>${row[2]}</td> <td><span class="badge-warehouse">${row[3]}</span></td> <td>${row[4]}</td> <td class="${row[5] < 5 ? 'low-stock' : ''}">${row[5]}</td> <td>${Number(row[6]).toFixed(2)}</td> <td>${Number(row[7]).toFixed(2)}</td> <td>${row[8]}</td> <td>
                        <button class="action-btn edit" onclick="editProduct(${row[0]})"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete" onclick="deleteProduct(event, ${row[0]})">
    <i class="fas fa-trash"></i>
</button>
                    </td>
                </tr>`;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">لا توجد نتائج</td></tr>`;
    }
}

window.quickSearch = function(text) {
    const res = db.exec("SELECT * FROM products WHERE name LIKE ?", [`%${text}%`]);
    renderInventoryFromData(res);
};


window.updateDateTime = function() {
    const now = new Date();
    // ... كود الساعة ...
};

window.openProductModal = function() {
    document.getElementById('modal-product').style.display = 'flex';
    fillSelects();
};

window.searchProductForSale = function(term) {
    if (term.length < 2) return; // يبدأ بحث بعد كتابة حرفين

    // استعلام SQL لجلب المنتج بالاسم أو الكود
    const res = db.exec("SELECT name, sellPrice, quantity FROM products WHERE name LIKE ? OR code LIKE ?", [`%${term}%`, `%${term}%`]);

    if (res.length > 0) {
        // هنا هنعرض النتائج في قائمة منسدلة تحت البحث (هعملك الكود بتاعها الجولة الجاية)
        console.log("النتائج:", res[0].values);
    }
};


// قسم الشراء 








window.updateItem = function(index, field, val) {
    currentPurchaseList[index][field] = parseFloat(val) || 0;
    renderPurchaseTable();
};
window.updateRow = function(index, field, val) {
    currentPurchaseItems[index][field] = parseFloat(val) || 0;
    renderPurchaseTable();
};
window.removeItem = function(index) {
    currentPurchaseList.splice(index, 1);
    renderPurchaseTable();
};

window.updatePurchaseItem = function(index, field, value) {
    purchaseItems[index][field] = parseFloat(value) || 0;
    renderPurchaseTable();
};

window.removePurchaseItem = function(index) {
    purchaseItems.splice(index, 1);
    renderPurchaseTable();
};

// 1. دالة إضافة صنف للفاتورة
window.addToPurchaseCart = function() {
    const productName = document.getElementById('purchase-search').value;
    if (!productName) return alert("اختر صنفاً أولاً");

    const newItem = {
        name: productName,
        qty: 1,
        buyPrice: 0,
        sellPrice: 0
    };
    
    purchaseItems.push(newItem);
    renderPurchaseTable();
    document.getElementById('purchase-search').value = ""; 
};

// 3. الدالة الكبرى: حفظ الفاتورة وتحديث المخزن
window.savePurchaseInvoice = function() {
    if (purchaseItems.length === 0) return alert("الفاتورة فارغة");
    
    const supplier = document.getElementById('supplier-name').value || "مورد عام";
    const el = document.getElementById('purchase-final-total');
    const total = el ? parseFloat(el.innerText) : 0;
    try {
        // أ. تسجيل الفاتورة في السجل بنوع 'وارد'
        db.run("INSERT INTO sales_history (date, type, customer_name, total) VALUES (?, ?, ?, ?)", 
            [new Date().toISOString(), 'وارد', supplier, totalAmount]);

        // ب. تحديث المخزن (زيادة الكمية وتعديل السعر)
        purchaseItems.forEach(item => {
            const exists = db.exec("SELECT id FROM products WHERE name = ?", [item.name]);
            if (exists.length > 0) {
                // إذا كان المنتج موجوداً: زود الكمية وحدث السعر
                db.run("UPDATE products SET quantity = quantity + ?, buyPrice = ?, sellPrice = ? WHERE name = ?", 
                    [item.qty, item.buyPrice, item.sellPrice, item.name]);
            } else {
                // إذا كان منتجاً جديداً: أضفه للمخزن
                db.run("INSERT INTO products (name, quantity, buy_price, sell_price, category) VALUES (?, ?, ?, ?, ?)", 
                    [item.name, item.qty, item.buyPrice, item.sellPrice, 'عام']);
            }
        });

        alert("تم حفظ المشتريات بنجاح وتحديث المخزن ✅");
        purchaseItems = []; // تصفير الفاتورة
        renderPurchaseTable();
        document.getElementById('supplier-name').value = "";
    } catch (e) {
        console.error("فشل حفظ المشتريات:", e);
    }
};

window.searchProduct = function(query, type) {
    const resultsDiv = document.getElementById('purchase-results');
    if (!query) {
        resultsDiv.style.display = 'none';
        return;
    }

    try {
        const res = db.exec("SELECT name, buyPrice, sellPrice FROM products WHERE name LIKE ?", [`%${query}%`]);
        resultsDiv.innerHTML = "";
        
        if (res.length > 0 && res[0].values) {
            resultsDiv.style.display = 'block';
            res[0].values.forEach(row => {
                const div = document.createElement('div');
                div.className = 'search-item';
                div.style.padding = '10px';
                div.style.cursor = 'pointer';
                div.innerHTML = `<i class="fas fa-box"></i> ${row[0]} - <small>${row[1]} ج.م</small>`;
                div.onclick = () => selectProductForPurchase(row[0], row[1], row[2]);
                resultsDiv.appendChild(div);
            });
        } else {
            resultsDiv.style.display = 'none';
        }
    } catch (e) { console.error(e); }
};

window.selectProductForPurchase = function(name, buyPrice, sellPrice) {
    document.getElementById('purchase-search').value = name;
    document.getElementById('purchase-results').style.display = 'none';
    handleManualEntry(buyPrice, sellPrice);
};

window.handleManualEntry = function(bPrice = 0, sPrice = 0) {
    const name = document.getElementById('purchase-search').value;
    if (!name) return;

    // إضافة الصنف للمصفوفة
    currentPurchaseList.push({
        name: name,
        buyPrice: bPrice,
        sellPrice: sPrice,
        qty: 1
    });

    renderPurchaseTable();
    document.getElementById('purchase-search').value = "";
};


// 1. تهيئة المصفوفة (مرة واحدة فقط)
if (typeof window.purchaseItems === 'undefined') {
    window.purchaseItems = [];
}

// 2. دالة البحث الذكي (تستدعي الأسعار)

window.searchWithLocation = function(val) {
    window.selectedIndex = -1; // صفر العداد عند كل بحث جديد
    const resultsDiv = document.getElementById('purchase-results');
    if (!val || val.length < 1) { 
        resultsDiv.style.display = 'none'; 
        selectedIndex = -1;
        return; 
    }

    try {
        const res = db.exec("SELECT id, name, buyPrice, sellPrice, warehouse, category FROM products WHERE name LIKE ? LIMIT 5", [`%${val}%`]);
        selectedIndex = -1; // إعادة تعيين التحديد عند كل كتابة جديدة

        if (res.length > 0 && res[0].values) {
            resultsDiv.innerHTML = res[0].values.map((row, index) => `
                <div class="search-item" id="res-item-${index}" style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; background: white;" 
                    onclick="selectForPurchase('${row[1]}', ${row[2]}, ${row[3]}, '${row[4]}', '${row[5]}')">
                    <div style="display: flex; justify-content: space-between;">
                        <b>${row[1]}</b>
                        <small>📍 ${row[4] || 'المخزن'}</small>
                    </div>
                </div>
            `).join('');
            resultsDiv.style.display = 'block';
        } else {
            resultsDiv.innerHTML = "<div style='padding:12px; color:#94a3b8;'>✨ صنف جديد.. اضغط Enter للمتابعة</div>";
            resultsDiv.style.display = 'block';
        }
    } catch (e) { console.error(e); }
};

// 3. دالة اختيار المنتج وملء الخانات
window.selectForPurchase = function(name, buyPrice, sellPrice, wh, cat) {
    document.getElementById('purchase-search').value = name;
    document.getElementById('purchase-buy-price').value = buyPrice || 0;
    document.getElementById('purchase-sell-price').value = sellPrice || 0;
    document.getElementById('target-warehouse').value = wh || "المخزن الرئيسي";
    document.getElementById('target-category').value = cat || "عام";
    
    // الحل هنا: خلى الكمية 1 دايماً عند اختيار صنف موجود عشان تحدد الجديد بس
    const qtyInput = document.getElementById('purchase-qty-input');
    qtyInput.value = "1"; 
    
    document.getElementById('purchase-results').style.display = 'none';
    qtyInput.focus();
    qtyInput.select(); // يحدد الرقم عشان لو كتبت يمسح الـ 1 ويكتب رقمك فوراً
};

// 4. معالجة مفاتيح الكيبورد
// تعريف المتغير في النطاق العام
window.selectedIndex = -1;

window.handlePurchaseKeys = function(e) {
    const resultsDiv = document.getElementById('purchase-results');
    const items = resultsDiv.querySelectorAll('.search-item');
    const activeId = document.activeElement.id; // نحدد العنصر النشط في أول الدالة

    // 1. حركة الأسهم (تشتغل فقط لو قائمة البحث مفتوحة وفيها عناصر)
    if (resultsDiv.style.display === 'block' && items.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            window.selectedIndex = (window.selectedIndex + 1) % items.length;
            updateSearchSelection(items);
            return; // اخرج من الدالة عشان ميكملش للـ Enter
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            window.selectedIndex = (window.selectedIndex - 1 + items.length) % items.length;
            updateSearchSelection(items);
            return;
        }
    }

    // 2. التعامل مع مفتاح Enter للتنقل أو الإضافة
    if (e.key === 'Enter') {
        e.preventDefault(); // منع أي سلوك افتراضي للمتصفح

        // حالة أ: لو فاتح البحث ومختار صنف بالأسهم.. دوس Enter يختاره
        if (activeId === 'purchase-search' && window.selectedIndex > -1) {
            if (items[window.selectedIndex]) {
                items[window.selectedIndex].click();
                window.selectedIndex = -1;
                return;
            }
        }

        // حالة ب: التنقل التسلسلي بين الخانات
        if (activeId === 'purchase-search') {
            // لو الخانة فاضية وداس Enter (ومش مختار حاجة بالأسهم)
            if (!document.getElementById('purchase-search').value.trim()) {
                showToast("⚠️ اكتب اسم المنتج أولاً", "error");
                return;
            }
            document.getElementById('purchase-qty-input').focus();
            document.getElementById('purchase-qty-input').select();
            
        } else if (activeId === 'purchase-qty-input') {
            document.getElementById('purchase-buy-price').focus();
            document.getElementById('purchase-buy-price').select();
            
        } else if (activeId === 'purchase-buy-price') {
            document.getElementById('purchase-sell-price').focus();
            document.getElementById('purchase-sell-price').select();
            
        } else if (activeId === 'purchase-sell-price') {
            // إضافة المنتج للجدول وتصفير الخانات
            addNewItemToPurchaseTable();
            // الرجوع لأول خانة لبدء صنف جديد
            document.getElementById('purchase-search').focus();
            window.selectedIndex = -1; 
        }
    }
};

// دالة التلوين باستخدام الكلاس
function updateSearchSelection(items) {
    items.forEach((item, idx) => {
        if (idx === window.selectedIndex) {
            item.classList.add('selected-item');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected-item');
        }
    });
}


window.loadMyCategories = function() {
    // التأكد إن db موجودة وشغالة
    if (typeof db === 'undefined' || !db) {
        console.log("قاعدة البيانات لسه مش جاهزة.. هجرب كمان نص ثانية");
        setTimeout(window.loadMyCategories, 500); // بيلف يرجع للدالة تاني بعد 500 مللي ثانية
        return;
    }
    else {
        console.log("قاعدة البيانات جاهزة   ");
    }

    try {
        const res = db.exec("SELECT name FROM categories");
        const catSelect = document.getElementById('target-category');
        
        if (res.length > 0 && res[0].values) {
            catSelect.innerHTML = res[0].values.map(row => 
                `<option value="${row[0]}">${row[0]}</option>`
            ).join('');
        } else {
            catSelect.innerHTML = `<option value="عام">عام</option>`;
        }
    } catch (e) {
        console.error("مش عارف أوصل للأقسام اللي أنت عاملها:", e);
    }
};

// شغّلها مرة واحدة، وهي هتكرر نفسها لو db لسه مجهزش
window.loadMyCategories();

let openTabs = [{ id: 1, cart: [], customer: 'عميل 1' }];
let activeTabId = 1;

window.addNewTab = function() {
    const newId = openTabs.length + 1;
    openTabs.push({ id: newId, cart: [], customer: `عميل ${newId}` });
    renderTabs(); // دالة ترسم التابات فوق
};
// 1. تهيئة المصفوفة المؤقتة للفاتورة
window.purchaseItems = [];

// 2. دالة إضافة صنف للجدول (قبل الاعتماد)
window.addNewItemToPurchaseTable = function() {
    const searchInput = document.getElementById('purchase-search');
    const qtyInput = document.getElementById('purchase-qty-input');
    
    const name = searchInput.value.trim();
    const qty = parseFloat(qtyInput.value) || 0;
    const bPrice = parseFloat(document.getElementById('purchase-buy-price').value) || 0;
    const sPrice = parseFloat(document.getElementById('purchase-sell-price').value) || 0;
    const wh = document.getElementById('target-warehouse').value;
    const cat = document.getElementById('target-category').value;

    // 1. الفحص: لو الاسم فاضي أو الكمية صفر
    if (!name) {
        showToast("⚠️ برجاء اختيار أو كتابة اسم المنتج", "error");
        searchInput.focus();
        return; // الخروج فوراً ومنع التعليق
    }
    
    if (qty <= 0) {
        showToast("⚠️ برجاء إدخال كمية صحيحة", "error");
        qtyInput.focus();
        qtyInput.select();
        return;
    }

    // 2. إضافة المنتج للمصفوفة
    window.currentPurchaseItems.push({
        name: name,
        quantity: qty,
        buyPrice: bPrice,
        sellPrice: sPrice,
        warehouse: wh,
        category: cat
    });

    // 3. تحديث الواجهة
    renderPurchaseTable(); 
    
    // 4. تنظيف الحقول وتجهيزها للاسم الجديد
    searchInput.value = "";
    qtyInput.value = "1";
    document.getElementById('purchase-buy-price').value = "0";
    document.getElementById('purchase-sell-price').value = "0";
    
    // إخفاء نتائج البحث لو لسه ظاهرة
    document.getElementById('purchase-results').style.display = 'none';
    
    searchInput.focus();
    showToast("تم إضافة الصنف للفاتورة ✅");
};

// 3. دالة رسم جدول الفاتورة (الوارد)
window.renderPurchaseTable = function() {
    const tbody = document.querySelector("#purchase-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    let grandTotal = 0;
    window.currentPurchaseItems.forEach((item, index) => {
        const rowTotal = Number((item.buyPrice * item.quantity).toFixed(2));
        const total = Number((item.price * item.qty).toFixed(2));
        tbody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td><span class="badge-warehouse">${item.warehouse}</span></td>
                <td>${item.buyPrice.toFixed(2)}</td>
                <td>${item.sellPrice.toFixed(2)}</td>
                <td><b>${item.quantity}</b></td>
                <td><b>${rowTotal.toFixed(2)}</b></td>
                <td>
                    <button class="action-btn delete" onclick="window.currentPurchaseItems.splice(${index},1); renderPurchaseTable();">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>`;
    });
    
    const finalTotalEl = document.getElementById('purchase-final-total');
    if (finalTotalEl) finalTotalEl.innerText = grandTotal.toFixed(2);
};
document.addEventListener('DOMContentLoaded', () => {
    const supplierInput = document.getElementById('supplier-name');
    const resultsList = document.getElementById('supplier-results');

    if (supplierInput && resultsList) {
        supplierInput.addEventListener('input', function() {
            const val = this.value.trim();
            resultsList.innerHTML = '';
            
            if (val.length === 0) {
                resultsList.style.display = 'none';
                return;
            }

            try {
                // البحث في قاعدة البيانات عن الأسماء التي تحتوي على الحروف المكتوبة
                const res = db.exec(`SELECT name FROM suppliers WHERE name LIKE '%${val}%'`);
                
                if (res.length > 0 && res[0].values.length > 0) {
                    resultsList.style.display = 'block';
                    res[0].values.forEach(row => {
                        const li = document.createElement('li');
                        li.textContent = row[0];
                        li.onclick = function() {
                            supplierInput.value = row[0];
                            resultsList.style.display = 'none';
                        };
                        resultsList.appendChild(li);
                    });
                } else {
                    resultsList.style.display = 'none';
                }
            } catch (e) {
                console.error("خطأ في بحث الموردين:", e);
            }
        });

        // إخفاء القائمة عند الضغط في أي مكان آخر
        document.addEventListener('click', (e) => {
            if (e.target !== supplierInput) resultsList.style.display = 'none';
        });
    }
});

// 4. الدالة الكبرى: اعتماد الفاتورة وترحيلها للمخزن
window.processSmartPurchase = function() {
  // 1. اسحب القيمة أولاً
const supplierInput = document.getElementById('supplier-name');
// 2. تحقق لو الخانة موجودة وليها قيمة، وإلا استخدم البديل
const supplierName = (supplierInput && supplierInput.value.trim()) || 'مورد عام';
    const tableBody = document.querySelector('#purchase-table tbody');
    const finalTotalElement = document.getElementById('purchase-final-total');
    const finalTotal = parseFloat(finalTotalElement.innerText) || 0;

    if (tableBody.rows.length === 0) return showToast("الفاتورة فارغة! ⚠️", "error");

    try {
        // 1. التعامل مع المورد
        const checkSupplier = db.exec(`SELECT id FROM suppliers WHERE name = '${supplierName}'`);
        if (checkSupplier.length === 0) {
            db.run(`INSERT INTO suppliers (name, added_date, balance) VALUES (?, ?, 0)`, 
                   [supplierName, new Date().toLocaleDateString('en-CA')]);
        }
        db.run(`UPDATE suppliers SET balance = balance + ? WHERE name = ?`, [finalTotal, supplierName]);

        // 2. تحديث المخزن (المنتجات)
        window.currentPurchaseItems.forEach(item => {
            const checkProd = db.exec("SELECT id FROM products WHERE name = ? AND warehouse = ?", [item.name, item.warehouse]);
            
            if (checkProd.length > 0) {
                db.run(`UPDATE products SET quantity = quantity + ?, buyPrice = ?, sellPrice = ? WHERE name = ? AND warehouse = ?`, 
                        [item.quantity, item.buyPrice, item.sellPrice, item.name, item.warehouse]);
            } else {
                const generatedCode = "P-" + Math.floor(1000 + Math.random() * 9999);
                db.run(`INSERT INTO products (name, code, warehouse, category, quantity, buyPrice, sellPrice, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
                        [item.name, generatedCode, item.warehouse, item.category, item.quantity, item.buyPrice, item.sellPrice, new Date().toLocaleDateString('en-CA')]);
            }
        });

        // 3. سجل الفواتير
        db.run(`INSERT INTO sales_history (customer_name, total, type, date, net_profit, payment_method) VALUES (?, ?, ?, ?, ?, ?)`,
               [supplierName, finalTotal, 'purchase', new Date().toISOString(), 0, 'وارد']);

        // 4. حفظ وتحديث الواجهة
        saveDbToLocal();
        showToast("تم اعتماد الفاتورة   ✅");
        window.purchaseItems = []; 
        if (window.currentPurchaseItems) window.currentPurchaseItems = [];
        // --- تنظيف الذاكرة ---
        document.getElementById('supplier-name').value = "";
        tableBody.innerHTML = "";
        finalTotalElement.innerText = "0.00";
        window.purchaseItems = []; 

        // تحديث التقارير والمخزن فوراً
        if (typeof renderInventory === 'function') renderInventory();
        if (typeof renderReports === 'function') renderReports(); 

    } catch (e) {
        console.error("خطأ في عملية الشراء:", e);
        showToast("حدث خطأ أثناء الحفظ: " + e.message, "error");
    }
};
window.addLog = function(action, details) {
const user = localStorage.getItem('last_logged_user') || 'System';
db.run("INSERT INTO activity_logs (user_name, action_type, details) VALUES (?, ?, ?)", [user, action, details]);

// مثال للاستخدام في دالة البيع عندك:
// addLog("عملية بيع", `تم إصدار فاتورة بمبلغ ${totalAmount}`);
};



window.showToast = function(message, type = 'success') {
    // 1. حذف أي توست قديم عشان ميزحمش الشاشة
    const oldToast = document.getElementById('custom-toast');
    if (oldToast) oldToast.remove();

    // 2. إنشاء عنصر التوست
    const toast = document.createElement('div');
    toast.id = 'custom-toast';
    toast.innerText = message;

    // 3. تنسيق التوست مباشرة (عشان نضمن الشكل الشيك)
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '50px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: type === 'success' ? '#27ae60' : '#e74c3c', // أخضر للنجاح وأحمر للخطأ
        color: 'white',
        padding: '5px 12px',
        borderRadius: '50px', // شكل كبسولة شيك
        fontSize: '10px',
        fontWeight: 'bold',
        zIndex: '10000',
        boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
        opacity: '0',
        transition: 'all 0.4s ease',
        textAlign: 'center',
        minWidth: '110px',
        maxWidth: '110px'
    });

    document.body.appendChild(toast);

    // 4. حركات الظهور والاختفاء
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.bottom = '70px'; // رفعة خفيفة لفوق وهو بيظهر
    }, 100);

    // 5. يختفي بعد ثانيتين
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.bottom = '50px';
        setTimeout(() => toast.remove(), 400);
    }, 2500);
};

window.deletePerson = function(event, id, type) {
    // 1. فحص الأمان: لو الـ id مش موجود اخرج فوراً
    if (id === undefined || id === null) {
        console.error("ID is undefined!");
        return; 
    }

    event.stopPropagation();
    const old = document.querySelector('.inline-confirm-box');
    if(old) old.remove();

    const rect = event.currentTarget.getBoundingClientRect();
    const box = document.createElement('div');
    box.className = 'inline-confirm-box';
    box.innerHTML = `
        <button class="mini-sq-btn btn-confirm-ok" id="exec-del"><i class="fas fa-check"></i></button>
        <button class="mini-sq-btn btn-confirm-no" id="cancel-del"><i class="fas fa-times"></i></button>
    `;

    // حساب الإحداثيات بدقة فوق الزرار
    box.style.left = (rect.left + rect.width / 2 + window.scrollX) + 'px';
    box.style.top = (rect.top + window.scrollY) + 'px';

    document.body.appendChild(box);

    // تنفيذ الحذف
    document.getElementById('exec-del').onclick = () => {
        try {
            const table = (type === 'suppliers') ? 'suppliers' : 'customers';
            // هنا كان بيحصل الإيرور لو الـ id مش متعرف
            db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
            saveDbToLocal();
            if (typeof openPeopleModal === 'function') openPeopleModal(type);
            box.remove();
            showToast("تم الحذف ✅");
        } catch (e) {
            console.error(e);
            showToast("فشل الحذف", "error");
        }
    };

    document.getElementById('cancel-del').onclick = () => box.remove();
};





































// فاتورة المبيعات




window.saleSearch = function(val) {
    const resultsDiv = document.getElementById('sale-search-results');
    if (!val || val.length < 1) { resultsDiv.style.display = 'none'; return; }

    // جلب buyPrice و sellPrice من الـ DB
    const res = db.exec("SELECT id, name, sellPrice, quantity, warehouse, buyPrice FROM products WHERE name LIKE ? OR code LIKE ? LIMIT 5", [`%${val}%`, `%${val}%`]);

    if (res.length > 0) {
        resultsDiv.innerHTML = res[0].values.map((row, index) => `
            <div class="search-item" onclick="prepareProduct(${row[0]}, '${row[1]}', ${row[2]}, ${row[3]}, ${row[5]})">
                <div style="display: flex; justify-content: space-between;">
                    <span><b>${row[1]}</b></span>
                    <small style="color: #60a5fa;">${row[4]}</small>
                </div>
                <small>السعر: ${row[2]} | المتاح: ${row[3]}</small>
            </div>
        `).join('');
        resultsDiv.style.display = 'block';
    } else {
        resultsDiv.style.display = 'none';
    }
};



window.prepareProduct = function(id, name, price, stock) {
    selectedProductTemp = { id, name, price, stock };
    document.getElementById('sale-search-results').style.display = 'none';
    document.getElementById('sale-search-input').value = name;
    
    // تركيز على خانة الكمية
    const qtyInput = document.getElementById('sale-qty-input');
    if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
    }
};


window.confirmAddToInvoice = function() {
    // 1. تعريف العناصر الأساسية الأول (عشان نستخدمها تحت)
    const qtyInput = document.getElementById('sale-qty-input');
    const qty = parseFloat(qtyInput.value) || 0;
    const isReturnMode = document.getElementById('return-mode-switch')?.checked;

    // 2. التأكد من اختيار منتج
    if (!selectedProductTemp) {
        showToast("يرجى اختيار منتج أولاً", "error");
        return;
    }

    // 3. التأكد من الكمية
    if (qty <= 0) {
        showToast("يرجى إدخال كمية صحيحة", "error");
        return;
    }

    // --- 4. منطق وضع المرتجع (التأكد من الفاتورة الأصلية) ---
    if (isReturnMode) {
        // بنقارن بالمنتج اللي اخترته selectedProductTemp
        const originalItem = currentOriginalItems.find(i => i.id == selectedProductTemp.id);
        
        if (!originalItem) {
            showToast("هذا المنتج غير موجود في الفاتورة الأصلية!", "error");
            return;
        }

        if (qty > originalItem.qty) {
            showToast(`لا يمكن إرجاع كمية أكبر من المباعة (${originalItem.qty})`, "error");
            return;
        }
        // في المرتجع بنعدي شرط المخزن لأننا بنرجع بضاعة للمخزن
    } else {
        // --- 5. منطق وضع البيع العادي (التأكد من المخزن) ---
        if (qty > selectedProductTemp.stock) {
            showToast("الكمية المطلوبة أكبر من المتاح في المخزن!", "error");
            return;
        }
    }

    // 6. إضافة المنتج للسلة (الجدول اللي تحت)
    addItemToCart(selectedProductTemp.id, selectedProductTemp.name, selectedProductTemp.price, qty, selectedProductTemp.stock);

    // 7. تصفير الحقول للمرة الجاية
// 7. تصفير الحقول والواجهة للمرة الجاية
    selectedProductTemp = null;
    document.getElementById('sale-search-input').value = '';
    qtyInput.value = 1;
    
    // ✅ السطر اللي كان ناقص: تصفير عرض تفاصيل المنتج في الـ UI
    if (typeof updateProductDetails === 'function') {
        updateProductDetails(null); 
    } else {
        // لو مفيش دالة جاهزة، صفر العناصر يدوياً (حسب الأسماء عندك)
        const detailsName = document.getElementById('selected-product-name');
        const detailsPrice = document.getElementById('selected-product-price');
        const detailsStock = document.getElementById('selected-product-stock');
        
        if(detailsName) detailsName.innerText = "-";
        if(detailsPrice) detailsPrice.innerText = "0.00";
        if(detailsStock) detailsStock.innerText = "0";
    }

    document.getElementById('sale-search-input').focus();
    // 8. تحديث الجدول والحسابات
    renderInvoiceTable();
    if (typeof calculateTotal === 'function') calculateTotal();
};



window.addItemToInvoice = function(id, name, price, stock) {
    const currentTab = saleTabs.find(t => t.id === activeTabId);
    if (!currentTab) return;

    const existing = currentTab.cart.find(item => item.id === id);
    const originalInvId = document.getElementById('original-inv-id')?.value;

    if (existing) {
        if (originalInvId) {
            // جلب الكمية الأصلية من قاعدة البيانات لمعرفة كم قطعة أضفنا "الآن"
            const oldRes = db.exec("SELECT items_json FROM sales_history WHERE id = ?", [originalInvId]);
            let oldQty = 0;
            if (oldRes.length > 0 && oldRes[0].values) {
                const oldItems = JSON.parse(oldRes[0].values[0][0]);
                const oldItem = oldItems.find(i => i.id === id);
                if (oldItem) oldQty = oldItem.qty;
            }

            // الزيادة المسموحة = الكمية القديمة + المتاح في المخزن حالياً
            if (existing.qty < (oldQty + stock)) {
                existing.qty++;
            } else {
                alert(`عذراً، الرصيد المتاح في المخزن (${stock}) لا يسمح بزيادة إضافية!`);
                return;
            }
        } else {
            // بيع جديد عادي
            if (existing.qty < stock) {
                existing.qty++;
            } else {
                alert("وصلت لأقصى كمية متاحة في المخزن!");
                return;
            }
        }
    } else {
        // صنف جديد
        if (stock <= 0) {
            alert("هذا المنتج غير متوفر في المخزن!");
            return;
        }
        currentTab.cart.push({ id, name, price, qty: 1, stock });
    }

    document.getElementById('sale-search-results').style.display = 'none';
    document.getElementById('sale-search-input').value = '';
    renderInvoiceTable();
    calculateTotal();
    renderInventory(); // تحديث المخزن فوراً عشان ينعكس التغيير في الكميات المتاحة
};

window.addItemToCart = function(id, name, price, qty, stock) {
    // تحديث دالة الـ Input المباشر بنفس المنطق
    const currentTab = saleTabs.find(t => t.id === activeTabId);
    if (!currentTab) return;

    const existing = currentTab.cart.find(item => item.id === id);
    const originalInvId = document.getElementById('original-inv-id')?.value;

    if (existing) {
        let maxAllowed = stock;
        if (originalInvId) {
            const oldRes = db.exec("SELECT items_json FROM sales_history WHERE id = ?", [originalInvId]);
            if (oldRes.length > 0) {
                const oldItems = JSON.parse(oldRes[0].values[0][0]);
                const oldItem = oldItems.find(i => i.id === id);
                if (oldItem) maxAllowed = oldItem.qty + stock;
            }
        }

        if ((existing.qty + qty) <= maxAllowed) {
            existing.qty += qty;
        } else {
            alert("الكمية تتخطى الرصيد المتاح!");
            return;
        }
    } else {
        currentTab.cart.push({ id, name, price, qty, stock });
    }
    renderInvoiceTable();
    calculateTotal();
    renderInventory();
};
// إضافة تاب جديد
window.addNewSaleTab = function() {
    const newId = saleTabs.length > 0 ? Math.max(...saleTabs.map(t => t.id)) + 1 : 1;
    
    saleTabs.push({
        id: newId,
        name: `فاتورة ${newId}`,
        cart: [],
        customerName: "", // التأكد إنها فاضية
        customerPhone: "",
        paymentMethod: "cash",
        isReturn: false // وضع البيع الافتراضي
    });

    switchTab(newId); 
    
    // تركيز الماوس على خانة البحث عن صنف فوراً
    setTimeout(() => {
        document.getElementById('sale-search-input')?.focus();
    }, 100)
};

// التبديل بين التابات
window.switchTab = function(tabId) {
    activeTabId = tabId;
    renderTabsUI();

    const currentTab = saleTabs.find(t => t.id === tabId);
    if (!currentTab) return;

    // --- تحديث الحقول في الواجهة من بيانات التابة ---
    const nameEl = document.getElementById('sale-customer-name');
    const phoneEl = document.getElementById('sale-customer-phone');
    const methodEl = document.getElementById('sale-payment-method');
    const returnSwitch = document.getElementById('return-mode-switch');

    if (nameEl) nameEl.value = currentTab.customerName || "";
    if (phoneEl) phoneEl.value = currentTab.customerPhone || "";
    if (methodEl) {
        methodEl.value = currentTab.paymentMethod || "cash";
        // تحديث ظهور قسم الآجل لو التابة دي كانت آجل
        if (typeof toggleCreditSection === 'function') toggleCreditSection();
    }

    if (returnSwitch) {
        returnSwitch.checked = currentTab.isReturn || false;
        applyReturnUI(currentTab.isReturn || false);
    }

    // إخفاء تنبيه المديونية والبحث عند التبديل
    document.getElementById('customer-debt-alert').style.display = 'none';
    const resultsDiv = document.getElementById('customer-search-results');
    if (resultsDiv) resultsDiv.style.display = 'none';

    renderInvoiceTable(); 
    calculateTotal();
    // ضيف السطر ده جوه دالة switchTab
const suggestionsDiv = document.getElementById('customer-suggestions');
if (suggestionsDiv) suggestionsDiv.style.display = 'none';
};
function applyReturnUI(isReturn) {
    const returnLabel = document.getElementById('return-label');
    const originalInvSection = document.getElementById('original-inv-section');
    const invoiceContainer = document.querySelector('.invoice-container');
    const btnConfirm = document.querySelector('.btn-confirm');

    if (isReturn) {
        if (returnLabel) { returnLabel.innerText = "وضع المرتجع"; returnLabel.style.color = "#e74c3c"; }
        if (originalInvSection) originalInvSection.style.display = 'block';
        if (invoiceContainer) invoiceContainer.style.borderTop = "5px solid #e74c3c";
        if (btnConfirm) {
            btnConfirm.innerHTML = '<i class="fas fa-undo"></i> إتمام المرتجع';
            btnConfirm.style.background = "#e74c3c";
        }
    } else {
        if (returnLabel) { returnLabel.innerText = "وضع البيع"; returnLabel.style.color = "#666"; }
        if (originalInvSection) originalInvSection.style.display = 'none';
        if (invoiceContainer) invoiceContainer.style.borderTop = "5px solid #27ae60";
        if (btnConfirm) {
            btnConfirm.innerHTML = 'إتمام العملية';
            btnConfirm.style.background = ""; // يرجع للون الـ CSS الأصلي
        }
    }
}
// إغلاق تاب
window.closeTab = function(id) {
    // لو فيه أكتر من فاتورة، امسح عادي
    if (saleTabs.length > 1) {
        saleTabs = saleTabs.filter(t => t.id !== id);
        // لو قفلنا التاب اللي كنا واقفين عليه، انقل للتاب اللي قبله
        if (activeTabId === id) {
            activeTabId = saleTabs[0].id;
        }
    } else {
        // الحل السحري: لو هي فاتورة واحدة، متمسحهاش.. بس صفر بياناتها
        const lastTab = saleTabs[0];
        lastTab.cart = [];
        lastTab.customerName = "";
        lastTab.customerPhone = "";
        lastTab.paymentMethod = "cash";
        lastTab.name = "فاتورة 1"; // إعادة تسمية اختيارية
        activeTabId = lastTab.id;
    }

    // تحديث كل حاجة في الواجهة
    renderTabsUI();
    switchTab(activeTabId); 
    renderInvoiceTable();
};

function renderTabsUI() {
    const container = document.getElementById('sale-tabs-container');
    if (!container) return;

    // 1. رسم التابات
    let tabsHtml = saleTabs.map(t => `
        <div class="tab-item ${t.id === activeTabId ? 'active' : ''}" onclick="switchTab(${t.id})">
            ${t.name}
            <i class="fas fa-times" onclick="event.stopPropagation(); closeTab(${t.id})"></i>
        </div>
    `).join('');

    // 2. إضافة الزرار "مرة واحدة" في نهاية الـ HTML
    const addBtnHtml = `<button onclick="addNewSaleTab()" class="btn-blue" style="margin-right:10px;    border: 2px solid white;
    width: 20px;
    border-radius:5px ;
    -webkit-border-radius:5px ;
    -moz-border-radius:5px ;
    -ms-border-radius:5px ;
    -o-border-radius:5px ;"> + </button>`;

    container.innerHTML = tabsHtml + addBtnHtml;
}
function renderInvoiceTable() {
    const currentTab = saleTabs.find(t => t.id === activeTabId);
    const tbody = document.querySelector("#sale-invoice-table tbody");
    if (!tbody || !currentTab) return;
    
    tbody.innerHTML = "";
    

    currentTab.cart.forEach((item, index) => {
        
        const price = Number(item.price) || 0;
        const qty = Number(item.qty) || 1;
        const total = Number((price * qty).toFixed(2));  
        tbody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td>${(Number(item.price) || 0).toFixed(2)}</td>
                <td><input type="number" value="${item.qty}" min="1" onchange="updateQty(${index}, this.value)" style="width:70px"></td>
                <td>${total.toFixed(2)}</td>
                <td>
                    <button onclick="removeFromInvoice(${index})" class="action-btn delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
    });
    if (currentTab.cart.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">لا يوجد منتجات</td></tr>`;
    return;
}
    
}

window.updateQty = function(index, val) {
    const currentTab = saleTabs.find(t => t.id === activeTabId);
    if (!currentTab) return;

    const item = currentTab.cart[index]; // التعديل هنا
    if (val > item.stock) {
        alert("الكمية المطلوبة أكبر من المتوفر!");
        item.qty = item.stock;
    } else {
        item.qty = Math.max(1, parseInt(val) || 1);
    }
    renderInvoiceTable();
    calculateTotal();
};

window.removeFromInvoice = function(index) {
    const currentTab = saleTabs.find(t => t.id === activeTabId);
    if (currentTab) {
        currentTab.cart.splice(index, 1);
        renderInvoiceTable();
        calculateTotal();
    }
};

// نادى الدالة دي في event الـ input بتاع خانة اسم العميل مثلاً
window.updateCurrentTabData = function() {
    const currentTab = saleTabs.find(t => t.id === activeTabId);
    if (!currentTab) return;

    currentTab.customerName = document.getElementById('sale-customer-name')?.value || "";
    currentTab.customerPhone = document.getElementById('sale-customer-phone')?.value || "";
    currentTab.paymentMethod = document.getElementById('sale-payment-method')?.value || "cash";
};


window.saleProcessInvoice = function() {
    const currentTab = saleTabs.find(t => t.id === activeTabId);
    if (!currentTab || currentTab.cart.length === 0) return showToast("أضف أصنافاً أولاً", "error");

    const isReturnMode = document.getElementById('return-mode-switch')?.checked || false;
    const res = calculateTotal() || {}; 
    const finalTotal = res.finalTotal || 0;
    const correctedRemaining = res.remainingAmount || 0; 
    
    // --- [ القيم المعدلة لتطابق الـ Schema الجديدة ] ---
    const discount = res.discount || 0;
    const tax = res.tax || 0;
    const dScope = res.dScope || 'total'; // القيمة المطلوبة لعمود discount_scope

    let customerName = document.getElementById('sale-customer-name').value.trim() || "عميل نقدي";
    const customerPhone = (document.getElementById('sale-customer-phone')?.value || "").trim();
    const payMethod = document.getElementById('sale-payment-method')?.value || "cash";
    const originalInvId = document.getElementById('original-inv-id')?.value || null;

    const multiplier = isReturnMode ? -1 : 1;
    const todayFullDate = new Date().toLocaleString('sv-SE'); 
    const itemsJson = JSON.stringify(currentTab.cart);

    let inTransaction = false;

    try {
        db.run("BEGIN TRANSACTION");
        inTransaction = true;

        // 1. تسجيل العميل
        if (customerName !== "عميل نقدي") {
            let check = db.exec("SELECT id FROM customers WHERE name = ?", [customerName]);
            if (check.length === 0) {
                db.run("INSERT INTO customers (name, phone, added_date, balance) VALUES (?, ?, ?, 0)", 
                    [customerName, customerPhone, todayFullDate.split(' ')[0], 0]);
            }
        }

        // 2. تحديث المخزن
        let oldItems = [];
        if (originalInvId) {
            const oldRes = db.exec("SELECT items_json FROM sales_history WHERE id = ?", [originalInvId]);
            if (oldRes.length > 0) oldItems = JSON.parse(oldRes[0].values[0][0]);
        }

        currentTab.cart.forEach(item => {
            let diff = item.qty;
            if (originalInvId && !isReturnMode) {
                const oldItem = oldItems.find(i => i.id === item.id);
                if (oldItem) diff = item.qty - oldItem.qty;
            }
            if (diff !== 0) {
                db.run("UPDATE products SET quantity = quantity - ? WHERE id = ?", [diff * multiplier, item.id]);
            }
        });

        let realInvoiceId;

        // --- [ وضع المرتجع ] ---
        if (isReturnMode && originalInvId) {
            const parentRes = db.exec("SELECT items_json, final_total, paid_amount FROM sales_history WHERE id = ?", [originalInvId]);
            if (parentRes.length > 0 && parentRes[0].values) {
                let parentItems = JSON.parse(parentRes[0].values[0][0]);
                let parentFinal = parseFloat(parentRes[0].values[0][1]);
                let parentPaid = parseFloat(parentRes[0].values[0][2]);

                currentTab.cart.forEach(retItem => {
                    let idx = parentItems.findIndex(i => i.id == retItem.id);
                    if (idx > -1) {
                        parentItems[idx].qty -= retItem.qty;
                        if (parentItems[idx].qty <= 0) parentItems.splice(idx, 1);
                    }
                });

                let updatedFinalTotal = parentFinal - finalTotal; 
                let updatedRemaining = Math.max(0, updatedFinalTotal - parentPaid);

                db.run(`UPDATE sales_history SET items_json=?, final_total=?, remaining_amount=? WHERE id=?`,
                    [JSON.stringify(parentItems), updatedFinalTotal, updatedRemaining, originalInvId]);
                
                if (customerName !== "عميل نقدي") {
                    db.run("UPDATE customers SET balance = ? WHERE name = ?", [updatedRemaining, customerName]);
                }
            }
            
            db.run(`INSERT INTO sales_history (customer_name, total, final_total, discount_value, tax_value, payment_method, paid_amount, remaining_amount, items_json, date, type, original_invoice_id, discount_scope) 
                    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 'return', ?, ?)`, 
                [customerName, -res.subTotal, -finalTotal, -discount, -tax, payMethod, itemsJson, todayFullDate, originalInvId, dScope]);
            
            realInvoiceId = originalInvId; 
        } 
        // --- [ وضع البيع أو التعديل ] ---
        else {
            if (originalInvId) {
                db.run(`UPDATE sales_history SET total=?, final_total=?, discount_value=?, tax_value=?, remaining_amount=?, items_json=?, date=?, discount_scope=? WHERE id=?`, 
                    [res.subTotal, finalTotal, discount, tax, correctedRemaining, itemsJson, todayFullDate, dScope, originalInvId]);
                realInvoiceId = originalInvId;
            } else {
                db.run(`INSERT INTO sales_history (customer_name, total, final_total, discount_value, tax_value, payment_method, paid_amount, remaining_amount, items_json, date, type, discount_scope) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sale', ?)`, 
                    [customerName, res.subTotal, finalTotal, discount, tax, payMethod, (finalTotal - correctedRemaining), correctedRemaining, itemsJson, todayFullDate, dScope]);
                
                const lastIdRes = db.exec("SELECT last_insert_rowid()");
                realInvoiceId = lastIdRes[0].values[0][0];
            }

            if (customerName !== "عميل نقدي") {
                db.run("UPDATE customers SET balance = ? WHERE name = ?", [correctedRemaining, customerName]);
            }
        }

        db.run("COMMIT");
        inTransaction = false;
        saveDbToLocal(); 

        showToast("تمت العملية بنجاح ✅");
        
        // استدعاء الطباعة مباشرة بالبيانات الحالية لضمان ظهور المعاينة والخصم
        if (typeof window.printInvoice === 'function') {
            window.printInvoice({
                invId: realInvoiceId,
                customer: customerName,
                customerPhone: customerPhone,
                cartItems: currentTab.cart,
                subTotal: res.subTotal,
                finalTotal: finalTotal,
                isReturn: isReturnMode,
                invDisc: discount,
                tax: tax,
                remainingAmount: correctedRemaining,
                dScope: dScope
            });
        }

        clearSaleScreen();
        if (typeof loadCustomersDebt === 'function') loadCustomersDebt();

    } catch (err) {
        if (inTransaction) db.run("ROLLBACK");
        console.error(err);
        showToast("خطأ في الحفظ: " + err.message, "error");
    }
};
// دالة مساعدة لتنظيف الشاشة بعد البيع
window.clearSaleScreen = function() {
    // 1. إعادة تعيين الحقول في الواجهة (الـ UI)
    const fields = [
        'sale-customer-name', 'sale-customer-phone', 
        'original-inv-id', 'sale-search-input'
    ];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // إعادة تعيين المبالغ
    if (document.getElementById('sale-paid-amount')) document.getElementById('sale-paid-amount').value = 0;
    if (document.getElementById('sale-remaining-amount')) document.getElementById('sale-remaining-amount').value = 0;
    
    // إخفاء الأقسام الخاصة بالتعديل أو الارتجاع
    if (document.getElementById('original-inv-section')) document.getElementById('original-inv-section').style.display = 'none';
    if (document.getElementById('original-invoice-preview')) document.getElementById('original-invoice-preview').style.display = 'none';
    if (document.getElementById('customer-debt-alert')) document.getElementById('customer-debt-alert').style.display = 'none';

    // 2. التعامل مع التابات في الذاكرة
    const currentTabIndex = saleTabs.findIndex(t => t.id === activeTabId);
    
    if (saleTabs.length > 1) {
        // لو فيه أكتر من تابة، اقفل الحالية
        closeTab(activeTabId); 
    } else {
        // لو دي التابة الوحيدة، فضّي السلة بتاعتها بس
        if (currentTabIndex !== -1) {
            saleTabs[currentTabIndex].cart = [];
            saleTabs[currentTabIndex].customerName = "";
            saleTabs[currentTabIndex].customerPhone = "";
            
            renderInvoiceTable(); // تحديث الجدول عشان يبقى فاضي
            calculateTotal();     // تحديث الإجماليات للأصفار
        }
    }

    // 3. تحديث واجهة التابات والتركيز على خانة البحث
    renderTabsUI();
    setTimeout(() => {
        document.getElementById('sale-search-input')?.focus();
    }, 100);
};


window.processAndPrint = function() {
    const currentTab = saleTabs.find(t => t.id === activeTabId);
    if (!currentTab || currentTab.cart.length === 0) {
        showToast("السلة فارغة!", "error");
        return;
    }

    const res = calculateTotal() || {};

    const payMethod = document.getElementById('sale-payment-method')?.value || "cash";
    const paidAmount = (payMethod === 'credit') ? parseFloat(document.getElementById('sale-paid-amount')?.value || 0) : res.finalTotal;
    const remainingAmount = (payMethod === 'credit') ? (res.finalTotal - paidAmount) : 0;

    const invoiceData = {
        customer: document.getElementById('sale-customer-name')?.value || "عميل نقدي",
        customerPhone: document.getElementById('sale-customer-phone')?.value || "",
        invId: "INV-" + Date.now().toString().slice(-6),
        cartItems: JSON.parse(JSON.stringify(currentTab.cart)), // Deep copy لضمان عدم تأثر البيانات
        subTotal: res.subTotal,
        itemsDisc: res.itemsDiscountTotal || 0, // خصم الأصناف
        invDisc: res.invoiceDiscountTotal || 0,   // الخصم الكلي
        tax: res.taxAmount || 0,
        finalTotal: res.finalTotal,
        payMethod: payMethod,
        paidAmount: paidAmount,
        remainingAmount: Math.max(0, remainingAmount),
        isReturn: document.getElementById('return-mode-switch')?.checked || false
    };

    printInvoice(invoiceData);
};

window.printInvoice = function (data) {
    if (!data) return;

    const items = Array.isArray(data.cartItems) ? data.cartItems : [];
    const isPerItem = data.dScope === 'per-item';
    const companyName = getSetting('company_name') || "المؤسسة التجارية";

    const subTotal = Number(data.subTotal || 0);
    const finalTotal = Number(data.finalTotal || 0);
    const invDisc = Number(data.invDisc || 0);
    const tax = Number(data.tax || 0);

    const win = window.open('', '_blank');
    if (!win) return;

    // ================= rows =================
    let rowsHtml = "";

    items.forEach((item, i) => {
        const name = item.name || "منتج";
        const price = Number(item.price || 0);
        const qty = Number(item.qty || 1);
        const disc = Number(item.discount || 0);

        const total = isPerItem
            ? (price - disc) * qty
            : price * qty;

        rowsHtml += `
        <tr>
            <td>${i + 1}</td>
            <td class="name">${name}</td>
            <td>${qty}</td>
            <td>${price.toFixed(2)}</td>
            ${isPerItem ? `<td>${disc.toFixed(2)}</td>` : ''}
            <td>${total.toFixed(2)}</td>
        </tr>`;
    });

    // fill to 40 rows


    // ================= HTML =================
    win.document.write(`
    <html dir="rtl">
    <head>
        <style>
            @page { size: A4; margin: 5mm; }

            body {
                font-family: Arial;
                margin: 0;
                font-size: 12px;
                color: #000;
            }

            .header {
                display: flex;
                justify-content: space-between;
                border-bottom: 2px solid #000;
                margin-bottom: 8px;
                padding-bottom: 5px;
            }

            .header h2 {
                margin: 0;
                font-size: 16px;
            }

            .title {
                text-align: center;
                font-weight: bold;
                font-size: 14px;
            }

            table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
            }

            th {
                background: #000;
                color: #fff;
                font-size: 11px;
                height: 28px;
            }

            td {
                border: 1px solid #000;
                text-align: center;
                padding: 2px 1px;
            }

            .name {
                text-align: right;
                padding-right: 5px;
                overflow: hidden;
                white-space: nowrap;
            }

            .totals {
                margin-top: 10px;
                width: 220px;
                border-collapse: collapse;
                float: left;
            }

            .totals td {
                border: 1px solid #000;
                padding: 4px;
                font-weight: bold;
            }

            .grand {
                background: #000;
                color: #fff;
            }

            .footer {
                margin-top: 15px;
                font-size: 10px;
            }

            @media print {
                button { display: none; }
            }
        </style>
    </head>

    <body>

    <button onclick="window.print()">طباعة</button>

    <div class="header">
        <div>
            <h2>${companyName}</h2>
            <div>العميل: ${data.customer || 'نقدي'}</div>
        </div>

        <div style="text-align:left">
            <div class="title">فاتورة مبيعات</div>
            <div>#${data.invId}</div>
            <div>${new Date().toLocaleDateString('ar-EG')}</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th width="30">م</th>
                <th>الصنف</th>
                <th width="50">كمية</th>
                <th width="70">سعر</th>
                ${isPerItem ? '<th width="60">خصم</th>' : ''}
                <th width="80">إجمالي</th>
            </tr>
        </thead>

        <tbody>
            ${rowsHtml}
        </tbody>
    </table>

    <table class="totals">
        <tr><td>الإجمالي</td><td>${subTotal.toFixed(2)}</td></tr>
        ${invDisc > 0 ? `<tr><td>خصم</td><td>${invDisc.toFixed(2)}</td></tr>` : ''}
        ${tax > 0 ? `<tr><td>ضريبة</td><td>${tax.toFixed(2)}</td></tr>` : ''}
        <tr class="grand"><td>الصافي</td><td>${finalTotal.toFixed(2)}</td></tr>
    </table>

    <div class="footer">
        ${getSetting('invoice_footer') || ''}
    </div>

    </body>
    </html>
    `);

    win.document.close();
};

window.printInvoiceFromHistory = function(invId) {
    const res = db.exec("SELECT * FROM sales_history WHERE id = ?", [invId]);
    if (!res.length) return;

    const columns = res[0].columns;
    const values = res[0].values[0];
    const row = {};
    columns.forEach((col, i) => row[col] = values[i]);

    let items = [];
    try { items = JSON.parse(row.items_json || "[]"); } catch(e) { console.error("Error parsing items"); }

    window.printInvoice({
        invId: row.id,
        customer: row.customer_name,
        customerPhone: row.customer_phone,
        cartItems: items,
        subTotal: Math.abs(row.total), 
        finalTotal: row.final_total, 
        isReturn: row.type === 'return', 
        invDisc: row.discount_value || 0,
        tax: row.tax_value || 0,
        paidAmount: row.paid_amount || 0,
        remainingAmount: row.remaining_amount || 0,
        payMethod: row.payment_method,
        dScope: row.discount_scope || 'total' 
    });
};
window.calculateTotal = function() {
    const currentTab = saleTabs.find(t => t.id === activeTabId);
    if (!currentTab) return { subTotal:0, discount:0, tax:0, finalTotal:0, dScope:'total' };

    const isDiscountActive = document.getElementById('apply-discount-switch')?.checked; 
    const isTaxActive = document.getElementById('apply-tax-switch')?.checked;

    const taxPercent = isTaxActive ? (parseFloat(document.getElementById('temp-tax-val')?.value) || parseFloat(getSetting('tax_percent')) || 0) : 0;
    const dVal = isDiscountActive ? (parseFloat(document.getElementById('temp-discount-val')?.value) || parseFloat(getSetting('discount_default_value')) || 0) : 0;

    const dScope = getSetting('discount_scope') || 'total';          
    const dType = getSetting('discount_type') || 'val';           

    let subTotal = 0;
    let itemsDiscountTotal = 0;

    // تحديث خصم كل صنف عشان الطباعة تشوفه
    currentTab.cart.forEach(item => {
        const price = parseFloat(item.price) || 0;
        const qty = parseFloat(item.qty) || 0;
        const rowTotal = price * qty;
        subTotal += rowTotal;

        if (isDiscountActive && dScope === 'per-item') {
            // حساب الخصم لكل صنف وتخزينه في الـ item نفسه
            const discountPerUnit = (dType === 'percent') ? (price * (dVal / 100)) : dVal;
            item.discount = discountPerUnit; 
            itemsDiscountTotal += (discountPerUnit * qty);
        } else {
            item.discount = 0;
        }
    });

    let invoiceDiscountTotal = 0;
    if (isDiscountActive && dScope === 'total') {
        invoiceDiscountTotal = (dType === 'percent') ? (subTotal * (dVal / 100)) : Math.min(dVal, subTotal);
    }

    const finalDiscount = Math.min(subTotal, itemsDiscountTotal + invoiceDiscountTotal);
    const taxable = Math.max(0, subTotal - finalDiscount);
    const taxAmount = isTaxActive ? (taxable * (taxPercent / 100)) : 0;
    const finalTotal = parseFloat((subTotal - finalDiscount + taxAmount).toFixed(2));

    const originalInvId = document.getElementById('original-inv-id')?.value;
    const payMethod = document.getElementById('sale-payment-method')?.value || "cash";
    const paidInput = document.getElementById('sale-paid-amount');

    let paidNow = parseFloat(paidInput?.value) || 0;
    let paidPreviously = (originalInvId && originalInvId !== "") ? parseFloat(currentTab.previousPaid || 0) : 0;

    let totalPaidDisplay = 0;
    let currentRemaining = 0;

    if (payMethod === 'credit') {
        totalPaidDisplay = paidNow + paidPreviously;
        currentRemaining = Math.max(0, finalTotal - totalPaidDisplay);
    } else {
        totalPaidDisplay = finalTotal;
        currentRemaining = 0;
        if (paidInput && (!originalInvId || originalInvId === "")) {
            paidInput.value = finalTotal.toFixed(2);
            paidNow = finalTotal;
        }
    }

    // تحديث الـ UI
    const updateText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val.toFixed(2);
    };

    updateText('sale-grand-total', finalTotal);
    updateText('display-paid-amount', totalPaidDisplay);
    updateText('display-remaining-amount', currentRemaining);

    const remInput = document.getElementById('sale-remaining-amount');
    if (remInput) remInput.value = currentRemaining.toFixed(2);

    return {
        subTotal: parseFloat(subTotal.toFixed(2)),
        discount: parseFloat(finalDiscount.toFixed(2)),
        tax: parseFloat(taxAmount.toFixed(2)),
        finalTotal: finalTotal,
        paidAmount: paidNow, 
        remainingAmount: parseFloat(currentRemaining.toFixed(2)),
        dScope: dScope // ضروري جداً لعملية الطباعة
    };
};

window.toggleCreditSection = function() {
    const paymentMethod = document.getElementById('sale-payment-method').value;
    const creditSection = document.getElementById('credit-details-section');
    const paidInput = document.getElementById('sale-paid-amount');
    
    if (creditSection) {
        if (paymentMethod === 'credit') {
            // 1. إظهار القسم بتأثير بسيط
            creditSection.style.display = 'block';
            document.getElementById('sale-search-input')?.focus()
            // 2. تصفير القيمة وتحديدها فوراً للسرعة
            // if (paidInput) {
            //     paidInput.value = 0; // يصفر الخانة
            //     setTimeout(() => {
            //         paidInput.focus();
            //         paidInput.select(); // يحدد الصفر عشان أي كتابة تمسحه فوراً
            //     }, 100);
            // }
            
        } else {
            creditSection.style.display = 'none';
        }
    }

    // تحديث الحسابات فوراً لتحديث أرقام الفوتر (المدفوع والمتبقي)
    if (typeof calculateTotal === 'function') calculateTotal();
};

// جزء من منطق حفظ الفاتورة داخل saleProcessInvoice
const customerName = document.getElementById('sale-customer-name').value;
const remaining = parseFloat(document.getElementById('sale-remaining-amount').value) || 0;

if (remaining > 0 && customerName !== "عميل نقدي") {
    // تحديث مديونية العميل في القاعدة
    db.run(`UPDATE customers SET balance = balance + ? WHERE name = ?`, [remaining, customerName]);
    console.log(`تم إضافة ${remaining} لمديونية العميل ${customerName}`);
}

window.toggleReturnMode = function() {
    const isReturnMode = document.getElementById('return-mode-switch').checked;
    const label = document.getElementById('return-label');
    const originalInvSection = document.getElementById('original-inv-section');
    const originalPreview = document.getElementById('original-invoice-preview');
    const confirmBtn = document.querySelector('.btn-confirm'); // تأكد من وجود هذا الكلاس في الزرار

    if (isReturnMode) {
        // --- وضع المرتجع ---
        label.innerText = "وضع المرتجع";
        label.style.color = "#e74c3c";
        if(originalInvSection) originalInvSection.style.display = "block";
        
        if(confirmBtn) {
            confirmBtn.innerText = "إتمام المرتجع";
            confirmBtn.style.background = "#e74c3c";
            confirmBtn.setAttribute("onclick", "processReturnOnly()");
        }
    } else {
        // --- وضع البيع العادي ---
        label.innerText = "وضع البيع";
        label.style.color = "#666";
        if(originalInvSection) originalInvSection.style.display = "none";
        if(originalPreview) originalPreview.style.display = "none";
        
        if(confirmBtn) {
            confirmBtn.innerText = "إتمام العملية";
            confirmBtn.style.background = "#27ae60"; 
            confirmBtn.setAttribute("onclick", "saleProcessInvoice()");
        }
        // تصفير بيانات الفاتورة المجلوبة عند العودة للبيع
        currentOriginalItems = []; 
    }
};


window.fetchInvoiceForReturn = function() {
    const invId = document.getElementById('original-inv-id')?.value;
    if (!invId) return showToast("برجاء إدخال رقم الفاتورة أولاً", "error");

    try {
        const res = db.exec("SELECT * FROM sales_history WHERE id = ?", [invId]);
        if (!res.length || !res[0].values.length) {
            return showToast("عفواً، الفاتورة غير موجودة!", "error");
        }

        const columns = res[0].columns;
        const values = res[0].values[0];
        const invoice = {};
        columns.forEach((col, i) => invoice[col] = values[i]);

        // --- 🟢 بداية فحص مهلة المرتجعات الآلي ---
        const statusRes = db.exec("SELECT value FROM settings WHERE key = 'return_policy_status'");
        const daysRes = db.exec("SELECT value FROM settings WHERE key = 'return_policy_days'");
        
        const isPolicyActive = (statusRes.length > 0 && statusRes[0].values[0][0] === '1');
        const maxDays = (daysRes.length > 0) ? parseInt(daysRes[0].values[0][0]) : 14;

        if (isPolicyActive) {
            const invDate = new Date(invoice.date); // تاريخ الفاتورة الأصلية من القاعدة
            const today = new Date();
            const diffTime = Math.abs(today - invDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

            if (diffDays > maxDays) {
                // الفاتورة تجاوزت المهلة -> نوقف العملية فوراً
                return showToast(`❌ لا يمكن الإرجاع! الفاتورة مر عليها ${diffDays} يوم، والحد الأقصى المسموح هو ${maxDays} يوم.`, "error");
            }
        }
        // --- 🔴 نهاية الفحص ---

        const items = JSON.parse(invoice.items_json);
        currentOriginalItems = items; 

        // تعبئة البيانات الأساسية
        document.getElementById('sale-customer-name').value = invoice.customer_name || "";
        document.getElementById('sale-customer-phone').value = invoice.customer_phone || "";

        // رسم جدول المعاينة (العلوي)
        const tbody = document.getElementById('original-items-list');
        if (tbody) {
            tbody.innerHTML = "";
            items.forEach(item => {
                tbody.innerHTML += `
                    <tr style="border-bottom: 1px solid #f1f1f1;">
                        <td style="padding: 8px;">${item.name}</td>
                        <td style="padding: 8px; color: #e74c3c; font-weight: bold;">${item.qty}</td>
                        <td style="padding: 8px;">${parseFloat(item.price).toFixed(2)}</td>
                        <td style="padding: 8px; text-align:center;">
                            <button onclick="addThisToReturnList('${item.id}', '${item.name}', ${item.price}, ${item.qty})" 
                                    class="btn-return-action" 
                                    style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
                                <i class="fas fa-plus"></i> إرجاع
                            </button>
                        </td>
                    </tr>`;
            });
            document.getElementById('original-invoice-preview').style.display = 'block';
            showToast(`تم جلب فاتورة: ${invoice.customer_name || 'عميل'}`, "success");
        }
    } catch (e) {
        console.error(e);
        showToast("خطأ في جلب البيانات", "error");
    }
};
// ابحث عن دالة الإضافة عندك وضيف فيها المنطق ده في البداية
window.addThisToReturnList = function(id, name, price, maxSoldQty) {
    const currentTab = saleTabs.find(t => t.id === activeTabId);
    const existingInCart = currentTab.cart.find(i => i.id == id);
    const currentQtyInCart = existingInCart ? existingInCart.qty : 0;

    // التأكد إننا مديناش فرصة نرجع أكتر من اللي اتباع
    if (currentQtyInCart + 1 > maxSoldQty) {
        return showToast(`خطأ: لا يمكن إرجاع أكثر من المباع (${maxSoldQty})`, "error");
    }

    // إضافة للسلة (الجدول السفلي)
    if (typeof addItemToCart === 'function') {
        addItemToCart(id, name, price, 1, 9999); // 9999 لتخطي فحص المخزن
        renderInvoiceTable();
        if (typeof calculateTotal === 'function') calculateTotal();
        showToast(`تمت إضافة [${name}] للمرتجع`);
    }
};
window.processReturnOnly = function() {
    const currentTab = saleTabs.find(t => t.id === activeTabId);
    const originalInvId = document.getElementById('original-inv-id').value;

    if (!currentTab || currentTab.cart.length === 0) return showToast("أضف أصناف المرتجع أولاً", "error");
    if (!originalInvId) return showToast("رقم الفاتورة الأصلية مفقود!", "error");

    const res = (typeof calculateTotal === 'function') ? calculateTotal() : { finalTotal: 0, subTotal: 0 };
    const today = new Date().toLocaleString('sv-SE');
    const dateOnly = today.split(' ')[0];

    let inTransaction = false;

    try {
        // 1. جلب بيانات الفاتورة الأم
        const oldInvRes = db.exec("SELECT customer_name, payment_method, remaining_amount, final_total, total, items_json, date FROM sales_history WHERE id = ?", [originalInvId]);
        
        if (!oldInvRes.length || !oldInvRes[0].values.length) {
            throw new Error("الفاتورة الأصلية غير موجودة في السجل");
        }

        const [custName, payMethod, oldRemaining, originalFinalTotal, originalSubTotal, originalItemsJson, invoiceDate] = oldInvRes[0].values[0];

        // 🟢 فحص مهلة المرتجع
        const statusRes = db.exec("SELECT value FROM settings WHERE key = 'return_policy_status'");
        const daysRes = db.exec("SELECT value FROM settings WHERE key = 'return_policy_days'");
        const isPolicyActive = (statusRes.length > 0 && statusRes[0].values[0][0] === '1');
        const maxDays = (daysRes.length > 0) ? parseInt(daysRes[0].values[0][0]) : 14;

        if (isPolicyActive) {
            const invDate = new Date(invoiceDate);
            const diffDays = Math.ceil(Math.abs(new Date() - invDate) / (1000 * 60 * 60 * 24)); 
            if (diffDays > maxDays) throw new Error(`انتهت مهلة المرتجع (${diffDays} يوم)`);
        }

        db.run("BEGIN TRANSACTION");
        inTransaction = true;

        let returnNetProfit = 0; 
        let originalItems = JSON.parse(originalItemsJson);

        // 2. تحديث المخزن وتعديل مصفوفة الأصناف الأصلية
        currentTab.cart.forEach(returnedItem => {
            db.run("UPDATE products SET quantity = quantity + ? WHERE id = ?", [returnedItem.qty, returnedItem.id]);
            
            const pRes = db.exec("SELECT buyPrice FROM products WHERE id = ?", [returnedItem.id]);
            const buyPrice = (pRes.length > 0) ? parseFloat(pRes[0].values[0][0]) : 0;
            returnNetProfit -= (parseFloat(returnedItem.price) - buyPrice) * returnedItem.qty; 

            let itemInOriginal = originalItems.find(i => i.id == returnedItem.id);
            if (itemInOriginal) {
                itemInOriginal.qty = parseFloat(itemInOriginal.qty) - parseFloat(returnedItem.qty);
            }
        });

        // تنظيف الفاتورة الأصلية من الأصناف التي صفرت
        originalItems = originalItems.filter(i => i.qty > 0);

        const returnAmount = Math.abs(res.finalTotal);
        const newFinalTotal = parseFloat(originalFinalTotal) - returnAmount;
        const newRemaining = Math.max(0, parseFloat(oldRemaining) - returnAmount);

        // 3. تحديث الفاتورة الأم (تصبح بـ 3000 بدلاً من 5000)
        db.run(`UPDATE sales_history SET items_json = ?, total = total - ?, final_total = ?, remaining_amount = ? WHERE id = ?`, 
                [JSON.stringify(originalItems), Math.abs(res.subTotal), newFinalTotal, newRemaining, originalInvId]);

        // 4. تحديث مديونية العميل
        if (custName !== "عميل نقدي") {
            db.run("UPDATE customers SET balance = ? WHERE name = ?", [newRemaining, custName]);
        }

        // 5. تسجيل إيصال المرتجع للتوثيق
        db.run(`INSERT INTO sales_history (customer_name, total, final_total, items_json, date, net_profit, type, original_invoice_id, payment_method) 
                VALUES (?, ?, ?, ?, ?, ?, 'return', ?, ?)`, 
                [custName, -res.subTotal, -res.finalTotal, JSON.stringify(currentTab.cart), today, returnNetProfit, originalInvId, payMethod]);

        db.run(`INSERT INTO profit_logs (date, daily_profit) VALUES (?, 0) ON CONFLICT(date) DO UPDATE SET daily_profit = daily_profit + ?`, [dateOnly, returnNetProfit]);

        db.run("COMMIT");
        inTransaction = false;
        saveDbToLocal();

        // 6. الطباعة (إرسال بيانات الفاتورة الأصلية بعد التعديل)
        if (typeof printInvoice === 'function') {
            printInvoice({
                invId: originalInvId,
                customer: custName,
                cartItems: originalItems, // الأصناف المتبقية فقط
                finalTotal: newFinalTotal, // 3000
                paidAmount: (newFinalTotal - newRemaining),
                remainingAmount: newRemaining,
                isReturn: false, // تطبع كفاتورة بيع محدثة
                date: invoiceDate
            });
        }

        showToast("تم تحديث الفاتورة الأصلية وإتمام المرتجع ✅");
        if (window.clearSaleScreen) window.clearSaleScreen();

    } catch (e) {
        if (inTransaction) db.run("ROLLBACK");
        console.error(e);
        showToast("خطأ: " + e.message, "error");
    }
};





// دالة مساعدة لتنظيف الواجهة (عشان الكود ميبقاش زحمة)
function cleanReturnUI(currentTab) {
    if (document.getElementById('sale-customer-name')) document.getElementById('sale-customer-name').value = "";
    if (document.getElementById('original-inv-id')) document.getElementById('original-inv-id').value = "";

    if (saleTabs.length === 1) {
        currentTab.cart = [];
        renderInvoiceTable();
    } else {
        if (typeof closeTab === 'function') closeTab(activeTabId);
    }

    const switchBtn = document.getElementById('return-mode-switch');
    if (switchBtn) {
        switchBtn.checked = false;
        if (typeof toggleReturnMode === 'function') toggleReturnMode();
    }

    if (typeof renderProducts === 'function') renderProducts();
    if (typeof renderInventory === 'function') renderInventory();
    if (typeof renderReports === 'function') renderReports();
    if (typeof renderTabsUI === 'function') renderTabsUI();
}

window.saveReturnPolicyValue = function() {
    const el = document.getElementById('return_policy_days');
    const val = String(el?.value || "14").trim();
    try {
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('return_policy_days', ?)", [val]);
        if (typeof saveDbToLocal === 'function') saveDbToLocal();
        showToast("تم حفظ مهلة المرتجعات بنجاح");
    } catch (err) { console.error(err); }
};


window.updateMultiPriceUI = function() {
    const sw = document.getElementById('multi_price_status');
    const card = document.getElementById('multi_price_card');
    if (sw && card) {
        if (sw.checked) {
            card.classList.remove('f-feature-disabled');
            showToast("✅ تم تفعيل تعدد فئات الأسعار (جملة/قطاعي)");
        } else {
            card.classList.add('f-feature-disabled');
            showToast("⚠️ تم تعطيل فئات الأسعار - سيتم اعتماد السعر الافتراضي");
        }
    }
};


















// كود التعرف على العميل بمجرد كتابة الرقم
document.getElementById('sale-customer-phone')?.addEventListener('input', function() {
    const phone = this.value.trim();
    if (phone.length >= 11) { // ابدأ البحث لما الرقم يكمل
        const res = db.exec("SELECT name FROM customers WHERE phone = ?", [phone]);
        if (res.length > 0) {
            const name = res[0].values[0][0];
            document.getElementById('sale-customer-name').value = name;
            showToast("تم التعرف على العميل: " + name);
        }
    }
});

// دالة مساعدة لتنظيف الشاشة وإعادة التركيز

window.processCheckout = function() {
    // 1. تحديد التاب النشط وبياناته
    const currentTab = saleTabs.find(t => t.id === activeTabId);
    if (!currentTab || currentTab.cart.length === 0) {
        showToast("الفاتورة فارغة!", "error");
        return;
    }

    try {
        // حساب الإجمالي النهائي
        let subTotal = currentTab.cart.reduce((sum, item) => {
    if (!item.price || !item.qty) return sum;
    return sum + (item.price * item.qty);
}, 0);
        let finalTotal = Number((subTotal - currentTab.discount).toFixed(2));
        let dateNow = new Date().toISOString();

        // 2. بدأ عملية التسجيل في قاعدة البيانات
        // تسجيل رأس الفاتورة في جدول المبيعات
        db.run(`INSERT INTO sales (customer_name, customer_phone, sub_total, discount, final_total, payment_type, date) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                [currentTab.customerName || "عميل نقدي", currentTab.customerPhone || "", subTotal, currentTab.discount, finalTotal, currentTab.paymentType, dateNow]);

        // جلب رقم الفاتورة اللي لسه متسجلة
        const lastIdRes = db.exec("SELECT last_insert_rowid()");
        const invoiceId = lastIdRes[0].values[0][0];

        // 3. حلقة تكرارية لخصم المخزن وتسجيل الأصناف
        currentTab.cart.forEach(item => {
            // أ- تسجيل الصنف في تفاصيل الفاتورة (للتقارير لاحقاً)
            db.run(`INSERT INTO sale_items (invoice_id, product_id, product_name, price, qty, total) 
                    VALUES (?, ?, ?, ?, ?, ?)`, 
                    [invoiceId, item.id, item.name, item.price, item.qty, (item.price * item.qty)]);

            // ب- الخصم من المخزن (أهم سطر)
            db.run(`UPDATE products SET quantity = quantity - ? WHERE id = ?`, [item.qty, item.id]);
        });

        // 4. حفظ التغييرات في التخزين المحلي (LocalStorage)
        if (typeof saveDbToLocal === 'function') saveDbToLocal();

        showToast(`تم حفظ فاتورة رقم ${invoiceId} بنجاح ✅`);

        // 5. طباعة الفاتورة (اختياري - لو عندك دالة طباعة)
        // if (window.confirm("هل تريد طباعة الفاتورة؟")) { printInvoice(invoiceId); }

        // 6. إغلاق التاب الحالي وفتح واحد جديد لو كان الأخير
        closeTab(activeTabId);
        
        // تحديث جدول المخزن لو مفتوح في الخلفية
        if (typeof renderInventory === 'function') renderInventory();

    } catch (err) {
        console.error("Checkout Error:", err);
        showToast("حدث خطأ أثناء حفظ الفاتورة", "error");
    }
};
// دالة إظهار اقتراحات الأسماء
window.updateCustomerSuggestions = function(term) {
    const suggestionsDiv = document.getElementById('customer-suggestions');
    
    // لو الخانة فاضية، اخفي القائمة واخرج
    if (!term || term.trim().length < 1) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    try {
        // البحث عن العميل (الاسم، الهاتف، المديونية)
        const res = db.exec("SELECT name, phone, balance FROM customers WHERE name LIKE ? LIMIT 5", [`%${term}%`]);
        
        if (res.length > 0 && res[0].values) {
            suggestionsDiv.innerHTML = "";
            suggestionsDiv.style.display = 'block';

            res[0].values.forEach(row => {
                const [name, phone, balance] = row;
                const item = document.createElement('div');
                item.style = "padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; transition: 0.2s;";
                
                // إضافة تأثير عند التمرير بالماوس
                item.onmouseover = () => item.style.background = "#f8f9fa";
                item.onmouseout = () => item.style.background = "transparent";

                const debtInfo = balance > 0 ? `<span style="color: #e74c3c; font-size: 12px; font-weight: bold;">(مديونية: ${balance.toFixed(2)})</span>` : '';
                
                item.innerHTML = `
                    <span style="color: #2c3e50; font-weight: 500;">${name}</span>
                    ${debtInfo}
                `;

                // عند الضغط على الاسم من الاقتراحات
                item.onclick = () => {
                    selectCustomerFromList(name, phone, balance);
                };
                suggestionsDiv.appendChild(item);
            });
        } else {
            suggestionsDiv.style.display = 'none';
        }
    } catch (err) {
        console.error("Search Error:", err);
    }
};

window.selectCustomerFromList = function(name, phone, balance) {
    const currentTab = saleTabs.find(t => t.id === activeTabId);
    if (!currentTab) return;

    // 1. تحديث بيانات التابة
    currentTab.customerName = name;
    currentTab.customerPhone = phone || "";

    // 2. تحديث الواجهة
    document.getElementById('sale-customer-name').value = name;
    document.getElementById('sale-customer-phone').value = phone || "";
    document.getElementById('customer-suggestions').style.display = 'none';

    // 3. لو فيه مديونية، اسحب الأصناف فوراً للجدول
    if (balance > 0) {
        pullOldInvoiceItems(name);
    } else {
        // لو عميل جديد أو معلهوش مديونية، صفر رقم الفاتورة الأصلية
        document.getElementById('original-inv-id').value = "";
    }
};

window.autoLinkToInvoice = function(name) {
    try {
        const res = db.exec("SELECT id FROM sales_history WHERE customer_name = ? AND remaining_amount > 0 ORDER BY id DESC LIMIT 1", [name]);
        if (res.length > 0 && res[0].values) {
            const lastInvId = res[0].values[0][0];
            
            // تعبئة رقم الفاتورة الأصلية وإظهار القسم
            const invInput = document.getElementById('original-inv-id');
            const invSection = document.getElementById('original-inv-section');
            
            if (invInput) invInput.value = lastInvId;
            if (invSection) invSection.style.display = 'block';

            // تحويل الدفع لآجل أوتوماتيكياً
            const payMethod = document.getElementById('sale-payment-method');
            if (payMethod) {
                payMethod.value = 'credit';
                toggleCreditSection(); // تحديث واجهة المديونية (المدفوع والمتبقي)
            }
            
            showToast(`تم ربط الحساب بالفاتورة السابقة #${lastInvId}`, "success");
        }
    } catch (e) { console.error("Link Error:", e); }
};

window.pullOldInvoiceItems = function(name) {
    try {
        const res = db.exec("SELECT id, items_json, paid_amount FROM sales_history WHERE customer_name = ? AND remaining_amount > 0 ORDER BY id DESC LIMIT 1", [name]);
        
        if (res.length > 0 && res[0].values) {
            const [invId, itemsJson, previousPaid] = res[0].values[0];
            const currentTab = saleTabs.find(t => t.id === activeTabId);

            document.getElementById('original-inv-id').value = invId;
            
            // تخزين المبلغ المدفوع سابقاً في بيانات التابة
            currentTab.previousPaid = parseFloat(previousPaid) || 0;
            currentTab.cart = JSON.parse(itemsJson);

            // تحويل الدفع لآجل تلقائياً
            const payMethod = document.getElementById('sale-payment-method');
            if (payMethod) { payMethod.value = 'credit'; toggleCreditSection(); }

            // تصفير خانة "المدفوع الآن" لأننا لسه مخدناش فلوس جديدة
            if (document.getElementById('sale-paid-amount')) {
                document.getElementById('sale-paid-amount').value = 0;
            }

            renderInvoiceTable();
            calculateTotal(); 
            showToast(`تم سحب الفاتورة #${invId} (مدفوع سابقاً: ${previousPaid})`, "success");
        }
    } catch (e) { console.error(e); }
};



























































































































// سجل العملاء 


// 1. جلب قائمة العملاء اللي عليهم مديونيات
// --- [1] جلب وعرض قائمة المديونيات ---
window.loadCustomersDebt = function() {
    try {
        // تم تغيير الترتيب ليكون حسب الاسم أبجدياً (ASC)
        const res = db.exec("SELECT id, name, phone, balance FROM customers WHERE balance != 0 ORDER BY name ASC");
        const tbody = document.getElementById('debt-list-body');
        if (!tbody) return;

        tbody.innerHTML = "";
        if (res.length > 0 && res[0].values) {
            res[0].values.forEach(row => {
                tbody.innerHTML += `
                    <tr>
                        <td>${row[0]}</td>
                        <td><b style="color:#2563eb; cursor:pointer;" onclick="viewCustomerStatement(${row[0]})">${row[1]}</b></td>
                        <td>${row[2] || '---'}</td>
                        <td style="color:#e11d48; font-weight:600;">${parseFloat(row[3]).toFixed(2)}</td>
                        <td>
                            <div style="display:flex; gap:5px;">
                                <button onclick="openPaymentModal(${row[0]}, '${row[1]}', ${row[3]})" class="btn-modern btn-pay-sm">
                                تحصيل
                                </button>
                                <button onclick="viewCustomerStatement(${row[0]})" class="btn-modern btn-view-sm">
                                    كشف حساب
                                </button>
                            </div>
                        </td>
                    </tr>`;
            });
        } else {
            tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px;'>لا يوجد مديونيات حالياً</td></tr>";
        }
    } catch (err) {
        console.error("خطأ في تحميل المديونيات:", err);
    }
};

// --- [2] تحصيل مبلغ وتحديث القاعدة ---
window.collectPayment = function() {
    const cId = document.getElementById('pay-customer-id').value;
    const cName = document.getElementById('pay-customer-name').innerText;
    const amount = parseFloat(document.getElementById('pay-amount').value);
    const note = document.getElementById('pay-note').value || "تحصيل من الحساب";

    if (!amount || amount <= 0) {
        return showToast("يرجى إدخال مبلغ صحيح", "error");
    }

    let inTransaction = false;
    try {
        // بدء العملية لضمان سلامة البيانات
        db.run("BEGIN TRANSACTION");
        inTransaction = true;

        // 1. تحديث رصيد العميل (خصم المبلغ المحصل من المديونية)
        db.run("UPDATE customers SET balance = balance - ? WHERE id = ?", [amount, cId]);
        
        // 2. تسجيل عملية التحصيل في جدول المدفوعات بتنسيق ISO للترتيب الصحيح
        const now = new Date().toLocaleString('sv-SE'); 
        db.run("INSERT INTO customer_payments (customer_id, amount, payment_method, note, date) VALUES (?, ?, 'نقدي', ?, ?)", 
                [cId, amount, note, now]);

        db.run("COMMIT");
        inTransaction = false;

        // 3. حفظ التغييرات وتحديث الواجهة
        saveDbToLocal(); 
        closeModal('paymentModal');
        
        // تحديث الجدول تلقائياً بعد التحصيل
        if (typeof loadCustomersDebt === 'function') {
            loadCustomersDebt();
        }

        // 4. إظهار معاينة الإيصال للطباعة
        showReceiptPreview(cName, amount, note);
        showToast("تم التحصيل وتحديث الحساب بنجاح ✅", "success");

    } catch (e) {
        if (inTransaction) db.run("ROLLBACK");
        console.error(e);
        showToast("فشلت العملية، تأكد من وجود جدول المدفوعات", "error");
    }
};

// --- [3] عرض كشف الحساب التفصيلي للطباعة ---
window.viewCustomerStatement = function(customerId) {
    try {
        // 1. جلب بيانات العميل
        const customerRes = db.exec("SELECT id, name, phone, balance FROM customers WHERE id = ?", [customerId]);
        if (!customerRes.length || !customerRes[0].values) return;
        const [id, name, phone, balance] = customerRes[0].values[0];

        // 2. جلب الفواتير المعلقة
        const sales = db.exec("SELECT id, date, final_total, remaining_amount FROM sales_history WHERE customer_name = ? AND remaining_amount > 0", [name]);

        // 3. جلب سجل التحصيلات (آخر 5 عمليات)
        const payments = db.exec("SELECT amount, date, note FROM customer_payments WHERE customer_id = ? ORDER BY date DESC LIMIT 5", [customerId]);

        // 4. بناء الواجهة بتصميم محسن
        let htmlContent = `
            <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #334155;">
                
                <div style="background: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 25px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h3 style="margin: 0; color: #1e293b;">${name}</h3>
                        <span style="font-size: 13px; color: #64748b;">ID: #${id}</span>
                    </div>
                    <p style="margin: 5px 0; color: #64748b; font-size: 14px;">📱 ${phone || 'بدون هاتف'}</p>
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="font-size: 14px; color: #64748b;">المديونية الإجمالية:</span>
                            <div style="font-size: 24px; font-weight: 800; color: #e11d48;">${parseFloat(balance).toFixed(2)} <small style="font-size: 14px;">ج.م</small></div>
                        </div>
                        ${balance > 0 ? `
                            <button onclick="settleCustomerAccount(${id}, '${name}', ${balance})" 
                                    style="background: #0f172a; color: white; border: none; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; transition: 0.2s;">
                                    تسديد الحساب
                            </button>
                        ` : ''}
                    </div>
                </div>

                <h4 style="font-size: 15px; color: #1e293b; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <span style="width: 4px; height: 18px; background: #2563eb; border-radius: 2px; display: inline-block;"></span>
                    فواتير لم تسدد بالكامل
                </h4>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
                        <thead>
                            <tr style="background: #f8fafc; text-align: right; border-bottom: 1px solid #e2e8f0;">
                                <th style="padding: 12px; font-size: 13px;">رقم الفاتورة</th>
                                <th style="padding: 12px; font-size: 13px;">المتبقي</th>
                                <th style="padding: 12px; font-size: 13px; text-align: center;">إجراء</th>
                            </tr>
                        </thead>
                        <tbody>`;

        if (sales.length > 0 && sales[0].values) {
            sales[0].values.forEach(row => {
                htmlContent += `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 12px; font-weight: 600; font-size: 14px;">#${row[0]}</td>
                        <td style="padding: 12px; color: #e11d48; font-weight: 700; font-size: 14px;">${parseFloat(row[3]).toFixed(2)}</td>
                        <td style="padding: 12px; text-align: center;">
                            <button onclick="editOldInvoice(${row[0]})" style="background: #f1f5f9; color: #2563eb; border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
                                ➕ إضافة أصناف
                            </button>
                        </td>
                    </tr>`;
            });
        } else {
            htmlContent += `<tr><td colspan="3" style="text-align: center; padding: 20px; color: #94a3b8; font-size: 13px;">لا توجد فواتير معلقة حالياً</td></tr>`;
        }

        htmlContent += `</tbody></table></div>

                <h4 style="font-size: 15px; color: #1e293b; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <span style="width: 4px; height: 18px; background: #f59e0b; border-radius: 2px; display: inline-block;"></span>
                    آخر التحصيلات
                </h4>
                <div style="background: #f8fafc; border-radius: 10px; padding: 10px; border: 1px solid #e2e8f0;">`;

        if (payments.length > 0 && payments[0].values) {
            payments[0].values.forEach(row => {
                htmlContent += `
                    <div style="padding: 10px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; last-child { border: none; }">
                        <div>
                            <div style="font-size: 13px; font-weight: 600; color: #0f172a;">+ ${parseFloat(row[0]).toFixed(2)} ج.م</div>
                            <div style="font-size: 11px; color: #64748b;">${row[2]}</div>
                        </div>
                        <div style="font-size: 11px; color: #94a3b8;">${row[1]}</div>
                    </div>`;
            });
        } else {
            htmlContent += `<div style="text-align: center; padding: 15px; color: #94a3b8; font-size: 12px;">لم يتم تسجيل تحصيلات سابقة</div>`;
        }

        htmlContent += `</div></div>`;

        document.getElementById('statement-preview-area').innerHTML = htmlContent;
        document.getElementById('statementPreviewModal').style.display = 'flex';

    } catch (err) {
        console.error(err);
        showToast("خطأ في جلب البيانات", "error");
    }
};
// --- [4] دوال مساعدة للمودال والتحصيل ---
window.openPaymentModal = function(id, name, currentBalance) {
    document.getElementById('pay-customer-id').value = id;
    document.getElementById('pay-customer-name').innerText = name;
    document.getElementById('pay-amount').value = ""; 
    document.getElementById('pay-amount').placeholder =  currentBalance;
    document.getElementById('paymentModal').style.display = 'flex';
};

window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
};
function generateSmartReceipt(name, amount, note) {
    // إنشاء عنصر مؤقت للطباعة لو مش موجود
    let printArea = document.getElementById('print-receipt-area');
    if (!printArea) {
        printArea = document.createElement('div');
        printArea.id = 'print-receipt-area';
        printArea.style.display = 'none';
        document.body.appendChild(printArea);
    }

    const date = new Date().toLocaleString('ar-EG');
    
    printArea.innerHTML = `
        <div class="receipt-card">
            <div class="receipt-header">
                <h3>إيصال استلام نقدية</h3>
                <p>${date}</p>
            </div>
            <div class="receipt-row"><span>العميل:</span> <b>${name}</b></div>
            <div class="receipt-row"><span>المبلغ:</span> <b>${amount} ج.م</b></div>
            <div class="receipt-row"><span>البيان:</span> <b>${note}</b></div>
            <div class="receipt-footer">
                <p>شكراً لتعاملكم معنا</p>
                <p>توقيع المستلم: .................</p>
            </div>
        </div>
    `;

    // أمر الطباعة
    window.print();
}
function showReceiptPreview(name, amount, note) {
    document.getElementById('print-customer-name').innerText = name;
    document.getElementById('print-amount').innerText = amount.toFixed(2);
    document.getElementById('print-note').innerText = note;
    document.getElementById('print-date').innerText = new Date().toLocaleString('ar-EG');

    document.getElementById('receiptPreviewModal').style.display = 'flex';
}

// دالة الطباعة النهائية
window.printFinalReceipt = function() {
    const content = document.getElementById('receipt-printable-area').innerHTML;
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(`
        <html>
            <head><title>Print Receipt</title></head>
            <body style="direction: rtl; font-family: Arial;" onload="window.print(); window.close();">
                ${content}
            </body>
        </html>
    `);
    printWindow.document.close();
};


// دالة إغلاق المودال
window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
};
window.printLastInvoiceFromStatement = function() {
    const previewArea = document.getElementById('statement-preview-area');
    if (!previewArea) return showToast("منطقة المعاينة غير موجودة", "error");

    // 1. جلب اسم العميل (تنظيف دقيق للنص)
    const nameElement = previewArea.querySelector('h3');
    if (!nameElement) return showToast("تعذر تحديد العميل", "error");
    
    // إزالة جملة "سجل العمليات الكامل: " لو موجودة، أو التنظيف العادي
    const customerName = nameElement.innerText.replace('سجل العمليات الكامل:', '').trim();

    try {
        // 2. جلب آخر فاتورة بيع (أعلى ID) للعميل ده
        const lastSale = db.exec(`
            SELECT id, items_json, final_total, remaining_amount, date 
            FROM sales_history 
            WHERE customer_name = ? AND type = 'sale' 
            ORDER BY id DESC LIMIT 1
        `, [customerName]);

        if (lastSale.length === 0 || !lastSale[0].values) {
            return showToast("لا توجد فواتير بيع مسجلة لهذا العميل", "error");
        }

        const row = lastSale[0].values[0];
        const invId = row[0];
        let items = JSON.parse(row[1]);
        let total = parseFloat(row[2]);
        let remaining = parseFloat(row[3]);
        const invDate = row[4];

        // 3. جلب المرتجعات اللي مرتبطة بالفاتورة دي بالظبط
        const returns = db.exec(`
            SELECT items_json, final_total 
            FROM sales_history 
            WHERE original_invoice_id = ? AND type = 'return'
        `, [invId]);

        if (returns.length > 0 && returns[0].values) {
            returns[0].values.forEach(retRow => {
                const retItems = JSON.parse(retRow[0]);
                const retAmount = Math.abs(parseFloat(retRow[1]));

                retItems.forEach(rItem => {
                    let target = items.find(i => i.id === rItem.id || i.name === rItem.name);
                    if (target) {
                        target.qty = parseFloat(target.qty) - parseFloat(rItem.qty);
                    }
                });
                total -= retAmount;
            });
        }

        // مسح الأصناف اللي رجعت بالكامل (كميتها صفر)
        items = items.filter(i => i.qty > 0);

        // 4. تنفيذ الطباعة
        if (typeof printInvoice === 'function') {
            printInvoice({
                invId: invId,
                customer: customerName,
                cartItems: items,
                finalTotal: total,
                paidAmount: (total - remaining),
                remainingAmount: remaining,
                date: invDate,
                isReturn: false 
            });
        } else {
            console.error("printInvoice function is missing!");
        }

    } catch (err) {
        console.error("Database Error:", err);
        showToast("خطأ في جلب بيانات الفاتورة الأخيرة", "error");
    }
};



window.editOldInvoice = function(invoiceId) {
    try {
        // 1. جلب بيانات الفاتورة من القاعدة
        const res = db.exec("SELECT customer_name, items_json, paid_amount FROM sales_history WHERE id = ?", [invoiceId]);
        
        if (res.length > 0 && res[0].values) {
            const [custName, itemsJson, previousPaid] = res[0].values[0];
            
            // 2. الانتقال لقسم البيع
            showSection('sales'); 

            // 3. تجهيز بيانات التابة النشطة (Active Tab)
            const currentTab = saleTabs.find(t => t.id === activeTabId);
            if (currentTab) {
                currentTab.customerName = custName;
                currentTab.cart = JSON.parse(itemsJson);
                currentTab.previousPaid = parseFloat(previousPaid) || 0;
            }

            // 4. تحديث الواجهة (UI)
            document.getElementById('sale-customer-name').value = custName;
            document.getElementById('original-inv-id').value = invoiceId;
            document.getElementById('original-inv-section').style.display = 'block';

            // 5. ضبط وضع الدفع لآجل وتصفير "المدفوع الآن"
            const payMethod = document.getElementById('sale-payment-method');
            if (payMethod) {
                payMethod.value = 'credit';
                if (typeof toggleCreditSection === 'function') toggleCreditSection();
            }
            
            const paidInput = document.getElementById('sale-paid-amount');
            if (paidInput) paidInput.value = 0;

            // 6. تحديث الجدول والحسابات
            renderInvoiceTable();
            calculateTotal(); 

            // 7. إغلاق المودال وتنبيه المستخدم
            closeModal('statementPreviewModal');
            showToast(`تم فتح الفاتورة #${invoiceId} للإضافة (العميل: ${custName})`, "success");
        }
    } catch (e) {
        console.error("Edit Invoice Error:", e);
        showToast("خطأ في فتح الفاتورة", "error");
    }
};

async function showCustomerStatement(customerName, customerPhone, totalDebt) {
    document.getElementById('statement-customer-name').innerText = customerName;
    document.getElementById('statement-customer-phone').innerText = customerPhone;
    document.getElementById('statement-total-debt').innerText = totalDebt;

    // استعلام لجلب فواتير العميل الآجلة فقط
    const query = `SELECT id, date, grand_total, remaining_amount 
                   FROM invoices 
                   WHERE customer_name = '${customerName}' 
                   AND payment_method = 'credit' 
                   ORDER BY id DESC`;
    
    // تنفيذ الاستعلام (افترضنا db هو متغير الـ SQL عندك)
    const result = db.exec(query); 
    const tbody = document.getElementById('statement-list-body');
    tbody.innerHTML = '';

    if (result.length > 0) {
        result[0].values.forEach(row => {
            const [id, date, total, remaining] = row;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${date}</td>
                <td>فاتورة بيع #${id}</td>
                <td>${total.toFixed(2)}</td>
                <td style="color: ${remaining > 0 ? 'red' : 'green'}">${remaining.toFixed(2)}</td>
                <td>
                    ${remaining > 0 ? 
                    `<button class="btn-add-fast" title="إضافة بضاعة" onclick="editOldInvoice(${id})"><i class="fas fa-plus-circle"></i></button>` 
                    : '<span style="font-size: 10px; color: #999;">مسددة</span>'}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    document.getElementById('customerStatementModal').style.display = 'block';
}



window.showPrintPreview = function() {
    const previewArea = document.getElementById('statement-preview-area');
    if (!previewArea) return;

    // 1. استخراج البيانات الأساسية
    const customerName = previewArea.querySelector('h3')?.innerText || "عميل";
    // جلب المديونية من رقم داخل النص (لتجنب النصوص العشوائية)
    const balanceElement = previewArea.querySelector('div[style*="color: #e11d48"]');
    const balance = balanceElement ? balanceElement.innerText : "0.00";
    
    // 2. تجهيز الجداول وتنظيفها
    const tables = previewArea.querySelectorAll('table');
    let cleanInvoices = "";
    let cleanPayments = "";

    if (tables[0]) {
        const clone = tables[0].cloneNode(true); // نسخة من جدول الفواتير
        // حذف عمود "إجراء" من الرأس والجسم
        clone.querySelectorAll('tr').forEach(row => {
            if (row.cells.length > 2) row.deleteCell(-1); 
        });
        cleanInvoices = clone.outerHTML;
    }

    if (tables[1]) {
        cleanPayments = tables[1].outerHTML;
    }

    // 3. بناء الورقة بتنسيق A4 نظيف
    const paperHtml = `
        <div style="text-align:center; border-bottom:2px solid #334155; padding-bottom:15px; margin-bottom:20px;">
            <h2 style="margin:0;">كشف حساب عميل</h2>
            <p style="margin:5px 0; color:#64748b;">تاريخ التقرير: ${new Date().toLocaleString('sv-SE')}</p>
        </div>

        <div style="margin-bottom:25px; padding:15px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc;">
            <p style="margin:5px 0;"><b>اسم العميل:</b> ${customerName}</p>
            <p style="font-size:18px; color:#e11d48; margin:5px 0;"><b>إجمالي المديونية الحالية:</b> ${balance}</p>
        </div>

        <h3 style="font-size:15px; border-right:4px solid #2563eb; padding-right:10px; margin-bottom:10px;">الفواتير الآجلة المتبقية</h3>
        <div class="table-wrapper">${cleanInvoices || '<p>لا توجد فواتير معلقة</p>'}</div>

        <h3 style="font-size:15px; border-right:4px solid #f59e0b; padding-right:10px; margin-top:25px; margin-bottom:10px;">آخر التحصيلات النقدية</h3>
        <div class="table-wrapper">${cleanPayments || '<p>لا يوجد سجل تحصيلات</p>'}</div>

        <div style="margin-top:50px; text-align:center; border-top:1px solid #eee; padding-top:10px; font-size:11px; color:#94a3b8;">
            نهاية كشف الحساب - تم الاستخراج بواسطة النظام المحاسبي
        </div>
    `;

    document.getElementById('paper-content').innerHTML = paperHtml;
    document.getElementById('printPreviewModal').style.display = 'flex';
};

// دالة الطباعة الفعلية بعد التأكيد
window.executeFinalPrint = function() {
    const content = document.getElementById('paper-content').innerHTML;
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>طباعة كشف حساب</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #000; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-size: 13px; }
                th { background: #f1f5f9; }
                h2, h3 { margin-top: 0; }
                .table-wrapper { margin-bottom: 30px; }
                @media print {
                    body { padding: 0; }
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            ${content}
            <script>
                window.onload = function() {
                    window.print();
                    window.close();
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
    closeModal('printPreviewModal');
};

window.filterCustomerTable = function() {
    const searchTerm = document.querySelector('input[oninput*="filterCustomerTable"]').value.toLowerCase();
    const rows = document.querySelectorAll('#debt-list-body tr');

    rows.forEach(row => {
        const customerName = row.cells[1].innerText.toLowerCase();
        if (customerName.includes(searchTerm)) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
};



window.settleCustomerAccount = function(customerId, customerName, currentBalance) {
    if (!confirm(`هل أنت متأكد من تصفير حساب "${customerName}"؟ سيتم اعتبار كل المديونيات محصلة.`)) return;

    let inTransaction = false;
    try {
        db.run("BEGIN TRANSACTION");
        inTransaction = true;

        const now = new Date().toLocaleString('sv-SE');

        // 1. تصفير رصيد العميل في جدول العملاء
        db.run("UPDATE customers SET balance = 0 WHERE id = ?", [customerId]);

        // 2. تصفير جميع فواتير العميل التي بها متبقي (remaining_amount)
        db.run("UPDATE sales_history SET remaining_amount = 0 WHERE customer_name = ? AND remaining_amount > 0", [customerName]);

        // 3. تسجيل عملية تحصيل بقيمة المبلغ الذي كان متبقياً لتوثيق "تصفية الحساب"
        db.run(`INSERT INTO customer_payments (customer_id, amount, payment_method, note, date) 
                VALUES (?, ?, 'تصفية حساب', 'تصفية كامل الحساب - الحساب خلصان', ?)`, 
                [customerId, currentBalance, now]);

        db.run("COMMIT");
        inTransaction = false;

        saveDbToLocal();
        showToast("تم تصفير الحساب بنجاح ✅");
        
        // إغلاق المودال وتحديث جدول المديونيات
        closeModal('statementPreviewModal');
        if (typeof loadCustomersDebt === 'function') loadCustomersDebt();

    } catch (e) {
        if (inTransaction) db.run("ROLLBACK");
        console.error(e);
        showToast("فشلت عملية تصفية الحساب", "error");
    }
};

window.videwFromPreview = function() {
    const nameElement = document.querySelector('#statement-preview-area h3');
    const customerName = nameElement ? nameElement.innerText.replace('سجل العمليات الكامل: ', '').trim() : "عميل";
    
    try {
        const salesRes = db.exec(`
            SELECT id, date, final_total, type, remaining_amount 
            FROM sales_history 
            WHERE customer_name = ? 
            ORDER BY date DESC`, [customerName]);

        const customerIdRes = db.exec("SELECT id FROM customers WHERE name = ?", [customerName]);
        let payments = [];
        if (customerIdRes.length > 0) {
            const cId = customerIdRes[0].values[0][0];
            const payRes = db.exec("SELECT amount, date, note FROM customer_payments WHERE customer_id = ? ORDER BY date DESC", [cId]);
            if (payRes.length > 0) payments = payRes[0].values;
        }

        let allActions = [];
        if (salesRes.length > 0 && salesRes[0].values) {
            salesRes[0].values.forEach(row => {
                allActions.push({
                    type: row[3] === 'return' ? 'مرتجع' : 'فاتورة',
                    id: row[0],
                    date: row[1],
                    amount: row[2],
                    extra: row[4] > 0 ? `متبقي: ${row[4]}` : 'خالصة'
                });
            });
        }
        
        payments.forEach(pay => {
            allActions.push({
                type: 'تحصيل نقدي',
                id: '-',
                date: pay[1],
                amount: -pay[0],
                extra: pay[2]
            });
        });

        allActions.sort((a, b) => new Date(b.date) - new Date(a.date));

        let html = `
            <div id="printable-statement-content" dir="rtl" style="padding:15px;">
                <h3 style="text-align:center; color:#1e293b; margin-bottom:20px;">سجل العمليات الكامل: ${customerName}</h3>
                <table style="width:100%; border-collapse:collapse; background:#fff; font-size:13px; border:1px solid #e2e8f0;">
                    <thead>
                        <tr style="background:#f1f5f9; border-bottom:2px solid #e2e8f0;">
                            <th style="padding:10px; text-align:right;">التاريخ</th>
                            <th style="padding:10px; text-align:right;">النوع</th>
                            <th style="padding:10px; text-align:right;">القيمة</th>
                            <th style="padding:10px; text-align:right;">ملاحظات</th>
                        </tr>
                    </thead>
                    <tbody>`;

        allActions.forEach(act => {
            const color = act.type === 'مرتجع' ? '#e11d48' : (act.type === 'تحصيل نقدي' ? '#059669' : '#1e293b');
            html += `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px;">${act.date}</td>
                    <td style="padding:10px; font-weight:600; color:${color}">${act.type} ${act.id !== '-' ? '#'+act.id : ''}</td>
                    <td style="padding:10px; font-weight:bold;">${Math.abs(act.amount).toFixed(2)}</td>
                    <td style="padding:10px; color:#64748b;">${act.extra}</td>
                </tr>`;
        });

        html += `</tbody></table>
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button onclick="printFromPreview()" 
                            style="flex:1; padding:12px; background:#2563eb; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">
                        🖨️ طباعة السجل
                    </button>
                    <button onclick="document.getElementById('statementPreviewModal').style.display='none'" 
                            style="flex:1; padding:12px; background:#64748b; color:#fff; border:none; border-radius:8px; cursor:pointer;">
                        إغلاق
                    </button>
                </div>
            </div>`;

        document.getElementById('statement-preview-area').innerHTML = html;

    } catch (err) {
        console.error(err);
        showToast("خطأ في جلب سجل العمليات", "error");
    }
};

// دالة الطباعة اللي هتسحب الجدول اللي لسه معروض فوق
window.printFromPreview = function() {
    const content = document.getElementById('printable-statement-content').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>طباعة سجل العمليات</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #000; padding: 8px; text-align: right; }
                th { background: #f0f0f0; }
                button { display: none; } /* إخفاء الأزرار عند الطباعة */
                h3 { text-align: center; }
            </style>
        </head>
        <body>
            ${content}
            <script>
                // حذف الأزرار من نسخة الطباعة عشان متظهرش في الورقة
                document.querySelectorAll('button').forEach(b => b.remove());
                window.onload = function() { window.print(); window.close(); };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

















































































































// سجل الفواتير






// متغير لحفظ النوع المختار حالياً (الكل، وارد، صادر)
let currentRecordType = 'الكل';

// دالة لجلب البيانات وعرضها في الجدول
window.renderReports = function() {
    const tbody = document.querySelector("#reports-table tbody");
    if (!tbody || !db) return;

    try {
        // 1. جلب البيانات مع إضافة عمود type لتمييز المرتجع
        // تأكد أن الاستعلام يجلب عمود type (سواء كان row[5] أو حسب ترتيبه في جدولك)
        const res = db.exec("SELECT id, date, customer_name, total, payment_method, type FROM sales_history ORDER BY id DESC");
        
        tbody.innerHTML = ""; 

        if (res.length > 0 && res[0].values) {
            res[0].values.forEach(row => {
                const tr = document.createElement("tr");

                // 2. معالجة التاريخ
                let dateStr = '---';
                if (row[1]) {
                    const d = new Date(row[1]);
                    dateStr = isNaN(d) ? row[1] : d.toLocaleString('ar-EG');
                }
                
                // 3. تحديد نوع العملية (وارد، صادر، مرتجع)
                const pMethod = row[4]; // payment_method
                const processType = row[5]; // النوع (sale, return, وارد)
                
                let typeText = "صادر";
                let typeClass = "export";
                let priceColor = "#c62828"; // أحمر تلقائي للصادر
                let operationDesc = "مبيعات منتجات";

                if (pMethod === "وارد") {
                    typeText = "وارد";
                    typeClass = "import";
                    priceColor = "#2e7d32"; // أخضر للوارد
                    operationDesc = "توريد بضاعة";
                } else if (processType === "return") {
                    typeText = "مرتجع";
                    typeClass = "return-type"; // كلاس جديد للمرتجع
                    priceColor = "#f57c00"; // برتقالي للمرتجع لتمييزه
                    operationDesc = "مرتجع مبيعات";
                }

                tr.innerHTML = `
                    <td>#${row[0]}</td>
                    <td>${dateStr}</td>
                    <td><span class="badge-type ${typeClass}">${typeText}</span></td>
                    <td>${row[2] || 'عميل نقدي'}</td>
                    <td>${operationDesc}</td>
                    <td style="font-weight: bold; color: ${priceColor}; direction: ltr; text-align: right;">
                        ${row[3]} ج.م
                    </td>
                    <td>
                        <button class="action-btn print" onclick="printInvoiceFromHistory(${row[0]})" title="طباعة">
                            <i class="fas fa-print"></i>
                        </button>
                        <button class="action-btn delete" onclick="deleteInvoice(event, ${row[0]})" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; padding: 20px;'>لا توجد عمليات مسجلة حالياً</td></tr>";
        }
    } catch (err) {
        console.error("خطأ في جلب السجل:", err);
    }
};

// دالة الفلترة (البحث بالاسم والتاريخ والنوع)
window.applyAllFilters = function() {
    // 1. تجهيز قيم البحث
    const nameInput = document.getElementById('filter-name').value.toLowerCase().trim();
    const rows = document.querySelectorAll("#reports-table tbody tr");

    rows.forEach(row => {
        // صمام أمان: لو الصف ملوش خلايا (cells) تجاهله فوراً
        if (!row || !row.cells || row.cells.length < 4) return;

        // 2. سحب البيانات من الخلايا بأمان
        // cells[0] هو رقم العملية (#49)
        // cells[3] هو اسم العميل/المورد (خالد، عميل نقدي)
        const invoiceIdText = row.cells[0]?.innerText?.toLowerCase() || "";
        const customerName = row.cells[3]?.innerText?.toLowerCase() || "";
        const rowType = row.cells[2]?.innerText?.trim() || "";

        let show = true;

        // 3. منطق البحث
        if (nameInput) {
            // شيل الـ # من الرقم عشان لو المستخدم بحث بـ 49 بس يلاقيها
            const cleanId = invoiceIdText.replace('#', '');
            
            const matchId = invoiceIdText.includes(nameInput) || cleanId.includes(nameInput);
            const matchName = customerName.includes(nameInput);

            if (!matchId && !matchName) {
                show = false;
            }
        }

        // 4. فلترة النوع (وارد، صادر، مرتجع)
        if (show && typeof currentRecordType !== 'undefined' && currentRecordType !== 'الكل') {
            if (!rowType.includes(currentRecordType)) {
                show = false;
            }
        }

        // إظهار أو إخفاء الصف
        row.style.display = show ? "" : "none";
    });
};

// دالة تحديد النوع (وارد/صادر) من الزراير
window.setRecordType = function(type, btn) {
    currentRecordType = type;
    
    // تغيير شكل الزراير (active)
    document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    applyAllFilters();
};
// اربط هذا الكود بخانة البحث في الـ HTML (oninput="filterInvoices()")
window.filterInvoices = function() {
    try {
        const input = document.getElementById('filter-name').value.toLowerCase().trim();
        const rows = document.querySelectorAll("#reports-table tbody tr");

        rows.forEach(row => {
            // 1. حماية: لو الصف ملوش خلايا كافية (تجنب البياض)
            if (!row.cells || row.cells.length < 4) return;

            // 2. سحب البيانات اللي هنبحث فيها
            const invoiceId = row.cells[0].textContent.toLowerCase(); // رقم العملية (#49)
            const typeText = row.cells[2].textContent.toLowerCase();  // النوع (وارد/صادر/مرتجع)
            const customerName = row.cells[3].textContent.toLowerCase(); // الاسم

            // 3. منطق البحث: لو المدخل موجود في الرقم أو الاسم أو النوع
            // شيلنا الـ # من الرقم عشان لو بحثت بـ 49 بس يلاقيها
            const cleanId = invoiceId.replace('#', '');
            
            const isMatch = invoiceId.includes(input) || 
                            cleanId.includes(input) || 
                            customerName.includes(input) || 
                            typeText.includes(input);

            // 4. تطبيق النتيجة
            row.style.display = isMatch ? "" : "none";
        });
    } catch (err) {
        console.error("خطأ في البحث:", err);
    }
};


















// لوحة التحكم
window.updateDashboardStats = function() {
    if (!db) return; 

    try {
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.substring(0, 7);

        // 1. مبيعات اليوم (شيلنا شرط payment_method عشان نضمن القراءة)
        const salesRes = db.exec("SELECT SUM(total) FROM sales_history WHERE date LIKE ?", [`${today}%`]);
        const totalSales = salesRes[0]?.values[0][0] || 0;
        document.getElementById('dash-today-sales').innerText = Number(totalSales).toFixed(2);

        // 2. أرباح اليوم (القراءة مباشرة من عمود net_profit اللي الدالة الجديدة بتسجله)
        const profitTodayRes = db.exec("SELECT SUM(net_profit) FROM sales_history WHERE date LIKE ?", [`${today}%`]);
        const totalProfitToday = profitTodayRes[0]?.values[0][0] || 0;
        document.getElementById('dash-today-profit').innerText = Number(totalProfitToday).toFixed(2);

        // 3. أرباح الشهر
        const profitMonthRes = db.exec("SELECT SUM(net_profit) FROM sales_history WHERE date LIKE ?", [`${thisMonth}%`]);
        const totalProfitMonth = profitMonthRes[0]?.values[0][0] || 0;
        document.getElementById('dash-month-profit').innerText = Number(totalProfitMonth).toFixed(2);

        // 4. نواقص المخزن
        const lowStockRes = db.exec("SELECT COUNT(*) FROM products WHERE quantity <= 10");
        const lowStockCount = lowStockRes[0]?.values[0][0] || 0;
        document.getElementById('dash-low-stock').innerText = lowStockCount;


    } catch (e) {
        console.error("Dashboard Sync Error:", e);
    }
};




function loadPeopleData(query) {
    const list = document.getElementById('modal-items-list');
    try {
        // نستخدم الاستعلام اللي جاي كـ parameter مباشرة
        const res = db.exec(query); 
        list.innerHTML = "";

        if (res.length > 0 && res[0].values) {
            res[0].values.forEach(row => {
                const li = document.createElement('li');
                li.className = "modal-item-row";
                li.innerHTML = `
                    <div class="person-info">
                        <strong>${row[0]}</strong>
                        <span><i class="fas fa-phone"></i> ${row[1] || 'بدون رقم'}</span>
                    </div>
                    <div class="person-actions">
                        <button onclick="viewPersonDetails('${row[0]}')" class="view-btn">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                `;
                list.appendChild(li);
            });
        } else {
            list.innerHTML = "<li style='text-align:center; padding:20px;'>لا يوجد مسجلين حالياً</li>";
        }
    } catch (e) {
        list.innerHTML = "<li>حدث خطأ أثناء جلب البيانات</li>";
        console.error("People Data Error:", e);
    }
}

// الدالة اللي بتفتح المودال وتحدد الاستعلام الصح
window.openPeopleModal = function(type) {
    const table = (type === 'suppliers') ? 'suppliers' : 'customers';
    const modal = document.getElementById('people-modal'); 
    const listContainer = document.getElementById('modal-items-list'); 

    if (!modal || !listContainer) {
        return console.error("يا هندسة، المودال أو القائمة مش موجودين في الـ HTML!");
    }

    try {
        const res = db.exec(`SELECT id, name, phone, balance FROM ${table}`);
        listContainer.innerHTML = "";
        document.getElementById('modal-title').innerText = (type === 'suppliers') ? 'قائمة الموردين' : 'قائمة العملاء';

        if (res.length > 0 && res[0].values.length > 0) {
            res[0].values.forEach(row => {
                // فك المصفوفة لمتغيرات واضحة
                const [id, name, phone, balance] = row;

                listContainer.innerHTML += `
                    <li class="modal-list-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                        <div class="item-info">
                            <strong style="display: block;">${name}</strong>
                            <small style="color: #666;">${phone || 'بدون هاتف'}</small>
                            
                        </div>
                        <div class="item-actions">
                            <button onclick="deletePerson(event, ${id}, '${type}')" 
                                    style="background: #ff4d4d; color: white; border: none; padding: 4px 6px; border-radius: 5px; cursor: pointer;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </li>`;
            });
        } else {
            listContainer.innerHTML = `<li style="text-align: center; padding: 20px;">لا يوجد بيانات حالياً</li>`;
        }

        modal.style.display = 'flex';
        window.currentPeopleType = type;

    } catch (e) {
        console.error("إيرور جلب البيانات:", e);
        listContainer.innerHTML = `<li style="text-align: center; padding: 20px; color: red;">الجدول غير موجود</li>`;
        modal.style.display = 'flex';
    }
};

// دالة الإغلاق
window.closePeopleModal = function() {
    document.getElementById('people-modal').style.display = 'none';
};

window.closePeopleModal = () => document.getElementById('people-modal').style.display = 'none';


window.filterModalList = function() {
    const input = document.getElementById('modal-search-input').value.toLowerCase();
    const items = document.querySelectorAll('.modal-item-row');

    items.forEach(item => {
        const text = item.innerText.toLowerCase();
        item.style.display = text.includes(input) ? "flex" : "none";
    });
};


window.viewPersonDetails = function(personName) {
    const list = document.getElementById('modal-items-list');
    const title = document.getElementById('modal-title');
    
    // تغيير العنوان لاسم العميل
    title.innerText = "كشف حساب: " + personName;

    try {
        // جلب كل فواتير الشخص ده من سجل المبيعات
        const res = db.exec("SELECT id, date, total, payment_method FROM sales_history WHERE customer_name = ? ORDER BY id DESC", [personName]);
        
        let html = `
            <button onclick="openPeopleModal('customers')" class="back-btn">
                <i class="fas fa-arrow-right"></i> رجوع للقائمة
            </button>
            <div class="account-summary">
                <div class="summary-box">
                    <span>إجمالي المسحوبات</span>
                    <h4 id="person-total-spent">0.00</h4>
                </div>
            </div>
            <table class="mini-table">
                <thead>
                    <tr>
                        <th>رقم الفاتورة</th>
                        <th>التاريخ</th>
                        <th>المبلغ</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let totalSpent = 0;

        if (res.length > 0 && res[0].values) {
            res[0].values.forEach(row => {
                totalSpent += row[2];
                const date = new Date(row[1]).toLocaleDateString('ar-EG');
                html += `
                    <tr>
                        <td>#${row[0]}</td>
                        <td>${date}</td>
                        <td>${row[2].toFixed(2)} ج.م</td>
                    </tr>
                `;
            });
        } else {
            html += "<tr><td colspan='3'>لا توجد فواتير مسجلة</td></tr>";
        }

        html += "</tbody></table>";
        list.innerHTML = html;
        
        // تحديث إجمالي المسحوبات
        document.getElementById('person-total-spent').innerText = totalSpent.toFixed(2) + " ج.م";

    } catch (e) {
        console.error("خطأ في كشف الحساب:", e);
    }
};
function applyStoredSettings() {
    try {
        const res = db.exec("SELECT value FROM settings WHERE key = 'company_name'");
        if (res.length > 0) {
            const storedName = res[0].values[0][0];
            // ابحث عن العنصر اللي شايل اسم الشركة في الهيدر بتاعك
            // لو هو <span> جوه اللوجو مثلاً:
            const logo = document.querySelector('.company-logo span') || document.querySelector('.header-title');
            if (logo) logo.innerText = storedName;
        }
    } catch (e) { console.log("إعدادات الشركة غير موجودة بعد"); }
}





// --- 1. دالة تسجيل الدخول الرئيسية ---
window.checkMainPass = function() {
    const uEl = document.getElementById('main-username');
    const pEl = document.getElementById('main-pass');
    if(!uEl || !pEl) return;

    const userInp = uEl.value.trim();
    const passInp = pEl.value.trim();

    try {
        // 1. هنسحب كل البيانات اللي محتاجينها في خبطة واحدة (الاسم، الرول، الصلاحيات)
        const res = db.exec("SELECT username, role, permissions FROM system_users WHERE username = ? AND password = ?", [userInp, passInp]);

        if (res.length > 0 && res[0].values.length > 0) {
            const userData = res[0].values[0];
            const userName = userData[0];
            const userRole = userData[1];
            const userPerms = userData[2]; // ده النص الـ JSON اللي فيه [ "sales", ... ]

            // حفظ البيانات في الـ LocalStorage
            localStorage.setItem('last_logged_user', userName);
            localStorage.setItem('user_role', userRole);
            localStorage.setItem('user_permissions', userPerms);

            // إخفاء شاشة اللوجن
            const loginOverlay = document.getElementById('main-login-overlay');
            if (loginOverlay) {
                loginOverlay.style.transition = "opacity 0.5s ease";
                loginOverlay.style.opacity = "0";
                setTimeout(() => { loginOverlay.style.display = 'none'; }, 500);
            }

            const userDisplay = document.getElementById('user');
            if (userDisplay) userDisplay.innerText = `المستخدم: ${userName}`;

            // 2. أهم خطوة: تطبيق الصلاحيات (بنبعت الـ permissions مش الـ role)
            if (typeof window.applyPermissions === 'function') {
                window.applyPermissions(userPerms);
            }

            showToast(`مرحباً ${userName}!`, "success");

        } else {
            showToast("بيانات الدخول غير صحيحة ❌", "error");
            pEl.value = "";
            pEl.focus();
            [uEl, pEl].forEach(el => {
                el.style.borderColor = "red";
                setTimeout(() => el.style.borderColor = "", 2000);
            });
        }
    } catch (e) {
        console.error("Login Error:", e);
        showToast("خطأ في قاعدة البيانات", "error");
    }
};

// --- 2. كود التشغيل والتحكم (الكل داخل DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', () => {
    const uInput = document.getElementById('main-username');
    const pInput = document.getElementById('main-pass');

    if (uInput && pInput) {
        // أ. استرجاع آخر يوزر
        const lastUser = localStorage.getItem('last_logged_user');
        if (lastUser) uInput.value = lastUser;

        // ب. تفعيل زر Enter للخانات
        [uInput, pInput].forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') window.checkMainPass();
            });
        });

        // ج. دالة الفوكس القوي (القنص)
        let focusAttempts = 0;
        const forceFocus = setInterval(() => {
            // بنحاول نركز على الباسورد لو اليوزر مكتوب، أو على اليوزر لو فاضي
            const target = uInput.value ? pInput : uInput;
            
            target.focus();
            if (target === pInput) target.select(); // تظليل الباسورد لو موجود

            focusAttempts++;
            if (document.activeElement === target || focusAttempts > 15) {
                clearInterval(forceFocus);
            }
        }, 200); // كل 200 ملي ثانية عشان يبقى أسرع
    }
});

// 1. تحديث اسم الشركة
window.updateCompanyName = function() {
    const name = document.getElementById('new-company-name').value.trim();
    if (!name) return showToast("برجاء إدخال اسم", "warning");
    
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('company_name', ?)", [name]);
    saveDbToLocal();
    
    document.querySelectorAll('.company-name-display, #sidebar-logo-name, #display-company-name')
            .forEach(el => el.innerText = name);
            
    showToast("تم تحديث اسم الشركة ✅");
    
    // ❌ امسح السطر اللي تحت ده أو اعمله كومنت
    // document.getElementById('new-company-name').value = ""; 
};
// دالة فتح وإغلاق مودال الأرقام السرية
window.togglePassModal = function(show) {
    const modal = document.getElementById('pass-management-modal'); // تأكد إن ده الـ ID في الـ HTML
    if (modal) {
        modal.style.display = show ? 'flex' : 'none';
    } else {
        console.error("مودال الأرقام السرية مش موجود في الـ HTML");
    }
};
// دالة حفظ الأرقام السرية للأقسام
window.saveSystemPass = function() {
    const invPass = document.getElementById('new-inv-pass').value.trim();
    const dashPass = document.getElementById('new-dash-pass').value.trim();

    // لو الخانتين فاضيين نبه المستخدم
    if (!invPass && !dashPass) {
        return showToast("لم يتم إدخال أي تغييرات ⚠️", "error");
    }

    try {
        // تحديث باسوورد المخزن فقط لو اتكتب فيه حاجة
        if (invPass !== "") {
            db.run("UPDATE settings SET value = ? WHERE key = 'inv_pass'", [invPass]);
        }

        // تحديث باسوورد لوحة التحكم فقط لو اتكتب فيه حاجة
        if (dashPass !== "") {
            db.run("UPDATE settings SET value = ? WHERE key = 'dash_pass'", [dashPass]);
        }
        
        saveDbToLocal();
        showToast("تم تحديث البيانات المختارة بنجاح ✅");
        
        // تصفير الخانات وقفل المودال
        document.getElementById('new-inv-pass').value = "";
        document.getElementById('new-dash-pass').value = "";
        togglePassModal(false);
        
    } catch (e) {
        console.error("حفظ فاشل:", e);
        showToast("حدث خطأ أثناء الحفظ", "error");
    }
};
window.openResetModal = function() {
    document.getElementById('reset-modal').style.display = 'block';
    document.getElementById('reset-pass-input').value = ''; // تصفير الباسورد
};
// دالة لتحديد كل الخيارات لو اختار "إعادة تهيئة كاملة"
window.toggleFullReset = function(masterChk) {
    const allChecks = document.querySelectorAll('.reset-chk');
    allChecks.forEach(chk => {
        chk.checked = masterChk.checked;
        chk.disabled = masterChk.checked; // تعطيلهم عشان ميلخبطش السيستم
    });
};

// دالة عامة لقفل أي مودال عن طريق الـ ID بتاعه
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
};
// حركة صايعة: قفل المودال لو دوست في أي حتة فاضية بره الصندوق
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

window.openLogsModal = function(type, mode = 'day') {
    const container = document.getElementById('logs-table-container');
    const modalTitle = document.getElementById('logs-modal-title');
    const database = window.db || db;

    if (!container || !database) return;

    // تحديد شكل التاريخ للتجميع (10 حروف لليوم، 7 حروف للشهر)
    const dateLength = mode === 'day' ? 10 : 7;
    const titlePrefix = mode === 'day' ? "سجل أرباح الأيام" : "سجل أرباح الشهور";
    modalTitle.innerHTML = `💰 ${titlePrefix}`;

    try {
        const query = `
            SELECT 
                substr(date, 1, ${dateLength}) as period, 
                SUM(total) as total_sales, 
                SUM(net_profit) as total_profit 
            FROM sales_history 
            GROUP BY period 
            ORDER BY period DESC 
            LIMIT 50
        `;
        const res = database.exec(query);
        
        renderLogsTable(res);
        document.getElementById('logs-modal').style.display = 'block';
    } catch (e) {
        console.error("خطأ في جلب البيانات:", e);
    }
};

// دالة رسم الجدول (عشان نستخدمها في البحث برضه)
function renderLogsTable(res) {
    const container = document.getElementById('logs-table-container');
    let html = `<table id="main-log-table" style="width:100%; border-collapse: collapse; text-align: right;" dir="rtl">
                    <thead>
                        <tr style="background: #f4f4f4; border-bottom: 2px solid #27ae60;">
                            <th style="padding:10px; border:1px solid #ddd;">📅 الفترة</th>
                            <th style="padding:10px; border:1px solid #ddd;">💵 المبيعات</th>
                            <th style="padding:10px; border:1px solid #ddd;">💸 صافي الربح</th>
                        </tr>
                    </thead>
                    <tbody>`;

    if (res.length > 0 && res[0].values.length > 0) {
        res[0].values.forEach(row => {
            html += `<tr style="border-bottom: 1px solid #eee;">
                        <td style="padding:10px; border:1px solid #ddd;"><b>${row[0]}</b></td>
                        <td style="padding:10px; border:1px solid #ddd;">${Number(row[1]).toFixed(2)}</td>
                        <td style="padding:10px; border:1px solid #ddd; color: #27ae60; font-weight: bold;">${Number(row[2]).toFixed(2)}</td>
                     </tr>`;
        });
    } else {
        html += `<tr><td colspan="3" style="text-align:center; padding:20px;">لا توجد بيانات تطابق بحثك.</td></tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
}

// 🔥 دالة البحث بالتاريخ
window.filterLogsByDate = function() {
    const searchDate = document.getElementById('logDateSearch').value;
    if (!searchDate) return;

    const database = window.db || db;
    try {
        const res = database.exec(`
            SELECT substr(date, 1, 10) as day, SUM(total), SUM(net_profit) 
            FROM sales_history 
            WHERE date LIKE '${searchDate}%' 
            GROUP BY day
        `);
        renderLogsTable(res);
    } catch (e) {
        console.error("خطأ في البحث:", e);
    }
};

window.liveSearchLogs = function() {
    const input = document.getElementById("logGeneralSearch");
    const filter = input.value.toLowerCase();
    const table = document.getElementById("main-log-table");
    if (!table) return;

    const rows = table.querySelectorAll("tbody tr");

    rows.forEach(row => {
        let textContent = row.textContent.toLowerCase();
        
        if (textContent.includes(filter)) {
            row.style.display = ""; // إظهار
            row.style.opacity = "1";
            
            // تمييز الكلمات (Highlighting)
            Array.from(row.cells).forEach(cell => {
                const originalText = cell.getAttribute('data-original') || cell.innerText;
                if (!cell.hasAttribute('data-original')) cell.setAttribute('data-original', originalText);
                
                if (filter && originalText.toLowerCase().includes(filter)) {
                    const regex = new RegExp(`(${filter})`, 'gi');
                    cell.innerHTML = originalText.replace(regex, `<span class="highlight">$1</span>`);
                } else {
                    cell.innerHTML = originalText;
                }
            });
        } else {
            row.style.display = "none"; // إخفاء
            row.style.opacity = "0";
        }
    });
    const visibleRows = Array.from(rows).filter(r => r.style.display !== "none").length;
document.getElementById("searchCount").innerText = filter ? `تم العثور على ${visibleRows} نتيجة` : "";
};

// دالة البحث (عشان خانة البحث اللي في صورتك تشتغل)
window.filterLogTable = function() {
    let input = document.getElementById("log-search").value.toUpperCase();
    let table = document.getElementById("main-log-table");
    let tr = table.getElementsByTagName("tr");

    for (let i = 1; i < tr.length; i++) {
        let td = tr[i].getElementsByTagName("td")[0];
        if (td) {
            let textValue = td.textContent || td.innerText;
            tr[i].style.display = textValue.toUpperCase().indexOf(input) > -1 ? "" : "none";
        }
    }
};

// 1. وظيفة الربط التفاعلي
window.syncResetFields = function(caller) {
    const salesChk = document.getElementById('chk-sales');
    const profitChk = document.getElementById('chk-profit');
    
    // لو اخترت واحد التاني يختار نفسه أوتوماتيك
    if (caller === 'sales' && salesChk.checked) {
        profitChk.checked = true;
    } else if (caller === 'profit' && profitChk.checked) {
        salesChk.checked = true;
    }
};

// 2. وظيفة التبديل الشامل (لما يدوس على القنبلة)
window.toggleFullReset = function(master) {
    const allChks = document.querySelectorAll('.reset-chk');
    allChks.forEach(chk => {
        chk.checked = master.checked; // الكل يتبع القنبلة
        chk.disabled = master.checked; // قفل الخانات عشان الشكل يبان احترافي
        chk.parentElement.style.opacity = master.checked ? "0.5" : "1"; // تأثير بصري
    });
};

// 3. دالة المسح النهائية
window.executeSystemReset = function() {
    const pass = document.getElementById('reset-pass-input').value;
    if (pass !== '123') return showToast("❌ كلمة السر خطأ", "error");

    const selectedTables = Array.from(document.querySelectorAll('.reset-chk:checked')).map(c => c.value);
    const fullReset = document.getElementById('full-reset-chk').checked;

    try {
        db.run("BEGIN TRANSACTION");

        if (fullReset) {
            // مسح كل شيء بلا استثناء
            const all = ['customers', 'customer_payments', 'sales_history', 'products', 'expenses'];
            all.forEach(t => db.run(`DELETE FROM ${t}`));
        } else {
            // معالجة ذكية لكل اختيار
            selectedTables.forEach(table => {
                if (table === 'customers') {
                    // فحص: هل فيه عملاء عليهم مديونية؟
                    const debtRes = db.exec("SELECT COUNT(*) FROM customers WHERE balance != 0");
                    const debtCount = debtRes[0].values[0][0];
                    
                    if (debtCount > 0) {
                        throw new Error(`لا يمكن مسح سجل العملاء لوجود ${debtCount} عملاء لديهم مديونيات قائمة. صفي الحسابات أولاً أو اختر مسح شامل.`);
                    }
                }
                
                db.run(`DELETE FROM ${table}`);
                db.run(`DELETE FROM sqlite_sequence WHERE name = ?`, [table]);
            });
        }

        db.run("COMMIT");
        createTablesSchema(); // لإعادة إنشاء القيم الافتراضية
        showToast("✅ تم تنفيذ العملية بنجاح");
        setTimeout(() => location.reload(), 1000);
    } catch (e) {
        db.run("ROLLBACK");
        showToast(e.message, "error");
    }
};




// دالة الدخول للمخزن بباسوورد
window.openInventory = function() {
    // 1. نجيب الباسوورد المتسيف في القاعدة
    const res = db.exec("SELECT value FROM settings WHERE key = 'inv_pass'");
    const correctPass = (res.length > 0) ? res[0].values[0][0] : "123"; // 123 افتراضي

    // 2. نطلب الباسوورد من المستخدم
    const userPass = prompt("برجاء إدخال رقم سر المخزن:");

    if (userPass === correctPass) {
        showToast("تم التحقق بنجاح ✅");
        // هنا حط الكود اللي بيفتح المخزن عندك، مثلاً:
        document.getElementById('inventory-section').scrollIntoView(); 
        // أو إظهار الـ div الخاص بالمخزن
    } else if (userPass !== null) {
        showToast("الباسوورد غلط يا هندسة ❌", "error");
    }
};

// دالة الدخول للوحة التحكم / الإعدادات
window.openSettings = function() {
    const res = db.exec("SELECT value FROM settings WHERE key = 'dash_pass'");
    const correctPass = (res.length > 0) ? res[0].values[0][0] : "456"; // 456 افتراضي

    const userPass = prompt("برجاء إدخال رقم سر الإعدادات:");

    if (userPass === correctPass) {
        showToast("مرحباً بك في الإعدادات ✅");
        toggleSettingsModal(true); // الدالة اللي بتفتح المودال عندك
    } else if (userPass !== null) {
        showToast("ممنوع الدخول لغير المخولين ❌", "error");
    }
};
let currentTargetSection = "";
let currentTargetKey = "";

// دالة فتح مودال الباسوورد
window.checkPassAndShow = function(sectionId, passKey) {
    currentTargetSection = sectionId;
    currentTargetKey = passKey;
    
    // تغيير الرسالة حسب القسم
    const msg = sectionId === 'inventory' ? "دخول قسم المخزن" : "دخول لوحة التحكم";
    document.getElementById('auth-message').innerText = msg;
    
    document.getElementById('section-auth-modal').style.display = 'flex';
    document.getElementById('auth-section-pass').value = ""; // تصفير الخانة
    document.getElementById('auth-section-pass').focus();     // تركيز الماوس
};








window.checkPassAndShow = function(sectionId, passKey) {
    const role = localStorage.getItem('user_role');
    const allowed = ROLES_PERMISSIONS[role] || [];

    if (!allowed.includes(sectionId)) {
        showToast("عفواً، ليس لديك صلاحية لدخول هذا القسم", "error");
        return;
    }

    // لو له صلاحية، كمل الكود عادي وافتح السكشن
    window.showSection(sectionId);
};

// 1. فتح وقفل المودال
window.toggleUserModal = function(show) {
    const modal = document.getElementById('user-management-modal');
    if (modal) {
        modal.style.display = show ? 'flex' : 'none';
        if (show) renderUsers();
    }
};

// 2. تحديث العداد وزر "الوصول الكامل"
window.updatePermCount = function() {
    const allChecks = document.querySelectorAll('#sections-perm-list input[type="checkbox"]:not(#full-access-check)');
    const checked = Array.from(allChecks).filter(i => i.checked);
    document.getElementById('selected-count').innerText = checked.length;
    
    // لو كل الصلاحيات متعلم عليها، علم على "وصول كامل" تلقائياً
    const master = document.getElementById('full-access-check');
    if (master) master.checked = (checked.length === allChecks.length && allChecks.length > 0);
};

window.toggleAllPerms = function(master) {
    document.querySelectorAll('#sections-perm-list input[type="checkbox"]').forEach(cb => {
        cb.checked = master.checked;
    });
    updatePermCount();
};

// 3. رندر الجدول (3 أعمدة) - حل مشكلة علامات التنصيص
window.renderUsers = function() {
    const tbody = document.getElementById('users-list-table');
    if (!tbody) return;
    tbody.innerHTML = "";

    try {
        const res = db.exec("SELECT id, username, role, permissions FROM system_users");
        if (res.length > 0) {
            res[0].values.forEach(row => {
                const [id, user, role, perms] = row;
                const isMainAdmin = (user.toLowerCase() === 'admin');
                
                // تحويل الصلاحيات لشارات (Badges)
                let permsHtml = "";
                try {
                    const pArr = JSON.parse(perms || "[]");
                    permsHtml = pArr.map(p => `<span style="background:#e8f0fe; color:#1a73e8; padding:2px 5px; border-radius:3px; font-size:11px; margin:2px; display:inline-block; border:1px solid #d1e9ff;">${p}</span>`).join('');
                } catch(e) { permsHtml = "---"; }

                // تجهيز النص ليكون آمناً داخل الـ onclick
                const safePerms = (perms || "[]").replace(/"/g, '&quot;').replace(/'/g, "\\'");

                tbody.innerHTML += `
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:10px;"><strong>${user}</strong><br><small style="color:#888;">${role === 'admin' ? 'مدير' : 'موظف'}</small></td>
                        <td style="padding:10px;">${permsHtml}</td>
                        <td style="padding:10px; text-align:center;">
                            <button onclick="prepareUserEdit(${id}, '${user}', '${role}', '${safePerms}')" style="color:#f39c12; border:none; background:none; cursor:pointer; font-size:16px;"><i class="fas fa-edit"></i></button>
                            ${!isMainAdmin ? `<button onclick="deleteUser(${id})" style="color:#e74c3c; border:none; background:none; cursor:pointer; font-size:16px; margin-right:8px;"><i class="fas fa-trash-alt"></i></button>` : '<i class="fas fa-lock" style="color:#ccc; margin-right:8px;"></i>'}
                        </td>
                    </tr>`;
            });
        }
    } catch (e) { console.error(e); }
};

// 4. تجهيز التعديل
window.prepareUserEdit = function(id, name, role, perms) {
    document.getElementById('edit-user-id').value = id;
    document.getElementById('manage-user-name').value = name;
    document.getElementById('manage-user-role').value = role;
    document.getElementById('manage-user-pass').placeholder = "اتركه فارغاً للحفاظ على القديم";

    // تصفير الصلاحيات أولاً
    document.querySelectorAll('#sections-perm-list input').forEach(i => i.checked = false);

    try {
        const cleanPerms = perms.replace(/&quot;/g, '"');
        const pArray = JSON.parse(cleanPerms);
        pArray.forEach(p => {
            const cb = document.querySelector(`#sections-perm-list input[value="${p}"]`);
            if (cb) cb.checked = true;
        });
        updatePermCount();
    } catch(e) { console.error(e); }

    document.getElementById('btn-add-user').style.display = 'none';
    document.getElementById('edit-actions').style.display = 'flex';
};

// 5. الإضافة والتحديث والحذف
window.addUser = function() {
    const name = document.getElementById('manage-user-name').value.trim();
    const pass = document.getElementById('manage-user-pass').value.trim();
    const role = document.getElementById('manage-user-role').value;
    const perms = JSON.stringify(Array.from(document.querySelectorAll('#sections-perm-list input:checked')).map(i => i.value));

    if (!name || !pass) return alert("الاسم والباسوورد مطلوبين");
    try {
        db.run("INSERT INTO system_users (username, password, role, permissions) VALUES (?, ?, ?, ?)", [name, pass, role, perms]);
        saveDbToLocal();
        resetUserForm();
        renderUsers();
    } catch (e) { alert("الاسم موجود فعلاً"); }
};

window.updateUser = function() {
    const id = document.getElementById('edit-user-id').value;
    const name = document.getElementById('manage-user-name').value.trim();
    const pass = document.getElementById('manage-user-pass').value.trim();
    const role = document.getElementById('manage-user-role').value;
    const perms = JSON.stringify(Array.from(document.querySelectorAll('#sections-perm-list input:checked')).map(i => i.value));

    if (pass) {
        db.run("UPDATE system_users SET username=?, password=?, role=?, permissions=? WHERE id=?", [name, pass, role, perms, id]);
    } else {
        db.run("UPDATE system_users SET username=?, role=?, permissions=? WHERE id=?", [name, role, perms, id]);
    }
    saveDbToLocal();
    resetUserForm();
    renderUsers();
};

window.deleteUser = function(id) {
    if (confirm("حذف المستخدم؟")) {
        db.run("DELETE FROM system_users WHERE id=?", [id]);
        saveDbToLocal();
        renderUsers();
    }
};

window.resetUserForm = function() {
    document.getElementById('edit-user-id').value = "";
    document.getElementById('manage-user-name').value = "";
    document.getElementById('manage-user-pass').value = "";
    document.getElementById('manage-user-pass').placeholder = "كلمة المرور";
    document.querySelectorAll('#sections-perm-list input').forEach(i => i.checked = false);
    updatePermCount();
    document.getElementById('btn-add-user').style.display = 'block';
    document.getElementById('edit-actions').style.display = 'none';
};

// التحكم في الـ Popup
window.togglePermPopup = function(e) {
    e.stopPropagation();
    const p = document.getElementById('perm-popup');
    p.style.display = (p.style.display === 'block') ? 'none' : 'block';
};

document.addEventListener('click', () => {
    const p = document.getElementById('perm-popup');
    if (p) p.style.display = 'none';
});
window.applyPermissions = function(permsJson) {
    // 1. حالة الوصول الكامل (الأدمن)
    const isAdmin = (permsJson === 'all' || permsJson.includes('"all"'));

    try {
        const userPerms = isAdmin ? [] : JSON.parse(permsJson || "[]");

        const sectionsMap = {
            'welcome-section': 'nav-welcome',
            'sales': 'nav-sales',
            'purchase': 'nav-purchase',
            'inventory': 'nav-inventory',
            'reports': 'nav-reports',
            'customers': 'nav-customers',
            'dashboard-section': 'nav-dashboard',
            'settings-section': 'nav-settings',
        };

        for (const [key, id] of Object.entries(sectionsMap)) {
            const element = document.getElementById(id);
            if (element) {
                // إذا كان الأدمن أو لديه الصلاحية
                const hasAccess = isAdmin || userPerms.includes(key);

                if (hasAccess) {
                    element.classList.remove('locked');
                    element.style.opacity = "1";
                    element.style.pointerEvents = "auto";
                } else {
                    element.classList.add('locked');
                    // اختياري: لو عايز تمسح الـ onclick مؤقتاً لزيادة الأمان
                    // element.setAttribute('data-old-click', element.getAttribute('onclick'));
                    // element.removeAttribute('onclick');
                }
            }
        }
        console.log("✅ تم قفل الأقسام غير المسموحة.");
    } catch (e) {
        console.error("خطأ في تطبيق القيود:", e);
    }
};

































































































// window.checkPassAndShow = function(sectionId, passKey) {
//     // مؤقتاً: تخطي الحماية وتحويل المستخدم للسكشن المطلوب فوراً
//     console.log("وضع التطوير: تم تخطي الباسورد للدخول إلى " + sectionId);
    
//     // نداء مباشر لدالة إظهار السكشن
//     if (typeof showSection === 'function') {
//         showSection(sectionId);
//     } else {
//         // لو دالة showSection مش في النطاق العام، نستخدم الطريقة اليدوية
//         const sections = document.querySelectorAll('.content-section');
//         sections.forEach(s => s.style.display = 'none');
        
//         const target = document.getElementById(sectionId);
//         if (target) target.style.display = 'block';
//     }

//     // إخفاء المودال لو كان مفتوح بالصدفة
//     const authModal = document.getElementById('section-auth-modal');
//     if (authModal) authModal.style.display = 'none';
// };

// إغلاق المودال
window.closeAuthModal = function() {
    document.getElementById('section-auth-modal').style.display = 'none';
};

// تنفيذ التحقق عند الضغط على دخول
document.getElementById('confirm-auth-btn').onclick = function() {
    const enteredPass = document.getElementById('auth-section-pass').value;
    
    try {
        const res = db.exec("SELECT value FROM settings WHERE key = ?", [currentTargetKey]);
        const correctPass = (res.length > 0) ? res[0].values[0][0] : "123";

        if (enteredPass === correctPass) {
            showToast("تم الدخول بنجاح ✅");
            closeAuthModal();
            showSection(currentTargetSection); // نداء دالتك الأصلية
        } else {
            showToast("كلمة السر خطأ ❌", "error");
            document.getElementById('auth-section-pass').style.borderColor = "red";
        }
    } catch (e) {
        console.error("Auth Error:", e);
    }
};

// دعم زرار Enter في مودال الباسوورد
document.getElementById('auth-section-pass').onkeypress = function(e) {
    if (e.key === 'Enter') document.getElementById('confirm-auth-btn').click();
};











































































































































































































// دالة الحذف
window.deleteInvoice = function(event, invoiceId) {
    if (event) event.stopPropagation();

    // 1. نمسك الصف فوراً ونخزنه قبل أي حاجة
    const btnClicked = event.currentTarget;
    const rowToDelete = btnClicked.closest('tr') || btnClicked.closest('.modal-list-item') || btnClicked.closest('li');

    const oldBox = document.querySelector('.inline-confirm-box');
    if (oldBox) oldBox.remove();

    const box = document.createElement('div');
    box.className = 'inline-confirm-box';
    
    Object.assign(box.style, {
        position: 'absolute',
        backgroundColor: '#ffffff',
        padding: '6px',
        borderRadius: '10px',
        display: 'flex',
        gap: '8px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
        zIndex: '100000',
        border: '1px solid #f0f0f0',
        transform: 'translate(-50%, -130%)'
    });

    box.innerHTML = `
        <button id="ok-inv" style="background:#e3f9e5; color:#27ae60; border:none; width:32px; height:32px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fas fa-check"></i></button>
        <button id="no-inv" style="background:#feeaea; color:#e74c3c; border:none; width:32px; height:32px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fas fa-times"></i></button>
    `;

    const rect = btnClicked.getBoundingClientRect();
    box.style.left = (rect.left + rect.width / 2 + window.scrollX) + 'px';
    box.style.top = (rect.top + window.scrollY) + 'px';

    document.body.appendChild(box);

    // 2. تنفيذ الحذف
    document.getElementById('ok-inv').onclick = function() {
        try {
            db.run(`DELETE FROM sales_history WHERE id = ?`, [invoiceId]);
            saveDbToLocal();
            
            // مسح الصف اللي خزنّاه في الخطوة رقم 1
            if (rowToDelete) {
                rowToDelete.style.transition = '0.3s';
                rowToDelete.style.opacity = '0';
                setTimeout(() => rowToDelete.remove(), 300);
            }

            box.remove();
            showToast("تم الحذف بنجاح ✅");
        } catch (e) {
            console.error("خطأ أثناء الحذف:", e);
            showToast("حدث خطأ", "error");
        }
    };

    // 6. إلغاء عند الضغط على "غلط"
    document.getElementById('no-inv').onclick = (e) => {
        e.stopPropagation();
        box.remove();
    };

    // إغلاق لو دوست في أي حتة فاضية (طريقة أنظف)
    window.onclick = function(event) {
        if (event.target !== box && !box.contains(event.target)) {
            box.remove();
            window.onclick = null; // تنظيف الـ listener فوراً
        }
    };
};
// دالة الطباعة (تنبيه مبدئي)










// حط الكود ده في آخر الملف خالص
setTimeout(() => {
    const payBtn = document.getElementById('sale-payment-method');
    if (payBtn) { 
        payBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') window.saleProcessInvoice();
        });
    }
}, 500);

window.showSection = function(sectionId) {
    // 1. إخفاء كل السكاشن
    document.querySelectorAll('.content-section').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    
    // 2. إظهار السكشن المطلوب
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.add('active');
        activeSection.style.display = 'block';

        // 3. --- ميكانيكا إظهار البيانات تلقائياً ---
        if (sectionId === 'inventory') {
            console.log("تحديث تلقائي للمخزن...");
            // استدعاء الدالة اللي بتسحب من SQL وتملأ الجدول
            if (typeof renderInventory === 'function') {
                renderInventory(); 
            }
        } 
        
        // 4. ضبط مؤشر الكتابة (Focus)
        setTimeout(() => {
            if (sectionId === 'sales') {
                document.getElementById('sale-search-input')?.focus();
            } else if (sectionId === 'inventory') {
                document.getElementById('inventory-search-input')?.focus();
            } else if (sectionId === 'purchase') {
                document.getElementById('purchase-search')?.focus();
            }
        }, 100);
    }
};

// 4. 🔥 السطر ده عشان يفتح "الرئيسية" أول ما تعمل Save والكود يعمل ريفريش
document.addEventListener('DOMContentLoaded', () => {
    showSection('welcome-section'); 
});





window.viewSalesHistory = function() {
    const res = db.exec("SELECT * FROM sales_history ORDER BY id DESC");
    if (res.length > 0) {
        console.log("📜 سجل الفواتير المسجلة:");
        console.table(res[0].values);
    } else {
        console.log("⚠️ السجل فارغ حالياً.");
    }
};
















window.showToast = function(message, type = 'success') {
    // التأكد من وجود حاوية التوست أو إنشائها
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // إنشاء التوست نفسه
    const toast = document.createElement('div');
    toast.className = `toast-message ${type === 'error' ? 'toast-error' : 'toast-success'}`;
    
    // أيقونة بسيطة حسب النوع
    const icon = type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : '<i class="fas fa-check-circle"></i>';
    
    toast.innerHTML = `${icon} <span>${message}</span>`;
    
    container.appendChild(toast);

    // حذف العنصر من الـ DOM بعد انتهاء الأنيميشن
    setTimeout(() => {
        toast.remove();
        if (container.childNodes.length === 0) container.remove();
    }, 3000);
};





// ابحث عن الدالة اللي بتبدل بين الشاشات (مثلاً اسمها showSection)
window.showSection = function(sectionId) {
    // 1. إخفاء كل السكاشن
    document.querySelectorAll('.content-section').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    
    // 2. إظهار السكشن المطلوب
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.add('active');
        activeSection.style.display = 'block';

        // --- الجزء اللي هيخلي اللون يتبعك ---
        // بنشيل اللون من كل العناصر أولاً
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // بندور على الـ div اللي جواه الـ onclick اللي فيه اسم السكشن بتاعنا
        const currentItem = document.querySelector(`.nav-item[onclick*="${sectionId}"]`);
        if (currentItem) {
            currentItem.classList.add('active');
        }
    }
    if (sectionId === 'reports') {
            console.log("تحديث تلقائي للمخزن...");
            // استدعاء الدالة اللي بتسحب من SQL وتملأ الجدول
            if (typeof renderReports === 'function') {
                renderReports(); 
            }
        } 
    // الفوكس الذكي (عشان تكتب فوراً في البحث)
    setTimeout(() => {
        if (sectionId === 'sales') document.getElementById('sale-search-input')?.focus();
    }, 150);
    if (sectionId === 'sales') {
        applySalesScreenSettings(); // تحديث أزرار الضريبة والخصم بناءً على الإعدادات
        calculateTotal(); // إعادة حساب الإجمالي
    }
    if (sectionId === 'customers') {
        loadCustomersDebt();
    }
    if (sectionId === 'inventory') {
        renderInventory();
    }
}

window.saleClearInvoice = function(isReturn = false) {
    // 1. تصفير السلة للتاب النشط
    const currentTab = saleTabs.find(t => t.id === activeTabId);
    if (currentTab) {
        currentTab.cart = [];
    }

    // 2. تصفير بيانات العميل (الحل اللي إنت محتاجه)
    const nameField = document.getElementById('sale-customer-name');
    const phoneField = document.getElementById('sale-customer-phone');
    const invIdField = document.getElementById('original-inv-id');

    if (nameField) nameField.value = isReturn ? "" : "عميل نقدي";
    if (phoneField) phoneField.value = "";
    if (invIdField) invIdField.value = "";

    // 3. تصفير حقول البحث والكمية والتفاصيل
    const searchInput = document.getElementById('sale-search-input');
    const qtyInput = document.getElementById('sale-qty-input');
    
    if (searchInput) searchInput.value = "";
    if (qtyInput) qtyInput.value = 1;

    // 4. تصفير المبالغ المالية (المدفوع والمتبقي)
    const paidInput = document.getElementById('sale-paid-amount');
    const remainingInput = document.getElementById('sale-remaining-amount');
    if (paidInput) paidInput.value = 0;
    if (remainingInput) remainingInput.value = 0;

    // 5. إخفاء معاينة الفاتورة الأصلية (لو مفتوحة)
    const previewDiv = document.getElementById('original-invoice-preview');
    if (previewDiv) previewDiv.style.display = 'none';

    // 6. تصفير واجهة المنتج المختار (الاسم والسعر اللي بيفضلوا ظاهرين)
    if (typeof updateProductDetails === 'function') {
        updateProductDetails(null);
    }

    // 7. إعادة تحديث الجدول والحسابات (عشان يظهر "السلة فارغة")
    renderInvoiceTable();
    if (typeof calculateTotal === 'function') calculateTotal();

    // 8. تركيز الماوس على البحث
    if (searchInput) searchInput.focus();

    console.log("تم مسح كافة بيانات الشاشة بنجاح.");
};

// إظهار البوب
window.showClearConfirm = function() {
    const pop = document.getElementById('clear-confirm-pop');
    pop.style.display = 'block';
};

// تنفيذ المسح أو الإلغاء
window.saleClearInvoice = function() {
    // تنفيذ المسح فوراً بدون confirm
    saleTabs = [];
    renderInvoiceTable();
    document.getElementById('sale-search-input').value = '';
    document.getElementById('sale-search-input').focus();
    showToast("تم مسح الفاتورة", "error");
};

// إغلاق البوب لو المستخدم داس في أي مكان بره
document.addEventListener('click', function(e) {
    const container = document.querySelector('.clear-btn-container');
    const pop = document.getElementById('clear-confirm-pop');
    if (container && !container.contains(e.target)) {
        pop.style.display = 'none';
    }
});








// 5. إدارة النوافذ (Modals)
function openProductModal() {
    const modal = document.getElementById('modal-product');
    if (modal) {
        modal.style.display = 'flex';
        fillSelects();
    }
}


// اغلاق النوافذ

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    resetProductModal(); // تنظيف المودال دايماً عند القفل
}
// دالة إغلاق مودال السجلات
window.closeLogsModal = function() {
    const modal = document.getElementById('logs-modal'); // تأكد إن ده الـ ID بتاع المودال عندك
    if (modal) {
        modal.style.display = 'none';
    } else {
        console.error("❌ Modal with ID 'logsModal' not found!");
    }
};




document.getElementById('sale-search-input').addEventListener('keydown', function(e) {
    let items = document.querySelectorAll('.search-item');
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
        currentFocus++;
        addActive(items);
    } else if (e.key === "ArrowUp") {
        currentFocus--;
        addActive(items);
    } else if (e.key === "Enter") {
        e.preventDefault();
        if (currentFocus > -1) {
            if (items[currentFocus]) items[currentFocus].click();
        }
    }
});

function addActive(items) {
    if (!items) return false;
    // إزالة التحديد القديم
    items.forEach(item => item.classList.remove('active-item'));
    
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    
    // إضافة التحديد الجديد
    items[currentFocus].classList.add('active-item');
    // لضمان رؤية العنصر إذا كانت القائمة طويلة
    items[currentFocus].scrollIntoView({ block: 'nearest' });
}




// دالة فتح الآلة الحاسبة
function openCalculator() {
    const modal = document.getElementById('calculator-modal');
    if (modal) modal.style.display = 'flex';
}

const calcDisplay = document.getElementById('calc-display');

function appendCalc(value) {
    // منع تكرار العلامات الحسابية ورا بعض
    const lastChar = document.getElementById('calc-display').value.slice(-1);
    const ops = ['+', '-', '*', '/'];
    if (ops.includes(value) && ops.includes(lastChar)) return;
    
    document.getElementById('calc-display').value += value;
}

function clearCalc() {
    document.getElementById('calc-display').value = '';
}

function deleteLast() {
    let current = document.getElementById('calc-display').value;
    document.getElementById('calc-display').value = current.slice(0, -1);
}

function calculateResult() {
    try {
        let result = eval(document.getElementById('calc-display').value);
        // تقريب النتيجة لرقمين عشريين لو فيه كسر
        document.getElementById('calc-display').value = Number.isInteger(result) ? result : result.toFixed(2);
    } catch (e) {
        document.getElementById('calc-display').value = "Error";
        setTimeout(clearCalc, 1000);
    }
}

// دعم الكتابة من الكيبورد
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('calculator-modal');
    if (modal && modal.style.display === 'flex') {
        if ((e.key >= 0 && e.key <= 9) || ['+', '-', '*', '/', '.'].includes(e.key)) appendCalc(e.key);
        if (e.key === 'Enter') calculateResult();
        if (e.key === 'Backspace') deleteLast();
        if (e.key === 'Escape') closeModal('calculator-modal');
    }
});
function openCalculator() {
    const panel = document.getElementById('calculator-panel');
    // تبديل الحالة بين ظهور واختفاء
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
    } else {
        panel.style.display = 'block';
    }
}

function closeCalculator() {
    document.getElementById('calculator-panel').style.display = 'none';
}

// دالة الحساب (نفس السابقة مع تعديل طفيف)
function calculateResult() {
    try {
        const display = document.getElementById('calc-display');
        let result = eval(display.value);
        display.value = Number.isInteger(result) ? result : result.toFixed(2);
    } catch (e) {
        document.getElementById('calc-display').value = "Error";
    }
}
// --- 1. دعم السحب (Drag and Drop) ---
function makeDraggable(el) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = document.getElementById(el.id + "-header") || el;
    
    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        // السماح بالسحب فقط من الهيدر وليس من الأزرار
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'I') return;
        
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        el.style.top = (el.offsetTop - pos2) + "px";
        el.style.left = (el.offsetLeft - pos1) + "px";
        el.style.bottom = "auto"; // لإلغاء التثبيت السفلي عند السحب
        el.style.right = "auto";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// تشغيل ميزة السحب فور تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    const calcPanel = document.getElementById('calculator-panel');
    if (calcPanel) makeDraggable(calcPanel);
});

// --- 2. دعم الكيبورد (Keyboard Support) ---
document.addEventListener('keydown', (e) => {
    const panel = document.getElementById('calculator-panel');
    // نتحقق إن الآلة مفتوحة أولاً
    if (panel && panel.style.display === 'block') {
        const key = e.key;
        
        // الأرقام والعمليات
        if (/[0-9\+\-\*\/\.]/.test(key)) {
            e.preventDefault(); // منع الكتابة في أي مكان تاني لو الآلة فوكس
            appendCalc(key);
        }
        
        // حساب النتيجة (Enter)
        if (key === 'Enter') {
            e.preventDefault();
            calculateResult();
        }
        
        // مسح رقم واحد (Backspace)
        if (key === 'Backspace') {
            deleteLast();
        }
        
        // مسح الكل (Escape أو Delete)
        if (key === 'Escape' || key === 'Delete') {
            clearCalc();
        }
    }
});

// --- 3. وظائف الآلة الأساسية ---
function openCalculator() {
    const panel = document.getElementById('calculator-panel');
    panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
    // ضبط مكان افتراضي لو أول مرة تفتح
    if (!panel.style.top) {
        panel.style.bottom = "20px";
        panel.style.right = "20px";
    }
}

function appendCalc(value) {
    const display = document.getElementById('calc-display');
    const ops = ['+', '-', '*', '/'];
    const lastChar = display.value.slice(-1);
    
    if (ops.includes(value) && ops.includes(lastChar)) return;
    display.value += value;
}

function calculateResult() {
    try {
        const display = document.getElementById('calc-display');
        if (!display.value) return;
        let result = eval(display.value);
        display.value = Number.isInteger(result) ? result : result.toFixed(2);
    } catch (e) {
        document.getElementById('calc-display').value = "Error";
        setTimeout(() => document.getElementById('calc-display').value = "", 1000);
    }
}

function deleteLast() {
    const display = document.getElementById('calc-display');
    display.value = display.value.slice(0, -1);
}

function clearCalc() {
    document.getElementById('calc-display').value = '';
}
function toggleMinimizeCalc() {
    const panel = document.getElementById('calculator-panel');
    panel.classList.toggle('calc-minimized');
    
    // تغيير الأيقونة من ناقص لزائد عند التصغير
    const icon = document.querySelector('.calc-controls .fa-minus, .calc-controls .fa-plus');
    if (panel.classList.contains('calc-minimized')) {
        icon.classList.replace('fa-minus', 'fa-plus');
    } else {
        icon.classList.replace('fa-plus', 'fa-minus');
    }
}

// تعديل بسيط لدالة الغلق عشان تشيل حالة التصغير لو فتحناها تاني
function closeCalculator() {
    const panel = document.getElementById('calculator-panel');
    panel.style.display = 'none';
    panel.classList.remove('calc-minimized');
}




// 1. ضع هذه الدالة في بداية ملف script4.js لتكون جاهزة دائماً
window.fixElectronFocus = function() {
    const pInput = document.getElementById('main-pass');
    if (pInput) {
        // إخفاء وإظهار سريع جداً لإجبار المحرك على إعادة تهيئة العنصر
        pInput.style.visibility = 'hidden';
        
        setTimeout(() => {
            pInput.style.visibility = 'visible';
            pInput.focus();
            // محاكاة نقرة ماوس داخل الخانة
            pInput.dispatchEvent(new MouseEvent('mousedown'));
            pInput.dispatchEvent(new MouseEvent('mouseup'));
            pInput.click();
        }, 50);
    }
};

// 2. دالة تسجيل الخروج المحدثة
window.logOut = function() {
    

    const overlay = document.getElementById('main-login-overlay');
    const pInput = document.getElementById('main-pass');

    if (overlay) {
        // إظهار الشاشة فوراً وبقوة
        overlay.style.setProperty('display', 'flex', 'important');
        overlay.style.opacity = '1';
        
        if (pInput) pInput.value = "";

        // السحر هنا: محاكاة خروج ودخول للنافذة (Blur & Focus)
        // هذا السطر يحل مشكلة "الضغط خارج البرنامج" التي ذكرتها
        window.blur(); 
        
        setTimeout(() => {
            window.focus(); // العودة للنافذة
            window.fixElectronFocus(); // تفعيل التركيز على الخانة
        }, 100);
    }
};

function initSupplierSearch() {
    const input = document.getElementById('supplier-name');
    const list = document.getElementById('supplier-results');

    if (!input || !list) return;

    input.addEventListener('input', function() {
        const val = this.value.trim();
        
        // لو الخانة فاضية نخفي القائمة ونخرج
        if (val.length === 0) {
            list.innerHTML = "";
            list.style.display = 'none';
            return;
        }

        try {
            // البحث عن الموردين اللي اسمهم بيبدأ أو بيحتوي على الكلام المكتوب
            const query = "SELECT name FROM suppliers WHERE name LIKE ? LIMIT 10";
            const res = db.exec(query, [`%${val}%`]);

            if (res.length > 0 && res[0].values.length > 0) {
                list.innerHTML = "";
                list.style.display = 'block';

                res[0].values.forEach(row => {
                    const li = document.createElement('li');
                    li.style.padding = "10px";
                    li.style.cursor = "pointer";
                    li.style.borderBottom = "1px solid #eee";
                    li.textContent = row[0];
                    
                    li.onmousedown = function() { // استخدمنا mousedown عشان يلحق يسجل قبل الـ blur
                        input.value = row[0];
                        list.style.display = 'none';
                    };
                    list.appendChild(li);
                });
            } else {
                list.style.display = 'none';
            }
        } catch (e) {
            console.error("خطأ في جلب الموردين:", e);
        }
    });

    // إخفاء القائمة لما المستخدم يضغط بره
    input.addEventListener('blur', () => {
        setTimeout(() => { list.style.display = 'none'; }, 200);
    });
}

// تشغيل الدالة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupplierSearch);
} else {
    initSupplierSearch();
}
// ضعه في آخر ملف script4.js
setTimeout(() => {
    if(typeof initSupplierSearch === 'function') {
        initSupplierSearch();
    }
}, 1000);


// تحديث الإحصائيات كل 30 ثانية أوتوماتيك
setInterval(() => {
    if (window.db && window.updateDashboardStats) {
        updateDashboardStats();
        console.log("🔄 Live Update Done");
    }
}, 30000);

// إضافة مراقب للكيبورد على مستوى الصفحة كلها
document.addEventListener('keydown', function(event) {
    if (event.key === "F10") {
        event.preventDefault(); // منع المتصفح/إلكترون من فتح DevTools

        // فحص أي قسم هو النشط حالياً
        const salesSection = document.getElementById('sales');
        const purchaseSection = document.getElementById('purchase');

        // إذا كنت في شاشة البيع
        if (salesSection && salesSection.classList.contains('active')) {
            console.log("محاولة حفظ فاتورة بيع...");
            if (typeof window.saleProcessInvoice === 'function') {
                window.saleProcessInvoice();
            }
        } 
        // إذا كنت في شاشة الوارد
        else if (purchaseSection && purchaseSection.classList.contains('active')) {
            console.log("محاولة حفظ فاتورة وارد...");
            if (typeof window.processSmartPurchase === 'function') {
                window.processSmartPurchase();
            }
        }
    }
});
// مراقب أحداث الكيبورد
document.addEventListener('keydown', function(e) {
    // 1. تحديد هل زر Ctrl مضغوط؟
    const isCtrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // طباعة مفتاح الضغط في الكونسول للتأكد أن الاختصار مسموع
    console.log(`Key Pressed: ${key} | Ctrl: ${isCtrl}`);

    if (isCtrl) {
        // منع تنفيذ أوامر المتصفح الافتراضية تماماً
        if (['s', 'p', 'i', 'h'].includes(key)) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (key === 's' || key === 'س') {
            console.log("الانتقال لصفحة المبيعات...");
            showSection('sales');
        } 
        else if (key === 'p' || key === 'ح') { // دعم حرف P و O للوارد
            console.log("الانتقال لصفحة الوارد...");
            showSection('purchase');
        }
        // else if (key === 'i' || key === 'ه') {
        //     console.log("الانتقال لصفحة المخزن...");
        //     showSection('inventory');
        // }
        else if (key === 'h' || key === 'ا') {
            console.log("الانتقال للرئيسية...");
            showSection('welcome-section');
        }
        else if (key === 'q' || key === 'ض') {
            console.log("الانتقال للرئيسية...");
            showSection('settings-section');
        }
        if (e.key === "Escape") {
    // 1. إخفاء نتائج البحث لو مفتوحة
    document.getElementById('sale-search-results').innerHTML = "";
    document.getElementById('purchase-results').innerHTML = "";
    window.saleClearInvoice(true)
    
    // 2. تصفير خانة البحث والوقوف عليها
    const activeSearch = document.querySelector('.active input[type="text"]');
    if (activeSearch) {
        activeSearch.value = "";
        activeSearch.focus();
    }
}
    }
}, true); // استخدام true هنا يجعل الاختصار له أولوية قصوى
// هنحتاج نستدعي ipcRenderer في أول الملف لو مش موجود




// ضيف الكلاس ده (next-on-enter) لأي Input عايز الـ Enter ينقلك للي بعده
document.querySelectorAll('.next-on-enter').forEach(input => {
    input.addEventListener('keydown', (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const inputs = Array.from(document.querySelectorAll('input, button, select'));
            const index = inputs.indexOf(e.target);
            if (index > -1 && inputs[index + 1]) {
                inputs[index + 1].focus();
            }
        }
    });
});





// الاعدادات


// 1. تصدير قاعدة البيانات كملف .db
window.exportDatabase = function() {
    try {
        if (!db) return alert("القاعدة غير جاهزة");

        const binaryData = db.export(); 
        // Blob بصيغة ثنائية خام
        const blob = new Blob([binaryData], { type: 'application/octet-stream' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ERPSystem_Backup_${new Date().toISOString().slice(0,10)}.db`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);

        showToast("تم تصدير النسخة الاحتياطية بنجاح ✅");
    } catch (e) {
        console.error("Export Error:", e);
        showToast("فشل التصدير", "error");
    }
};

// 2. استيراد قاعدة بيانات من ملف خارجي
window.importDatabase = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsArrayBuffer(file);

    reader.onload = function() {
        try {
            const uints = new Uint8Array(this.result);

            // تأكد إننا بنستخدم محرك الـ SQL اللي متعرف في البرنامج
            // هنجرب كذا طريقة عشان نوصل للمكتبة حسب إعدادات مشروعك
            let SQL_ENGINE = window.SQL || (typeof initSqlJs === 'function' ? null : SQL);

            if (!SQL_ENGINE && typeof initSqlJs === 'function') {
                // لو المكتبة محتاجة تحضير (Async)
                initSqlJs().then(function(sql) {
                    const newDb = new sql.Database(uints);
                    finalizeImport(newDb);
                });
            } else if (SQL_ENGINE) {
                const newDb = new SQL_ENGINE.Database(uints);
                finalizeImport(newDb);
            } else {
                throw new Error("مكتبة SQL.js غير معرفة في هذا النطاق");
            }

        } catch (err) {
            console.error("Critical Import Error:", err);
            alert("فشل الاستيراد: المتصفح لا يستطيع الوصول لمكتبة SQL حالياً.");
        }
    };

    // دالة داخلية لإنهاء العملية لمنع التكرار
    function finalizeImport(newDb) {
        try {
            // اختبار سريع للقاعدة
            newDb.exec("SELECT name FROM sqlite_master LIMIT 1");
            
            db = newDb; // تحديث القاعدة العالمية
            
            if (typeof saveDbToLocal === 'function') saveDbToLocal();
            
            alert("✅ تم استعادة البيانات بنجاح !");
            location.reload();
        } catch (e) {
            // alert("الملف سليم ولكن هيكل البيانات الداخلي به مشكلة.");
        }
    }
};

// ميزة 1: إدارة هوية المنشأة والبراند (اسم الشركة، العنوان، الهاتف)

function saveIdentitySettings() {
    const companyName = document.getElementById('company_name').value;
    const storeAddress = document.getElementById('store_address').value;
    const storePhone = document.getElementById('store_phone').value;

    try {
        db.run("UPDATE settings SET value = ? WHERE key = 'company_name'", [companyName]);
        db.run("UPDATE settings SET value = ? WHERE key = 'store_address'", [storeAddress]);
        db.run("UPDATE settings SET value = ? WHERE key = 'store_phone'", [storePhone]);

        // ✅ السطر السحري: حفظ التغييرات في ملف .db على الهارد فوراً
        if (typeof saveDbToLocal === 'function') saveDbToLocal();

        alert("تم حفظ بيانات الهوية بنجاح ✅");
    } catch (error) {
        console.error("خطأ في حفظ بيانات الهوية:", error);
        alert("فشل الحفظ، يرجى التحقق من قاعدة البيانات.");
    }
}

function saveSingleSetting(settingKey) {
    const settingElement = document.getElementById(settingKey);
    if (!settingElement) return;

    const settingValue = settingElement.value;

    try {
        db.run("UPDATE settings SET value = ? WHERE key = ?", [settingValue, settingKey]);

        // ✅ السطر السحري: تأكد من كتابة التعديل في ملف القاعدة
        if (typeof saveDbToLocal === 'function') saveDbToLocal();

        alert("تم حفظ الإعداد بنجاح ✅");
    } catch (error) {
        console.error(`خطأ أثناء حفظ الإعداد ${settingKey}:`, error);
        alert("حدث خطأ أثناء الاتصال بقاعدة البيانات.");
    }
}
// ميزة 3: حد أمان المخزون (التنبيه آلياً عند وصول كمية المنتج لرقم معين)
function saveStockAlertSetting(settingKey) {
    const inputElement = document.getElementById(settingKey);
    if (!inputElement) return;
    const alertValue = inputElement.value;

    try {
        db.run("UPDATE settings SET value = ? WHERE key = ?", [alertValue, settingKey]);
        
        // ✅ الحفظ على الهارد فوراً
        if (typeof saveDbToLocal === 'function') saveDbToLocal();

        alert("تم حفظ حد أمان المخزون بنجاح ✅");
    } catch (error) {
        console.error("خطأ في حفظ حد الأمان:", error);
    }
}
function checkStockAlert(productQty) {
    // 1. جلب حد الأمان من الإعدادات
    const limit = parseInt(getSetting('stock_alert_limit')) || 5;
    const isAlertEnabled = getSetting('stock_alert_status') === '1';

    // 2. لو الميزة مفعلة والكمية أقل من أو تساوي الحد
    if (isAlertEnabled && productQty <= limit) {
        return "background-color: #ffcccc; color: red; font-weight: bold;"; // تنسيق التنبيه
    }
    return "";
}

// ميزة 4: ألوان النظام (تغيير اللون الأساسي للمنظومة وتطبيقه فوراً)
function saveSingleSetting(settingKey) {
    const colorPicker = document.getElementById(settingKey);
    const selectedColor = colorPicker.value;

    try {
        // 1. حفظ اللون في جدول settings
        db.run("UPDATE settings SET value = ? WHERE key = ?", [selectedColor, settingKey]);

        // 2. تطبيق اللون فوراً على واجهة المستخدم (تحديث متغير الـ CSS)
        document.documentElement.style.setProperty('--main-color', selectedColor);

        alert("تم حفظ اللون الجديد وتطبيقه بنجاح ✅");
    } catch (error) {
        console.error("خطأ في حفظ أو تطبيق اللون:", error);
    }
}

// ميزة 6: نظام الخصومات (إدارة نطاق، نوع، وقيمة الخصم الافتراضي)
window.saveDiscountSettings = function() {
    // 1. جلب العناصر
    const scope = document.getElementById('discount_scope')?.value;
    const type = document.getElementById('discount_type')?.value;
    const val = document.getElementById('discount_default_value')?.value;
    const status = document.getElementById('discount_status')?.checked ? "1" : "0";

    try {
        db.run("BEGIN TRANSACTION");

        // 2. استخدام INSERT OR REPLACE لضمان الحفظ حتى لو المفتاح غير موجود
        const settings = {
            'discount_scope': scope,
            'discount_type': type,
            'discount_default_value': val,
            'discount_status': status
        };

        for (const [key, value] of Object.entries(settings)) {
            db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
        }

        db.run("COMMIT");

        // 3. الحفظ الفيزيائي على الملف
        if (typeof persistDatabase === 'function') persistDatabase(); 
        else if (typeof saveDbToLocal === 'function') saveDbToLocal();

        showToast("✅ تم حفظ إعدادات الخصم بنجاح");
        
        // إعادة تحميل الإعدادات لتحديث الواجهة
        if (typeof loadSettings === 'function') loadSettings();

    } catch (err) {
        if (db) db.run("ROLLBACK");
        console.error("خطأ أثناء حفظ الإعدادات:", err);
        showToast("❌ فشل الحفظ", "error");
    }
};

window.updateDiscountPlaceholder = function() {
    const typeElem = document.getElementById('discount_type');
    const input = document.getElementById('discount_default_value');
    const label = document.getElementById('discount_value_label');

    if (!typeElem || !input) return;

    const type = typeElem.value;

    if (type === 'percent') {
        if (label) label.innerText = "نسبة الخصم (%)";
        input.placeholder = "مثلاً: 10";
    } else {
        if (label) label.innerText = "مبلغ الخصم الثابت";
        input.placeholder = "مثلاً: 50";
    }
};
// تابع ميزة 6: تفعيل/تعطيل الميزة (السويتش)
function toggleDiscountFeature() {
    const isChecked = document.getElementById('discount_status').checked;
    const status = isChecked ? '1' : '0';

    try {
        db.run("UPDATE settings SET value = ? WHERE key = 'discount_status'", [status]);
        console.log(`تم ${isChecked ? 'تفعيل' : 'تعطيل'} نظام الخصومات`);
    } catch (error) {
        console.error("خطأ في تحديث حالة الخصم:", error);
    }
}

// ميزة 7: ضريبة القيمة المضافة VAT (إدارة نسبة الضريبة وحالة تفعيلها)
function saveTaxSettings() {
    // 1. جلب نسبة الضريبة وحالة السويتش (مفعل/معطل)
    const taxPercent = document.getElementById('tax_percent').value;
    const taxStatus = document.getElementById('tax_status').checked ? '1' : '0';

    try {
        // 2. تحديث القيمة والحالة في جدول settings
        db.run("UPDATE settings SET value = ? WHERE key = 'tax_percent'", [taxPercent]);
        db.run("UPDATE settings SET value = ? WHERE key = 'tax_status'", [taxStatus]);

        alert("تم حفظ إعدادات الضريبة بنجاح ✅");
    } catch (error) {
        console.error("خطأ في حفظ إعدادات الضريبة:", error);
    }
}


// ميزة 9: نظام العملة (حفظ رمز العملة المعتمد في النظام)
function saveSingleSetting(settingKey) {
    const currencyElement = document.getElementById(settingKey);
    const selectedCurrency = currencyElement.value;

    try {
        // 1. تحديث رمز العملة في جدول settings
        db.run("UPDATE settings SET value = ? WHERE key = ?", [selectedCurrency, settingKey]);

        alert(`تم اعتماد العملة (${selectedCurrency}) بنجاح ✅`);
    } catch (error) {
        console.error("خطأ في حفظ العملة:", error);
        alert("فشل حفظ العملة في قاعدة البيانات.");
    }
}

// تابع ميزة 9: وظيفة إضافة عملة جديدة للقائمة (UI Only)
// ملاحظة: هذه الوظيفة تضيف الخيار للقائمة، وعند الضغط على "حفظ" يتم تخزينها في DB
function addNewCurrency() {
    const newCurrency = prompt("أدخل رمز العملة الجديدة (مثلاً: د.ك):");
    if (newCurrency && newCurrency.trim() !== "") {
        const select = document.getElementById('currency_symbol');
        const option = document.createElement('option');
        option.value = newCurrency.trim();
        option.text = newCurrency.trim();
        select.add(option);
        select.value = option.value; // اختيار العملة المضافة فوراً لتسهيل الحفظ
    }
}

// ميزة 11: سقف المديونية (تحديد الحد الائتماني الافتراضي للعملاء الجدد)
function saveSingleSetting(settingKey) {
    const inputVal = document.getElementById(settingKey).value;
    try {
        db.run("UPDATE settings SET value = ? WHERE key = ?", [inputVal, settingKey]);
        alert("تم حفظ سقف المديونية الافتراضي ✅");
    } catch (error) {
        console.error("خطأ في حفظ سقف المديونية:", error);
    }
}

// ميزة 13: مراقبة الصلاحية (ضبط عدد الأيام للتنبيه قبل انتهاء صلاحية المنتج)
function saveSingleSetting(settingKey) {
    const inputVal = document.getElementById(settingKey).value;
    try {
        db.run("UPDATE settings SET value = ? WHERE key = ?", [inputVal, settingKey]);
        alert("تم ضبط أيام تنبيه الصلاحية ✅");
    } catch (error) {
        console.error("خطأ في حفظ إعدادات الصلاحية:", error);
    }
}

// ميزة 14: عمولات المناديب (تحديد نسبة العمولة الافتراضية للمندوب عند البيع)

/**
 * ميزة 15: مهلة المرتجعات
 * تقوم بتحديث عدد الأيام المسموح فيها بالمرتجع في جدول الإعدادات
 */
function saveSingleSetting(settingKey) {
    const daysValue = document.getElementById(settingKey).value;
    try {
        db.run("UPDATE settings SET value = ? WHERE key = ?", [daysValue, settingKey]);
        alert("تم تحديث سياسة المرتجعات بنجاح ✅");
    } catch (error) {
        console.error("خطأ في حفظ مهلة المرتجعات:", error);
    }
}
/**
 * الدالة الموحدة لجميع مفاتيح التشغيل (Switches)
 * تغطي الميزات: 5, 10, 12, 16, 17, 18, 19, 20, 21, 22, 23, 24
 */
window.saveSingleSetting = function(id) {
    const element = document.getElementById(id);
    if (!element) return;

    // تحديد القيمة بناءً على نوع العنصر (Checkbox/Switch أو Textarea/Input)
    let val;
    if (element.type === 'checkbox') {
        val = element.checked ? '1' : '0';
    } else {
        val = element.value;
    }

    try {
        // الاستخدام الذكي لـ INSERT OR REPLACE
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [id, val]);
        
        if (typeof saveDatabase === 'function') {
            saveDatabase(); 
        }

        console.log(`✅ تم حفظ [${id}] بنجاح`);
        showToast("تم حفظ التعديلات بنجاح");
    } catch (err) {
        console.error("❌ فشل الحفظ:", err);
    }
};

window.loadSettings = function() {
    try {
        const res = db.exec("SELECT key, value FROM settings");
        if (res && res.length > 0) {
            const settingsMap = {};
            res[0].values.forEach(row => {
                settingsMap[row[0]] = row[1];
            });

            const allSwitches = [
                'discount_status', 'tax_status', 'stock_alert_status', 
                'auto_clear_cart', 'multi_unit_status', 'round_total_status',
                'shift_system_status', 'multi_price_status', 'min_price_protection',
                'activity_log_status', 'promo_system_status', 'warranty_system_status',
                'auto_pricing_update', 'auto_check_purchase_price', 'reservation_system_status', 
                'credit_limit_status', 'expiry_alert_status', 'commission_status', 'return_policy_status'
            ];

            const allInputs = [
                'credit_limit_default', 'expiry_alert_days', 'commission_percent',
                'return_policy_days', 'tax_percent', 'stock_alert_limit', 
                'company_name', 'store_address', 'store_phone', 'invoice_footer',
                'discount_scope', 'discount_type', 'discount_default_value'
            ];

            // 1. تحديث السويتشات
            allSwitches.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.checked = (settingsMap[id] === '1' || settingsMap[id] === 'true');
                }
            });

            // 2. تحديث الحقول والقوائم المنسدلة
            allInputs.forEach(id => {
                const val = settingsMap[id];
                if (val !== undefined) {
                    const element = document.getElementById(id);
                    const elementNew = document.getElementById('new-' + id);
                    
                    if (element) element.value = val;
                    if (elementNew) elementNew.value = val;
                }
            });

            // تحديثات إضافية للـ UI
            if (typeof updateDiscountPlaceholder === 'function') updateDiscountPlaceholder();
            if (typeof applySalesScreenSettings === 'function') applySalesScreenSettings();

            console.log("✅ تم تحميل الإعدادات وتحديث الواجهة");
        }
    } catch (err) {
        console.error("❌ خطأ في تحميل الإعدادات:", err);
    }
};


window.getSetting = function(key) {
    // التأكد من أن قاعدة البيانات معرفة وجاهزة
    if (typeof db === 'undefined' || !db) {
        console.warn("قاعدة البيانات غير جاهزة بعد لجلب الإعداد: " + key);
        return null;
    }
    try {
        const res = db.exec("SELECT value FROM settings WHERE key = ?", [key]);
        return (res.length > 0 && res[0].values.length > 0) ? res[0].values[0][0] : null;
    } catch (e) {
        return null;
    }
};
/**ن
 * دالة حساب إجمالي الفاتورة مع الضرائب والخصومات المؤقتة
 */

function applySalesScreenSettings() {
    try {
        // التأكد من وجود قاعدة البيانات أولاً
        if (!window.db) return;

        // جلب الإعدادات
        const res = db.exec("SELECT key, value FROM settings WHERE key IN ('tax_status', 'discount_status', 'tax_percent', 'discount_default_value')");
        
        const settings = {};
        if (res.length > 0) {
            res[0].values.forEach(row => {
                settings[row[0]] = String(row[1]).trim(); // تحويل لنص ومسح المسافات لضمان دقة المقارنة
            });
        }

        // 1. التحكم في قسم الضريبة
        const taxSection = document.getElementById('ui-tax-section');
        if (taxSection) {
            // المقارنة الصارمة: لازم تكون القيمة '1' بالظبط عشان يظهر
            if (settings['tax_status'] === '1') {
                taxSection.style.setProperty('display', 'flex', 'important');
                document.getElementById('temp-tax-val').value = settings['tax_percent'] || 14;
            } else {
                taxSection.style.setProperty('display', 'none', 'important');
            }
        }

        // 2. التحكم في قسم الخصم
        const discountSection = document.getElementById('ui-discount-section');
        if (discountSection) {
            // المقارنة الصارمة: لازم تكون القيمة '1' بالظبط عشان يظهر
            if (settings['discount_status'] === '1') {
                discountSection.style.setProperty('display', 'flex', 'important');
                document.getElementById('temp-discount-val').value = settings['discount_default_value'] || 0;
            } else {
                discountSection.style.setProperty('display', 'none', 'important');
            }
        }

    } catch (err) {
        console.warn("تنبيه: فشل تطبيق إعدادات واجهة البيع:", err);
    }
}

// استدعي هذه الدالة داخل الـ initDatabase بعد إنشاء الجداول


/**
 * حفظ قاعدة البيانات على الهارد (Electron) أو الـ LocalStorage
 */
async function persistDatabase() {
    const binaryDb = db.export();
    // استخدام invoke لضمان أن الـ Main رد علينا بنجاح
    const result = await ipcRenderer.invoke('save-db-to-disk', binaryDb);
    if(result.success) {
        console.log("تم الحفظ الفعلي على الهارد");
    }
}
window.saveStockAlertSettings = function() {
    try {
        // 1. جلب القيم من الـ HTML
        const limit = document.getElementById('stock_alert_limit').value;
        const status = document.getElementById('stock_alert_status').checked ? '1' : '0';

        // 2. حفظ القيمة الرقمية في جدول settings
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['stock_alert_limit', limit]);
        
        // 3. حفظ حالة السويتش (للتأكيد)
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['stock_alert_status', status]);

        // 4. الحفظ النهائي على الهارد
        if (typeof saveDbToLocal === 'function') {
            saveDbToLocal();
        }

        // 5. إشعار نجاح
        if (typeof showToast === 'function') {
            showToast("✅ تم حفظ إعدادات المخزون بنجاح");
        } else {
            alert("✅ تم الحفظ بنجاح");
        }
        
        console.log(`Saved: Limit=${limit}, Status=${status}`);
    } catch (err) {
        console.error("❌ فشل حفظ إعدادات حد الأمان:", err);
    }
};
window.saveTaxSettings = async function() {
    try {
        // 1. سحب البيانات من الواجهة
        const percent = document.getElementById('tax_percent').value;
        const status = document.getElementById('tax_status').checked ? '1' : '0';

        // 2. تحديث جدول الإعدادات في الرام
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['tax_percent', percent]);
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['tax_status', status]);

        // 3. الحفظ الفعلي على الهارد (باستخدام دالتك الأساسية)
        if (typeof saveDbToLocal === 'function') {
            await saveDbToLocal();
        }

        // 4. تطبيق التغييرات فوراً على شاشة البيع (لو الدالة موجودة عندك)
        if (typeof applySalesScreenSettings === 'function') {
            applySalesScreenSettings();
        }

        console.log(`✅ Tax Updated: ${percent}% | Status: ${status}`);
        alert("تم حفظ إعدادات الضريبة بنجاح");
        
    } catch (err) {
        console.error("❌ فشل حفظ إعدادات الضريبة:", err);
    }
};
window.saveInvoiceFooter = function() {
    const el = document.getElementById('invoice_footer');
    if (!el) return console.error("الخانة مش موجودة!");

    const val = String(el.value).trim(); 

    try {
        // 1. التخزين في الرام (Database RAM)
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('invoice_footer', ?)", [val]);
        
        // 2. الحفظ الفعلي على الهارد (نفس الدالة اللي شغالة في الضرائب)
        if (typeof saveDbToLocal === 'function') {
            saveDbToLocal(); 
            console.log("✅ تم الحفظ على الهارد باستخدام saveDbToLocal");
        } else if (typeof saveDatabase === 'function') {
            saveDatabase();
        }

        console.log("✅ تم الحفظ في الرام بنجاح:", val);
        showToast("تم حفظ نص الفاتورة بنجاح");
    } catch (err) {
        console.error("❌ فشل الحفظ:", err);
    }
};


window.checkCreditLimit = function(customerName, newInvoiceAmount) {
    // 1. جلب حالة السويتش (هل الميزة مفعلة؟)
    const isLimitEnabled = getSetting('credit_limit_default_enabled') === 'true'; // حسب اسم التخزين عندك
    if (!isLimitEnabled) return true; // لو مش مفعلة، اسمح بالبيع عادي

    // 2. جلب قيمة السقف من الإدخال اللي بعته
    const limit = parseFloat(document.getElementById('credit_limit_default')?.value) || 0;
    if (limit <= 0) return true; // لو مش حاطط رقم، مفيش سقف

    // 3. جلب مديونية العميل الحالية من القاعدة
    const res = db.exec("SELECT balance FROM customers WHERE name = ?", [customerName]);
    if (res.length > 0) {
        const currentBalance = parseFloat(res[0].values[0][0]);
        
        // 4. التحقق: هل (المديونية القديمة + الفاتورة الجديدة) > السقف؟
        if ((currentBalance + newInvoiceAmount) > limit) {
            showToast(`⚠️ خطأ: العميل تجاوز سقف المديونية! المسموح: ${limit}، الحالي: ${currentBalance + newInvoiceAmount}`, "error");
            return false; // ممنوع البيع
        }
    }
    return true; // مسموح بالبيع
};


window.saveCreditLimitValue = function() {
    const el = document.getElementById('credit_limit_default');
    if (!el) return;

    const val = String(el.value).trim();

    try {
        // الحفظ في الرام (Database) بنفس منطق دالة footer
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('credit_limit_default', ?)", [val]);
        
        // الحفظ الفعلي على الهارد
        if (typeof saveDbToLocal === 'function') saveDbToLocal();

        showToast("تم حفظ سقف المديونية بنجاح");
        console.log("✅ حفظ سقف المديونية:", val);
    } catch (err) {
        console.error("❌ فشل حفظ سقف المديونية:", err);
    }
};

// دالة مساعدة لتحديث شكل الكارت (باهت أو واضح)
window.updateCreditUI = function() {
    const sw = document.getElementById('credit_limit_status');
    const card = document.getElementById('credit_limit_card');
    if (sw && card) {
        sw.checked ? card.classList.remove('f-feature-disabled') : card.classList.add('f-feature-disabled');
    }
};



// حفظ إعدادات الطابعة
window.savePrinterSettings = function() {
    const printerConfig = {
        paperSize: document.getElementById('printer_paper_size').value,
        copyCount: document.getElementById('printer_copy_count').value,
        autoPrint: document.getElementById('auto_print_status').checked
    };

    // حفظ في localStorage كحل سريع وسهل الوصول إليه وقت الطباعة
    localStorage.setItem('printer_config', JSON.stringify(printerConfig));
    
    // لو عندك دالة حفظ عامة للإعدادات في الـ Database نده عليها هنا
    if (typeof saveGeneralSetting === 'function') {
        saveGeneralSetting('printer_paper_size', printerConfig.paperSize);
        saveGeneralSetting('printer_copy_count', printerConfig.copyCount);
    }

    showToast("تم حفظ إعدادات الطابعة بنجاح ✅", "success");
};

// // تحميل الإعدادات عند فتح شاشة الإعدادات
// window.loadPrinterSettings = function() {
//     const savedConfig = localStorage.getItem('printer_config');
//     if (savedConfig) {
//         const config = JSON.parse(savedConfig);
//         if(document.getElementById('printer_paper_size'))
//             document.getElementById('printer_paper_size').value = config.paperSize || '80mm';
//         if(document.getElementById('printer_copy_count'))
//             document.getElementById('printer_copy_count').value = config.copyCount || 1;
//         if(document.getElementById('auto_print_status'))
//             document.getElementById('auto_print_status').checked = config.autoPrint || false;
//     }
// };

// // نده عليها مع بداية تحميل الصفحة
// document.addEventListener('DOMContentLoaded', loadPrinterSettings);
// // دالة لجلب الطابعات وتعبئة القائمة
// async function refreshPrintersList() {
//     try {
//         const printers = await window.electronAPI.getPrinters();
//         const select = document.getElementById('printer_name_select');
//         select.innerHTML = ''; // مسح المحتوى القديم

//         printers.forEach(printer => {
//             const option = document.createElement('option');
//             option.value = printer.name;
//             option.text = printer.name + (printer.isDefault ? ' (الافتراضية)' : '');
//             if (printer.isDefault) option.selected = true;
//             select.appendChild(option);
//         });
//     } catch (err) {
//         console.error("فشل في جلب الطابعات:", err);
//     }
// }

// // تعديل دالة الحفظ لتأخذ القيمة من الـ Select
// window.saveAdvancedPrinterSettings = function() {
//     const config = {
//         printerName: document.getElementById('printer_name_select').value,
//         orientation: document.getElementById('print_orientation').value,
//         duplex: document.getElementById('print_duplex').value,
//         copies: document.getElementById('print_copies').value,
//         silent: document.getElementById('silent_print').checked
//     };
//     localStorage.setItem('adv_printer_config', JSON.stringify(config));
//     showToast("تم حفظ إعدادات الطابعة بنجاح ✅", "success");
// };

// // تشغيل الجلب عند تحميل الصفحة
// document.addEventListener('DOMContentLoaded', () => {
//     refreshPrintersList();
//     loadAdvPrinterSettings(); // الدالة القديمة لتحميل القيم المحفوظة
// });





























































































window.saveSwitchSetting = function(id) {
    const element = document.getElementById(id);
    if (!element) return;

    const val = element.checked ? '1' : '0';

    try {
        // 1. التحديث في الرام (Database)
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [id, val]);
        
        // 2. السطر ده هو "السر": بننادي الدالة بتاعتك وبنستناها تخلص
        window.saveDbToLocal(); 
        
        console.log(`✅ تم حفظ حالة [${id}] بنجاح كـ: ${val}`);
    } catch (err) {
        console.error("❌ فشل حفظ السويتش:", err);
    }


    
};

window.saveDbToLocal = async function() {
    if (!db) return;
    
    try {
        // 1. تصدير قاعدة البيانات
        const data = db.export(); 
        
        // 2. استخدام invoke بدلاً من send (عشان يتماشى مع ipcMain.handle)
        // ده بيضمن إن الـ Main Process يستلم الـ Buffer ويحفظه بالكامل
        const result = await ipcRenderer.invoke('save-db-to-disk', data);
        
        if (result.success) {
            console.log("✅ تم الحفظ الفعلي على الهارد بنجاح!");
            
            // 3. تحديث الـ localStorage للضمان (اختياري)
            const array = Array.from(data);
            localStorage.setItem('warehouse_sqlite_db', JSON.stringify(array));
        } else {
            console.error("❌ فشل الحفظ على القرص:", result.error);
        }
    } catch (err) {
        console.error("❌ خطأ أثناء عملية الحفظ:", err);
    }
};



























































































































































































































































window.checkPassAndShow = function(sectionId) {
    if (!sectionId) return;

    // حفظ في الـ localStorage (اللي بيفضل ثابت في Electron حتى لو قفلت البرنامج)
    localStorage.setItem('last_dev_section', sectionId);
    
    // إخفاء كل السكاشن اللي واخدة class معين (تأكد إن السكاشن عندك ليها نفس الكلاس)
    document.querySelectorAll('.content-section').forEach(s => {
        s.style.setProperty('display', 'none', 'important');
    });

    // إخفاء "أوفرلاي" الترحيب أو الدخول
    const loginOverlay = document.getElementById('main-login-overlay');
    if (loginOverlay) loginOverlay.style.setProperty('display', 'none', 'important');

    // إظهار السكشن المطلوب
    const target = document.getElementById(sectionId);
    if (target) {
        target.style.setProperty('display', 'block', 'important');
        console.log("Electron: Showing section -> " + sectionId);
    }
};

// كود الاستعادة عند تشغيل الـ Window
window.addEventListener('load', () => {
    const lastSection = localStorage.getItem('last_dev_section');
    const savedUser = localStorage.getItem('last_logged_user');

    if (savedUser && lastSection) {
        // بنستخدم setTimeout عشان نهرب من أي كود تاني بيشتغل أول ما الـ DOM يحمل
        setTimeout(() => {
            window.checkPassAndShow(lastSection);
        }, 100); 
    }
});



// الكود ده بيتنفذ أوتوماتيك أول ما ملف السكريبت يتحمل
(function() {
    // ننتظر تحميل الصفحة بالكامل
    window.addEventListener('load', () => {
        // نأكد إن مصفوفة التابات موجودة
        if (typeof saleTabs !== 'undefined') {
            // لو المصفوفة فاضية، افتح أول فاتورة فوراً
            if (saleTabs.length === 0) {
                addNewSaleTab();
                console.log("🚀 تم فتح فاتورة تلقائية عند التشغيل");
            }
        }
    });
})();



// تشغيل البرنامج
// ضيف السطرين دول جوه window.onload اللي عندك
window.onload = async function() {
    // ... الأكواد القديمة بتاعتك (initDatabase و showSection) ...

    // تشغيل الساعة فوراً
    updateLiveDateTime();
    // تحديثها كل ثانية واحدة (1000 مللي ثانية)
    setInterval(updateLiveDateTime, 1000);
    initApp()
    
};