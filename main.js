const { app, BrowserWindow, ipcMain, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');
const { machineIdSync } = require('node-machine-id');

// 1. المتغيرات العالمية والإعدادات الأساسية
let win;
let downloadStream = null;
const dbPath = path.join(app.getPath('userData'), 'system_data.db');

// 2. منع فتح أكثر من نسخة من البرنامج
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });
}

// 3. تفعيل Hot Reload للتطوير (اختياري - يفضل تعطيله عند الإنتاج)
try {
    require('electron-reloader')(module, {
        debug: true,
        watchRenderer: true,
        ignore: [/system_data\.db/, /data/] 
    });
} catch (err) {}

// 4. دالة إنشاء نافذة البرنامج
function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            devTools: true // سيبها true عشان الشفرة السرية تشتغل
        }
    });

    // 1. حذف القائمة العلوية (عشان نلغي اختصاراتها)
    win.setMenu(null); 

    win.loadFile('index.html');

    // 2. القفل الصارم للاختصارات من داخل الـ WebContents
    win.webContents.on('before-input-event', (event, input) => {
        // منع F12
        if (input.key === 'F12') {
            event.preventDefault();
        }
        // منع Ctrl + Shift + I (أو Cmd + Option + I على الماك)
        if (input.control && input.shift && input.key.toLowerCase() === 'i') {
            event.preventDefault();
        }
        // منع Ctrl + Shift + J
        if (input.control && input.shift && input.key.toLowerCase() === 'j') {
            event.preventDefault();
        }
    });
}

// --- [A] خدمات الطباعة ---
ipcMain.handle('get-printers', async () => {
    return await win.webContents.getPrintersAsync();
});

ipcMain.handle('execute-print', async (event, options) => {
    return new Promise((resolve) => {
        win.webContents.print({
            silent: options.silent || false,
            deviceName: options.printerName || '',
            printBackground: true,
            copies: parseInt(options.copies || 1),
            landscape: options.orientation === 'landscape',
        }, (success, failureReason) => {
            resolve({ success, error: failureReason });
        });
    });
});

// --- [B] إدارة قاعدة البيانات على الهارد ---
ipcMain.handle('save-db-to-disk', async (event, buffer) => {
    try {
        fs.writeFileSync(dbPath, Buffer.from(buffer));
        return { success: true };
    } catch (err) { 
        return { success: false, error: err.message }; 
    }
});

ipcMain.handle('load-db-from-disk', async () => {
    if (fs.existsSync(dbPath)) {
        return fs.readFileSync(dbPath);
    }
    return null;
});
// مسح ملف قاعدة البيانات نهائياً من الهارد
ipcMain.handle('delete-db-file', async () => {
    try {
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath); // حذف الملف
            return { success: true };
        }
        return { success: true, message: "File already gone" };
    } catch (err) {
        return { success: false, error: err.message };
    }
});
// --- [C] نظام فحص التحديثات أونلاين ---
ipcMain.handle('check-for-update', async () => {
    return new Promise((resolve) => {
        const request = net.request('https://raw.githubusercontent.com/Khaledgama12l/ERP-SYSTEM/refs/heads/main/version.json');        
        request.on('response', (response) => {
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => {
                try {
                    const serverConfig = JSON.parse(data);
                    const currentVersion = app.getVersion();
                    resolve({
                        isUpdateAvailable: serverConfig.version !== currentVersion,
                        newVersion: serverConfig.version,
                        updateUrl: serverConfig.url 
                    });
                } catch (e) { resolve({ isUpdateAvailable: false }); }
            });
        });
        request.on('error', () => resolve({ isUpdateAvailable: false }));
        request.end();
    });
});

// --- [D] تحميل وتثبيت التحديث التلقائي ---
ipcMain.handle('download-and-install', async (event, url) => {
    const controller = new AbortController();
    const tempPath = path.join(app.getPath('temp'), 'erp-setup.exe');
    
    ipcMain.once('cancel-download-action', () => {
        controller.abort();
        if (downloadStream) downloadStream.destroy();
        if (fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch(e){}
        }
    });

    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            signal: controller.signal
        });

        downloadStream = response.data;
        const totalLength = response.headers['content-length'];
        let downloadedLength = 0;

        response.data.on('data', (chunk) => {
            downloadedLength += chunk.length;
            const progress = Math.round((downloadedLength / totalLength) * 100);
            if (win) win.webContents.send('download-progress', progress);
        });

        const writer = fs.createWriteStream(tempPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                exec(`"${tempPath}"`);
                setTimeout(() => app.quit(), 1000);
                resolve({ success: true });
            });
            writer.on('error', reject);
        });
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// --- [E] فتح DevTools بالشفرة السرية من المتصفح ---
ipcMain.on('open-dev-tools-now', (event) => {
    if (win) win.webContents.openDevTools();
});

// --- [F] تشغيل البرنامج وإغلاقه ---
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});