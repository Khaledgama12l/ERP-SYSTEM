// 1. تصدير الداتا (Export)
window.exportDatabase = function() {
    // بنسحب الـ db من الـ window عشان نضمن إننا بنسحب الداتا الحالية
    if (!window.db) {
        alert("قاعدة البيانات غير محملة");
        return;
    }
    
    try {
        const data = window.db.export();
        const blob = new Blob([data], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Hancho_Backup_${new Date().toLocaleDateString('en-CA')}.db`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if(typeof showToast === 'function') showToast("تم تصدير النسخة الاحتياطية بنجاح 💾");
    } catch (e) {
        console.error("Export Error:", e);
    }
};

// 2. استيراد الداتا (Import)
window.importDatabase = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function() {
        try {
            const buffer = this.result;
            const Uint8ArrayData = new Uint8Array(buffer);
            
            // التريك هنا: بنحول الداتا لـ Base64 ونخزنها في الـ LocalStorage بنفس المفتاح اللي script4 بيستخدمه
            // غالبا مفتاح التخزين عندك اسمه 'sqliteDb' أو 'db'
            const base64Data = btoa(String.fromCharCode.apply(null, Uint8ArrayData));
            
            // استبدل 'db' بالمفتاح اللي إنت بتستخدمه في script4.js للحفظ
            localStorage.setItem('db', base64Data); 
            
            alert("تم استيراد البيانات.. سيتم إعادة تحميل الصفحة لتفعيل التغييرات");
            location.reload(); 
        } catch (e) {
            console.error("Import Error:", e);
            alert("خطأ في قراءة ملف القاعدة");
        }
    };
    reader.readAsArrayBuffer(file);
};