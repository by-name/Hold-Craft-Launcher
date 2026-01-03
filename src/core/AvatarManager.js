// src/core/AvatarManager.js
/**
 * HCL 头像管理器
 * 负责处理 Minecraft 账户的头像获取、缓存和显示
 */
class HCLAvatarManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.cache = new Map();
        this.defaultAvatar = this.getDefaultAvatar();
        
        // 头像源配置
        this.avatarSources = {
            'crafatar': {
                name: 'Crafatar',
                baseUrl: 'https://crafatar.com/avatars/',
                options: '?size=64&overlay',
                fallback: 'https://crafatar.com/avatars/8667ba71b85a4004af54457a9734eed7' // Steve UUID
            },
            'minotar': {
                name: 'Minotar',
                baseUrl: 'https://minotar.net/avatar/',
                options: '/64.png',
                fallback: 'https://minotar.net/avatar/Steve/64.png'
            },
            'mc-heads': {
                name: 'MC-Heads',
                baseUrl: 'https://mc-heads.net/avatar/',
                options: '/64',
                fallback: 'https://mc-heads.net/avatar/Steve/64'
            }
        };
        
        this.currentSource = 'crafatar';
        this.init();
    }
    
    async init() {
        // 从配置加载头像源设置
        const config = await this.dataManager.getConfig();
        this.currentSource = config.avatarSource || 'crafatar';
        
        // 预加载默认头像
        await this.preloadDefaultAvatars();
    }
    
    /**
     * 获取玩家头像
     * @param {string} username - 玩家用户名
     * @param {string} uuid - 玩家UUID（可选）
     * @param {boolean} forceRefresh - 是否强制刷新缓存
     * @returns {Promise<string>} 头像DataURL
     */
    async getAvatar(username, uuid = null, forceRefresh = false) {
        const cacheKey = uuid || username;
        
        // 检查缓存
        if (!forceRefresh && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            let avatarUrl = null;
            
            // 如果有UUID，优先使用UUID获取
            if (uuid) {
                avatarUrl = await this.getAvatarByUUID(uuid);
            }
            
            // 如果UUID获取失败，回退到用户名
            if (!avatarUrl) {
                avatarUrl = await this.getAvatarByUsername(username);
            }
            
            // 转换为DataURL并缓存
            const dataUrl = await this.convertToDataURL(avatarUrl);
            this.cache.set(cacheKey, dataUrl);
            
            // 保存到本地存储
            await this.saveToStorage(cacheKey, dataUrl);
            
            return dataUrl;
        } catch (error) {
            console.warn('获取头像失败，使用默认头像:', error);
            return this.defaultAvatar;
        }
    }
    
    /**
     * 通过UUID获取头像
     * @param {string} uuid - 玩家UUID
     * @returns {Promise<string>} 头像URL
     */
    async getAvatarByUUID(uuid) {
        const source = this.avatarSources[this.currentSource];
        const url = `${source.baseUrl}${uuid}${source.options}`;
        
        // 验证头像是否存在
        if (await this.validateImage(url)) {
            return url;
        }
        
        // 尝试其他源
        for (const [sourceName, sourceConfig] of Object.entries(this.avatarSources)) {
            if (sourceName === this.currentSource) continue;
            
            const fallbackUrl = `${sourceConfig.baseUrl}${uuid}${sourceConfig.options}`;
            if (await this.validateImage(fallbackUrl)) {
                return fallbackUrl;
            }
        }
        
        return null;
    }
    
    /**
     * 通过用户名获取头像
     * @param {string} username - 玩家用户名
     * @returns {Promise<string>} 头像URL
     */
    async getAvatarByUsername(username) {
        const source = this.avatarSources[this.currentSource];
        
        // 先尝试通过用户名获取UUID
        const uuid = await this.getUUIDByUsername(username);
        if (uuid) {
            return await this.getAvatarByUUID(uuid);
        }
        
        // 如果获取UUID失败，直接使用用户名
        const url = `${source.baseUrl}${username}${source.options}`;
        
        if (await this.validateImage(url)) {
            return url;
        }
        
        return source.fallback;
    }
    
    /**
     * 通过用户名获取UUID
     * @param {string} username - 玩家用户名
     * @returns {Promise<string|null>} 玩家UUID
     */
    async getUUIDByUsername(username) {
        try {
            // 尝试 Mojang API
            const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
            if (response.ok) {
                const data = await response.json();
                return data.id || null;
            }
            
            // 尝试其他API
            const fallbackResponse = await fetch(`https://playerdb.co/api/player/minecraft/${username}`);
            if (fallbackResponse.ok) {
                const data = await fallbackResponse.json();
                return data.data?.player?.id || null;
            }
        } catch (error) {
            console.warn('获取UUID失败:', error);
        }
        
        return null;
    }
    
    /**
     * 验证图片URL是否有效
     * @param {string} url - 图片URL
     * @returns {Promise<boolean>} 是否有效
     */
    async validateImage(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
            
            // 设置超时
            setTimeout(() => resolve(false), 5000);
        });
    }
    
    /**
     * 转换为DataURL
     * @param {string} url - 图片URL
     * @returns {Promise<string>} DataURL
     */
    async convertToDataURL(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                try {
                    const dataUrl = canvas.toDataURL('image/png');
                    resolve(dataUrl);
                } catch (error) {
                    // 如果转换为DataURL失败，返回原始URL
                    resolve(url);
                }
            };
            
            img.onerror = () => {
                reject(new Error('图片加载失败'));
            };
            
            img.src = url;
        });
    }
    
    /**
     * 获取默认头像
     * @returns {string} 默认头像DataURL
     */
    getDefaultAvatar() {
        // 创建一个简单的默认头像
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        
        const ctx = canvas.getContext('2d');
        
        // 背景
        ctx.fillStyle = '#4a90e2';
        ctx.fillRect(0, 0, 64, 64);
        
        // 绘制简单的人脸
        ctx.fillStyle = '#f5d76e';
        ctx.beginPath();
        ctx.arc(32, 25, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // 眼睛
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(25, 22, 3, 0, Math.PI * 2);
        ctx.arc(39, 22, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // 嘴巴
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(32, 30, 8, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
        
        return canvas.toDataURL('image/png');
    }
    
    /**
     * 生成随机皮肤颜色
     * @returns {string} 颜色值
     */
    generateRandomColor() {
        const colors = [
            '#4a90e2', // 蓝色
            '#e74c3c', // 红色
            '#2ecc71', // 绿色
            '#f39c12', // 橙色
            '#9b59b6', // 紫色
            '#1abc9c', // 青色
            '#e67e22', // 深橙色
            '#3498db'  // 浅蓝色
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    /**
     * 创建占位符头像
     * @param {string} username - 用户名
     * @returns {string} 头像DataURL
     */
    createPlaceholderAvatar(username) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        
        const ctx = canvas.getContext('2d');
        
        // 使用用户名首字母决定颜色
        const firstChar = username.charAt(0).toUpperCase();
        const colors = [
            { bg: '#4a90e2', text: '#ffffff' }, // 蓝色
            { bg: '#e74c3c', text: '#ffffff' }, // 红色
            { bg: '#2ecc71', text: '#ffffff' }, // 绿色
            { bg: '#f39c12', text: '#ffffff' }, // 橙色
            { bg: '#9b59b6', text: '#ffffff' }, // 紫色
            { bg: '#1abc9c', text: '#ffffff' }, // 青色
        ];
        
        const colorIndex = firstChar.charCodeAt(0) % colors.length;
        const color = colors[colorIndex];
        
        // 背景
        ctx.fillStyle = color.bg;
        ctx.fillRect(0, 0, 64, 64);
        
        // 绘制首字母
        ctx.fillStyle = color.text;
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(firstChar, 32, 32);
        
        return canvas.toDataURL('image/png');
    }
    
    /**
     * 批量获取头像
     * @param {Array} accounts - 账户列表
     * @param {Function} onProgress - 进度回调
     * @returns {Promise<Array>} 带有头像的账户列表
     */
    async batchGetAvatars(accounts, onProgress = null) {
        const results = [];
        const total = accounts.length;
        
        for (let i = 0; i < accounts.length; i++) {
            const account = accounts[i];
            
            try {
                const avatar = await this.getAvatar(account.username, account.uuid);
                results.push({
                    ...account,
                    avatar: avatar
                });
            } catch (error) {
                console.warn(`获取账户 ${account.username} 的头像失败:`, error);
                results.push({
                    ...account,
                    avatar: this.createPlaceholderAvatar(account.username)
                });
            }
            
            // 回调进度
            if (onProgress) {
                onProgress({
                    current: i + 1,
                    total: total,
                    percent: Math.round(((i + 1) / total) * 100),
                    account: account.username
                });
            }
            
            // 添加延迟避免请求过多
            await this.delay(100);
        }
        
        return results;
    }
    
    /**
     * 预加载默认头像
     */
    async preloadDefaultAvatars() {
        const defaultUsernames = ['Steve', 'Alex', 'Herobrine', 'Notch'];
        
        for (const username of defaultUsernames) {
            try {
                await this.getAvatar(username);
            } catch (error) {
                console.debug('预加载默认头像失败:', username, error);
            }
        }
    }
    
    /**
     * 保存头像到本地存储
     * @param {string} key - 缓存键
     * @param {string} dataUrl - 头像DataURL
     */
    async saveToStorage(key, dataUrl) {
        try {
            const avatarData = await this.dataManager.loadData('avatars') || {};
            avatarData[key] = {
                dataUrl: dataUrl,
                timestamp: Date.now()
            };
            
            // 清理过期缓存（30天）
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            Object.keys(avatarData).forEach(k => {
                if (avatarData[k].timestamp < thirtyDaysAgo) {
                    delete avatarData[k];
                }
            });
            
            await this.dataManager.saveData('avatars', avatarData);
        } catch (error) {
            console.warn('保存头像到存储失败:', error);
        }
    }
    
    /**
     * 从本地存储加载头像
     * @param {string} key - 缓存键
     * @returns {string|null} 头像DataURL
     */
    async loadFromStorage(key) {
        try {
            const avatarData = await this.dataManager.loadData('avatars') || {};
            const cached = avatarData[key];
            
            if (cached && cached.timestamp) {
                // 检查是否过期（30天）
                const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                if (cached.timestamp > thirtyDaysAgo) {
                    return cached.dataUrl;
                } else {
                    // 删除过期缓存
                    delete avatarData[key];
                    await this.dataManager.saveData('avatars', avatarData);
                }
            }
        } catch (error) {
            console.warn('从存储加载头像失败:', error);
        }
        
        return null;
    }
    
    /**
     * 清理头像缓存
     */
    async clearCache() {
        this.cache.clear();
        await this.dataManager.saveData('avatars', {});
    }
    
    /**
     * 获取缓存信息
     * @returns {Object} 缓存统计信息
     */
    getCacheInfo() {
        return {
            memoryCacheCount: this.cache.size,
            memoryCacheSize: this.getCacheSize(),
            storageCacheCount: this.getStorageCacheCount()
        };
    }
    
    /**
     * 获取缓存大小
     * @returns {number} 缓存大小（字节）
     */
    getCacheSize() {
        let totalSize = 0;
        this.cache.forEach(value => {
            if (value && value.length) {
                totalSize += value.length;
            }
        });
        return totalSize;
    }
    
    /**
     * 获取存储缓存数量
     * @returns {number} 缓存数量
     */
    async getStorageCacheCount() {
        try {
            const avatarData = await this.dataManager.loadData('avatars') || {};
            return Object.keys(avatarData).length;
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * 切换头像源
     * @param {string} source - 头像源名称
     */
    async setAvatarSource(source) {
        if (this.avatarSources[source]) {
            this.currentSource = source;
            
            // 更新配置
            const config = await this.dataManager.getConfig();
            config.avatarSource = source;
            await this.dataManager.saveConfig(config);
            
            // 清理缓存
            this.cache.clear();
            
            return true;
        }
        return false;
    }
    
    /**
     * 获取可用头像源列表
     * @returns {Array} 头像源列表
     */
    getAvatarSources() {
        return Object.entries(this.avatarSources).map(([key, config]) => ({
            id: key,
            name: config.name,
            baseUrl: config.baseUrl
        }));
    }
    
    /**
     * 延迟函数
     * @param {number} ms - 毫秒
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 创建头像元素
     * @param {string} avatarData - 头像DataURL或URL
     * @param {Object} options - 选项
     * @returns {HTMLElement} 头像元素
     */
    createAvatarElement(avatarData, options = {}) {
        const {
            size = 64,
            className = 'avatar',
            alt = '玩家头像',
            onclick = null
        } = options;
        
        const img = document.createElement('img');
        img.src = avatarData;
        img.alt = alt;
        img.className = className;
        img.style.width = `${size}px`;
        img.style.height = `${size}px`;
        img.style.borderRadius = '8px';
        img.style.objectFit = 'cover';
        
        if (onclick) {
            img.style.cursor = 'pointer';
            img.addEventListener('click', onclick);
        }
        
        // 添加加载错误处理
        img.onerror = () => {
            img.src = this.defaultAvatar;
        };
        
        return img;
    }
    
    /**
     * 更新UI中的头像
     * @param {string} selector - 选择器
     * @param {string} username - 用户名
     * @param {string} uuid - UUID
     */
    async updateAvatarInUI(selector, username, uuid = null) {
        const elements = document.querySelectorAll(selector);
        
        if (elements.length === 0) return;
        
        try {
            const avatar = await this.getAvatar(username, uuid);
            
            elements.forEach(element => {
                if (element.tagName === 'IMG') {
                    element.src = avatar;
                } else {
                    element.style.backgroundImage = `url(${avatar})`;
                }
            });
        } catch (error) {
            console.warn('更新UI头像失败:', error);
        }
    }
    
    /**
     * 导出所有头像缓存
     * @returns {Object} 头像缓存数据
     */
    async exportAvatarCache() {
        try {
            const avatarData = await this.dataManager.loadData('avatars') || {};
            return {
                timestamp: Date.now(),
                count: Object.keys(avatarData).length,
                data: avatarData
            };
        } catch (error) {
            throw new Error('导出头像缓存失败: ' + error.message);
        }
    }
    
    /**
     * 导入头像缓存
     * @param {Object} cacheData - 缓存数据
     */
    async importAvatarCache(cacheData) {
        try {
            if (cacheData && cacheData.data) {
                await this.dataManager.saveData('avatars', cacheData.data);
                
                // 重新加载到内存缓存
                Object.entries(cacheData.data).forEach(([key, value]) => {
                    this.cache.set(key, value.dataUrl);
                });
                
                return true;
            }
        } catch (error) {
            throw new Error('导入头像缓存失败: ' + error.message);
        }
        return false;
    }
}

// 全局单例实例
let avatarManagerInstance = null;

/**
 * 获取AvatarManager实例
 * @param {Object} dataManager - 数据管理器
 * @returns {HCLAvatarManager} AvatarManager实例
 */
function getAvatarManager(dataManager = null) {
    if (!avatarManagerInstance && dataManager) {
        avatarManagerInstance = new HCLAvatarManager(dataManager);
    }
    return avatarManagerInstance;
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HCLAvatarManager, getAvatarManager };
}

export { HCLAvatarManager, getAvatarManager };
