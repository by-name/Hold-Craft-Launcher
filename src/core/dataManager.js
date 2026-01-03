
// src/core/DataManager.js
/**
 * HCL 数据管理器
 * 负责本地数据的存储、加载和管理
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class HCLDataManager {
    constructor(configManager) {
        this.configManager = configManager;
        this.dataPath = null;
        this.encryptionKey = null;
        this.dataCache = new Map();
        this.init();
    }
    
    async init() {
        console.log('初始化数据管理器...');
        
        // 获取数据目录
        const paths = this.configManager.getPaths();
        this.dataPath = paths.appDataPath;
        
        // 创建数据目录
        await fs.mkdir(this.dataPath, { recursive: true });
        
        // 设置加密密钥
        await this.setupEncryptionKey();
        
        // 初始化默认数据结构
        await this.initializeDataStructure();
        
        // 预加载常用数据
        await this.preloadData();
        
        console.log('数据管理器初始化完成');
    }
    
    /**
     * 设置加密密钥
     */
    async setupEncryptionKey() {
        const keyPath = path.join(this.dataPath, '.encryption.key');
        
        try {
            const key = await fs.readFile(keyPath, 'utf8');
            this.encryptionKey = key.trim();
            console.log('加载加密密钥');
        } catch (error) {
            // 生成新的加密密钥
            this.encryptionKey = crypto.randomBytes(32).toString('hex');
            await fs.writeFile(keyPath, this.encryptionKey, 'utf8');
            console.log('生成新的加密密钥');
        }
    }
    
    /**
     * 初始化数据文件结构
     */
    async initializeDataStructure() {
        const defaultStructure = {
            'accounts': [],              // 账户数据
            'settings': {},              // 用户设置
            'launch-profiles': [],       // 启动配置
            'quick-launch-profiles': [], // 快速启动配置
            'version-cache': [],         // 版本缓存
            'avatar-cache': {},          // 头像缓存
            'download-cache': {},        // 下载缓存
            'game-stats': {},            // 游戏统计
            'user-preferences': {        // 用户偏好
                'theme': 'dark',
                'language': 'zh_CN',
                'recent-versions': [],
                'favorite-mods': []
            }
        };
        
        for (const [filename, defaultData] of Object.entries(defaultStructure)) {
            const filePath = path.join(this.dataPath, `${filename}.json`);
            
            try {
                await fs.access(filePath);
                // 文件存在，验证完整性
                const existingData = await this.loadData(filename);
                if (!existingData) {
                    // 文件损坏，重置为默认值
                    await this.saveData(filename, defaultData);
                    console.log(`重置损坏的数据文件: ${filename}`);
                }
            } catch (error) {
                // 文件不存在，创建默认文件
                await this.saveData(filename, defaultData);
                console.log(`创建默认数据文件: ${filename}`);
            }
        }
    }
    
    /**
     * 预加载常用数据
     */
    async preloadData() {
        const preloadFiles = ['accounts', 'user-preferences', 'version-cache'];
        
        for (const file of preloadFiles) {
            try {
                const data = await this.loadData(file);
                this.dataCache.set(file, data);
            } catch (error) {
                console.warn(`预加载 ${file} 失败:`, error.message);
            }
        }
    }
    
    /**
     * 加载数据文件
     */
    async loadData(filename, defaultValue = null) {
        // 检查缓存
        if (this.dataCache.has(filename)) {
            return this.dataCache.get(filename);
        }
        
        const filePath = path.join(this.dataPath, `${filename}.json`);
        
        try {
            const data = await fs.readFile(filePath, 'utf8');
            let parsedData;
            
            // 尝试解析 JSON
            try {
                parsedData = JSON.parse(data);
            } catch (parseError) {
                console.error(`JSON 解析失败 ${filename}:`, parseError);
                
                // 尝试修复常见 JSON 错误
                const fixedData = this.fixJSON(data);
                if (fixedData) {
                    parsedData = fixedData;
                    // 保存修复后的数据
                    await this.saveData(filename, parsedData);
                } else {
                    throw new Error('数据文件损坏且无法修复');
                }
            }
            
            // 解密敏感数据
            if (this.isSensitiveFile(filename)) {
                parsedData = this.decryptSensitiveData(parsedData);
            }
            
            // 缓存数据
            this.dataCache.set(filename, parsedData);
            
            return parsedData;
        } catch (error) {
            if (error.code === 'ENOENT') {
                // 文件不存在，返回默认值
                if (defaultValue !== null) {
                    await this.saveData(filename, defaultValue);
                    this.dataCache.set(filename, defaultValue);
                    return defaultValue;
                }
                return null;
            }
            
            console.error(`加载数据文件失败 ${filename}:`, error);
            throw error;
        }
    }
    
    /**
     * 保存数据文件
     */
    async saveData(filename, data) {
        const filePath = path.join(this.dataPath, `${filename}.json`);
        
        try {
            let dataToSave = { ...data };
            
            // 加密敏感数据
            if (this.isSensitiveFile(filename)) {
                dataToSave = this.encryptSensitiveData(dataToSave);
            }
            
            // 添加元数据
            const dataWithMeta = {
                _metadata: {
                    version: '1.0.0',
                    saveTime: new Date().toISOString(),
                    dataVersion: 1
                },
                ...dataToSave
            };
            
            const jsonData = JSON.stringify(dataWithMeta, null, 2);
            
            // 写入文件
            await fs.writeFile(filePath, jsonData, 'utf8');
            
            // 更新缓存
            this.dataCache.set(filename, data);
            
            // 发送数据保存事件
            this.emitDataSaved(filename, data);
            
            return true;
        } catch (error) {
            console.error(`保存数据文件失败 ${filename}:`, error);
            
            // 备份旧文件
            await this.backupFile(filePath);
            
            throw error;
        }
    }
    
    /**
     * 删除数据文件
     */
    async deleteData(filename) {
        const filePath = path.join(this.dataPath, `${filename}.json`);
        
        try {
            await fs.unlink(filePath);
            this.dataCache.delete(filename);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return true; // 文件不存在，视为删除成功
            }
            console.error(`删除数据文件失败 ${filename}:`, error);
            return false;
        }
    }
    
    /**
     * 备份文件
     */
    async backupFile(filePath) {
        try {
            if (await this.fileExists(filePath)) {
                const backupPath = `${filePath}.backup.${Date.now()}`;
                await fs.copyFile(filePath, backupPath);
                console.log(`文件已备份: ${backupPath}`);
            }
        } catch (error) {
            console.warn('文件备份失败:', error);
        }
    }
    
    /**
     * 检查文件是否存在
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * 修复常见 JSON 错误
     */
    fixJSON(data) {
        try {
            // 尝试修复末尾逗号
            const fixed = data
                .replace(/,\s*}/g, '}')
                .replace(/,\s*]/g, ']')
                .replace(/'/g, '"'); // 替换单引号为双引号
            
            return JSON.parse(fixed);
        } catch (error) {
            return null;
        }
    }
    
    /**
     * 检查是否为敏感文件
     */
    isSensitiveFile(filename) {
        const sensitiveFiles = ['accounts', 'launch-profiles', 'quick-launch-profiles'];
        return sensitiveFiles.includes(filename);
    }
    
    /**
     * 加密敏感数据
     */
    encryptSensitiveData(data) {
        if (!this.encryptionKey) return data;
        
        const encryptedData = { ...data };
        
        // 只加密特定字段
        if (Array.isArray(encryptedData)) {
            encryptedData.forEach((item, index) => {
                if (item.accessToken || item.refreshToken) {
                    encryptedData[index] = this.encryptObject(item);
                }
            });
        } else if (typeof encryptedData === 'object') {
            if (encryptedData.accessToken || encryptedData.refreshToken) {
                return this.encryptObject(encryptedData);
            }
        }
        
        return encryptedData;
    }
    
    /**
     * 解密敏感数据
     */
    decryptSensitiveData(data) {
        if (!this.encryptionKey) return data;
        
        const decryptedData = { ...data };
        
        if (Array.isArray(decryptedData)) {
            decryptedData.forEach((item, index) => {
                if (item._encrypted) {
                    decryptedData[index] = this.decryptObject(item);
                }
            });
        } else if (typeof decryptedData === 'object' && decryptedData._encrypted) {
            return this.decryptObject(decryptedData);
        }
        
        return decryptedData;
    }
    
    /**
     * 加密对象
     */
    encryptObject(obj) {
        const algorithm = 'aes-256-gcm';
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, Buffer.from(this.encryptionKey, 'hex'), iv);
        
        const plainText = JSON.stringify(obj);
        let encrypted = cipher.update(plainText, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        
        return {
            _encrypted: true,
            iv: iv.toString('hex'),
            data: encrypted,
            tag: authTag.toString('hex')
        };
    }
    
    /**
     * 解密对象
     */
    decryptObject(encryptedObj) {
        if (!encryptedObj._encrypted) return encryptedObj;
        
        try {
            const algorithm = 'aes-256-gcm';
            const iv = Buffer.from(encryptedObj.iv, 'hex');
            const decipher = crypto.createDecipheriv(
                algorithm, 
                Buffer.from(this.encryptionKey, 'hex'), 
                iv
            );
            
            decipher.setAuthTag(Buffer.from(encryptedObj.tag, 'hex'));
            
            let decrypted = decipher.update(encryptedObj.data, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('解密失败:', error);
            return null;
        }
    }
    
    /**
     * 发射数据保存事件
     */
    emitDataSaved(filename, data) {
        // 这里可以发送 IPC 消息通知渲染进程
        if (typeof process !== 'undefined' && process.send) {
            process.send({
                type: 'data-saved',
                filename,
                data
            });
        }
    }
    
    /**
     * 账户管理
     */
    async getAccounts() {
        return await this.loadData('accounts', []);
    }
    
    async saveAccounts(accounts) {
        return await this.saveData('accounts', accounts);
    }
    
    async addAccount(account) {
        const accounts = await this.getAccounts();
        
        // 生成唯一 ID
        account.id = this.generateAccountId(account);
        account.createdAt = new Date().toISOString();
        account.lastUsed = null;
        
        // 添加到列表
        accounts.push(account);
        
        await this.saveAccounts(accounts);
        return account.id;
    }
    
    async updateAccount(accountId, updates) {
        const accounts = await this.getAccounts();
        const index = accounts.findIndex(acc => acc.id === accountId);
        
        if (index === -1) {
            throw new Error('账户不存在');
        }
        
        // 更新账户
        accounts[index] = { ...accounts[index], ...updates, updatedAt: new Date().toISOString() };
        
        await this.saveAccounts(accounts);
        return accounts[index];
    }
    
    async removeAccount(accountId) {
        const accounts = await this.getAccounts();
        const filteredAccounts = accounts.filter(acc => acc.id !== accountId);
        
        await this.saveAccounts(filteredAccounts);
        return true;
    }
    
    async getAccount(accountId) {
        const accounts = await this.getAccounts();
        return accounts.find(acc => acc.id === accountId) || null;
    }
    
    async setCurrentAccount(accountId) {
        const accounts = await this.getAccounts();
        const account = accounts.find(acc => acc.id === accountId);
        
        if (!account) {
            throw new Error('账户不存在');
        }
        
        // 更新最后使用时间
        account.lastUsed = new Date().toISOString();
        
        // 保存更新
        await this.saveAccounts(accounts);
        
        return true;
    }
    
    generateAccountId(account) {
        if (account.uuid) {
            return `msa_${account.uuid.replace(/-/g, '')}`;
        } else {
            const hash = crypto.createHash('md5')
                .update(`${account.username}_${Date.now()}`)
                .digest('hex')
                .substring(0, 12);
            return `offline_${hash}`;
        }
    }
    
    /**
     * 版本缓存管理
     */
    async getVersionCache() {
        return await this.loadData('version-cache', []);
    }
    
    async saveVersionCache(versions) {
        return await this.saveData('version-cache', versions);
    }
    
    async getCachedVersion(versionId) {
        const cache = await this.getVersionCache();
        return cache.find(v => v.id === versionId) || null;
    }
    
    async cacheVersion(versionInfo) {
        const cache = await this.getVersionCache();
        const existingIndex = cache.findIndex(v => v.id === versionInfo.id);
        
        if (existingIndex !== -1) {
            cache[existingIndex] = { ...cache[existingIndex], ...versionInfo, cachedAt: new Date().toISOString() };
        } else {
            versionInfo.cachedAt = new Date().toISOString();
            cache.push(versionInfo);
        }
        
        // 限制缓存数量
        if (cache.length > 100) {
            cache.sort((a, b) => new Date(b.cachedAt) - new Date(a.cachedAt));
            cache.length = 100;
        }
        
        await this.saveVersionCache(cache);
    }
    
    async clearVersionCache() {
        await this.deleteData('version-cache');
    }
    
    /**
     * 头像缓存管理
     */
    async getAvatarCache() {
        return await this.loadData('avatar-cache', {});
    }
    
    async saveAvatarCache(cache) {
        return await this.saveData('avatar-cache', cache);
    }
    
    async getCachedAvatar(username) {
        const cache = await this.getAvatarCache();
        return cache[username] || null;
    }
    
    async cacheAvatar(username, avatarData, expiresIn = 7 * 24 * 60 * 60 * 1000) { // 7天
        const cache = await this.getAvatarCache();
        cache[username] = {
            data: avatarData,
            cachedAt: Date.now(),
            expiresAt: Date.now() + expiresIn
        };
        
        await this.saveAvatarCache(cache);
    }
    
    async clearExpiredAvatars() {
        const cache = await this.getAvatarCache();
        const now = Date.now();
        let cleared = 0;
        
        Object.keys(cache).forEach(username => {
            if (cache[username].expiresAt < now) {
                delete cache[username];
                cleared++;
            }
        });
        
        if (cleared > 0) {
            await this.saveAvatarCache(cache);
        }
        
        return cleared;
    }
    
    /**
     * 用户偏好管理
     */
    async getUserPreferences() {
        return await this.loadData('user-preferences', {});
    }
    
    async saveUserPreferences(preferences) {
        return await this.saveData('user-preferences', preferences);
    }
    
    async updateUserPreferences(updates) {
        const prefs = await this.getUserPreferences();
        const updated = { ...prefs, ...updates };
        await this.saveUserPreferences(updated);
        return updated;
    }
    
    async getRecentVersions(limit = 5) {
        const prefs = await this.getUserPreferences();
        return (prefs.recentVersions || []).slice(0, limit);
    }
    
    async addRecentVersion(versionId) {
        const prefs = await this.getUserPreferences();
        const recent = prefs.recentVersions || [];
        
        // 移除重复
        const filtered = recent.filter(v => v !== versionId);
        
        // 添加到开头
        filtered.unshift(versionId);
        
        // 限制数量
        if (filtered.length > 10) {
            filtered.length = 10;
        }
        
        prefs.recentVersions = filtered;
        await this.saveUserPreferences(prefs);
    }
    
    /**
     * 启动配置管理
     */
    async getLaunchProfiles() {
        return await this.loadData('launch-profiles', []);
    }
    
    async saveLaunchProfiles(profiles) {
        return await this.saveData('launch-profiles', profiles);
    }
    
    async getLaunchProfile(profileId) {
        const profiles = await this.getLaunchProfiles();
        return profiles.find(p => p.id === profileId) || null;
    }
    
    async saveLaunchProfile(profile) {
        const profiles = await this.getLaunchProfiles();
        const existingIndex = profiles.findIndex(p => p.id === profile.id);
        
        if (existingIndex !== -1) {
            profiles[existingIndex] = profile;
        } else {
            profiles.push(profile);
        }
        
        await this.saveLaunchProfiles(profiles);
        return profile.id;
    }
    
    async deleteLaunchProfile(profileId) {
        const profiles = await this.getLaunchProfiles();
        const filtered = profiles.filter(p => p.id !== profileId);
        await this.saveLaunchProfiles(filtered);
    }
    
    /**
     * 游戏统计
     */
    async getGameStats() {
        return await this.loadData('game-stats', {});
    }
    
    async saveGameStats(stats) {
        return await this.saveData('game-stats', stats);
    }
    
    async recordGameLaunch(accountId, versionId, duration) {
        const stats = await this.getGameStats();
        
        if (!stats.totalLaunches) stats.totalLaunches = 0;
        if (!stats.byAccount) stats.byAccount = {};
        if (!stats.byVersion) stats.byVersion = {};
        if (!stats.playTime) stats.playTime = 0;
        
        stats.totalLaunches++;
        stats.playTime += duration || 0;
        stats.lastLaunch = new Date().toISOString();
        
        // 账户统计
        stats.byAccount[accountId] = stats.byAccount[accountId] || 0;
        stats.byAccount[accountId]++;
        
        // 版本统计
        stats.byVersion[versionId] = stats.byVersion[versionId] || 0;
        stats.byVersion[versionId]++;
        
        await this.saveGameStats(stats);
    }
    
    /**
     * 数据导出导入
     */
    async exportData(filename, data) {
        const exportDir = path.join(this.dataPath, 'exports');
        await fs.mkdir(exportDir, { recursive: true });
        
        const exportPath = path.join(exportDir, `${filename}.json`);
        const exportData = {
            data,
            exportTime: new Date().toISOString(),
            version: '1.0.0',
            source: 'hcl-launcher'
        };
        
        await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2), 'utf8');
        return exportPath;
    }
    
    async importData(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            const importData = JSON.parse(data);
            
            if (importData.source !== 'hcl-launcher') {
                throw new Error('无效的数据文件格式');
            }
            
            return importData.data;
        } catch (error) {
            throw new Error(`导入数据失败: ${error.message}`);
        }
    }
    
    /**
     * 数据清理
     */
    async cleanupData() {
        console.log('清理数据...');
        
        // 清理过期头像缓存
        const clearedAvatars = await this.clearExpiredAvatars();
        console.log(`清理了 ${clearedAvatars} 个过期头像`);
        
        // 清理旧的导出文件
        await this.cleanupExports();
        
        // 清理临时文件
        await this.cleanupTempFiles();
        
        // 清理大文件
        await this.cleanupLargeFiles();
        
        console.log('数据清理完成');
    }
    
    async cleanupExports() {
        const exportDir = path.join(this.dataPath, 'exports');
        try {
            const files = await fs.readdir(exportDir);
            const now = Date.now();
            const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
            
            for (const file of files) {
                const filePath = path.join(exportDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtimeMs < oneWeekAgo) {
                    await fs.unlink(filePath);
                }
            }
        } catch (error) {
            // 目录不存在，忽略
        }
    }
    
    async cleanupTempFiles() {
        const tempDir = path.join(this.dataPath, 'temp');
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
            await fs.mkdir(tempDir, { recursive: true });
        } catch (error) {
            // 忽略错误
        }
    }
    
    async cleanupLargeFiles() {
        const dataFiles = [
            'download-cache.json',
            'avatar-cache.json',
            'version-cache.json'
        ];
        
        for (const filename of dataFiles) {
            const filePath = path.join(this.dataPath, filename);
            try {
                const stats = await fs.stat(filePath);
                if (stats.size > 10 * 1024 * 1024) { // 10MB
                    console.log(`清理大文件: ${filename} (${stats.size} bytes)`);
                    await fs.unlink(filePath);
                }
            } catch (error) {
                // 文件不存在，忽略
            }
        }
    }
    
    /**
     * 数据统计
     */
    async getDataStatistics() {
        const stats = {
            accounts: 0,
            launchProfiles: 0,
            recentVersions: 0,
            totalPlayTime: 0,
            totalLaunches: 0,
            avatarCacheSize: 0,
            versionCacheSize: 0
        };
        
        try {
            const accounts = await this.getAccounts();
            stats.accounts = accounts.length;
            
            const launchProfiles = await this.getLaunchProfiles();
            stats.launchProfiles = launchProfiles.length;
            
            const recent = await this.getRecentVersions();
            stats.recentVersions = recent.length;
            
            const gameStats = await this.getGameStats();
            stats.totalPlayTime = gameStats.playTime || 0;
            stats.totalLaunches = gameStats.totalLaunches || 0;
            
            const avatarCache = await this.getAvatarCache();
            stats.avatarCacheSize = Object.keys(avatarCache).length;
            
            const versionCache = await this.getVersionCache();
            stats.versionCacheSize = versionCache.length;
            
        } catch (error) {
            console.error('获取数据统计失败:', error);
        }
        
        return stats;
    }
    
    /**
     * 数据备份
     */
    async backupData(backupName = null) {
        const backupDir = path.join(this.dataPath, 'backups');
        await fs.mkdir(backupDir, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupNameFinal = backupName || `backup-${timestamp}`;
        const backupPath = path.join(backupDir, `${backupNameFinal}.tar.gz`);
        
        // 收集所有数据文件
        const dataFiles = await this.getAllDataFiles();
        
        // 创建备份（简化版本）
        const backupData = {
            files: {},
            metadata: {
                backupTime: new Date().toISOString(),
                dataManagerVersion: '1.0.0'
            }
        };
        
        for (const file of dataFiles) {
            const content = await fs.readFile(file, 'utf8');
            const relativePath = path.relative(this.dataPath, file);
            backupData.files[relativePath] = content;
        }
        
        const backupFile = path.join(backupPath.replace('.tar.gz', '.json'));
        await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
        
        return backupFile;
    }
    
    async restoreBackup(backupFile) {
        try {
            const backupData = JSON.parse(await fs.readFile(backupFile, 'utf8'));
            
            // 验证备份
            if (!backupData.metadata || backupData.metadata.dataManagerVersion !== '1.0.0') {
                throw new Error('无效的备份文件格式');
            }
            
            // 恢复文件
            for (const [relativePath, content] of Object.entries(backupData.files)) {
                const filePath = path.join(this.dataPath, relativePath);
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await fs.writeFile(filePath, content, 'utf8');
            }
            
            // 清除缓存
            this.dataCache.clear();
            
            return true;
        } catch (error) {
            throw new Error(`恢复备份失败: ${error.message}`);
        }
    }
    
    async getAllDataFiles() {
        const files = [];
        
        try {
            const items = await fs.readdir(this.dataPath);
            
            for (const item of items) {
                const itemPath = path.join(this.dataPath, item);
                const stats = await fs.stat(itemPath);
                
                if (stats.isFile() && item.endsWith('.json')) {
                    files.push(itemPath);
                } else if (stats.isDirectory() && item !== 'backups' && item !== 'exports') {
                    const subFiles = await this.getFilesRecursive(itemPath);
                    files.push(...subFiles);
                }
            }
        } catch (error) {
            console.error('获取数据文件列表失败:', error);
        }
        
        return files;
    }
    
    async getFilesRecursive(dir) {
        const files = [];
        
        try {
            const items = await fs.readdir(dir);
            
            for (const item of items) {
                const itemPath = path.join(dir, item);
                const stats = await fs.stat(itemPath);
                
                if (stats.isFile() && item.endsWith('.json')) {
                    files.push(itemPath);
                } else if (stats.isDirectory()) {
                    const subFiles = await this.getFilesRecursive(itemPath);
                    files.push(...subFiles);
                }
            }
        } catch (error) {
            console.error(`递归获取文件失败 ${dir}:`, error);
        }
        
        return files;
    }
    
    /**
     * 获取数据目录大小
     */
    async getDataSize() {
        let totalSize = 0;
        
        const calculateSize = async (dir) => {
            try {
                const items = await fs.readdir(dir);
                
                for (const item of items) {
                    const itemPath = path.join(dir, item);
                    const stats = await fs.stat(itemPath);
                    
                    if (stats.isFile()) {
                        totalSize += stats.size;
                    } else if (stats.isDirectory()) {
                        await calculateSize(itemPath);
                    }
                }
            } catch (error) {
                // 忽略错误
            }
        };
        
        await calculateSize(this.dataPath);
        return totalSize;
    }
    
    /**
     * 格式化数据大小
     */
    formatDataSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HCLDataManager;
}
