const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const HCLConfigManager = require('../core/ConfigManager');
const HCLDataManager = require('../core/DataManager');
const HCLAccountManager = require('../core/AccountManager');
const HCLDownloadManager = require('../core/DownloadManager');
const HCLGameManager = require('../core/GameManager');

class HCLApplication {
    constructor() {
        this.mainWindow = null;
        this.isDev = process.env.NODE_ENV === 'development';
        this.configManager = new HCLConfigManager();
        this.dataManager = new HCLDataManager();
        this.accountManager = null;
        this.downloadManager = null;
        this.gameManager = null;
    }

    async initialize() {
        try {
            // 初始化核心管理器
            await this.configManager.initialize();
            await this.dataManager.initialize();
            
            this.accountManager = new HCLAccountManager(this.dataManager);
            this.downloadManager = new HCLDownloadManager(this.configManager);
            this.gameManager = new HCLGameManager(this.configManager, this.downloadManager);
            
            await this.accountManager.initialize();
            
            this.createWindow();
            this.setupIPC();
            this.setupMenu();
            
            console.log('HCL 启动器初始化完成');
        } catch (error) {
            console.error('初始化失败:', error);
            dialog.showErrorBox('启动失败', 'HCL 启动器初始化失败: ' + error.message);
        }
    }

    createWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 900,
            minHeight: 600,
            icon: path.join(__dirname, '../../assets/icons/hcl-icon.png'),
            title: 'HCL - Hold Craft Launcher',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../../preload.js')
            },
            show: false,
            titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
        });

        this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            if (this.isDev) {
                this.mainWindow.webContents.openDevTools();
            }
        });

        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });
    }

    setupIPC() {
        // 账户相关
        ipcMain.handle('get-all-accounts', () => {
            return this.accountManager.getAccounts();
        });

        ipcMain.handle('add-account', async (event, accountData) => {
            return await this.accountManager.addAccount(accountData);
        });

        ipcMain.handle('remove-account', async (event, accountId) => {
            return await this.accountManager.removeAccount(accountId);
        });

        ipcMain.handle('set-current-account', async (event, accountId) => {
            return await this.accountManager.setCurrentAccount(accountId);
        });

        // 下载相关
        ipcMain.handle('get-version-list', async () => {
            return await this.downloadManager.getVersionList();
        });

        ipcMain.handle('download-version', async (event, versionId) => {
            return await this.gameManager.installVersion(versionId);
        });

        // 设置相关
        ipcMain.handle('get-config', () => {
            return this.configManager.getConfig();
        });

        ipcMain.handle('save-config', async (event, newConfig) => {
            return await this.configManager.saveConfig(newConfig);
        });

        // 游戏启动
        ipcMain.handle('launch-game', async (event, launchConfig) => {
            return await this.gameManager.launchGame(launchConfig);
        });

        // 进度监听
        this.downloadManager.on('download-progress', (progress) => {
            if (this.mainWindow) {
                this.mainWindow.webContents.send('download-progress', progress);
            }
        });

        this.gameManager.on('game-output', (output) => {
            if (this.mainWindow) {
                this.mainWindow.webContents.send('game-output', output);
            }
        });
    }

    setupMenu() {
        const { Menu } = require('electron');
        
        const template = [
            {
                label: '文件',
                submenu: [
                    {
                        label: '设置',
                        accelerator: 'CmdOrCtrl+,',
                        click: () => this.openSettings()
                    },
                    { type: 'separator' },
                    {
                        label: '退出',
                        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                        click: () => app.quit()
                    }
                ]
            },
            {
                label: '视图',
                submenu: [
                    { role: 'reload' },
                    { role: 'forceReload' },
                    { role: 'toggleDevTools' },
                    { type: 'separator' },
                    { role: 'resetZoom' },
                    { role: 'zoomIn' },
                    { role: 'zoomOut' },
                    { type: 'separator' },
                    { role: 'togglefullscreen' }
                ]
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    openSettings() {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('open-settings');
        }
    }
}

module.exports = HCLApplication;
