// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fsSync = require('fs');
const fs = require('fs').promises;

const HCLConfigManager = require('./src/core/configManager');
const HCLDownloadManager = require('./src/core/DownloadManager');
const HCLGameManager = require('./src/core/GameManager');
const HCLAccountManager = require('./src/core/AccountManager');

let mainWindow = null;
let configManager = null;
let downloadManager = null;
let gameManager = null;
let accountManager = null;

/** 页面文件 */
const PAGES = {
    launch: path.join(__dirname, 'src', 'render', 'launch.html'),
    settings: path.join(__dirname, 'src', 'render', 'settings.html')
};

/**
 * 检查并创建必要目录
 */
async function setupApplication() {
    console.log('设置应用程序...');

    try {
        // 初始化配置管理器
        configManager = new HCLConfigManager();
        const config = await configManager.initialize();

        // 初始化其它核心管理器
        downloadManager = new HCLDownloadManager(configManager);
        gameManager = new HCLGameManager(configManager, downloadManager);
        accountManager = new HCLAccountManager(configManager);
        await accountManager.initialize();

        console.log('应用程序设置完成');
        console.log('当前配置:', config);

        return true;
    } catch (error) {
        console.error('应用程序设置失败:', error);

        dialog.showErrorBox(
            '启动失败',
            `无法初始化应用程序:\n${error.message}\n\n请检查磁盘权限和空间。`
        );

        return false;
    }
}

/**
 * 转发子进程事件到渲染进程
 */
function forwardEvents() {
    downloadManager.on('download-progress', (progress) => {
        if (mainWindow) {
            mainWindow.webContents.send('download-progress', progress);
        }
    });

    gameManager.on('game-output', (output) => {
        if (mainWindow) {
            mainWindow.webContents.send('game-output', output);
        }
    });

    gameManager.on('game-exit', (result) => {
        if (mainWindow) {
            mainWindow.webContents.send('game-exit', result);
        }
    });
}

/**
 * 创建主窗口
 */
function createWindow() {
    console.log('创建主窗口...');

    const iconPath = path.join(__dirname, 'assets', 'icon.ico');
    const windowOptions = {
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'HCL - Hold Craft Launcher',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false,
        backgroundColor: '#1a1a2e'
    };

    // 图标文件不存在时不要传入，避免 Electron 报错
    if (fsSync.existsSync(iconPath)) {
        windowOptions.icon = iconPath;
    }

    mainWindow = new BrowserWindow(windowOptions);

    // 加载启动页面
    mainWindow.loadFile(PAGES.launch);

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
        forwardEvents();
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
    if (mainWindow === null && configManager) {
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

ipcMain.handle('save-config', async (event, newConfig) => {
    if (configManager) {
        return await configManager.saveConfig(newConfig);
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

// 账户相关
ipcMain.handle('get-all-accounts', async () => {
    if (accountManager) {
        return await accountManager.getAccounts();
    }
    return [];
});

ipcMain.handle('add-account', async (event, accountData) => {
    if (accountManager) {
        return await accountManager.addAccount(accountData);
    }
    return null;
});

ipcMain.handle('remove-account', async (event, accountId) => {
    if (accountManager) {
        return await accountManager.removeAccount(accountId);
    }
    return false;
});

ipcMain.handle('set-current-account', async (event, accountId) => {
    if (accountManager) {
        return await accountManager.setCurrentAccount(accountId);
    }
    return null;
});

// 版本与下载
ipcMain.handle('get-version-list', async () => {
    if (downloadManager) {
        return await downloadManager.getVersionList();
    }
    return [];
});

ipcMain.handle('download-version', async (event, versionId) => {
    if (gameManager) {
        return await gameManager.installVersion(versionId);
    }
    return { success: false };
});

// 游戏启动
ipcMain.handle('launch-game', async (event, launchConfig) => {
    if (gameManager) {
        return await gameManager.launchGame(launchConfig);
    }
    return { success: false, error: '启动器尚未初始化' };
});

ipcMain.handle('stop-game', () => {
    if (gameManager) {
        return gameManager.stopGame();
    }
    return false;
});

// 系统对话框
ipcMain.handle('show-open-dialog', async (event, options = {}) => {
    const result = await dialog.showOpenDialog(options);
    return result.canceled ? null : result.filePaths;
});

ipcMain.handle('show-save-dialog', async (event, options = {}) => {
    const result = await dialog.showSaveDialog(options);
    return result.canceled ? null : result.filePath;
});

ipcMain.handle('show-folder-dialog', async (event, options = {}) => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        ...options
    });
    return result.canceled ? null : result.filePaths[0];
});

// 页面导航
ipcMain.handle('open-settings', async () => {
    if (!mainWindow) {
        return false;
    }
    await mainWindow.loadFile(PAGES.settings);
    return true;
});

ipcMain.handle('open-launch', async () => {
    if (!mainWindow) {
        return false;
    }
    await mainWindow.loadFile(PAGES.launch);
    return true;
});
