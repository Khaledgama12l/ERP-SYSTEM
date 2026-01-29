let currentPeopleType = 'customers';

function togglePeopleList(type) {
    currentPeopleType = type;
    // تبديل شكل الأزرار
    document.getElementById('btn-cust').classList.toggle('active', type === 'customers');
    document.getElementById('btn-supp').classList.toggle('active', type === 'suppliers');
    // تحديث القائمة
    renderPeopleList();
}

function renderPeopleList() {
    const searchVal = document.getElementById('people-search').value.toLowerCase();
    const listUl = document.getElementById('dynamic-people-list');
    
    // جلب البيانات من السجلات (Set)
    let names = currentPeopleType === 'customers' ? Array.from(allCustomersSet) : Array.from(allSuppliersSet);
    
    const filtered = names.filter(n => n.toLowerCase().includes(searchVal));
    
    listUl.innerHTML = filtered.map(name => `
        <li><i class="fas fa-user-circle" style="color:#64748b"></i> ${name}</li>
    `).join('') || '<li style="color:gray">لا توجد نتائج</li>';
}

function filterPeopleList() {
    renderPeopleList();
}
let currentType = '';

// --- نافذة العملاء والموردين ---
function openPeopleModal(type) {
    currentType = type;
    document.getElementById('people-modal').style.display = 'flex';
    document.getElementById('modal-title').innerText = type === 'customers' ? 'قائمة العملاء' : 'قائمة الموردين';
    renderPeopleList();
}
function closePeopleModal() { document.getElementById('people-modal').style.display = 'none'; }

function renderPeopleList() {
    const listUl = document.getElementById('modal-items-list');
    const search = document.getElementById('modal-search-input').value.toLowerCase();
    let names = currentType === 'customers' ? Array.from(allCustomersSet) : Array.from(allSuppliersSet);
    
    listUl.innerHTML = names.filter(n => n.toLowerCase().includes(search)).map(n => 
        `<li style="padding:10px; border-bottom:1px solid #eee;"><i class="fas fa-user-circle"></i> ${n}</li>`
    ).join('') || '<li>لا نتائج</li>';
}
function filterModalList() { renderPeopleList(); }

// --- نافذة السجلات (أرباح ومصروفات) ---
function openLogsModal(type) {
    currentType = type;
    document.getElementById('logs-modal').style.display = 'flex';
    const head = document.getElementById('logs-table-head');
    
    if(type === 'profit') {
        document.getElementById('logs-modal-title').innerText = 'سجل أرباح اليوم';
        head.innerHTML = `<tr><th>الوقت</th><th>البيان</th><th>المبلغ</th><th>الربح</th></tr>`;
    } else {
        document.getElementById('logs-modal-title').innerText = 'سجل المصروفات';
        head.innerHTML = `<tr><th>التاريخ</th><th>البند</th><th>المبلغ</th><th>ملاحظات</th></tr>`;
    }
    renderLogsTable();
}
function closeLogsModal() { document.getElementById('logs-modal').style.display = 'none'; }

function renderLogsTable() {
    const body = document.getElementById('logs-table-body');
    const search = document.getElementById('logs-search-input').value.toLowerCase();
    let html = '';

    if (currentType === 'profit') {
        // فلترة سجل مبيعات اليوم (بافتراض وجود مصفوفة salesHistory)
        salesHistory.filter(inv => inv.type === 'صادر' && inv.party.toLowerCase().includes(search)).forEach(inv => {
            let profit = inv.details.reduce((a, b) => a + ((b.sell - b.buy) * b.count), 0);
            html += `<tr><td>${inv.id.split('T')[1].substring(0,5)}</td><td>بيع لـ ${inv.party}</td><td>${inv.total}</td><td style="color:green">+${profit}</td></tr>`;
        });
    } else {
        // سجل المصروفات (بافتراض وجود مصفوفة expensesData)
        expensesData.filter(ex => ex.title.toLowerCase().includes(search)).forEach(ex => {
            html += `<tr><td>${ex.date}</td><td>${ex.title}</td><td style="color:red">${ex.amount}</td><td>${ex.notes}</td></tr>`;
        });
    }
    body.innerHTML = html || '<tr><td colspan="4" style="text-align:center;">لا توجد بيانات</td></tr>';
}
function filterLogsTable() { renderLogsTable(); }








function updateDashboardFinances() {
    let today = new Date().toISOString().split('T')[0]; // تاريخ اليوم YYYY-MM-DD
    let currentMonth = today.substring(0, 7); // الشهر الحالي YYYY-MM

    let todaySales = 0;
    let todayProfit = 0;
    let monthProfit = 0;

    // تأكد أن salesHistory هي المصفوفة التي تخزن فيها فواتيرك
    salesHistory.forEach(invoice => {
        let invDate = new Date(invoice.id).toISOString().split('T')[0];
        
        if (invoice.type === 'صادر') {
            // حساب الربح للفاتورة الواحدة (سعر البيع - سعر الشراء) لكل صنف
            let invProfit = 0;
            if (invoice.details) {
                invoice.details.forEach(item => {
                    // الربح = (سعر البيع الحالي - سعر التكلفة المخزن) * الكمية
                    invProfit += (Number(item.sell) - Number(item.buy)) * Number(item.count);
                });
            }

            // إذا كانت الفاتورة بتاريخ اليوم
            if (invDate === today) {
                todaySales += Number(invoice.total);
                todayProfit += invProfit;
            }

            // إذا كانت الفاتورة في الشهر الحالي
            if (invDate.startsWith(currentMonth)) {
                monthProfit += invProfit;
            }
        }
    });

    // تحديث الأرقام في الواجهة (تأكد من مطابقة الـ IDs)
    document.getElementById('dash-today-sales').innerText = todaySales.toFixed(2);
    document.getElementById('dash-today-profit').innerText = todayProfit.toFixed(2);
    document.getElementById('dash-month-profit').innerText = monthProfit.toFixed(2);
}
// 1. دالة التبديل الذكية
function showSection(id) {
    const protectedSections = ['dashboard-section', 'inventory'];

    if (protectedSections.includes(id)) {
        pendingSection = id;
        const modal = document.getElementById('password-modal');
        if (modal) {
            modal.style.display = 'flex';
            document.getElementById('section-pass-input').value = '';
            document.getElementById('section-pass-input').focus();
            return; 
        }
    }
    actualSwitch(id);
}

// 2. دالة التأكيد (مفتاح تشغيل الأرباح)
function verifySectionPass() {
    const input = document.getElementById('section-pass-input');
    const savedPass = localStorage.getItem('dash_pass') || '123';

    if (input.value === savedPass) {
        document.getElementById('password-modal').style.display = 'none';
        
        // تنفيذ التبديل
        actualSwitch(pendingSection);

        // أهم سطر: تحديث الأرباح فوراً بعد التأكد من الباسوورد
        if (pendingSection === 'dashboard-section') {
            setTimeout(() => {
                if (typeof updateDashboardFinances === 'function') updateDashboardFinances();
                if (typeof renderLogsTable === 'function') renderLogsTable();
            }, 100); // تأخير بسيط لضمان ظهور السكشن في المتصفح
        }
    } else {
        alert("كلمة المرور غلط!");
        input.value = '';
    }
}

let lowStockCount = 0;
inventoryData.forEach(product => {
    if (Number(product.qty) <= 5) { // افترضنا أن حد النقص هو 5 قطع
        lowStockCount++;
    }
});
document.getElementById('dash-low-stock').innerText = lowStockCount;


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

    const supplierInput = document.getElementById('supplier-name'); // تعريف العنصر
    const supplierName = supplierInput.value.trim() || "مورد عام";
    const total = currentInvoiceItems.reduce((sum, item) => sum + (item.buy * item.count), 0);
    
    saveToHistory('وارد', supplierName, total, currentInvoiceItems.length);

    // --- الجزء الجديد لإضافة المورد للقائمة ---
    if (supplierName !== "مورد عام") {
        allSuppliersSet.add(supplierName); // إضافة للاسم للـ Set
        // حفظ القائمة المحدثة في الـ LocalStorage
        localStorage.setItem('saved_suppliers', JSON.stringify(Array.from(allSuppliersSet)));
    }
    // ---------------------------------------
    
    syncStorage();
    currentInvoiceItems = [];
    supplierInput.value = ''; // تصفير الخانة
    renderPurchaseTable();
    
    // تحديث الأرقام في الداشبورد لو مفتوحة
    if(typeof updateDashboardFinances === 'function') updateDashboardFinances();
}















































// تعريف الدالة المفقودة لمنع توقف الكود
function autoFillCustomerPhone() {
    const nameVal = document.getElementById('sale-customer-name').value.trim();
    const phoneInput = document.getElementById('sale-customer-phone');
    
    // البحث في الذاكرة عن رقم مطابق للاسم
    const customerList = Array.from(allCustomersSet);
    const match = customerList.find(c => c.startsWith(nameVal + " | "));
    
    if (match && phoneInput) {
        phoneInput.value = match.split(" | ")[1];
    }
}

function renderPeopleList() {
    const listUl = document.getElementById('modal-items-list');
    const search = document.getElementById('modal-search-input').value.toLowerCase();
    
    // هنجيب البيانات سواء عملاء أو موردين
    let entries = currentType === 'customers' ? Array.from(allCustomersSet) : Array.from(allSuppliersSet);
    
    listUl.innerHTML = entries.filter(item => item.toLowerCase().includes(search)).map(item => {
        // بنقسم السطر لنصين عند علامة الـ |
        let name = item;
        let phone = "---"; // القيمة الافتراضية لو مفيش رقم

        if (item.includes(' | ')) {
            const parts = item.split(' | ');
            name = parts[0];   // الاسم قبل العلامة
            phone = parts[1];  // الرقم بعد العلامة
        }

        return `
            <li style="padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-weight: bold;">
                    <i class="fas fa-user" style="margin-left: 8px; color: #555;"></i> ${name}
                </div>
                <div style="color: #27ae60; font-family: monospace; font-size: 1.1em; font-weight: bold;">
                    <i class="fas fa-phone-alt" style="font-size: 0.8em; margin-left: 5px;"></i> ${phone}
                </div>
            </li>
        `;
    }).join('') || '<li style="padding: 20px; text-align: center; color: #888;">لا توجد نتائج</li>';
}
