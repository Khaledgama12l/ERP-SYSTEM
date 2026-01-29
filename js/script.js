// --- 1. تهيئة البيانات وتحميلها من الذاكرة المحلية ---
let inventoryData = JSON.parse(localStorage.getItem('myInventory')) || [];
let categories = JSON.parse(localStorage.getItem('myCategories')) || ["إلكترونيات", "أدوات منزلية"];
let salesHistory = JSON.parse(localStorage.getItem('mySalesHistory')) || [];

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

    inventoryData.forEach(item => {
        totalStockValue += (parseFloat(item.buy) * parseInt(item.qty));
        expectedProfit += ((parseFloat(item.sell) - parseFloat(item.buy)) * parseInt(item.qty));
        if (parseInt(item.qty) < 5) lowStockCount++;
    });

    const today = new Date().toLocaleDateString('ar-EG');
    let todaySales = 0;

    salesHistory.forEach(record => {
        // فحص مبيعات اليوم فقط من السجل
        if (record.date.split(' ')[0] === today && record.type === 'صادر') {
            todaySales += record.total;
        }
    });

    // تحديث الواجهة
    document.getElementById('dash-total-value').innerText = totalStockValue.toLocaleString() + " ج.م";
    document.getElementById('dash-expected-profit').innerText = expectedProfit.toLocaleString() + " ج.م";
    document.getElementById('dash-low-stock').innerText = lowStockCount;
    document.getElementById('dash-today-sales').innerText = todaySales.toLocaleString() + " ج.م";
}
function updateDashboard() {
    let totalValue = 0, profit = 0, lowStock = 0;
    
    inventoryData.forEach(p => {
        totalValue += (Number(p.buy) * Number(p.qty));
        profit += ((Number(p.sell) - Number(p.buy)) * Number(p.qty));
        if (Number(p.qty) < 5) lowStock++;
    });

    document.getElementById('dash-total-value').innerText = totalValue.toLocaleString() + ' ج.م';
    document.getElementById('dash-expected-profit').innerText = profit.toLocaleString() + ' ج.م';
    document.getElementById('dash-low-stock').innerText = lowStock;
    // ... باقي حساب مبيعات اليوم ...
}
function closeModal(id) {
    document.getElementById(id).style.display = 'none';
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
    const editId = document.getElementById('edit-id').value;
    const prod = {
        id: editId || Math.floor(Math.random() * 100000).toString(),
        name: document.getElementById('m-name').value,
        cat: document.getElementById('m-category').value,
        buy: document.getElementById('m-buy').value,
        sell: document.getElementById('m-sell').value,
        qty: parseInt(document.getElementById('m-qty').value) || 0
    };

    if (editId) {
        const idx = inventoryData.findIndex(i => i.id === editId);
        inventoryData[idx] = prod;
    } else {
        inventoryData.push(prod);
    }
    syncStorage();
    closeModal('productModal');
    loadInventory();
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
function searchProductForPurchase(query) {
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
                    <td><button onclick="deleteInvoice(${index})" class="btn-delete-sm"><i class="fas fa-trash"></i></button></td>
                </tr>`;
        }
    });
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
        saleCart.push({ ...product, count: 1 });
    }
    
    document.getElementById('sale-search-input').value = '';
    document.getElementById('sale-search-results').style.display = 'none';
    saleRenderTable();
}

function saleRenderTable() {
    const tbody = document.querySelector('#sale-invoice-table tbody');
    let total = 0;
    tbody.innerHTML = '';

    saleCart.forEach((item, index) => {
        const rowTotal = item.sell * item.count;
        total += rowTotal;
        tbody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td>${item.sell}</td>
                <td><input type="number" value="${item.count}" min="1" onchange="saleUpdateQty(${index}, this.value)" style="width:50px"></td>
                <td>${rowTotal.toFixed(2)}</td>
                <td><button onclick="saleRemoveItem(${index})">×</button></td>
            </tr>`;
    });
    document.getElementById('sale-grand-total').innerText = total.toFixed(2);
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

function saleProcessInvoice() {
    if (saleCart.length === 0) return;

    const total = saleCart.reduce((sum, item) => sum + (item.sell * item.count), 0);
    const customer = document.getElementById('sale-customer-name').value || "عميل نقدي";
    const invoiceId = Date.now();

    const transaction = {
        id: invoiceId,
        date: new Date().toLocaleString('ar-EG'),
        type: 'صادر',
        party: customer,
        itemsCount: saleCart.length,
        total: total, 
        details: [...saleCart]
    };

    salesHistory.unshift(transaction);
    localStorage.setItem('mySalesHistory', JSON.stringify(salesHistory));

    saleCart.forEach(item => {
        const prodIndex = inventoryData.findIndex(p => p.id === item.id);
        if (prodIndex !== -1) {
            inventoryData[prodIndex].qty -= item.count;
        }
    });
    localStorage.setItem('myInventory', JSON.stringify(inventoryData));

    if (typeof loadInventory === "function") loadInventory();
    if (typeof applyAllFilters === "function") applyAllFilters();

    printInvoice(customer, total, invoiceId);
    saleClearInvoice();
}
window.onload = () => {
    const savedName = localStorage.getItem('company_name') || "شركتي الافتراضية";
    updateGlobalCompanyName(savedName);
    
    // باقي دوالك القديمة...
    loadInventory();
};
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

window.onload = () => {
    updateCategoryDropdowns();
    loadInventory();
    applyAllFilters();
    
    // لو مفيش جلسة دخول، أظهر شاشة القفل الرئيسية
    if (!sessionStorage.getItem('mainAuth')) {
        document.getElementById('main-login-overlay').style.display = 'flex';
    } else {
        document.getElementById('main-login-overlay').style.display = 'none';
    }
};
// المتغير ده هيشيل القسم اللي المستخدم داس عليه ومستني الباسوورد
let pendingSection = "";

const PASSWORDS = {
    main: "123",        // للبرنامج كله
    dashboard: "dash",  // للوحة التحكم
    inventory: "inv"    // للمخزن
};

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
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    
    // تحديث الشكل النشط في السايدبار (اختياري)
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    // تقدر تضيف كود يحدد العنصر النشط هنا
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
window.onload = () => {
    updateCategoryDropdowns();
    loadInventory();
    applyAllFilters();
    setInterval(updateWelcomeClock, 1000); // تحديث الساعة كل ثانية

    // إجبار البرنامج يفتح على صفحة الترحيب
    showSection('welcome-section');
    
    if (!sessionStorage.getItem('mainAuth')) {
        document.getElementById('main-login-overlay').style.display = 'flex';
    }
};

// تعديل بسيط في دالة التبديل عشان تشيل "active" من الزراير لو رجعنا للترحيب
function actualSwitch(id) {
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    
    // إخفاء الـ active من السايدبار لو فاتحين صفحة الترحيب
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
}
const compName = document.getElementById('new-company-name').value;
if (compName) {
    localStorage.setItem('company_name', compName);
    document.getElementById('display-company-name').innerText = compName;
}
// دالة حفظ الإعدادات وكلمات المرور واسم الشركة
function saveNewPasswords() {
    console.log("جاري حفظ التغييرات..."); // للتأكد من استدعاء الدالة

    try {
        // جلب المدخلات
        const mainInp = document.getElementById('new-main-pass').value;
        const dashInp = document.getElementById('new-dash-pass').value;
        const invInp = document.getElementById('new-inv-pass').value;
        const compInp = document.getElementById('new-company-name').value;

        // 1. تحديث كلمات المرور لو الخانات مش فاضية
        if (mainInp) PASSWORDS.main = mainInp;
        if (dashInp) PASSWORDS.dashboard = dashInp;
        if (invInp) PASSWORDS.inventory = invInp;

        // 2. حفظ كلمات المرور في التخزين المحلي
        localStorage.setItem('app_passwords', JSON.stringify(PASSWORDS));

        // 3. حفظ وتحديث اسم الشركة
        if (compInp) {
            localStorage.setItem('company_name', compInp);
            // تحديث النص في صفحة الترحيب فوراً
            const welcomeTitle = document.getElementById('display-company-name');
            if (welcomeTitle) welcomeTitle.innerText = compInp;
        }

     
        // مسح الخانات بعد الحفظ (اختياري)
        document.getElementById('new-main-pass').value = '';
        document.getElementById('new-dash-pass').value = '';
        document.getElementById('new-inv-pass').value = '';
        document.getElementById('new-company-name').value = '';

    } catch (error) {
        console.error("خطأ أثناء الحفظ:", error);
        alert("حدث خطأ أثناء حفظ البيانات، راجع الكونسول.");
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