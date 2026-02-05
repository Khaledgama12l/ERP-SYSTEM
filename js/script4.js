// 1. المتغيرات العامة وقاعدة البيانات
let db;
let currentManageMode = ''; 
let currentEditId = null; // عشان نعرف إحنا بنعدل أي منتج حالياً
// تعريف مصفوفة الفاتورة في بداية الملف
let currentInvoiceCart = []; 
let selectedProductTemp = null;
let currentFocus = -1; // لمتابعة العنصر المختار في القائمة
let purchaseItems = []; // مصفوفة مؤقتة للأصناف
let currentPurchaseList = [];
let currentPurchaseItems = [];





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

// 2. دوال الوقت والتاريخ (لازم تكون فوق عشان initApp يشوفها)
function updateDateTime() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    const dateElem = document.getElementById('welcome-date');
    const timeElem = document.getElementById('welcome-time');

    if (dateElem) dateElem.innerText = dateStr;
    if (timeElem) timeElem.innerText = timeStr;
}

// 3. تهيئة SQLite
// تهيئة SQLite وإنشاء الجداول بالكامل
async function initDatabase() {
    try {
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/${file}`
        });

        let dataToLoad = null;

        // 1. محاولة التحميل من الهارد (Electron)
        try {
            if (typeof ipcRenderer !== 'undefined') {
                const diskData = await ipcRenderer.invoke('load-db-from-disk');
                if (diskData && diskData.length > 0) {
                    dataToLoad = new Uint8Array(diskData);
                    console.log("✅ تم التحميل من الهارد");
                }
            }
        } catch (ipcErr) {
            console.warn("⚠️ الـ IPC مش شغال أو الـ main.js مش جاهز، هشوف الـ localStorage");
        }

        // 2. لو مفيش هارد، شوف الـ localStorage
        if (!dataToLoad) {
            const savedDb = localStorage.getItem('warehouse_sqlite_db');
            if (savedDb) {
                dataToLoad = new Uint8Array(JSON.parse(savedDb));
                console.log("⚠️ تم التحميل من الـ localStorage");
            }
        }

        // 3. تشغيل قاعدة البيانات (بالداتا القديمة لو لقيناها)
        // 3. تشغيل قاعدة البيانات (بالداتا القديمة لو لقيناها)
if (dataToLoad) {
    window.db = new SQL.Database(dataToLoad); // ضفنا window. هنا
} else {
    window.db = new SQL.Database(); // وضفنا window. هنا كمان
    console.log("🆕 قاعدة بيانات جديدة تماماً");
}

// وعشان نضمن إن أي كود قديم مشفر بكلمة db بس ما يضربش:
db = window.db;

        // --- 4. إنشاء الجداول (فقط لو مش موجودة) ---
        createTablesSchema(); 

        // 5. تحديث الواجهة فوراً
        setTimeout(() => {
            if (typeof updateDashboardStats === 'function') updateDashboardStats();
            console.log("🚀 السيستم جاهز");
        }, 500);

    } catch (err) {
        console.error("❌ كارثة في القاعدة:", err);
    }
}

// دالة منفصلة للجداول عشان الكود ميبقاش "سلطة"
function createTablesSchema() {
    db.run(`CREATE TABLE IF NOT EXISTS system_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, name TEXT, warehouse TEXT, category TEXT, quantity INTEGER DEFAULT 0, buyPrice REAL DEFAULT 0, sellPrice REAL DEFAULT 0, date TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS sales_history (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_name TEXT, total REAL, payment_method TEXT, date TEXT, net_profit REAL, customer_phone TEXT, type TEXT DEFAULT 'sale')`);
    db.run(`CREATE TABLE IF NOT EXISTS profit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT UNIQUE, daily_profit REAL DEFAULT 0)`);
    // ... كمل بقية جداولك هنا بنفس الطريقة ...
    
    // إدخال يوزر الأدمن لو مش موجود
    db.run("INSERT OR IGNORE INTO system_users (username, password) VALUES ('admin', '123')");
}

function saveDbToLocal() {
    const data = db.export();
    localStorage.setItem('warehouse_sqlite_db', JSON.stringify(Array.from(data)));
}

// 4. دالة التشغيل الأساسية
async function initApp() {
    console.log("البرنامج جاهز للعمل بنظام SQLite...");
    await initDatabase(); // ننتظر تحميل القاعدة أولاً
    
    updateDateTime(); 
    setInterval(updateDateTime, 1000); 
    updateLiveDateTime();
    
    // الحل هنا: نسحب الاسم من جدول settings
    try {
        const res = db.exec("SELECT value FROM settings WHERE key = 'company_name'");
        let companyName = "اسم الشركة"; // افتراضي
        if (res.length > 0 && res[0].values[0]) {
            companyName = res[0].values[0][0];
        }

        const companyElem = document.getElementById('display-company-name');
        const sidebarLogoName = document.getElementById('sidebar-logo-name');
        const user = document.getElementById('user');
        
        if (companyElem) companyElem.innerText = companyName;
        if (sidebarLogoName) sidebarLogoName.innerText = companyName;
        // تحديث اسم المستخدم برضه من القاعدة لو حبيت
        if (user) user.innerText = `المستخدم: ${companyName}`;
        
        // تغيير عنوان التابة في المتصفح
        document.title = companyName;
    } catch (e) {
        console.error("خطأ في تحميل اسم الشركة:", e);
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
        console.log("✅ قاعدة البيانات جاهزة ومؤمنة");
    } catch (e) { console.error("Database Fix Error:", e); }
}
fixDatabaseStructure();

























































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

    const res = db.exec("SELECT * FROM products");
    if (res.length > 0) {
        // row[0] هو الـ ID
        // row[1] هو الكود
        // row[2] هو الاسم ... وهكذا حسب ترتيب الجدول في القاعدة
        res[0].values.forEach(row => {
            tbody.innerHTML += `
                <tr>
                    <td>${row[1]}</td> 
                    <td>${row[2]}</td>
                    <td><span class="badge-warehouse">${row[3]}</span></td>
                    <td>${row[4]}</td>
                    <td class="${row[5] < 5 ? 'low-stock' : ''}">${row[5]}</td>
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

// 7. ملء القوائم (Selects)
function fillSelects() {
    const wRes = db.exec("SELECT name FROM warehouses");
    const cRes = db.exec("SELECT name FROM categories");
    const wSelect = document.getElementById('p-warehouse-select');
    const cSelect = document.getElementById('p-category-select');
    
    if(wRes.length > 0) wSelect.innerHTML = wRes[0].values.map(v => `<option value="${v[0]}">${v[0]}</option>`).join('');
    if(cRes.length > 0) cSelect.innerHTML = cRes[0].values.map(v => `<option value="${v[0]}">${v[0]}</option>`).join('');
}

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
    const totalAmount = parseFloat(document.getElementById('purchase-final-total').innerText);

    try {
        // أ. تسجيل الفاتورة في السجل بنوع 'وارد'
        db.run("INSERT INTO sales_history (date, type, customer_name, total) VALUES (?, ?, ?, ?)", 
               [new Date().toISOString(), 'وارد', supplier, totalAmount]);

        // ب. تحديث المخزن (زيادة الكمية وتعديل السعر)
        purchaseItems.forEach(item => {
            const exists = db.exec("SELECT id FROM products WHERE name = ?", [item.name]);
            if (exists.length > 0) {
                // إذا كان المنتج موجوداً: زود الكمية وحدث السعر
                db.run("UPDATE products SET quantity = quantity + ?, buy_price = ?, sell_price = ? WHERE name = ?", 
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
        const res = db.exec("SELECT name, buy_price, sell_price FROM products WHERE name LIKE ?", [`%${query}%`]);
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
if (typeof window.currentPurchaseItems === 'undefined') {
    window.currentPurchaseItems = [];
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


// 1. تهيئة المصفوفة المؤقتة للفاتورة
window.currentPurchaseItems = [];

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
        const rowTotal = item.buyPrice * item.quantity;
        grandTotal += rowTotal;
        tbody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td><span class="badge-warehouse">${item.warehouse}</span></td>
                <td>${item.buyPrice.toFixed(2)}</td>
                <td><b>${item.quantity}</b></td>
                <td>${rowTotal.toFixed(2)}</td>
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

// 4. الدالة الكبرى: اعتماد الفاتورة وترحيلها للمخزن
window.processSmartPurchase = function() {
    const supplierName = document.getElementById('supplier-name').value.trim();
    const tableBody = document.querySelector('#purchase-table tbody');
    const finalTotalElement = document.getElementById('purchase-final-total');
    const finalTotal = parseFloat(finalTotalElement.innerText) || 0;

    if (!supplierName) return showToast("برجاء إدخال اسم المورد ⚠️", "error");
    if (tableBody.rows.length === 0) return showToast("الفاتورة فارغة! ⚠️", "error");

    try {
        // 1. التعامل مع المورد (إضافة أو تحديث مديونية)
        const checkSupplier = db.exec("SELECT id FROM suppliers WHERE name = ?", [supplierName]);
        if (checkSupplier.length === 0) {
            db.run(`INSERT INTO suppliers (name, added_date, balance) VALUES (?, ?, 0)`, 
                   [supplierName, new Date().toLocaleDateString('en-CA')]);
        }
        db.run(`UPDATE suppliers SET balance = balance + ? WHERE name = ?`, [finalTotal, supplierName]);

        // 2. تحديث المخزن (المنتجات)
        // داخل دالة processSmartPurchase استبدل جزء الـ Array.from بهذا:
window.currentPurchaseItems.forEach(item => {
    const productName = item.name;
    const warehouse = item.warehouse;
    const category = item.category;
    const buyPrice = item.buyPrice;
    const sellPrice = item.sellPrice;
    const qty = item.quantity; // دي الكمية الجديدة اللي إنت كتبتها في الفاتورة بس

    const checkProd = db.exec("SELECT id FROM products WHERE name = ? AND warehouse = ?", [productName, warehouse]);
    
    if (checkProd.length > 0) {
        // هنا بيجمع الكمية اللي في الفاتورة (qty) على اللي موجودة في القاعدة (quantity)
        db.run(`UPDATE products SET quantity = quantity + ?, buyPrice = ?, sellPrice = ? WHERE name = ? AND warehouse = ?`, 
                [qty, buyPrice, sellPrice, productName, warehouse]);
    } else {
        const generatedCode = "P-" + Math.floor(1000 + Math.random() * 9000);
        db.run(`INSERT INTO products (name, code, warehouse, category, quantity, buyPrice, sellPrice, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
                [productName, generatedCode, warehouse, category, qty, buyPrice, sellPrice, new Date().toLocaleDateString('en-CA')]);
    }
});

        // 3. سجل الفواتير (sales_history)
        // بنبعت 'وارد' في آخر خانة عشان دالة renderReports تلونها أخضر
        db.run(`INSERT INTO sales_history (customer_name, total, type, date, net_profit, payment_method) VALUES (?, ?, ?, ?, ?, ?)`,
               [supplierName, finalTotal, 'purchase', new Date().toISOString(), 0, 'وارد']);

        // 4. حفظ وتحديث الواجهة
        saveDbToLocal();
        showToast("تم اعتماد الفاتورة كوارد بنجاح ✅");

        // تنظيف الفورم
        document.getElementById('supplier-name').value = "";
        tableBody.innerHTML = "";
        finalTotalElement.innerText = "0.00";

        // تحديث الجداول المفتوحة فوراً
        if (typeof renderInventory === 'function') renderInventory();
        if (typeof renderReports === 'function') renderReports(); 

    } catch (e) {
        console.error("خطأ في عملية الشراء:", e);
        showToast("حدث خطأ أثناء الحفظ: " + e.message, "error");
    }
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
    const qtyInput = document.getElementById('sale-qty-input');
    const qty = parseInt(qtyInput.value) || 0;

    if (!selectedProductTemp) {
        alert("يرجى اختيار منتج أولاً");
        return;
    }

    if (qty <= 0) {
        alert("يرج / إدخال كمية صحيحة");
        return;
    }

    if (qty > selectedProductTemp.stock) {
        alert("الكمية المطلوبة أكبر من المتاح في المخزن!");
        return;
    }

    addItemToCart(selectedProductTemp.id, selectedProductTemp.name, selectedProductTemp.price, qty, selectedProductTemp.stock);

    // تصفير للمرة الجاية
    selectedProductTemp = null;
    document.getElementById('sale-search-input').value = '';
    qtyInput.value = 1;
    document.getElementById('sale-search-input').focus();
    
    renderInvoiceTable();
};



window.addItemToCart = function(id, name, price, qty, stock) {
    const existing = currentInvoiceCart.find(item => item.id === id);
    if (existing) {
        if ((existing.qty + qty) <= stock) {
            existing.qty += qty;
        } else {
            alert("عذراً، الكمية الإجمالية تتخطى الرصيد المتاح!");
            return;
        }
    } else {
        currentInvoiceCart.push({ id, name, price, qty, stock });
    }
    renderInvoiceTable();
}

window.addItemToInvoice = function(id, name, price, stock) {
    if (stock <= 0) {
        alert("عذراً، هذا المنتج غير متوفر في المخزن!");
        return;
    }

    // التأكد إذا كان المنتج مضاف مسبقاً للفاتورة
    const existing = currentInvoiceCart.find(item => item.id === id);
    if (existing) {
        if (existing.qty < stock) {
            existing.qty++;
        } else {
            alert("وصلت لأقصى كمية متاحة!");
        }
    } else {
        currentInvoiceCart.push({ id, name, price, qty: 1, stock });
    }

    document.getElementById('sale-search-results').style.display = 'none';
    document.getElementById('sale-search-input').value = '';
    renderInvoiceTable();
};



function renderInvoiceTable() {
    const tbody = document.querySelector("#sale-invoice-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    let grandTotal = 0;

    currentInvoiceCart.forEach((item, index) => {
        const total = item.price * item.qty;
        grandTotal += total;
        tbody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td>${item.price.toFixed(2)}</td>
                <td>${item.qty}</td>
                <td>${total.toFixed(2)}</td>
                <td>
                    <button onclick="removeFromInvoice(${index})" class="action-btn delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
    });

    const totalEl = document.getElementById('sale-grand-total');
    if (totalEl) totalEl.innerText = grandTotal.toFixed(2);
    
    const countEl = document.getElementById('sale-items-count');
    if (countEl) countEl.innerText = currentInvoiceCart.length;
}

window.updateQty = function(index, val) {
    const item = currentInvoiceCart[index];
    if (val > item.stock) {
        alert("الكمية المطلوبة أكبر من المتوفر!");
        item.qty = item.stock;
    } else {
        item.qty = parseInt(val);
    }
    renderInvoiceTable();
};

window.removeFromInvoice = function(index) {
    currentInvoiceCart.splice(index, 1);
    renderInvoiceTable();
};




window.saleProcessInvoice = function() {
    // 1. التحقق من وجود أصناف
    if (!currentInvoiceCart || currentInvoiceCart.length === 0) {
        showToast("أضف أصنافاً للفاتورة أولاً", "error");
        return;
    }

    // 2. تجميع البيانات الأساسية
    const customerName = document.getElementById('sale-customer-name').value.trim() || "عميل نقدي";
    const customerPhone = document.getElementById('sale-customer-phone').value.trim() || "";
    const total = parseFloat(document.getElementById('sale-grand-total').innerText) || 0;
    const payMethod = document.getElementById('sale-payment-method').value;
    
    // توحيد التاريخ (YYYY-MM-DD)
    const todayDate = new Date().toISOString().split('T')[0]; 

    let totalNetProfit = 0; 

    try {
        db.run("BEGIN TRANSACTION");

        // 3. معالجة الأصناف (حساب الربح + خصم المخزن)
        currentInvoiceCart.forEach(item => {
            // جلب سعر الشراء بالاسم لضمان الدقة
            const res = db.exec("SELECT buyPrice FROM products WHERE id = ?", [item.id]);
            
            let actualBuyPrice = 0;
            if (res.length > 0 && res[0].values.length > 0) {
                actualBuyPrice = parseFloat(res[0].values[0][0]) || 0;
            }

            const sPrice = parseFloat(item.price || item.sellPrice || 0);
            
            // الربح الصافي للصنف الواحد = (سعر البيع - سعر الشراء) * الكمية
            const itemProfit = (sPrice - actualBuyPrice) * item.qty;
            totalNetProfit += itemProfit;

            // تحديث كمية المخزن
            db.run("UPDATE products SET quantity = quantity - ? WHERE id = ?", [item.qty, item.id]);
        });

        // 4. تسجيل الفاتورة في سجل المبيعات
        db.run(`INSERT INTO sales_history (customer_name, total, payment_method, date, customer_phone, net_profit, type) 
                VALUES (?, ?, ?, ?, ?, ?, 'sale')`, 
                [customerName, total, 'صادر', todayDate, customerPhone, totalNetProfit]);

        // 5. تحديث سجل الأرباح اليومية (profit_logs)
        const checkProfit = db.exec("SELECT daily_profit FROM profit_logs WHERE date = ?", [todayDate]);
        if (checkProfit.length > 0 && checkProfit[0].values.length > 0) {
            db.run("UPDATE profit_logs SET daily_profit = daily_profit + ? WHERE date = ?", [totalNetProfit, todayDate]);
        } else {
            db.run("INSERT INTO profit_logs (date, daily_profit) VALUES (?, ?)", [todayDate, totalNetProfit]);
        }

        // 6. إدارة بيانات العميل (لو مش نقدي)
        if (customerName !== "عميل نقدي") {
            const checkCust = db.exec("SELECT id FROM customers WHERE name = ?", [customerName]);
            if (checkCust.length > 0) {
                db.run("UPDATE customers SET phone = ?, added_date = ? WHERE name = ?", [customerPhone, todayDate, customerName]);
            } else {
                db.run("INSERT INTO customers (name, phone, added_date) VALUES (?, ?, ?)", [customerName, customerPhone, todayDate]);
            }
        }

        db.run("COMMIT");
        
        // حفظ قاعدة البيانات وتحديث الواجهة
        saveDbToLocal(); 
        if (typeof updateDashboardStats === 'function') updateDashboardStats();
        
        // 7. الطباعة وتصفير الشاشة
        if (typeof printInvoice === 'function') {
            printInvoice(customerName, total, "INV-" + Date.now().toString().slice(-6), payMethod);
        }

        // تصفير الواجهة
        currentInvoiceCart = [];
        if (typeof renderInvoiceTable === 'function') renderInvoiceTable();
        
        document.getElementById('sale-customer-name').value = '';
        document.getElementById('sale-customer-phone').value = '';
        document.getElementById('sale-search-input').value = '';
        document.getElementById('sale-search-input').focus();

        showToast("تم إتمام العملية وتحديث الأرباح بنجاح! ✅💰");

    } catch (err) {
        db.run("ROLLBACK");
        console.error("❌ خطأ فادح في عملية البيع:", err);
        showToast("حدث خطأ! تم إلغاء العملية ولم يتم خصم أي شيء", "error");
    }
    // جوه دالة إتمام البيع بعد ما تسيف في الـ DB
updateDashboardStats();
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
function clearSaleScreen() {
    currentInvoiceCart = [];
    renderInvoiceTable();
    document.getElementById('sale-customer-name').value = '';
    document.getElementById('sale-customer-phone').value = '';
    document.getElementById('sale-search-input').value = '';
    document.getElementById('sale-search-input').focus();
    renderInventory();
}





// سجل الفواتير






// متغير لحفظ النوع المختار حالياً (الكل، وارد، صادر)
let currentRecordType = 'الكل';

// دالة لجلب البيانات وعرضها في الجدول
window.renderReports = function() {
    const tbody = document.querySelector("#reports-table tbody");
    if (!tbody || !db) return;

    try {
        // 1. جلب البيانات مع إضافة عمود النوع (payment_method)
        const res = db.exec("SELECT id, date, customer_name, total, payment_method FROM sales_history ORDER BY id DESC");
        
        tbody.innerHTML = ""; 

        if (res.length > 0 && res[0].values) {
            res[0].values.forEach(row => {
                const tr = document.createElement("tr");

                // 2. تصليح التاريخ ( Invalid Date حل مشكلة الـ)
                let dateStr = '---';
                if (row[1]) {
                    const d = new Date(row[1]);
                    dateStr = isNaN(d) ? row[1] : d.toLocaleString('ar-EG');
                }
                
                // 3. سحر الألوان: لو القيمة "وارد" ارمي كلاس الاستيراد ولون أخضر
                const isImport = row[4] === "وارد";
                const typeText = isImport ? "وارد" : "صادر";
                const typeClass = isImport ? "import" : "export"; // تأكد إن عندك كلاس import في الـ CSS لونه أخضر
                const priceColor = isImport ? "#2e7d32" : "#c62828"; // أخضر للوارد وأحمر للصادر

                tr.innerHTML = `
                    <td>#${row[0]}</td>
                    <td>${dateStr}</td>
                    <td><span class="badge-type ${typeClass}">${typeText}</span></td>
                    <td>${row[2] || 'عميل نقدي'}</td>
                    <td>${isImport ? 'توريد بضاعة' : 'مبيعات منتجات'}</td>
                    <td style="font-weight: bold; color: ${priceColor};">${row[3]} ج.م</td>
                    <td>
                        <button class="action-btn print" onclick="printInvoice(${row[0]})" title="طباعة">
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
    const nameInput = document.getElementById('filter-name').value.toLowerCase();
    const dateInput = document.getElementById('filter-date').value;
    const rows = document.querySelectorAll("#reports-table tbody tr");

    rows.forEach(row => {
        const idAndName = row.innerText.toLowerCase();
        const rowDate = row.cells[1].innerText;
        const rowType = row.cells[2].innerText;

        let show = true;

        // فلترة بالاسم
        if (nameInput && !idAndName.includes(nameInput)) show = false;
        // فلترة بالتاريخ (تحويل صيغة تاريخ الصف لتناسب الـ input)
        if (dateInput && !rowDate.includes(new Date(dateInput).toLocaleDateString('ar-EG'))) show = false;
        // فلترة بالنوع
        if (currentRecordType !== 'الكل' && !rowType.includes(currentRecordType)) show = false;

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
    const input = document.getElementById('filter-name').value.toLowerCase();
    const rows = document.querySelectorAll("#reports-table tbody tr");

    rows.forEach(row => {
        const customerName = row.cells[3].textContent.toLowerCase();
        row.style.display = customerName.includes(input) ? "" : "none";
    });
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

        console.log("✅ تم تحديث الأرقام بنجاح");

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





// دالة التحقق من الدخول (تدعم المستخدمين الجدد)
window.checkMainPass = function() {
    const userInp = document.getElementById('main-username').value.trim();
    const passInp = document.getElementById('main-pass').value.trim();

    try {
        // البحث في جدول المستخدمين (system_users) بدل جدول الإعدادات القديم
        const res = db.exec("SELECT username FROM system_users WHERE username = ? AND password = ?", [userInp, passInp]);

        if (res.length > 0 && res[0].values.length > 0) {
            const loginOverlay = document.getElementById('main-login-overlay');
            if (loginOverlay) {
                loginOverlay.style.transition = "opacity 0.5s ease";
                loginOverlay.style.opacity = "0";
                setTimeout(() => { loginOverlay.style.display = 'none'; }, 500);
            }

            const userDisplay = document.getElementById('user');
            if (userDisplay) userDisplay.innerText = `المستخدم: ${userInp}`;

            showToast(`مرحباً ${userInp}!`);
        } else {
            showToast("اسم المستخدم أو كلمة المرور غير صحيحة ❌", "error");
            const inputs = document.querySelectorAll('.login-input');
            inputs.forEach(input => {
                input.style.borderColor = "red";
                setTimeout(() => { input.style.borderColor = ""; }, 2000);
            });
        }
    } catch (e) {
        console.error("خطأ:", e);
        showToast("حدث خطأ في النظام", "error");
    }
};
// --- رجوع زرار الـ Enter (مهم جداً) ---
// document.getElementById('main-pass').addEventListener('keypress', function (e) {
//     if (e.key === 'Enter') {
//         checkMainPass();
//     }
// });
// إضافة Enter أيضاً لخانة اسم المستخدم عشان يبقى الشغل كامل
// document.getElementById('main-username').addEventListener('keypress', function (e) {
//     if (e.key === 'Enter') {
//         checkMainPass();
//     }
// });
// 1. تحديث اسم الشركة
window.updateCompanyName = function() {
    const name = document.getElementById('new-company-name').value.trim();
    if (!name) return showToast("برجاء إدخال اسم", "warning");
    
    db.run("UPDATE settings SET value = ? WHERE key = 'company_name'", [name]);
    saveDbToLocal();
    
    // تحديث كل الأماكن اللي فيها اسم الشركة
    document.querySelectorAll('.company-name-display, #sidebar-logo-name, #display-company-name')
            .forEach(el => el.innerText = name);
            
    showToast("تم تحديث اسم الشركة ✅");
    document.getElementById('new-company-name').value = "";
};
// فتح المودال مع تحديث القائمة
window.toggleUserModal = function(show) {
    const modal = document.getElementById('user-management-modal');
    if (modal) {
        modal.style.display = show ? 'flex' : 'none';
        if (show) renderUsers();
    }
};
// 2. عرض المستخدمين في الجدول (باستخدام Font Awesome)
window.renderUsers = function() {
    const tbody = document.getElementById('users-list-table');
    if (!tbody) return;

    try {
        const res = db.exec("SELECT id, username FROM system_users");
        tbody.innerHTML = "";
        
        if (res.length > 0) {
            res[0].values.forEach(row => {
                const userId = row[0];
                const userName = row[1];
                const isMainAdmin = (userName.toLowerCase() === 'admin');

                tbody.innerHTML += `
                    <tr>
                        <td style="text-align:center; display: flex; justify-content: center; gap: 15px;">
                            <button class="action-icon edit-color" onclick="prepareUserEdit(${userId}, '${userName}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            
                            ${!isMainAdmin ? `
                                <button class="action-icon delete-color" onclick="deleteUser(${userId})">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            ` : '<i class="fas fa-lock" style="color:#ccc;" title="محمي"></i>'}
                        </td>
                        <td style="text-align:right;">${userName} <i class="fas fa-user-circle"></i></td>
                    </tr>`;
            });
        }
    } catch (e) {
        console.error("Database error in renderUsers:", e);
    }
};
// 1. إضافة مستخدم جديد
window.addUser = function() {
    const name = document.getElementById('manage-user-name').value.trim();
    const pass = document.getElementById('manage-user-pass').value.trim();
    
    if (!name || !pass) return showToast("اكتب الاسم والباسوورد", "error");

    try {
        // إضافة المستخدم للجدول
        db.run("INSERT INTO system_users (username, password) VALUES (?, ?)", [name, pass]);
        
        // الخطوة الأهم: حفظ قاعدة البيانات في الـ LocalStorage
        saveDbToLocal(); 
        
        showToast("تمت الإضافة.. تقدر تسجل دخول بيه دلوقتي ✅");
        resetUserForm();
        renderUsers();
    } catch (e) {
        showToast("الاسم ده موجود قبل كدة!", "error");
    }
};
// 2. وضع التعديل (تجهيز البيانات)
window.prepareUserEdit = function(id, name) {
    document.getElementById('edit-user-id').value = id;
    document.getElementById('manage-user-name').value = name;
    document.getElementById('manage-user-pass').placeholder = "باسوورد جديد (أو اتركه فارغاً)";
    
    // إخفاء زر الإضافة وإظهار أزرار التعديل
    document.getElementById('btn-add-user').style.display = 'none';
    document.getElementById('edit-actions').style.display = 'flex';
};
// 3. تنفيذ التعديل (Update)
window.updateUser = function() {
    const id = document.getElementById('edit-user-id').value;
    const name = document.getElementById('manage-user-name').value.trim();
    const pass = document.getElementById('manage-user-pass').value.trim();

    if (!name) return showToast("الاسم مطلوب", "error");

    if (pass) {
        db.run("UPDATE system_users SET username = ?, password = ? WHERE id = ?", [name, pass, id]);
    } else {
        db.run("UPDATE system_users SET username = ? WHERE id = ?", [name, id]);
    }
    
    saveDbToLocal();
    showToast("تم التحديث بنجاح ✅");
    resetUserForm();
    renderUsers();
};
// 4. تصفير الفورم (الرجوع لحالة الإضافة)
window.resetUserForm = function() {
    document.getElementById('edit-user-id').value = "";
    document.getElementById('manage-user-name').value = "";
    document.getElementById('manage-user-pass').value = "";
    document.getElementById('manage-user-pass').placeholder = "كلمة المرور";
    
    document.getElementById('btn-add-user').style.display = 'block';
    document.getElementById('edit-actions').style.display = 'none';
};
// 5. الحذف (Delete)
window.deleteUser = function(id) {
    if (confirm("يا رئيس، متأكد إنك عايز تحذف المستخدم ده؟")) {
        try {
            db.run("DELETE FROM system_users WHERE id = ?", [id]);
            saveDbToLocal();
            renderUsers();
            showToast("تم رميه في الزبالة بنجاح 🗑️");
        } catch (e) {
            showToast("حصلت مشكلة في الحذف", "error");
        }
    }
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
    const chks = document.querySelectorAll('.reset-chk');
    chks.forEach(c => {
        c.checked = masterChk.checked;
        c.disabled = masterChk.checked; // تعطيلهم عشان ميبقاش فيه لغبطة
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
    const passwordInput = document.getElementById('reset-pass-input').value;
    const ADMIN_PASSWORD = "123"; 

    if (passwordInput !== ADMIN_PASSWORD) {
        showToast("❌ كلمة السر غلط!", "error");
        return;
    }

    const isFullReset = document.getElementById('full-reset-chk').checked;
    let selectedTables = Array.from(document.querySelectorAll('.reset-chk:checked')).map(c => c.value);

    if (!isFullReset && selectedTables.length === 0) {
        showToast("⚠️ حدد حاجة الأول عشان نفرمتها", "info");
        return;
    }

    // تأكيد أخير لأن الموضوع فيه مسح داتا
    if(!confirm("هل أنت متأكد؟ لا يمكن التراجع عن هذه العملية!")) return;

    try {
        db.run("BEGIN TRANSACTION");

        // الجداول اللي هتتمسح
        let tables = isFullReset 
            ? ['products', 'categories', 'warehouses', 'customers', 'suppliers', 'sales_history', 'purchase_history', 'profit_logs', 'expenses'] 
            : selectedTables;

        tables.forEach(table => {
            db.run(`DELETE FROM ${table}`);
            db.run(`DELETE FROM sqlite_sequence WHERE name='${table}'`); // تصفير العداد
        });

        db.run("COMMIT");
        saveDbToLocal();
        
        showToast("✅ تم تنظيف النظام.. السيستم رجع جديد", "success");
        closeModal('reset-modal');
        setTimeout(() => location.reload(), 1200);

    } catch (e) {
        db.run("ROLLBACK");
        showToast("❌ خطأ: " + e.message, "error");
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
// window.checkPassAndShow = function(sectionId, passKey) {
//     currentTargetSection = sectionId;
//     currentTargetKey = passKey;
    
//     // تغيير الرسالة حسب القسم
//     const msg = sectionId === 'inventory' ? "دخول قسم المخزن" : "دخول لوحة التحكم";
//     document.getElementById('auth-message').innerText = msg;
    
//     document.getElementById('section-auth-modal').style.display = 'flex';
//     document.getElementById('auth-section-pass').value = ""; // تصفير الخانة
//     document.getElementById('auth-section-pass').focus();     // تركيز الماوس
// };
window.checkPassAndShow = function(sectionId, passKey) {
    // مؤقتاً: تخطي الحماية وتحويل المستخدم للسكشن المطلوب فوراً
    console.log("وضع التطوير: تم تخطي الباسورد للدخول إلى " + sectionId);
    
    // نداء مباشر لدالة إظهار السكشن
    if (typeof showSection === 'function') {
        showSection(sectionId);
    } else {
        // لو دالة showSection مش في النطاق العام، نستخدم الطريقة اليدوية
        const sections = document.querySelectorAll('.content-section');
        sections.forEach(s => s.style.display = 'none');
        
        const target = document.getElementById(sectionId);
        if (target) target.style.display = 'block';
    }

    // إخفاء المودال لو كان مفتوح بالصدفة
    const authModal = document.getElementById('section-auth-modal');
    if (authModal) authModal.style.display = 'none';
};

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
window.printInvoice = function(id) {
    alert("جاري تجهيز الطباعة للفاتورة رقم: #" + id);
    // هنا هنضيف كود فتح صفحة الطباعة لاحقاً
};











// حط الكود ده في آخر الملف خالص
setTimeout(() => {
    const payBtn = document.getElementById('sale-payment-method');
    if (payBtn) { 
        payBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') window.saleProcessInvoice();
        });
    }
}, 500);

window.showSection = function(id) {
    // 1. إخفاء السكاشن (زي ما عملنا)
    document.querySelectorAll('section, .content-section').forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
    });

    // 2. إظهار السيكشن المطلوب
    const target = document.getElementById(id);
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    }

    // 3. 🔥 الجزء الجديد: تلوين الزرار في الـ Sidebar 🔥
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active'); // شيل اللون من الكل
        
        // لو النص اللي جوه الزرار مرتبط بالسكشن، أو بالـ onClick
        if (item.getAttribute('onclick').includes(`'${id}'`)) {
            item.classList.add('active'); // حط اللون للي اتداس عليه بس
        }
    });

    // تحديث البيانات
    if (id === 'reports') renderReports();
    else if (id === 'inventory') renderInventory();
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





window.printInvoice = function(customer, total, invoiceId, payMethod) {
    const printWindow = window.open('', '', 'height=800,width=900');
    const savedCompanyName = localStorage.getItem('company_name') || "شركتك للتجارة";
    const paymentText = payMethod === 'card' ? "فيزا 💳" : "نقدي 💵";

    // بناء الجدول
    let itemsHtml = currentInvoiceCart.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td style="text-align: right;">${item.name}</td>
            <td>${item.qty}</td>
            <td>${parseFloat(item.price).toLocaleString()}</td>
            <td>${(item.price * item.qty).toLocaleString()}</td>
        </tr>
    `).join('');

    printWindow.document.write(`
    <html dir="rtl">
    <head>
        <title>فاتورة #${invoiceId}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
            body { font-family: 'Cairo', sans-serif; padding: 20px; color: #333; }
            .invoice-box { border: 1px solid #eee; padding: 20px; max-width: 600px; margin: auto; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
            .main-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .main-table th { background: #f8f9fa; border-bottom: 1px solid #333; padding: 8px; }
            .main-table td { padding: 8px; border-bottom: 1px solid #eee; text-align: center; }
            .total-area { border-top: 2px solid #3498db; margin-top: 15px; padding-top: 10px; font-weight: bold; font-size: 18px; }
        </style>
    </head>
    <body>
        <div class="invoice-box">
            <div class="header">
                <div><h1>${savedCompanyName}</h1><small>فاتورة مبيعات</small></div>
                <div style="text-align:left">رقم: ${invoiceId}<br>التاريخ: ${new Date().toLocaleDateString('ar-EG')}</div>
            </div>
            <p>العميل: ${customer} | الدفع: ${paymentText}</p>
            <table class="main-table">
                <thead><tr><th>م</th><th>الصنف</th><th>كمية</th><th>سعر</th><th>إجمالي</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div class="total-area">الإجمالي النهائي: ${total} ج.م</div>
        </div>
        <script>window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 500); };</script>
    </body>
    </html>
    `);
    printWindow.document.close();
};
window.processAndPrint = function() {
    // 1. جمع البيانات من الشاشة
    const total = document.getElementById('sale-grand-total').innerText;
    const customer = document.getElementById('sale-customer-name').value || "عميل نقدي";
    const method = document.getElementById('sale-payment-method').value;
    
    if (currentInvoiceCart.length === 0) {
        showToast("أضف منتجات أولاً!", "error");
        return;
    }

    // 2. تشغيل الطباعة
    printInvoice(customer, method, total, currentInvoiceCart);

    // 3. تصفير الفاتورة لبدء واحدة جديدة
    currentInvoiceCart = [];
    renderInvoiceTable();
    document.getElementById('sale-customer-name').value = '';
    document.getElementById('sale-search-input').focus();
    showToast("تم حفظ العملية وطباعتها", "success");
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
function showSection(sectionId) {
    // كود إخفاء كل السكاشن القديمة (اللي عندك)
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    
    // إظهار السكشن المطلوب
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.add('active');

        // --- الحركة السحرية هنا ---
        if (sectionId === 'sales') {
            setTimeout(() => {
                const searchInput = document.getElementById('sale-search-input');
                if (searchInput) searchInput.focus();
            }, 100); // تأخير بسيط لضمان أن القسم ظهر فعلياً
        }
    }
}

window.saleClearInvoice = function() {
    if (confirm("مسح الفاتورة؟")) {
        currentInvoiceCart = [];
        renderInvoiceTable();
        // ارجع للبحث فوراً
        document.getElementById('sale-search-input').focus();
    }
};

// إظهار البوب
window.showClearConfirm = function() {
    const pop = document.getElementById('clear-confirm-pop');
    pop.style.display = 'block';
};

// تنفيذ المسح أو الإلغاء
window.saleClearInvoice = function() {
    // تنفيذ المسح فوراً بدون confirm
    currentInvoiceCart = [];
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














// تحديث الإحصائيات كل 30 ثانية أوتوماتيك
setInterval(() => {
    if (window.db && window.updateDashboardStats) {
        updateDashboardStats();
        console.log("🔄 Live Update Done");
    }
}, 30000);



// هنحتاج نستدعي ipcRenderer في أول الملف لو مش موجود
const { ipcRenderer } = require('electron');

window.saveDbToLocal = function() {
    if (!db) return;
    
    // 1. تصدير قاعدة البيانات كـ Uint8Array
    const data = db.export();
    
    // 2. إرسال البيانات لملف main.js عشان يحفظها في الهارد
    ipcRenderer.send('save-db-to-disk', data);
    
    // 3. (اختياري) خلي الـ localStorage كنسخة احتياطية تانية
    const array = Array.from(data);
    localStorage.setItem('warehouse_sqlite_db', JSON.stringify(array));
    
    console.log("💾 تم الحفظ في ملف DB حقيقي بنجاح!");
};

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