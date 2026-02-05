const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// 1. 🔥 تفعيل الـ Live Reload (زي اللايف سيرفر بالظبط)
try {
  require('electron-reloader')(module, {
    debug: true,
    watchRenderer: true // بيراقب الـ HTML والـ JS والـ CSS
  });
} catch (err) {
  console.log('Hot Reload Error:', err);
}

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // عشان الـ Renderer يكلم الـ Main براحته
    }
  });

  win.loadFile('index.html');
}

// --- مسار قاعدة البيانات الموحد في الـ AppData ---
const getDbPath = () => path.join(app.getPath('userData'), 'system_data.db');

// 2. 📥 استقبال وحفظ الداتا (Save)
ipcMain.on('save-db-to-disk', (event, buffer) => {
    try {
        fs.writeFileSync(getDbPath(), Buffer.from(buffer));
        console.log("✅ Database Saved to:", getDbPath());
    } catch (err) {
        console.error("❌ Save Error:", err);
    }
});

// 3. 📤 إرسال الداتا للريندرر عند التشغيل (Load)
ipcMain.handle('load-db-from-disk', async () => {
    const dbPath = getDbPath();
    if (fs.existsSync(dbPath)) {
        console.log("📂 Loading existing database...");
        return fs.readFileSync(dbPath);
    }
    console.log("🆕 No database found, starting fresh.");
    return null;
});

// 4. إرسال المسار (للاحتياط)
ipcMain.handle('get-db-path', () => getDbPath());

// تشغيل البرنامج
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});