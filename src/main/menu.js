const { Menu, dialog } = require('electron');

class HCLMenu {
    static createMenu(app, mainWindow) {
        const template = [
            {
                label: 'HCL',
                submenu: [
                    {
                        label: '关于 HCL',
                        click: () => {
                            dialog.showMessageBox(mainWindow, {
                                type: 'info',
                                title: '关于 HCL',
                                message: 'HCL - Hold Craft Launcher',
                                detail: '版本 Beta 1.0\n下一代 Minecraft Java 版启动器'
                            });
                        }
                    },
                    { type: 'separator' },
                    {
                        label: '设置',
                        accelerator: 'CmdOrCtrl+,',
                        click: () => mainWindow.webContents.send('open-settings')
                    },
                    { type: 'separator' },
                    {
                        label: '退出 HCL',
                        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                        click: () => app.quit()
                    }
                ]
            },
            {
                label: '游戏',
                submenu: [
                    {
                        label: '启动游戏',
                        accelerator: 'CmdOrCtrl+L',
                        click: () => mainWindow.webContents.send('launch-game')
                    },
                    {
                        label: '安装新版本',
                        click: () => mainWindow.webContents.send('install-version')
                    },
                    { type: 'separator' },
                    {
                        label: '打开游戏目录',
                        click: () => mainWindow.webContents.send('open-game-dir')
                    }
                ]
            },
            {
                label: '账户',
                submenu: [
                    {
                        label: '添加微软账户',
                        click: () => mainWindow.webContents.send('add-microsoft-account')
                    },
                    {
                        label: '添加离线账户',
                        click: () => mainWindow.webContents.send('add-offline-account')
                    },
                    { type: 'separator' },
                    {
                        label: '管理账户',
                        click: () => mainWindow.webContents.send('manage-accounts')
                    }
                ]
            },
            {
                label: '窗口',
                submenu: [
                    { role: 'minimize' },
                    { role: 'close' }
                ]
            }
        ];

        if (process.platform === 'darwin') {
            template.unshift({
                label: 'HCL',
                submenu: [
                    { role: 'about' },
                    { type: 'separator' },
                    { role: 'services' },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideOthers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: 'quit' }
                ]
            });
        }

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }
}

module.exports = HCLMenu;
