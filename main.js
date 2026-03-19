const { app, BrowserWindow, ipcMain, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// 1. منع فتح أكثر من نسخة (Single Instance Lock)
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

// 2. تفعيل Hot Reload (للتطوير فقط)
try {
    require('electron-reloader')(module, {
        debug: true,
        watchRenderer: true,
        ignore: [/system_data\.db/, /data/] 
    });
} catch (err) {}

let win;
const dbPath = path.join(app.getPath('userData'), 'system_data.db');

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, 
        }
    });

    win.loadFile('index.html');
}

// --- [A] إدارة الطابعات والطباعة ---
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

// --- [B] إدارة قاعدة البيانات ---
ipcMain.handle('save-db-to-disk', async (event, buffer) => {
    try {
        fs.writeFileSync(dbPath, Buffer.from(buffer));
        return { success: true };
    } catch (err) { 
        return { success: false, error: err.message }; 
    }
});

ipcMain.handle('load-db-from-disk', async () => {
    if (fs.existsSync(dbPath)) return fs.readFileSync(dbPath);
    return null;
});

// --- [C] نظام التحديثات (أبو بلاش) ---
ipcMain.handle('check-for-update', async () => {
    return new Promise((resolve) => {
        // نصيحة: استبدل هذا الرابط برابط ملف JSON على GitHub الخاص بك
        const request = net.request('https://raw.githubusercontent.com/username/repo/main/version.json');
        
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

// --- [D] دورة حياة التطبيق ---
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});