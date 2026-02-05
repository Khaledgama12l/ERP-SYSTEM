window.addNewItemToPurchaseTable = function() {
    const name = document.getElementById('purchase-search').value;
    const qty = parseFloat(document.getElementById('purchase-qty-input').value) || 0;
    const wh = document.getElementById('target-warehouse').value;
    const cat = document.getElementById('target-category').value;

    if (!name || qty <= 0) return;

    currentPurchaseItems.push({ name, qty, warehouse: wh, category: cat, buyPrice: 0, sellPrice: 0 });
    renderPurchaseTable();
    
    // تصفير وتركيز
    document.getElementById('purchase-search').value = "";
    document.getElementById('purchase-qty-input').value = "1";
    document.getElementById('purchase-search').focus();
};

window.renderPurchaseTable = function() {
    const tbody = document.querySelector("#purchase-table tbody");
    if(!tbody) return;
    tbody.innerHTML = "";
    currentPurchaseItems.forEach((item, i) => {
        tbody.innerHTML += `<tr>
            <td style="padding:10px;">${item.name}</td>
            <td style="text-align:center;"><small>${item.warehouse}</small></td>
            <td style="text-align:center;"><input type="number" onchange="currentPurchaseItems[${i}].buyPrice=this.value; renderPurchaseTable();" style="width:60px;"></td>
            <td style="text-align:center;"><input type="number" onchange="currentPurchaseItems[${i}].sellPrice=this.value;" style="width:60px;"></td>
            <td style="text-align:center;">${item.qty}</td>
            <td style="text-align:center;"><button onclick="currentPurchaseItems.splice(${i},1); renderPurchaseTable();">❌</button></td>
        </tr>`;
    });
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

window.handlePurchaseKeys = function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const activeId = document.activeElement.id;
        if (activeId === 'purchase-search') {
            document.getElementById('purchase-qty-input').focus();
        } else if (activeId === 'purchase-qty-input') {
            addNewItemToPurchaseTable();
        }
    }
};

window.searchWithLocation = function(query) {
    const resultsDiv = document.getElementById('purchase-results');
    if (!query) { resultsDiv.style.display = 'none'; return; }

    try {
        // بنجيب البيانات المتاحة حالياً بس عشان نتجنب خطأ no such column
        const res = db.exec("SELECT name, warehouse, category FROM products WHERE name LIKE ?", [`%${query}%`]);
        
        resultsDiv.innerHTML = "";
        if (res.length > 0 && res[0].values) {
            resultsDiv.style.display = 'block';
            res[0].values.forEach(row => {
                const div = document.createElement('div');
                div.style = "padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; background: white; display: flex; justify-content: space-between;";
                div.innerHTML = `
                    <b>${row[0]}</b>
                    <span style="font-size:0.7rem; background:#e0f2fe; padding:2px 5px; border-radius:4px;">
                        📍 ${row[1] || 'عام'} | 📂 ${row[2] || 'عام'}
                    </span>`;
                div.onclick = () => {
                    document.getElementById('purchase-search').value = row[0];
                    document.getElementById('target-warehouse').value = row[1] || 'المخزن الرئيسي';
                    document.getElementById('target-category').value = row[2] || 'عام';
                    resultsDiv.style.display = 'none';
                    document.getElementById('purchase-qty-input').focus();
                };
                resultsDiv.appendChild(div);
            });
        } else {
            resultsDiv.style.display = 'block';
            resultsDiv.innerHTML = "<div style='padding:10px; background:white;'>✨ صنف جديد.. اضغط Enter للإضافة</div>";
        }
    } catch (e) {
        console.error("Search Error:", e);
    }
};

if (typeof currentPurchaseItems === 'undefined') {
    var currentPurchaseItems = []; 
}