// preload.js - 预加载脚本
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 账户相关
  getAccounts: () => ipcRenderer.invoke('get-all-accounts'),
  addAccount: (accountData) => ipcRenderer.invoke('add-account', accountData),
  removeAccount: (accountId) => ipcRenderer.invoke('remove-account', accountId),
  
  // 下载相关
  downloadVersion: (versionId) => ipcRenderer.invoke('download-version', versionId),
  getDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
  
  // 设置相关
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  // 游戏启动
  launchGame: (config) => ipcRenderer.invoke('launch-game', config)
});
