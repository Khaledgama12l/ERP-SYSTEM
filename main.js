const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // إعدادات النافذة الأساسية
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    // أيقونة التطبيق (تأكد من وجود ملف icon.ico في الفولدر)
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      // ده أهم جزء عشان الكود بتاعك يفضل شغال لوكال بعد البناء
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // تحميل الملف الرئيسي
  win.loadFile('index.html');

  // إلغاء القائمة العلوية الافتراضية (عشان يبان تطبيق احترافي)
  // win.setMenu(null); 
}

// تشغيل التطبيق
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// إغلاق البرنامج بالكامل عند قفل النافذة
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});