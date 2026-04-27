


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
        const rowTotal = item.buyPrice * item.quantity;
        grandTotal += rowTotal;
        tbody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td><span class="badge-warehouse">${item.warehouse}</span></td>
                <td>${item.buyPrice.toFixed(2)}</td>
                <td>${item.sellPrice.toFixed(2)}</td>
                <td><b>${item.quantity}</b></td>
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
                const res = db.exec("SELECT name FROM suppliers WHERE name LIKE ?", [`%${val}%`]);
                
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
        const checkSupplier = db.exec("SELECT id FROM suppliers WHERE name = ?", [supplierName]);
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

