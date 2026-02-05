// 1. المتغيرات العامة وقاعدة البيانات
let db;
let currentManageMode = ''; 
let currentEditId = null; // عشان نعرف إحنا بنعدل أي منتج حالياً

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
async function initDatabase() {
    try {
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/${file}`
        });

        const savedDb = localStorage.getItem('warehouse_sqlite_db');
        if (savedDb) {
            const uInt8Array = new Uint8Array(JSON.parse(savedDb));
            db = new SQL.Database(uInt8Array);
        } else {
            db = new SQL.Database();
        }

        // 1. إنشاء الجداول الأساسية
        db.run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, name TEXT, warehouse TEXT, category TEXT, quantity INTEGER, buyPrice REAL, sellPrice REAL, date TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT UNIQUE, added_date TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS sales_history (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_name TEXT, total REAL, payment_method TEXT, date TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS warehouses (name TEXT UNIQUE)`);
        db.run(`CREATE TABLE IF NOT EXISTS categories (name TEXT UNIQUE)`);

        // 2. سحر التحديث: إضافة عمود التليفون لجدول المبيعات لو مش موجود (حل خطأ image_8e7358)
        try {
            db.run("ALTER TABLE sales_history ADD COLUMN customer_phone TEXT");
            console.log("🆕 تم إضافة عمود التليفون لجدول المبيعات");
        } catch (e) {
            // لو طلع خطأ يبقى العمود موجود أصلاً، فبنطنش الخطأ عادي
        }

        saveDbToLocal();
        console.log("🚀 كافة الجداول محدثة وجاهزة للعمل");
        if (typeof renderInventory === 'function') renderInventory();

    } catch (err) {
        console.error("❌ فشل في التهيئة:", err);
    }
}






window.openSalesHistory = function() {
    // 1. جلب البيانات من القاعدة
    const res = db.exec("SELECT id, customer_name, customer_phone, total, payment_method, date FROM sales_history ORDER BY id DESC");
    
    // 2. بناء محتوى الجدول
    let rowsHtml = "";
    if (res.length > 0) {
        res[0].values.forEach(row => {
            const date = new Date(row[5]).toLocaleString('ar-EG');
            rowsHtml += `
                <tr>
                    <td>#${row[0]}</td>
                    <td>${row[1]}</td>
                    <td>${row[2] || '---'}</td>
                    <td><b>${row[3]} ج.م</b></td>
                    <td>${row[4] === 'cash' ? '💵 كاش' : '💳 فيزا'}</td>
                    <td>${date}</td>
                </tr>`;
        });
    } else {
        rowsHtml = "<tr><td colspan='6'>لا توجد فواتير مسجلة بعد</td></tr>";
    }

    // 3. عرض البيانات في مودال أو سكشن جديد (حسب تصميمك)
    // أنا هفترض إن عندك سكشن اسمه sales-history-section
    const historyTableBody = document.querySelector("#sales-history-table tbody");
    if (historyTableBody) {
        historyTableBody.innerHTML = rowsHtml;
        showSection('sales-history-section'); // الدالة اللي بتبدل بين الشاشات
    } else {
        // لو مفيش جدول جاهز، اطبعهم في الكونسول مؤقتاً
        console.table(res[0].values);
        alert("راجع الكونسول (F12) لمشاهدة السجل حالياً");
    }
};




















window.renderReports = function() {
    const tbody = document.querySelector("#reports-table tbody");
    if (!tbody || !db) return;

    try {
        // جلب البيانات مع ترتيبها من الأحدث للأقدم
        const res = db.exec("SELECT id, date, customer_name, total FROM sales_history ORDER BY id DESC");
        
        tbody.innerHTML = ""; // تنظيف الجدول من أي بيانات قديمة

        if (res.length > 0 && res[0].values) {
            res[0].values.forEach(row => {
                const tr = document.createElement("tr");
                // تنسيق الوقت والتاريخ
                const dateStr = row[1] ? new Date(row[1]).toLocaleString('ar-EG') : '---';
                
                tr.innerHTML = `
                    <td>#${row[0]}</td>
                    <td>${dateStr}</td>
                    <td><span class="badge-type export">صادر</span></td>
                    <td>${row[2] || 'عميل نقدي'}</td>
                    <td>مبيعات منتجات</td>
                    <td style="font-weight: bold; color: #2e7d32;">${row[3]} ج.م</td>
                    <td>
                        <button class="action-btn print" onclick="printInvoice(${row[0]})" title="طباعة">
                            <i class="fas fa-print"></i>
                        </button>
                        <button class="action-btn delete" onclick="deleteInvoice(${row[0]})" title="حذف">
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


























function saveDbToLocal() {
    const data = db.export();
    localStorage.setItem('warehouse_sqlite_db', JSON.stringify(Array.from(data)));
}

// 4. دالة التشغيل الأساسية
async function initApp() {
    console.log("البرنامج جاهز للعمل بنظام SQLite...");
    await initDatabase();
    
    updateDateTime(); 
    setInterval(updateDateTime, 1000); 
    
    const companyName = localStorage.getItem('company_name') || "اسم الشركة";
    const companyElem = document.getElementById('display-company-name');
    if (companyElem) companyElem.innerText = companyName;
}

// 5. إدارة النوافذ (Modals)
function openProductModal() {
    const modal = document.getElementById('modal-product');
    if (modal) {
        modal.style.display = 'flex';
        fillSelects();
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
}

// 6. العمليات على المنتجات
function saveProduct() {
    const name = document.getElementById('p-name').value;
    if (!name) { alert("ادخل اسم المنتج!"); return; }

    const wh = document.getElementById('p-warehouse-select').value;
    const cat = document.getElementById('p-category-select').value;
    const qty = parseInt(document.getElementById('p-qty').value) || 0;
    const buy = parseFloat(document.getElementById('p-buy').value) || 0;
    const sell = parseFloat(document.getElementById('p-sell').value) || 0;
    
    const autoCode = "P-" + Date.now().toString().slice(-6);
    const today = new Date().toISOString().split('T')[0];

    db.run(`INSERT INTO products (code, name, warehouse, category, quantity, buyPrice, sellPrice, date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [autoCode, name, wh, cat, qty, buy, sell, today]);

    saveDbToLocal();
    renderInventory();
    closeAllModals();
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
                        <button class="action-btn delete" onclick="deleteProduct(${row[0]})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
        });
    }
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


function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    resetProductModal(); // تنظيف المودال دايماً عند القفل
}

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
function deleteProduct(id) {
    if(confirm("حذف المنتج؟")) {
        db.run("DELETE FROM products WHERE id = ?", [id]);
        saveDbToLocal();
        renderInventory();
    }
}

// 7. ملء القوائم (Selects)
function fillSelects() {
    const wRes = db.exec("SELECT name FROM warehouses");
    const cRes = db.exec("SELECT name FROM categories");
    const wSelect = document.getElementById('p-warehouse-select');
    const cSelect = document.getElementById('p-category-select');
    
    if(wRes.length > 0) wSelect.innerHTML = wRes[0].values.map(v => `<option value="${v[0]}">${v[0]}</option>`).join('');
    if(cRes.length > 0) cSelect.innerHTML = cRes[0].values.map(v => `<option value="${v[0]}">${v[0]}</option>`).join('');
}



// اربط هذا الكود بخانة البحث في الـ HTML (oninput="filterInvoices()")
window.filterInvoices = function() {
    const input = document.getElementById('filter-name').value.toLowerCase();
    const rows = document.querySelectorAll("#reports-table tbody tr");

    rows.forEach(row => {
        const customerName = row.cells[3].textContent.toLowerCase();
        row.style.display = customerName.includes(input) ? "" : "none";
    });
};















































function showSection(id) {
    // إخفاء كل السكاشن
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });

    // إظهار السكشن المختار
    const target = document.getElementById(id);
    if (target) {
        target.style.display = 'block';
        
        // إذا كان السكشن هو سجل الفواتير، قم بتحديث البيانات فوراً
        if (id === 'reports') {
            renderReports(); 
        }
    }
}
// تشغيل البرنامج
window.onload = initApp;