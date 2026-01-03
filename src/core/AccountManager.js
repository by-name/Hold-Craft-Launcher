// src/core/AccountManager.js
class HCLAccountManager {
  constructor() {
    this.dataManager = new HCLDataManager();
    this.avatarManager = new HCLAvatarManager();
    this.accounts = new Map();
  }
  
  const AccountManager = require('./core/AccountManager');

// 创建账户管理器实例
const accountManager = new AccountManager();

// 监听事件
accountManager.on('userLoggedIn', ({ username }) => {
  console.log(`用户 ${username} 已登录`);
});

// 创建账户
const result = await accountManager.createAccount(
  'testuser',
  'Password123',
  { displayName: '测试用户', email: 'test@example.com' }
);

// 用户登录
const loginResult = await accountManager.login(
  'testuser',
  'Password123',
  { ip: '127.0.0.1', userAgent: 'Chrome' }
);

// 验证会话
const sessionCheck = accountManager.validateSession(loginResult.sessionId);

// 更新资料
await accountManager.updateProfile('testuser', {
  profile: { displayName: '新用户名' },
  settings: { theme: 'dark' }
});

}

module.exports = HCLAccountManager;
