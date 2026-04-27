const { app, BrowserWindow, ipcMain, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');

// متغيرات عالمية
let win;
let downloadStream = null;
const dbPath = path.join(app.getPath('userData'), 'system_data.db');

// 1. منع فتح أكثر من نسخة
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

// 2. تفعيل Hot Reload (للتطوير)
try {
    require('electron-reloader')(module, {
        debug: true,
        watchRenderer: true,
        ignore: [/system_data\.db/, /data/] 
    });
} catch (err) {}

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

// --- [C] نظام التحديثات وفحص الإصدار ---
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

// --- [D] تحميل وتثبيت التحديث (مع دعم الإلغاء) ---
ipcMain.handle('download-and-install', async (event, url) => {
    const controller = new AbortController();
    const tempPath = path.join(app.getPath('temp'), 'erp-setup.exe');
    
    // مستمع لمرة واحدة لإشارة الإلغاء
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
            controller.signal.addEventListener('abort', () => {
                writer.close();
                reject(new Error("تم إلغاء التحميل بواسطة المستخدم"));
            });
        });
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// --- [E] مديونية العملاء (الآجل) ---
ipcMain.handle('get-last-credit-invoice', async (event, customerName) => {
    // ملاحظة: هنا يجب استدعاء دالة البحث من مكتبة sqlite3 التي تستخدمها
    // مثال (تأكد من تعريف db الخاص بك):
    // return new Promise((resolve) => {
    //    db.get(sql, [customerName], (err, row) => resolve(row));
    // });
    console.log("جاري البحث عن مديونية العميل:", customerName);
    return null; // سيتم استبداله بنتيجة البحث الحقيقية
});

// --- [F] دورة حياة التطبيق ---
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});