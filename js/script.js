// --- 1. تهيئة البيانات وتحميلها من الذاكرة المحلية ---
let inventoryData = JSON.parse(localStorage.getItem('myInventory')) || [];
let categories = JSON.parse(localStorage.getItem('myCategories')) || ["", " "];
let salesHistory = JSON.parse(localStorage.getItem('mySalesHistory')) || [];
let allCustomersSet = new Set(JSON.parse(localStorage.getItem('saved_customers')) || []);
let allSuppliersSet = new Set(JSON.parse(localStorage.getItem('saved_suppliers')) || []);

// جوه دالة saleProcessInvoice
const nameInput = document.getElementById('sale-customer-name');
const phoneInput = document.getElementById('sale-customer-phone');

if (nameInput.value.trim() !== "عميل نقدي") {
    // السطر ده هو اللي بيلحم الاسم والرقم عشان يظهروا في القائمة
    const entry = `${nameInput.value.trim()} | ${phoneInput.value.trim()}`;
    allCustomersSet.add(entry); 
    
    // حفظ في الذاكرة
    localStorage.setItem('saved_customers', JSON.stringify(Array.from(allCustomersSet)));
}

// متغيرات الحالة المؤقتة
let currentInvoice = [];      // لفاتورة البيع
let currentInvoiceItems = []; // لفاتورة الوارد
let currentFilterType = 'الكل';

// --- 2. وظائف عامة ومزامنة البيانات ---
function syncStorage() {
    localStorage.setItem('myInventory', JSON.stringify(inventoryData));
    localStorage.setItem('myCategories', JSON.stringify(categories));
    localStorage.setItem('mySalesHistory', JSON.stringify(salesHistory));
}
window.onload = () => {
    // 1. تحديث البيانات الأساسية
    if (typeof updateCategoryDropdowns === "function") updateCategoryDropdowns();
    if (typeof loadInventory === "function") loadInventory();
    if (typeof applyAllFilters === "function") applyAllFilters();
    
    // 2. تشغيل الساعة (لو موجودة)
    if (typeof updateWelcomeClock === "function") {
        setInterval(updateWelcomeClock, 1000);
    }

    // 3. إظهار شاشة الدخول أو الترحيب بأمان
    const loginOverlay = document.getElementById('main-login-overlay');
    if (loginOverlay) {
        if (!sessionStorage.getItem('mainAuth')) {
            loginOverlay.style.display = 'flex';
        } else {
            loginOverlay.style.display = 'none';
            showSection('welcome-section');
        }
    } else {
        console.warn("تنبيه: عنصر main-login-overlay غير موجود في صفحة HTML");
        showSection('welcome-section');
    }
};
function updateGlobalCompanyName(newName) {
    if (!newName) return;
    
    // 1. التغيير في التخزين
    localStorage.setItem('company_name', newName);

    // 2. التغيير في كل واجهات البرنامج (الجانبية والترحيبية)
    const selectors = ['.invoice-company-name', '#display-company-name', '#sidebar-logo-name', '.brand h1'];
    selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            el.innerText = newName;
        });
    });
}
function saveCompanyName() {
    const newName = document.getElementById('new-company-name').value.trim();
    
    if (newName === "") {
        alert("يرجى إدخال اسم الشركة أولاً");
        return;
    }

    // 1. حفظ الاسم في الذاكرة الدائمة
    localStorage.setItem('company_name', newName);

    // 2. تحديث الاسم في كل العناصر التي تحمل IDs أو Classes معينة
    updateNameInUI(newName);

    alert("تم حفظ اسم الشركة وتحديثه في البرنامج بنجاح!");
}

// دالة مساعدة لتحديث الاسم في كل مكان
function updateNameInUI(name) {
    // تحديث في شاشة الترحيب
    if (document.getElementById('display-company-name')) {
        document.getElementById('display-company-name').innerText = name;
    }
    // تحديث في السايدبار (اللوجو)
    if (document.getElementById('sidebar-logo-name')) {
        document.getElementById('sidebar-logo-name').innerText = name;
    }
    // تحديث في جميع الفواتير (لو موجودة حالياً)
    document.querySelectorAll('.invoice-company-name').forEach(el => {
        el.innerText = name;
    });
}
// أضف هذا الجزء في بداية ملف الـ script.js
document.addEventListener('DOMContentLoaded', () => {
    const savedName = localStorage.getItem('company_name');
    if (savedName) {
        updateNameInUI(savedName);
        // تأكد أن خانة الإدخال في الإعدادات يظهر فيها الاسم القديم أيضاً
        if (document.getElementById('new-company-name')) {
            document.getElementById('new-company-name').value = savedName;
        }
    }
});
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'none';
    } else {
        console.error("تعذر إغلاق النافذة: العنصر " + id + " غير موجود");
    }
}
function showSection(id) {
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');

    if (id === 'inventory') loadInventory();
    if (id === 'reports') applyAllFilters();
    if (id === 'dashboard-section') updateDashboard(); // السطر الجديد
}
function updateDashboard() {
    let totalStockValue = 0;
    let expectedProfit = 0;
    let lowStockCount = 0;
    let todaySales = 0;

    // الحصول على تاريخ اليوم بصيغة ثابتة YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    // 1. حساب قيم المخزن
    inventoryData.forEach(item => {
        const qty = Number(item.qty) || 0;
        const buy = Number(item.buy) || 0;
        const sell = Number(item.sell) || 0;

        totalStockValue += (buy * qty);
        expectedProfit += ((sell - buy) * qty);
        if (qty < 5) lowStockCount++;
    });

    // 2. حساب مبيعات اليوم من سجل العمليات
    salesHistory.forEach(record => {
        // تحويل id السجل (Timestamp) إلى صيغة YYYY-MM-DD للمقارنة
        const recordDate = new Date(record.id).toISOString().split('T')[0];
        
        if (recordDate === today && record.type === 'صادر') {
            todaySales += Number(record.total) || 0;
        }
    });

    // 3. تحديث الأرقام في الواجهة
    const elements = {
        'dash-total-value': totalStockValue,
        'dash-expected-profit': expectedProfit,
        'dash-low-stock': lowStockCount,
        'dash-today-sales': todaySales
    };

    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) {
            el.innerText = id.includes('sales') || id.includes('value') || id.includes('profit') 
                ? value.toLocaleString() + " ج.م" 
                : value;
        }
    }
}

// --- 3. إدارة الأقسام ---
function updateCategoryDropdowns() {
    const mSelect = document.getElementById('m-category');
    const fSelect = document.getElementById('filter-category');
    if (!mSelect || !fSelect) return;

    mSelect.innerHTML = '';
    fSelect.innerHTML = '<option value="all">كل الأقسام</option>';
    
    categories.forEach(cat => {
        const opt = `<option value="${cat}">${cat}</option>`;
        mSelect.innerHTML += opt;
        fSelect.innerHTML += opt;
    });
}

function openCatModal() {
    renderCatTable();
    document.getElementById('catModal').style.display = 'block';
}

function renderCatTable() {
    const tbody = document.getElementById('cat-list-body');
    tbody.innerHTML = '';
    categories.forEach((cat, index) => {
        tbody.innerHTML += `<tr><td>${cat}</td><td><button onclick="deleteCat(${index})" class="btn-delete-sm"><i class="fas fa-trash"></i></button></td></tr>`;
    });
}

function saveCategory() {
    const name = document.getElementById('new-cat-name').value.trim();
    if (name && !categories.includes(name)) {
        categories.push(name);
        document.getElementById('new-cat-name').value = '';
        renderCatTable();
        updateCategoryDropdowns();
        syncStorage();
    }
}

function deleteCat(index) {
    categories.splice(index, 1);
    renderCatTable();
    updateCategoryDropdowns();
    syncStorage();
}

// --- 4. إدارة المخزن (عرض، إضافة، تعديل) ---
function loadInventory(filter = 'all') {
    const tbody = document.querySelector('#inventory-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    inventoryData.forEach(item => {
        if (filter !== 'all' && item.cat !== filter) return;
        tbody.innerHTML += `
            <tr>
                <td>#${item.id}</td>
                <td style="font-weight:600">${item.name}</td>
                <td><span class="badge">${item.cat}</span></td>
                <td style="color:${item.qty < 5 ? 'red' : 'inherit'}">${item.qty}</td>
                <td>${item.buy} ج.م</td>
                <td>${item.sell} ج.م</td>
                <td>
                    <button onclick="editProd('${item.id}')" class="btn-edit-sm"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteProd('${item.id}')" class="btn-delete-sm"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
    });
}

function openProductModal() {
    document.getElementById('edit-id').value = '';
    document.getElementById('modal-title').innerText = "إضافة منتج جديد";
    document.querySelectorAll('#productModal input').forEach(i => i.value = '');
    document.getElementById('productModal').style.display = 'block';
}
function saveProduct() {
    try {
        // 1. سحب البيانات وتأكيد القيم الرقمية
        const editId = document.getElementById('edit-id').value;
        const name = document.getElementById('m-name').value.trim();
        const cat = document.getElementById('m-category').value;
        const buy = parseFloat(document.getElementById('m-buy').value) || 0;
        const sell = parseFloat(document.getElementById('m-sell').value) || 0;
        const qty = parseInt(document.getElementById('m-qty').value) || 0;

        if (!name) {
            alert("يرجى إدخال اسم المنتج");
            return;
        }
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        
        // إذا أغلقنا نافذة المنتج، نصفر الـ ID لضمان عدم التعليق عند الإضافة الجديدة
        if (modalId === 'productModal') {
            const editId = document.getElementById('edit-id');
            if (editId) editId.value = '';
        }
    }
}
        // 2. معالجة البيانات (تعديل أو إضافة)
        if (editId) {
            const index = inventoryData.findIndex(p => p.id == editId);
            if (index !== -1) {
                inventoryData[index] = { id: editId, name, cat, buy, sell, qty };
            }
        } else {
            const newProduct = {
                id: Date.now().toString(), 
                name, cat, buy, sell, qty
            };
            inventoryData.push(newProduct);
        }

        // 3. المزامنة والتحديث (هذا الجزء يمنع التعليق)
        syncStorage();      
        loadInventory();    
        updateDashboard();  
        
        // 4. إغلاق المودال وتصفير الخانات
        closeModal('productModal');
        
        // تصفير خانة الـ ID المخفية لضمان عدم الخلط في المرة القادمة
        document.getElementById('edit-id').value = '';

    } catch (error) {
        console.error("Error in saveProduct:", error);
        alert("حدث خطأ أثناء الحفظ، يرجى مراجعة البيانات");
    }
}

function editProd(id) {
    const p = inventoryData.find(i => i.id == id);
    document.getElementById('edit-id').value = p.id;
    document.getElementById('m-name').value = p.name;
    document.getElementById('m-category').value = p.cat;
    document.getElementById('m-buy').value = p.buy;
    document.getElementById('m-sell').value = p.sell;
    document.getElementById('m-qty').value = p.qty;
    document.getElementById('modal-title').innerText = "تعديل المنتج";
    document.getElementById('productModal').style.display = 'block';
}

function deleteProd(id) {
    inventoryData = inventoryData.filter(i => i.id != id);
    syncStorage();
    loadInventory();
}
// --- 5. نظام البيع (صادر) ---
function searchProductForSale(query) {
    const resultsDiv = document.getElementById('sale-results');
    if (!query) { resultsDiv.style.display = 'none'; return; }

    const matches = inventoryData.filter(item => 
        item.name.toLowerCase().includes(query.toLowerCase()) || item.id.includes(query)
    );

    resultsDiv.innerHTML = '';
    matches.forEach(item => {
        const div = document.createElement('div');
        div.className = 'search-item';
        div.innerHTML = `<span>${item.name}</span> <span>السعر: ${item.sell} | المتاح: ${item.qty}</span>`;
        div.onclick = () => addToInvoice(item);
        resultsDiv.appendChild(div);
    });
    resultsDiv.style.display = 'block';
}

function addToInvoice(product) {
    if (product.qty <= 0) return; 
    
    const existing = currentInvoice.find(i => i.id === product.id);
    if (existing) {
        if (existing.count < product.qty) existing.count++;
    } else {
        currentInvoice.push({ ...product, count: 1 });
    }
    
    document.getElementById('sale-results').style.display = 'none';
    document.getElementById('sale-search').value = '';
    renderSaleTable();
}

function renderSaleTable() {
    const tbody = document.querySelector('#sale-table tbody');
    let total = 0;
    tbody.innerHTML = '';

    currentInvoice.forEach((item, index) => {
        const rowTotal = item.sell * item.count;
        total += rowTotal;
        tbody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td>${item.sell}</td>
                <td><input type="number" value="${item.count}" min="1" max="${item.qty}" onchange="updateSaleQty(${index}, this.value)" style="width: 60px;"></td>
                <td>${rowTotal.toFixed(2)}</td>
                <td><button onclick="removeFromSale(${index})" class="btn-delete-sm">&times;</button></td>
            </tr>`;
    });
    document.getElementById('sale-final-total').innerText = total.toFixed(2);
}

function updateSaleQty(index, val) {
    const item = currentInvoice[index];
    const original = inventoryData.find(p => p.id === item.id);
    if (parseInt(val) > original.qty) {
        renderSaleTable();
        return;
    }
    currentInvoice[index].count = parseInt(val);
    renderSaleTable();
}

function processSale() {
    if (currentInvoice.length === 0) return;

    const total = currentInvoice.reduce((sum, item) => sum + (item.sell * item.count), 0);
    const party = document.getElementById('customer-name').value || "عميل نقدي";

    currentInvoice.forEach(saleItem => {
        const productIndex = inventoryData.findIndex(p => p.id === saleItem.id);
        if (productIndex !== -1) inventoryData[productIndex].qty -= saleItem.count;
    });

    saveToHistory('صادر', party, total, currentInvoice.length);

    currentInvoice = [];
    document.getElementById('customer-name').value = '';
    renderSaleTable();
    syncStorage();
}

// --- 6. نظام الوارد الذكي ---
function searchProduct(query) {
    const resultsDiv = document.getElementById('purchase-results');
    if (!query) { resultsDiv.style.display = 'none'; return; }

    const matches = inventoryData.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
    
    resultsDiv.innerHTML = matches.map(item => `
        <div class="search-item" onclick="selectForPurchase('${item.name}')">
            ${item.name} (المخزون الحالي: ${item.qty})
        </div>
    `).join('');
    resultsDiv.style.display = matches.length > 0 ? 'block' : 'none';
}

function selectForPurchase(name) {
    document.getElementById('purchase-search').value = name;
    document.getElementById('purchase-results').style.display = 'none';
    handleManualEntry();
}
function updateGlobalCompanyName(newName) {
    const nameElements = [
        '.invoice-company-name',  // في الفواتير
        '#display-company-name',  // في صفحة الترحيب
        '#sidebar-logo-name'      // في اللوجو (السايدبار)
    ];

    nameElements.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            el.innerText = newName;
        });
    });
}
function handleManualEntry() {
    const input = document.getElementById('purchase-search');
    const name = input.value.trim();
    if (!name) return;

    const existing = inventoryData.find(p => p.name === name);
    const newItem = {
        id: existing ? existing.id : "NEW_" + Date.now(),
        name: name,
        buy: existing ? existing.buy : 0,
        sell: existing ? existing.sell : 0,
        count: 1,
        isNew: !existing
    };

    currentInvoiceItems.push(newItem);
    input.value = '';
    renderPurchaseTable();
    input.focus();
}

function renderPurchaseTable() {
    const tbody = document.querySelector('#purchase-table tbody');
    tbody.innerHTML = currentInvoiceItems.map((item, idx) => `
        <tr>
            <td>${item.name} ${item.isNew ? '<small style="color:blue">(جديد)</small>' : ''}</td>
            <td><input type="number" value="${item.buy}" onchange="currentInvoiceItems[${idx}].buy = parseFloat(this.value); renderPurchaseTable()"></td>
            <td><input type="number" value="${item.sell}" onchange="currentInvoiceItems[${idx}].sell = parseFloat(this.value)"></td>
            <td><input type="number" value="${item.count}" onchange="currentInvoiceItems[${idx}].count = parseInt(this.value); renderPurchaseTable()"></td>
            <td>${(item.buy * item.count).toFixed(2)}</td>
            <td><button onclick="currentInvoiceItems.splice(${idx},1); renderPurchaseTable()" class="btn-delete-sm">&times;</button></td>
        </tr>
    `).join('');
    
    const total = currentInvoiceItems.reduce((sum, item) => sum + (item.buy * item.count), 0);
    document.getElementById('purchase-final-total').innerText = total.toFixed(2);
}

function processSmartPurchase() {
    if (currentInvoiceItems.length === 0) return;

    currentInvoiceItems.forEach(item => {
        const invIdx = inventoryData.findIndex(p => p.id === item.id || p.name === item.name);
        if (invIdx !== -1) {
            inventoryData[invIdx].qty += parseInt(item.count);
            inventoryData[invIdx].buy = item.buy; 
            inventoryData[invIdx].sell = item.sell;
        } else {
            inventoryData.push({
                id: Math.floor(Math.random() * 100000).toString(),
                name: item.name, cat: "عام", buy: item.buy, sell: item.sell, qty: parseInt(item.count)
            });
        }
    });

    const total = currentInvoiceItems.reduce((sum, item) => sum + (item.buy * item.count), 0);
    saveToHistory('وارد', document.getElementById('supplier-name').value || "مورد عام", total, currentInvoiceItems.length);
    
    syncStorage();
    currentInvoiceItems = [];
    document.getElementById('supplier-name').value = '';
    renderPurchaseTable();
}

// --- 7. سجل العمليات والتقارير ---
function saveToHistory(type, party, total, itemsCount, details = []) {
    const record = {
        id: Date.now(),
        date: new Date().toLocaleString('ar-EG'),
        type: type,
        party: party,
        total: total,
        itemsCount: itemsCount,
        details: details
    };
    salesHistory.unshift(record);
    syncStorage();
}

function applyAllFilters() {
    const nameQuery = document.getElementById('filter-name').value.toLowerCase();
    const dateQuery = document.getElementById('filter-date').value;
    const tbody = document.querySelector('#reports-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    salesHistory.forEach((record, index) => {
        const recordDate = new Date(record.id).toISOString().split('T')[0];
        const matchesType = (currentFilterType === 'الكل' || record.type === currentFilterType);
        const matchesName = (!nameQuery || record.party.toLowerCase().includes(nameQuery));
        const matchesDate = (!dateQuery || recordDate === dateQuery);

        if (matchesType && matchesName && matchesDate) {
            const typeBadge = record.type === 'صادر' ? 'badge-out' : 'badge-in';
            tbody.innerHTML += `
                <tr>
                    <td>#${record.id.toString().slice(-6)}</td>
                    <td>${record.date}</td>
                    <td><span class="badge ${typeBadge}">${record.type}</span></td>
                    <td>${record.party}</td>
                    <td>${record.itemsCount} أصناف</td>
                    <td style="font-weight:bold">${record.total.toFixed(2)} ج.م</td>
                
<td>
    <button onclick="viewOldInvoice(${index})" class="btn-view-sm" title="معاينة الفاتورة">
        <i class="fas fa-eye"></i>
    </button>
    
    <button onclick="deleteInvoice(${index})" class="btn-delete-sm" title="حذف">
        <i class="fas fa-trash"></i>
    </button>
</td>
                </tr>`;
        }
    });
}function viewOldInvoice(index) {
    const record = salesHistory[index];
    if (!record.details || record.details.length === 0) {
        alert("عذراً، لا توجد تفاصيل أصناف لهذه الفاتورة.");
        return;
    }
    // بنجهز السلة مؤقتاً عشان دالة الطباعة تشتغل
    saleCart = record.details; 
    printInvoice(record.party, record.total, record.id);
    // بنصفرها تاني عشان متأثرش على مبيعاتك الحالية
    saleCart = []; 
}

function deleteInvoice(index) {
    salesHistory.splice(index, 1);
    syncStorage();
    applyAllFilters();
}

// --- نظام البيع والطباعة المتقدم ---
let saleCart = []; 

function saleSearch(query) {
    const resultsDiv = document.getElementById('sale-search-results');
    const input = query.trim().toLowerCase();
    if (!input) { resultsDiv.style.display = 'none'; return; }

    const matches = inventoryData.filter(item => 
        item.name.toLowerCase().includes(input) || item.id.toString().includes(input)
    );

    resultsDiv.innerHTML = matches.map(item => `
        <div class="search-item" onclick="saleAddToCart('${item.id}')" style="padding:10px; cursor:pointer; border-bottom:1px solid #eee;">
            <strong>${item.name}</strong> (${item.qty})
        </div>
    `).join('');
    resultsDiv.style.display = 'block';
}

function saleAddToCart(productId) {
    const product = inventoryData.find(p => p.id == productId);
    if (!product || product.qty <= 0) return;

    const existing = saleCart.find(item => item.id === product.id);
    if (existing) {
        if (existing.count < product.qty) existing.count++;
    } else {
        // ضيفنا خاصية التعديل هنا
        saleCart.push({ ...product, count: 1, isEditing: false });
    }
    
    saleRenderTable();
}
function saleRenderTable() {
    const tbody = document.querySelector('#sale-invoice-table tbody');
    let total = 0;
    tbody.innerHTML = '';

    saleCart.forEach((item, index) => {
        const rowTotal = item.sell * item.count;
        total += rowTotal;

        // التحقق من حالة التعديل
        if (item.isEditing) {
            tbody.innerHTML += `
                <tr class="editing-row">
                    <td>${item.name}</td>
                    <td><input type="number" id="edit-price-${index}" class="edit-input" value="${item.sell}"></td>
                    <td><input type="number" id="edit-qty-${index}" class="edit-input" value="${item.count}"></td>
                    <td>${rowTotal.toFixed(2)}</td>
                    <td>
                        <button onclick="saveRowEdit(${index})" class="btn-action save" title="حفظ"><i class="fas fa-check"></i></button>
                        <button onclick="cancelRowEdit(${index})" class="btn-action cancel" title="إلغاء"><i class="fas fa-times"></i></button>
                    </td>
                </tr>`;
        } else {
            tbody.innerHTML += `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.sell}</td>
                    <td>${item.count}</td>
                    <td>${rowTotal.toFixed(2)}</td>
                    <td>
                        <button onclick="toggleRowEdit(${index})" class="btn-action edit" title="تعديل"><i class="fas fa-pen"></i></button>
                        <button onclick="saleRemoveItem(${index})" class="btn-action delete" title="حذف"><i class="fas fa-trash-alt"></i></button>
                    </td>
                </tr>`;
        }
    });
    document.getElementById('sale-grand-total').innerText = total.toFixed(2);
}

// دالة الإلغاء
function cancelRowEdit(index) {
    saleCart[index].isEditing = false;
    saleRenderTable();
}
// فتح خانات الإدخال
function toggleRowEdit(index) {
    saleCart[index].isEditing = true;
    saleRenderTable();
}

// حفظ البيانات الجديدة وإغلاق الخانات
function saveRowEdit(index) {
    const newQty = parseInt(document.getElementById(`edit-qty-${index}`).value);
    const newPrice = parseFloat(document.getElementById(`edit-price-${index}`).value);
    
    // فحص المخزن قبل الحفظ
    const original = inventoryData.find(p => p.id === saleCart[index].id);
    if (newQty > original.qty) {
        alert("الكمية المطلوبة أكبر من المتوفر بالمخزن!");
        return;
    }

    saleCart[index].count = newQty;
    saleCart[index].sell = newPrice;
    saleCart[index].isEditing = false; // نرجعها نص عادي
    saleRenderTable();
}
function saleUpdateQty(index, val) {
    const n = parseInt(val);
    const max = saleCart[index].qty;
    saleCart[index].count = (n > max) ? max : (n < 1 ? 1 : n);
    saleRenderTable();
}

function saleRemoveItem(index) {
    saleCart.splice(index, 1);
    saleRenderTable();
}
function autoFillCustomerPhone() {
    const nameInput = document.getElementById('sale-customer-name').value.trim();
    const phoneInput = document.getElementById('sale-customer-phone');
    
    // بندور في قائمة العملاء اللي خزناها (اسم | رقم)
    const customersArray = Array.from(allCustomersSet);
    const match = customersArray.find(c => c.startsWith(nameInput + " | "));
    
    if (match && phoneInput) {
        const [name, phone] = match.split(' | ');
        phoneInput.value = phone;
    }
}
function saleProcessInvoice() {
    try {
        if (saleCart.length === 0) {
            alert("السلة فارغة!");
            return;
        }

        // 1. مسك العناصر
        const nameInp = document.getElementById('sale-customer-name');
        const phoneInp = document.getElementById('sale-customer-phone');
        
        // 2. سحب القيم في متغيرات ثابتة "قبل التصفير"
        const customer = nameInp ? nameInp.value.trim() : "عميل نقدي";
        const phone = phoneInp ? phoneInp.value.trim() : "";
        const total = saleCart.reduce((sum, item) => sum + (item.sell * item.count), 0);
        const invoiceId = Date.now();

        // 3. التصفير الإجباري واللحظي (هنا السر)
        if (nameInp) nameInp.value = '';
        if (phoneInp) phoneInp.value = '';

        // 4. حفظ الاسم والرقم في القائمة الدائمة (اللحام)
        if (customer !== "" && customer !== "عميل نقدي") {
            const fullEntry = phone ? `${customer} | ${phone}` : customer;
            allCustomersSet.add(fullEntry); 
            localStorage.setItem('saved_customers', JSON.stringify(Array.from(allCustomersSet)));
        }

        // 5. تحديث المخزن (خصم الكميات)
        saleCart.forEach(item => {
            const prodIndex = inventoryData.findIndex(p => p.id === item.id);
            if (prodIndex !== -1) {
                inventoryData[prodIndex].qty -= item.count;
            }
        });

        // 6. حفظ الفاتورة في السجل التاريخي (بما فيها الرقم)
        const transaction = { 
            id: invoiceId, 
            date: new Date().toLocaleString('ar-EG'),
            party: customer, 
            phone: phone, 
            total: total,
            details: [...saleCart] 
        };
        salesHistory.unshift(transaction);
        localStorage.setItem('mySalesHistory', JSON.stringify(salesHistory));

        // 7. المزامنة والطباعة
        if (typeof syncStorage === "function") syncStorage();
        if (typeof loadInventory === "function") loadInventory();
        if (typeof updateDashboard === "function") updateDashboard();
        if (typeof renderPeopleList === "function") renderPeopleList();
        
        // أمر الطباعة
        if (typeof printInvoice === "function") {
            printInvoice(customer, total, invoiceId);
        }

        // 8. تنظيف الجدول (السلة)
        if (typeof saleClearInvoice === "function") saleClearInvoice();

        

    } catch (e) {
        console.error("عطل في العملية:", e);
        // محاولة تصفير أخيرة في حالة حدوث خطأ كارثي
        document.getElementById('sale-customer-name').value = '';
        document.getElementById('sale-customer-phone').value = '';
    }
}
function printInvoice(customer, total, invoiceId) {
    const printWindow = window.open('', '', 'height=800,width=900');
    let totalQty = 0;
    let itemsHtml = saleCart.map((item, index) => {
        totalQty += item.count;
        return `<tr><td>${index + 1}</td><td style="text-align: right;">${item.name}</td><td>${item.count}</td><td>${item.sell.toLocaleString()}</td><td>${(item.sell * item.count).toLocaleString()}</td></tr>`;
    }).join('');
// 1. أول سطر في الدالة: هات اسم الشركة المخزن
const savedCompanyName = localStorage.getItem('company_name') || "اسم الشركة الافتراضي";

// 2. جوه الـ printWindow.document.write عدل الجزء ده:
printWindow.document.write(`
    <html dir="rtl">
    <head>
        <title>فاتورة #${invoiceId}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
            body { font-family: 'Cairo', sans-serif; padding: 0; margin: 0; color: #333; font-size: 12px; }
            .invoice-card { width: 90%; max-width: 600px; margin: 10px auto; padding: 15px; border: 1px solid #eee; }
            .header-flex { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
            /* تعديل استايل اسم الشركة ليكون أوضح */
            .brand h1 { margin: 0; color: #3498db; font-size: 22px; font-weight: 700; }
            .brand small { font-size: 14px; color: #666; display: block; margin-top: 5px; }
            
            .main-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .main-table th { background-color: #f8f9fa; border-bottom: 1px solid #333; padding: 8px; }
            .main-table td { padding: 8px; border-bottom: 1px solid #eee; text-align: center; }
            .grand-total { font-weight: bold; font-size: 16px; border-top: 2px solid #3498db; margin-top: 15px; padding-top: 10px; text-align: left; }
        </style>
    </head>
    <body>
        <div class="invoice-card">
            <div class="header-flex">
                <div class="brand">
                    <h1>${savedCompanyName}</h1> 
                    <small>فاتورة مبيعات</small>
                </div>
                <div>
                    <strong>رقم الفاتورة:</strong> #${invoiceId.toString().slice(-6)}<br>
                    <strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-EG')}
                </div>
            </div>
            
            <div style="margin: 15px 0;">
                <strong>العميل:</strong> ${customer}
            </div>

            <table class="main-table">
                <thead>
                    <tr>
                        <th>م</th>
                        <th>الصنف</th>
                        <th>كمية</th>
                        <th>سعر</th>
                        <th>إجمالي</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            
            <div class="grand-total">
                الإجمالي النهائي: ${total.toLocaleString()} ج.م
            </div>
            
            <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #999;">
                شكراً لتعاملكم مع ${savedCompanyName}
            </div>
        </div>
        <script>window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 300); };</script>
    </body>
    </html>
`);
    printWindow.document.close();
}

function saleClearInvoice() {
    saleCart = [];
    document.getElementById('sale-customer-name').value = '';
    saleRenderTable();
}

// المتغير ده هيشيل القسم اللي المستخدم داس عليه ومستني الباسوورد
let pendingSection = "";



// --- حماية البرنامج بالكامل عند الفتح ---
function checkMainPass() {
    const input = document.getElementById('main-pass');
    const overlay = document.getElementById('main-login-overlay');
    
    if (input.value === PASSWORDS.main) {
        overlay.style.opacity = '0'; // تأثير اختفاء ناعم
        setTimeout(() => overlay.style.display = 'none', 500);
        sessionStorage.setItem('mainAuth', 'true');
    } else {
        // حركة اهتزاز لو الباسوورد غلط
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 400);
        input.value = "";
    }
}

// --- دالة التبديل بين الأقسام المحدثة ---
function showSection(sectionId) {
    // 1. لو القسم محتاج حماية
    if (sectionId === 'dashboard-section' || sectionId === 'inventory') {
        pendingSection = sectionId;
        // افتح الـ Modal اللي عملناه في الـ HTML
        document.getElementById('password-modal').style.display = 'flex';
        document.getElementById('section-pass-input').focus();
        return; 
    }

    // 2. لو القسم مش محمي (زي المبيعات مثلاً) افتحه فوراً
    actualSwitch(sectionId);
}

// --- التحقق من باسوورد القسم جوه الـ Modal ---
function verifySectionPass() {
    const input = document.getElementById('section-pass-input');
    const passType = pendingSection === 'dashboard-section' ? 'dashboard' : 'inventory';
    const modalContent = document.querySelector('.auth-modal');

    if (input.value === PASSWORDS[passType]) {
        actualSwitch(pendingSection); // افتح القسم
        closePassModal();             // اقفل المودال
    } else {
        // لو غلط اهتزاز ومسح الخانة
        modalContent.classList.add('shake');
        setTimeout(() => modalContent.classList.remove('shake'), 400);
        input.value = "";
    }
}

// الدالة المسؤولة عن الإخفاء والإظهار الفعلي
function actualSwitch(id) {
    // إخفاء كل الأقسام
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    
    // إظهار القسم المطلوب
    const targetSection = document.getElementById(id);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // تحديث البيانات بناءً على القسم المختار
    if (id === 'dashboard-section') {
        updateDashboard();
    } else if (id === 'inventory') {
        loadInventory();
    } else if (id === 'reports') {
        applyAllFilters();
    }

    // إخفاء حالة "النشط" من القائمة الجانبية
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
}

function closePassModal() {
    document.getElementById('password-modal').style.display = 'none';
    document.getElementById('section-pass-input').value = "";
}

// تشغيل الـ Enter للدخول السريع
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (document.getElementById('main-login-overlay').style.display !== 'none') {
            checkMainPass();
        } else if (document.getElementById('password-modal').style.display === 'flex') {
            verifySectionPass();
        }
    }
});
// تحديث الوقت والتاريخ في صفحة الترحيب
function updateWelcomeClock() {
    const now = new Date();
    if(document.getElementById('welcome-date')) {
        document.getElementById('welcome-date').innerText = now.toLocaleDateString('ar-EG');
        document.getElementById('welcome-time').innerText = now.toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'});
    }
}

// تعديل بداية التشغيل


const compName = document.getElementById('new-company-name').value;
if (compName) {
    localStorage.setItem('company_name', compName);
    document.getElementById('display-company-name').innerText = compName;
}
// دالة حفظ الإعدادات وكلمات المرور واسم الشركة
// دالة حفظ الإعدادات وكلمات المرور واسم الشركة
function saveNewPasswords() {
    try {
        // 1. جلب القيم من الحقول
        const mainInp = document.getElementById('new-main-pass').value;
        const dashInp = document.getElementById('new-dash-pass').value;
        const invInp = document.getElementById('new-inv-pass').value;
        const compInp = document.getElementById('new-company-name').value;

        // 2. حفظ اسم الشركة لو تم إدخاله
        if (compInp.trim() !== "") {
            localStorage.setItem('company_name', compInp);
            // تحديث الاسم في الواجهة فوراً
            if (document.getElementById('display-company-name')) {
                document.getElementById('display-company-name').innerText = compInp;
            }
            // تحديث الاسم في اللوجو وفواتير الطباعة
            updateGlobalCompanyName(compInp);
        }

        // 3. تحديث كلمات المرور (تأكد أن كائن PASSWORDS معرف في أول الملف)
        if (mainInp) PASSWORDS.main = mainInp;
        if (dashInp) PASSWORDS.dashboard = dashInp;
        if (invInp) PASSWORDS.inventory = invInp;

        // 4. حفظ كلمات المرور في الذاكرة
        localStorage.setItem('myPasswords', JSON.stringify(PASSWORDS));

        alert("تم حفظ الإعدادات واسم الشركة بنجاح!");
        
        // مسح الخانات بعد الحفظ للأمان
        document.getElementById('new-main-pass').value = "";
        document.getElementById('new-dash-pass').value = "";
        document.getElementById('new-inv-pass').value = "";

    } catch (error) {
        console.error("خطأ في حفظ الإعدادات:", error);
        alert("حدث خطأ أثناء الحفظ");
    }
}
// دالة لتحديث اسم الشركة في كل مكان في الصفحة
function updateGlobalCompanyName(newName) {
    const nameElements = [
        '.invoice-company-name', // اسم الشركة في الفواتير
        '#display-company-name', // اسم الشركة في صفحة الترحيب
        '.logo span'             // اسم الشركة في السايدبار
    ];

    nameElements.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            el.innerText = newName;
        });
    });
}

// تعديل دالة saveNewPasswords السابقة لتشمل التحديث العام
function saveNewPasswords() {
    const compInp = document.getElementById('new-company-name').value;
    
    if (compInp) {
        localStorage.setItem('company_name', compInp);
        updateGlobalCompanyName(compInp); // تحديث فوري بدون ريفريش
    }

    // ... باقي كود حفظ الباسووردات اللي عملناه ...
    localStorage.setItem('app_passwords', JSON.stringify(PASSWORDS));

}
// اسمع لأزرار الكيبورد جوه الجدول
document.addEventListener('keydown', function(e) {
    if (e.target.classList.contains('edit-input')) {
        const index = e.target.id.split('-').pop(); // بيجيب الـ index من الـ id
        
        if (e.key === 'Enter') {
            saveRowEdit(index);
        } else if (e.key === 'Escape') {
            cancelRowEdit(index);
        }
    }
});
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('keydown', (e) => {
    // Alt + S يفتح المبيعات
    if (e.altKey && e.key === 's') showSection('sales-section');
    // Alt + I يفتح المخزن
    if (e.altKey && e.key === 'i') showSection('inventory');
    // F9 يحفظ الفاتورة فوراً
    if (e.key === 'F9') saleProcessInvoice();
});
// استرجاع الباسووردات المخزنة أو استخدام الافتراضية لو أول مرة يفتح
const DEFAULT_PASSWORDS = { main: "123", dashboard: "123", inventory: "123" };
let PASSWORDS = JSON.parse(localStorage.getItem('app_passwords')) || DEFAULT_PASSWORDS;
function saveNewPasswords() {
    try {
        const mainInp = document.getElementById('new-main-pass').value;
        const dashInp = document.getElementById('new-dash-pass').value;
        const invInp = document.getElementById('new-inv-pass').value;
        const compInp = document.getElementById('new-company-name').value;

        // 1. تحديث الكائن PASSWORDS بالقيم الجديدة فقط لو تم إدخالها
        if (mainInp) PASSWORDS.main = mainInp;
        if (dashInp) PASSWORDS.dashboard = dashInp;
        if (invInp) PASSWORDS.inventory = invInp;

        // 2. الحفظ النهائي في الذاكرة
        localStorage.setItem('app_passwords', JSON.stringify(PASSWORDS));

        // 3. حفظ اسم الشركة وتحديثه
        if (compInp) {
            localStorage.setItem('company_name', compInp);
            updateGlobalCompanyName(compInp); // دالة لتحديث الاسم في كل مكان
        }

    
        // إعادة تحميل الصفحة لتطبيق التغييرات بشكل كامل
        location.reload(); 

    } catch (error) {
        console.error("خطأ:", error);
    
    }
}

function updateGlobalCompanyName(newName) {
    // تحديث الاسم في صفحة الترحيب
    const welcomeName = document.getElementById('display-company-name');
    if (welcomeName) welcomeName.innerText = newName;

    // تحديث الاسم في السايدبار (اللوجو)
    const sidebarName = document.getElementById('sidebar-logo-name');
    if (sidebarName) sidebarName.innerText = newName;

    // تحديث العنوان في الفواتير (لو موجودة)
    document.querySelectorAll('.invoice-company-name').forEach(el => {
        el.innerText = newName;
    });
}
