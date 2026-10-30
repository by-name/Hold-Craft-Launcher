// preload.js - 预加载脚本
const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
    // 通用调用（渲染进程主要通过它访问主进程）
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, callback) => {
        const listener = (_event, ...args) => callback(...args);
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    },
    once: (channel, callback) => {
        ipcRenderer.once(channel, (_event, ...args) => callback(...args));
    },
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

    // 账户相关
    getAccounts: () => ipcRenderer.invoke('get-all-accounts'),
    addAccount: (accountData) => ipcRenderer.invoke('add-account', accountData),
    removeAccount: (accountId) => ipcRenderer.invoke('remove-account', accountId),
    setCurrentAccount: (accountId) => ipcRenderer.invoke('set-current-account', accountId),

    // 版本与下载相关
    getVersionList: () => ipcRenderer.invoke('get-version-list'),
    downloadVersion: (versionId) => ipcRenderer.invoke('download-version', versionId),
    getDownloadProgress: (callback) => {
        const listener = (_event, progress) => callback(progress);
        ipcRenderer.on('download-progress', listener);
        return () => ipcRenderer.removeListener('download-progress', listener);
    },

    // 设置相关
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    getPaths: () => ipcRenderer.invoke('get-paths'),
    exportConfig: (filePath) => ipcRenderer.invoke('export-config', filePath),
    importConfig: (filePath) => ipcRenderer.invoke('import-config', filePath),
    resetConfig: () => ipcRenderer.invoke('reset-config'),

    // 系统对话框
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    showFolderDialog: (options) => ipcRenderer.invoke('show-folder-dialog', options),

    // 页面导航
    openSettings: () => ipcRenderer.invoke('open-settings'),
    openLaunch: () => ipcRenderer.invoke('open-launch'),

    // 游戏启动
    launchGame: (config) => ipcRenderer.invoke('launch-game', config),
    stopGame: () => ipcRenderer.invoke('stop-game')
};

// 兼容 contextIsolation 关闭的情况（此时预加载脚本与主世界共享上下文）
if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
} else {
    window.electronAPI = electronAPI;
}
