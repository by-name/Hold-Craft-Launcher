// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const HCLConfigManager = require('./src/core/ConfigManager');

let mainWindow = null;
let configManager = null;

/**
 * 检查并创建必要目录
 */
async function setupApplication() {
    console.log('设置应用程序...');
    
    try {
        // 初始化配置管理器
        configManager = new HCLConfigManager();
        const config = await configManager.initialize();
        
        console.log('应用程序设置完成');
        console.log('当前配置:', config);
        
        return true;
    } catch (error) {
        console.error('应用程序设置失败:', error);
        
        // 显示错误对话框
        if (mainWindow) {
            dialog.showErrorBox(
                '启动失败',
                `无法初始化应用程序:\n${error.message}\n\n请检查磁盘权限和空间。`
            );
        }
        
        return false;
    }
}

/**
 * 创建主窗口
 */
function createWindow() {
    console.log('创建主窗口...');
    
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'assets/icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        show: false,
        backgroundColor: '#1a1a2e'
    });
    
    // 加载启动页面
    mainWindow.loadFile('src/renderer/launch.html');
    
    // 窗口准备就绪后显示
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // 发送配置到渲染进程
        if (configManager) {
            const config = configManager.getConfig();
            mainWindow.webContents.send('config-loaded', config);
        }
    });
    
    // 窗口关闭事件
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    
    // 开发工具
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

/**
 * 应用程序准备就绪
 */
app.whenReady().then(async () => {
    console.log('应用程序准备就绪');
    
    // 设置应用程序
    const setupSuccess = await setupApplication();
    
    if (setupSuccess) {
        createWindow();
    } else {
        app.quit();
    }
});

/**
 * 所有窗口关闭时退出
 */
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

/**
 * 退出应用程序
 */
app.on('before-quit', async () => {
    console.log('应用程序退出中...');
    
    // 清理临时文件
    if (configManager) {
        const paths = configManager.getPaths();
        const tempDir = paths.tempDir;
        
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
            console.log('清理临时文件完成');
        } catch (error) {
            console.warn('清理临时文件失败:', error);
        }
    }
});

/**
 * IPC 通信处理
 */
ipcMain.handle('get-config', () => {
    if (configManager) {
        return configManager.getConfig();
    }
    return null;
});

ipcMain.handle('save-config', (event, newConfig) => {
    if (configManager) {
        return configManager.saveConfig(newConfig);
    }
    return false;
});

ipcMain.handle('get-paths', () => {
    if (configManager) {
        return configManager.getPaths();
    }
    return null;
});

ipcMain.handle('export-config', async (event, exportPath) => {
    if (configManager) {
        return await configManager.exportConfig(exportPath);
    }
    return false;
});

ipcMain.handle('import-config', async (event, importPath) => {
    if (configManager) {
        return await configManager.importConfig(importPath);
    }
    return false;
});

ipcMain.handle('reset-config', async () => {
    if (configManager) {
        return await configManager.resetToDefault();
    }
    return false;
});
