// src/core/AccountManager.js
/**
 * HCL 账户管理器
 * 负责离线/在线账户的增删改查与本地持久化
 */
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class HCLAccountManager extends EventEmitter {
    constructor(configManager = null) {
        super();
        this.configManager = configManager;
        this.accounts = new Map();
        this.currentAccountId = null;
        this.accountsPath = null;
    }

    /**
     * 初始化：确定存储文件并加载已有账户
     */
    async initialize() {
        this.accountsPath = this.resolveAccountsPath();
        await this.loadAccounts();

        // 优先使用配置中记录的账户
        if (!this.currentAccountId && this.configManager) {
            const config = this.configManager.getConfig();
            if (config && config.lastUsedAccount && this.accounts.has(config.lastUsedAccount)) {
                this.currentAccountId = config.lastUsedAccount;
            }
        }

        if (!this.currentAccountId && this.accounts.size > 0) {
            this.currentAccountId = this.accounts.keys().next().value;
        }

        console.log(`账户管理器初始化完成，共 ${this.accounts.size} 个账户`);
        return true;
    }

    /**
     * 确定账户数据文件路径
     */
    resolveAccountsPath() {
        if (this.configManager && typeof this.configManager.getPaths === 'function') {
            const paths = this.configManager.getPaths();
            if (paths && paths.appDataPath) {
                return path.join(paths.appDataPath, 'accounts.json');
            }
        }

        try {
            const { app } = require('electron');
            return path.join(app.getPath('userData'), 'accounts.json');
        } catch (error) {
            return path.join(process.cwd(), 'accounts.json');
        }
    }

    /**
     * 从磁盘加载账户
     */
    async loadAccounts() {
        try {
            const raw = await fs.readFile(this.accountsPath, 'utf8');
            const data = JSON.parse(raw);
            const list = Array.isArray(data) ? data : (data.accounts || []);

            for (const account of list) {
                if (account && account.id) {
                    this.accounts.set(account.id, account);
                }
            }

            if (data && data.currentAccountId && this.accounts.has(data.currentAccountId)) {
                this.currentAccountId = data.currentAccountId;
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn('读取账户数据失败:', error.message);
            }
        }
    }

    /**
     * 保存账户到磁盘
     */
    async saveAccounts() {
        if (!this.accountsPath) {
            return false;
        }

        try {
            await fs.mkdir(path.dirname(this.accountsPath), { recursive: true });
            await fs.writeFile(
                this.accountsPath,
                JSON.stringify({
                    accounts: Array.from(this.accounts.values()),
                    currentAccountId: this.currentAccountId
                }, null, 2),
                'utf8'
            );
            return true;
        } catch (error) {
            console.error('保存账户数据失败:', error);
            return false;
        }
    }

    /**
     * 获取全部账户
     */
    getAccounts() {
        return Array.from(this.accounts.values());
    }

    /**
     * 按 ID 获取账户
     */
    getAccount(accountId) {
        return this.accounts.get(accountId) || null;
    }

    /**
     * 获取当前账户
     */
    getCurrentAccount() {
        return this.currentAccountId ? this.accounts.get(this.currentAccountId) : null;
    }

    /**
     * 添加账户
     * @param {{username: string, type?: string, uuid?: string, accessToken?: string}} accountData
     */
    async addAccount(accountData) {
        if (!accountData || !accountData.username) {
            throw new Error('账户名不能为空');
        }

        const type = accountData.type || 'offline';
        const id = this.generateAccountId(accountData.username, type);

        if (this.accounts.has(id)) {
            throw new Error(`账户 ${accountData.username} 已存在`);
        }

        const account = {
            id,
            username: accountData.username,
            displayName: accountData.displayName || accountData.username,
            type,
            uuid: accountData.uuid || this.generateOfflineUUID(accountData.username),
            accessToken: accountData.accessToken || '0',
            email: accountData.email || '',
            createdAt: new Date().toISOString(),
            lastUsed: null
        };

        this.accounts.set(id, account);
        await this.saveAccounts();
        this.emit('account-added', account);

        if (!this.currentAccountId) {
            await this.setCurrentAccount(id);
        }

        return account;
    }

    /**
     * 更新账户信息
     */
    async updateAccount(accountId, updates = {}) {
        const account = this.accounts.get(accountId);
        if (!account) {
            return null;
        }

        const updated = { ...account, ...updates, id: accountId };
        this.accounts.set(accountId, updated);
        await this.saveAccounts();
        this.emit('account-updated', updated);
        return updated;
    }

    /**
     * 删除账户
     */
    async removeAccount(accountId) {
        const removed = this.accounts.delete(accountId);

        if (removed) {
            if (this.currentAccountId === accountId) {
                this.currentAccountId = this.accounts.size > 0 ? this.accounts.keys().next().value : null;
                await this.syncConfigAccount();
            }
            await this.saveAccounts();
            this.emit('account-removed', { id: accountId });
        }

        return removed;
    }

    /**
     * 设置当前账户
     */
    async setCurrentAccount(accountId) {
        if (!this.accounts.has(accountId)) {
            throw new Error(`账户不存在: ${accountId}`);
        }

        this.currentAccountId = accountId;
        const account = this.accounts.get(accountId);
        account.lastUsed = new Date().toISOString();
        this.accounts.set(accountId, account);

        await this.saveAccounts();
        await this.syncConfigAccount();
        this.emit('account-changed', account);

        return account;
    }

    /**
     * 把当前账户写回配置
     */
    async syncConfigAccount() {
        if (!this.configManager || typeof this.configManager.saveConfig !== 'function') {
            return false;
        }

        return await this.configManager.saveConfig({ lastUsedAccount: this.currentAccountId });
    }

    /**
     * 生成离线账户 UUID（与 Minecraft 离线 UUID 规则一致）
     */
    generateOfflineUUID(username) {
        const hash = crypto.createHash('md5').update(`OfflinePlayer:${username}`).digest();
        hash[6] = (hash[6] & 0x0f) | 0x30;
        hash[8] = (hash[8] & 0x3f) | 0x80;
        const hex = hash.toString('hex');

        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    }

    /**
     * 生成账户 ID
     */
    generateAccountId(username, type) {
        return `${type}-${username}`.toLowerCase();
    }

    /**
     * 校验会话是否有效
     */
    validateSession(accountId) {
        const account = this.accounts.get(accountId);
        if (!account) {
            return { valid: false, reason: '账户不存在' };
        }

        if (account.type === 'offline') {
            return { valid: true, account, offline: true };
        }

        return { valid: Boolean(account.accessToken) && account.accessToken !== '0', account };
    }
}

module.exports = HCLAccountManager;
