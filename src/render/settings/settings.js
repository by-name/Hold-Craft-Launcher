// src/renderer/js/settings.js
/**
 * HCL 设置页面管理器
 * 负责设置页面的所有逻辑和交互
 */
class SettingsManager {
    constructor() {
        this.config = null;
        this.dataManager = null;
        this.accountManager = null;
        this.avatarManager = null;
        this.downloadManager = null;
        this.javaLauncher = null;
        
        this.hasUnsavedChanges = false;
        this.currentSection = 'general';
        this.configCache = new Map();
        this.isSaving = false;
        
        this.init();
    }
    
    async init() {
        console.log('🚀 初始化设置管理器...');
        
        try {
            // 获取 IPC 通信桥接
            if (typeof window.electronAPI !== 'undefined') {
                // 从主进程获取配置和数据管理器
                this.config = await window.electronAPI.invoke('get-config') || {};
                console.log('📁 配置加载完成');
                
                // 获取路径信息
                this.paths = await window.electronAPI.invoke('get-paths') || {};
                
                // 初始化管理器
                await this.initializeManagers();
            } else {
                console.warn('⚠️ 非 Electron 环境，使用模拟数据');
                await this.loadMockData();
            }
            
            // 加载设置
            await this.loadSettings();
            
            // 设置事件监听
            this.setupEventListeners();
            
            // 自动保存监听
            this.setupAutoSave();
            
            // 更新界面
            this.updateUI();
            
            console.log('✅ 设置管理器初始化完成');
        } catch (error) {
            console.error('❌ 设置管理器初始化失败:', error);
            this.showError('初始化失败', error.message);
        }
    }
    
    async initializeManagers() {
        // 在实际应用中，应该从主进程获取这些管理器实例
        // 这里简化处理，只使用必要的数据
        console.log('🔄 初始化管理器...');
    }
    
    async loadMockData() {
        // 模拟数据，用于测试
        this.config = {
            // 常规设置
            language: 'zh_CN',
            autoStartup: false,
            closeOnLaunch: false,
            showConsole: false,
            updateMode: 'auto',
            betaUpdates: false,
            
            // 游戏设置
            gameDirectory: 'C:\\Users\\Player\\.minecraft',
            memory: 2048,
            windowWidth: 1280,
            windowHeight: 720,
            fullscreenMode: 'window',
            
            // Java 设置
            javaPath: '',
            customJavaPath: '',
            jvmPreset: 'optimized',
            jvmArguments: '-Xmx2G -Xms1G -XX:+UseG1GC',
            
            // 下载设置
            downloadSource: 'bmclapi',
            autoSwitchMirror: true,
            downloadThreads: 2,
            maxRetries: 3,
            downloadTimeout: 30,
            speedLimit: 0,
            
            // 账户设置
            rememberPassword: true,
            sessionTimeout: 0,
            encryptData: true,
            avatarSource: 'crafatar',
            avatarQuality: 64,
            
            // 界面设置
            theme: 'dark',
            followSystemTheme: true,
            windowOpacity: 100,
            enableAnimations: true,
            fontSize: 'medium',
            downloadNotify: true,
            launchNotify: true,
            errorNotify: true,
            
            // 高级设置
            debugMode: false,
            logLevel: 'info',
            logSize: 10,
            proxyType: 'none',
            proxyHost: '',
            proxyPort: '',
            dnsMode: 'system',
            connectionTimeout: 30,
            hardwareAcceleration: true,
            multiProcess: false,
            memoryOptimization: false
        };
        
        this.paths = {
            isPortable: true,
            exeDir: 'C:\\HCL-Launcher',
            appDataPath: 'C:\\HCL-Launcher\\hcl-data',
            configPath: 'C:\\HCL-Launcher\\hcl-data\\hcl-config.json',
            gameDirectory: 'C:\\HCL-Launcher\\.minecraft',
            logDir: 'C:\\HCL-Launcher\\hcl-data\\logs',
            cacheDir: 'C:\\HCL-Launcher\\hcl-data\\cache',
            avatarDir: 'C:\\HCL-Launcher\\hcl-data\\avatars',
            tempDir: 'C:\\HCL-Launcher\\hcl-data\\temp'
        };
    }
    
    async loadSettings() {
        console.log('📥 加载设置...');
        
        // 常规设置
        this.loadGeneralSettings();
        
        // 游戏设置
        this.loadGameSettings();
        
        // Java 设置
        await this.loadJavaSettings();
        
        // 下载设置
        this.loadDownloadSettings();
        
        // 账户设置
        await this.loadAccountSettings();
        
        // 界面设置
        this.loadUISettings();
        
        // 高级设置
        this.loadAdvancedSettings();
        
        // 关于信息
        this.loadAboutInfo();
        
        console.log('✅ 设置加载完成');
    }
    
    loadGeneralSettings() {
        const { 
            language, 
            autoStartup, 
            closeOnLaunch, 
            showConsole, 
            updateMode, 
            betaUpdates 
        } = this.config;
        
        // 语言
        this.setSelect('language-select', language || 'zh_CN');
        
        // 启动设置
        this.setCheckbox('auto-startup', autoStartup || false);
        this.setCheckbox('close-on-launch', closeOnLaunch || false);
        this.setCheckbox('show-console', showConsole || false);
        
        // 更新设置
        this.setSelect('update-mode', updateMode || 'auto');
        this.setCheckbox('beta-updates', betaUpdates || false);
    }
    
    loadGameSettings() {
        const { 
            gameDirectory, 
            memory, 
            windowWidth, 
            windowHeight, 
            fullscreenMode 
        } = this.config;
        
        // 游戏目录
        this.setInput('game-dir', gameDirectory || this.paths.gameDirectory || '');
        
        // 内存设置
        this.setSlider('default-memory', memory || 2048, 'memory-display');
        
        // 窗口大小
        this.setSelect('window-width', windowWidth || 1280);
        this.setSelect('window-height', windowHeight || 720);
        
        // 全屏模式
        this.setSelect('fullscreen-mode', fullscreenMode || 'window');
        
        // 计算磁盘使用
        this.calculateDiskUsage();
    }
    
    async loadJavaSettings() {
        // 如果有 Java 检测功能
        if (typeof window.javaLauncher !== 'undefined') {
            const javaVersions = await window.javaLauncher.detectJavaVersions();
            this.populateJavaSelect(javaVersions);
        } else {
            this.populateJavaSelect([]);
        }
        
        // 设置选中的 Java
        this.setSelect('java-path-select', this.config.javaPath || '');
        
        // 自定义 Java 路径
        this.setInput('custom-java-path', this.config.customJavaPath || '');
        
        // JVM 参数
        this.setSelect('jvm-preset', this.config.jvmPreset || 'optimized');
        this.setTextarea('jvm-arguments', this.config.jvmArguments || '');
        
        // 更新 Java 信息显示
        this.updateJavaInfo();
    }
    
    loadDownloadSettings() {
        const { 
            downloadSource, 
            autoSwitchMirror, 
            downloadThreads, 
            maxRetries, 
            downloadTimeout, 
            speedLimit 
        } = this.config;
        
        // 下载源
        this.setRadio('download-source', downloadSource || 'bmclapi');
        
        // 自动切换
        this.setCheckbox('auto-switch-mirror', autoSwitchMirror || true);
        
        // 下载配置
        this.setSelect('download-threads', downloadThreads || 2);
        this.setInput('max-retries', maxRetries || 3);
        this.setInput('download-timeout', downloadTimeout || 30);
        this.setInput('speed-limit', speedLimit || 0);
        
        // 更新缓存信息
        this.updateCacheInfo();
    }
    
    async loadAccountSettings() {
        // 加载账户列表
        await this.loadAccountList();
        
        const { 
            rememberPassword, 
            sessionTimeout, 
            encryptData, 
            avatarSource, 
            avatarQuality 
        } = this.config;
        
        // 安全设置
        this.setCheckbox('remember-password', rememberPassword || true);
        this.setSelect('session-timeout', sessionTimeout || 0);
        this.setCheckbox('encrypt-data', encryptData || true);
        
        // 头像设置
        this.setSelect('avatar-source', avatarSource || 'crafatar');
        this.setSelect('avatar-quality', avatarQuality || 64);
    }
    
    loadUISettings() {
        const { 
            theme, 
            followSystemTheme, 
            windowOpacity, 
            enableAnimations, 
            fontSize, 
            downloadNotify, 
            launchNotify, 
            errorNotify 
        } = this.config;
        
        // 主题设置
        this.setTheme(theme || 'dark');
        this.setCheckbox('follow-system-theme', followSystemTheme || true);
        
        // 界面设置
        this.setSlider('window-opacity', windowOpacity || 100, 'opacity-value', true);
        this.setCheckbox('enable-animations', enableAnimations || true);
        this.setSelect('font-size', fontSize || 'medium');
        
        // 通知设置
        this.setCheckbox('download-notify', downloadNotify || true);
        this.setCheckbox('launch-notify', launchNotify || true);
        this.setCheckbox('error-notify', errorNotify || true);
    }
    
    loadAdvancedSettings() {
        const { 
            debugMode, 
            logLevel, 
            logSize, 
            proxyType, 
            proxyHost, 
            proxyPort, 
            dnsMode, 
            connectionTimeout,
            hardwareAcceleration,
            multiProcess,
            memoryOptimization
        } = this.config;
        
        // 调试设置
        this.setCheckbox('debug-mode', debugMode || false);
        this.setSelect('log-level', logLevel || 'info');
        this.setSelect('log-size', logSize || 10);
        
        // 网络设置
        this.setSelect('proxy-type', proxyType || 'none');
        this.setInput('proxy-host', proxyHost || '');
        this.setInput('proxy-port', proxyPort || '');
        this.setSelect('dns-mode', dnsMode || 'system');
        this.setInput('connection-timeout', connectionTimeout || 30);
        
        // 实验性功能
        this.setCheckbox('hardware-acceleration', hardwareAcceleration || true);
        this.setCheckbox('multi-process', multiProcess || false);
        this.setCheckbox('memory-optimization', memoryOptimization || false);
    }
    
    loadAboutInfo() {
        // 系统信息
        this.updateSystemInfo();
        
        // 路径信息
        this.updatePathInfo();
    }
    
    async loadAccountList() {
        try {
            const accountList = document.getElementById('account-list');
            if (!accountList) return;
            
            // 模拟账户数据
            const accounts = [
                {
                    id: 'msa_123456',
                    username: 'Player123',
                    type: 'microsoft',
                    avatar: 'default-avatar.png',
                    lastUsed: Date.now() - 86400000
                },
                {
                    id: 'offline_abc123',
                    username: '离线玩家',
                    type: 'offline',
                    avatar: 'default-avatar.png',
                    lastUsed: Date.now() - 172800000
                }
            ];
            
            let html = '';
            accounts.forEach(account => {
                const lastUsed = this.formatTimeAgo(account.lastUsed);
                html += `
                    <div class="account-item" data-id="${account.id}">
                        <img src="${account.avatar}" alt="${account.username}" 
                             class="account-avatar" onerror="this.src='default-avatar.png'">
                        <div class="account-info">
                            <div class="account-name">${account.username}</div>
                            <div>
                                <span class="account-type">${this.getAccountTypeText(account.type)}</span>
                                <span class="account-time">${lastUsed}</span>
                            </div>
                        </div>
                        <div class="account-actions">
                            <button class="btn-icon" onclick="settingsManager.editAccount('${account.id}')" title="编辑">✏️</button>
                            <button class="btn-icon" onclick="settingsManager.removeAccount('${account.id}')" title="删除">🗑️</button>
                        </div>
                    </div>
                `;
            });
            
            accountList.innerHTML = html;
        } catch (error) {
            console.error('加载账户列表失败:', error);
        }
    }
    
    getAccountTypeText(type) {
        const types = {
            microsoft: '微软账户',
            thirdparty: '第三方',
            offline: '离线账户'
        };
        return types[type] || '未知';
    }
    
    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
        return `${Math.floor(diff / 604800000)}周前`;
    }
    
    setupEventListeners() {
        console.log('🔗 设置事件监听...');
        
        // 导航切换
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.getAttribute('href').substring(1);
                this.switchSection(section);
            });
        });
        
        // 常规设置事件
        this.setupGeneralEvents();
        
        // 游戏设置事件
        this.setupGameEvents();
        
        // Java 设置事件
        this.setupJavaEvents();
        
        // 下载设置事件
        this.setupDownloadEvents();
        
        // 账户设置事件
        this.setupAccountEvents();
        
        // 界面设置事件
        this.setupUIEvents();
        
        // 高级设置事件
        this.setupAdvancedEvents();
        
        // 关于页面事件
        this.setupAboutEvents();
        
        // 全局事件
        this.setupGlobalEvents();
    }
    
    setupGeneralEvents() {
        // 语言选择
        this.addChangeListener('language-select', (value) => {
            this.config.language = value;
            this.markChanged();
        });
        
        // 复选框
        this.addCheckboxListener('auto-startup', (checked) => {
            this.config.autoStartup = checked;
            this.markChanged();
        });
        
        this.addCheckboxListener('close-on-launch', (checked) => {
            this.config.closeOnLaunch = checked;
            this.markChanged();
        });
        
        this.addCheckboxListener('show-console', (checked) => {
            this.config.showConsole = checked;
            this.markChanged();
        });
        
        this.addCheckboxListener('beta-updates', (checked) => {
            this.config.betaUpdates = checked;
            this.markChanged();
        });
    }
    
    setupGameEvents() {
        // 游戏目录
        this.addChangeListener('game-dir', (value) => {
            this.config.gameDirectory = value;
            this.markChanged();
        });
        
        // 内存滑块
        const memorySlider = document.getElementById('default-memory');
        if (memorySlider) {
            memorySlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('memory-display').textContent = value;
                this.config.memory = parseInt(value);
                this.markChanged();
            });
        }
        
        // 窗口大小
        this.addChangeListener('window-width', (value) => {
            this.config.windowWidth = parseInt(value);
            this.markChanged();
        });
        
        this.addChangeListener('window-height', (value) => {
            this.config.windowHeight = parseInt(value);
            this.markChanged();
        });
        
        // 全屏模式
        this.addChangeListener('fullscreen-mode', (value) => {
            this.config.fullscreenMode = value;
            this.markChanged();
        });
    }
    
    setupJavaEvents() {
        // Java 选择
        this.addChangeListener('java-path-select', (value) => {
            this.config.javaPath = value;
            this.updateJavaInfo();
            this.markChanged();
        });
        
        // 自定义 Java 路径
        this.addChangeListener('custom-java-path', (value) => {
            this.config.customJavaPath = value;
            this.markChanged();
        });
        
        // JVM 预设
        this.addChangeListener('jvm-preset', (value) => {
            this.config.jvmPreset = value;
            this.applyJvmPreset(value);
            this.markChanged();
        });
        
        // JVM 参数
        this.addTextareaListener('jvm-arguments', (value) => {
            this.config.jvmArguments = value;
            this.markChanged();
        });
    }
    
    setupDownloadEvents() {
        // 下载源单选按钮
        document.querySelectorAll('input[name="download-source"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.config.downloadSource = e.target.value;
                this.markChanged();
            });
        });
        
        // 自动切换镜像
        this.addCheckboxListener('auto-switch-mirror', (checked) => {
            this.config.autoSwitchMirror = checked;
            this.markChanged();
        });
        
        // 下载配置
        this.addChangeListener('download-threads', (value) => {
            this.config.downloadThreads = parseInt(value);
            this.markChanged();
        });
        
        this.addInputListener('max-retries', (value) => {
            this.config.maxRetries = parseInt(value);
            this.markChanged();
        });
        
        this.addInputListener('download-timeout', (value) => {
            this.config.downloadTimeout = parseInt(value);
            this.markChanged();
        });
        
        this.addInputListener('speed-limit', (value) => {
            this.config.speedLimit = parseInt(value);
            this.markChanged();
        });
    }
    
    setupAccountEvents() {
        // 记住密码
        this.addCheckboxListener('remember-password', (checked) => {
            this.config.rememberPassword = checked;
            this.markChanged();
        });
        
        // 会话超时
        this.addChangeListener('session-timeout', (value) => {
            this.config.sessionTimeout = parseInt(value);
            this.markChanged();
        });
        
        // 数据加密
        this.addCheckboxListener('encrypt-data', (checked) => {
            this.config.encryptData = checked;
            this.markChanged();
        });
        
        // 头像源
        this.addChangeListener('avatar-source', (value) => {
            this.config.avatarSource = value;
            this.markChanged();
        });
        
        // 头像质量
        this.addChangeListener('avatar-quality', (value) => {
            this.config.avatarQuality = parseInt(value);
            this.markChanged();
        });
    }
    
    setupUIEvents() {
        // 主题设置
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const theme = e.currentTarget.getAttribute('onclick').match(/'([^']+)'/)[1];
                this.setTheme(theme);
            });
        });
        
        // 跟随系统主题
        this.addCheckboxListener('follow-system-theme', (checked) => {
            this.config.followSystemTheme = checked;
            this.markChanged();
        });
        
        // 窗口透明度
        const opacitySlider = document.getElementById('window-opacity');
        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('opacity-value').textContent = value + '%';
                this.config.windowOpacity = parseInt(value);
                this.markChanged();
            });
        }
        
        // 动画效果
        this.addCheckboxListener('enable-animations', (checked) => {
            this.config.enableAnimations = checked;
            this.markChanged();
        });
        
        // 字体大小
        this.addChangeListener('font-size', (value) => {
            this.config.fontSize = value;
            this.markChanged();
        });
        
        // 通知设置
        this.addCheckboxListener('download-notify', (checked) => {
            this.config.downloadNotify = checked;
            this.markChanged();
        });
        
        this.addCheckboxListener('launch-notify', (checked) => {
            this.config.launchNotify = checked;
            this.markChanged();
        });
        
        this.addCheckboxListener('error-notify', (checked) => {
            this.config.errorNotify = checked;
            this.markChanged();
        });
    }
    
    setupAdvancedEvents() {
        // 调试模式
        this.addCheckboxListener('debug-mode', (checked) => {
            this.config.debugMode = checked;
            this.markChanged();
        });
        
        // 日志级别
        this.addChangeListener('log-level', (value) => {
            this.config.logLevel = value;
            this.markChanged();
        });
        
        // 日志大小
        this.addChangeListener('log-size', (value) => {
            this.config.logSize = parseInt(value);
            this.markChanged();
        });
        
        // 网络设置
        this.addChangeListener('proxy-type', (value) => {
            this.config.proxyType = value;
            this.markChanged();
        });
        
        this.addInputListener('proxy-host', (value) => {
            this.config.proxyHost = value;
            this.markChanged();
        });
        
        this.addInputListener('proxy-port', (value) => {
            this.config.proxyPort = value;
            this.markChanged();
        });
        
        this.addChangeListener('dns-mode', (value) => {
            this.config.dnsMode = value;
            this.markChanged();
        });
        
        this.addInputListener('connection-timeout', (value) => {
            this.config.connectionTimeout = parseInt(value);
            this.markChanged();
        });
        
        // 实验性功能
        this.addCheckboxListener('hardware-acceleration', (checked) => {
            this.config.hardwareAcceleration = checked;
            this.markChanged();
        });
        
        this.addCheckboxListener('multi-process', (checked) => {
            this.config.multiProcess = checked;
            this.markChanged();
        });
        
        this.addCheckboxListener('memory-optimization', (checked) => {
            this.config.memoryOptimization = checked;
            this.markChanged();
        });
    }
    
    setupAboutEvents() {
        // 链接点击事件
        document.querySelectorAll('.about-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const action = link.getAttribute('onclick');
                if (action) {
                    const funcName = action.match(/open(\w+)/);
                    if (funcName) {
                        this[funcName[0].toLowerCase()]();
                    }
                }
            });
        });
    }
    
    setupGlobalEvents() {
        // 保存按钮
        const saveBtn = document.getElementById('save-settings-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }
        
        // 导出配置按钮
        const exportBtn = document.getElementById('export-config-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportConfig());
        }
        
        // 导入配置按钮
        const importBtn = document.getElementById('import-config-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.importConfig());
        }
        
        // 重置按钮
        const resetBtn = document.getElementById('reset-config-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetConfig());
        }
    }
    
    addChangeListener(id, callback) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', (e) => callback(e.target.value));
        }
    }
    
    addInputListener(id, callback) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', (e) => callback(e.target.value));
        }
    }
    
    addTextareaListener(id, callback) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', (e) => callback(e.target.value));
        }
    }
    
    addCheckboxListener(id, callback) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', (e) => callback(e.target.checked));
        }
    }
    
    setupAutoSave() {
        // 可以添加自动保存逻辑
        console.log('💾 自动保存功能已准备');
    }
    
    switchSection(sectionId) {
        console.log(`🔀 切换到设置部分: ${sectionId}`);
        
        // 更新导航
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        document.querySelector(`.nav-item[href="#${sectionId}"]`)?.classList.add('active');
        
        // 隐藏所有部分
        document.querySelectorAll('.settings-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // 显示目标部分
        const targetSection = document.getElementById(`${sectionId}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
            this.currentSection = sectionId;
            
            // 滚动到顶部
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    
    async populateJavaSelect(versions) {
        const javaSelect = document.getElementById('java-path-select');
        if (!javaSelect) return;
        
        // 清空选项
        javaSelect.innerHTML = '<option value="">自动检测</option>';
        
        // 添加检测到的 Java
        versions.forEach(java => {
            const option = document.createElement('option');
            option.value = java.path;
            option.textContent = `Java ${java.version} (${java.vendor} ${java.bitness})`;
            option.dataset.info = JSON.stringify(java);
            javaSelect.appendChild(option);
        });
        
        // 如果有自定义 Java 路径，添加到选项
        if (this.config.customJavaPath) {
            const option = document.createElement('option');
            option.value = this.config.customJavaPath;
            option.textContent = `自定义路径: ${this.config.customJavaPath}`;
            javaSelect.appendChild(option);
        }
    }
    
    updateJavaInfo() {
        const javaSelect = document.getElementById('java-path-select');
        const javaInfoDiv = document.getElementById('java-info');
        
        if (!javaSelect || !javaInfoDiv) return;
        
        const selectedPath = javaSelect.value;
        if (!selectedPath) {
            javaInfoDiv.innerHTML = '';
            return;
        }
        
        const selectedOption = javaSelect.options[javaSelect.selectedIndex];
        if (selectedOption.dataset.info) {
            try {
                const javaInfo = JSON.parse(selectedOption.dataset.info);
                javaInfoDiv.innerHTML = `
                    <div class="java-details">
                        <div class="java-detail">
                            <span class="java-label">版本</span>
                            <span class="java-value">${javaInfo.version}</span>
                        </div>
                        <div class="java-detail">
                            <span class="java-label">供应商</span>
                            <span class="java-value">${javaInfo.vendor}</span>
                        </div>
                        <div class="java-detail">
                            <span class="java-label">类型</span>
                            <span class="java-value">${javaInfo.type}</span>
                        </div>
                        <div class="java-detail">
                            <span class="java-label">位数</span>
                            <span class="java-value">${javaInfo.bitness}</span>
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error('解析 Java 信息失败:', error);
                javaInfoDiv.innerHTML = `<div class="java-error">无法获取 Java 信息</div>`;
            }
        } else {
            javaInfoDiv.innerHTML = `<div class="java-info">自定义 Java 路径</div>`;
        }
    }
    
    applyJvmPreset(preset) {
        const jvmArgsTextarea = document.getElementById('jvm-arguments');
        if (!jvmArgsTextarea) return;
        
        const presets = {
            optimized: `-Xmx2G
-Xms1G
-XX:+UseG1GC
-XX:G1NewSizePercent=20
-XX:G1ReservePercent=20
-XX:MaxGCPauseMillis=50
-XX:G1HeapRegionSize=32M
-Dfml.ignoreInvalidMinecraftCertificates=true
-Dfml.ignorePatchDiscrepancies=true`,
            
            performance: `-Xmx3G
-Xms1G
-XX:+UseG1GC
-XX:+ParallelRefProcEnabled
-XX:MaxGCPauseMillis=200
-XX:+UnlockExperimentalVMOptions
-XX:+DisableExplicitGC
-XX:+AlwaysPreTouch
-XX:G1NewSizePercent=30
-XX:G1MaxNewSizePercent=40
-XX:G1HeapRegionSize=8M
-XX:G1ReservePercent=20
-XX:G1HeapWastePercent=5
-XX:G1MixedGCCountTarget=4
-XX:InitiatingHeapOccupancyPercent=15
-XX:G1MixedGCLiveThresholdPercent=90
-XX:G1RSetUpdatingPauseTimePercent=5
-XX:SurvivorRatio=32
-XX:+PerfDisableSharedMem
-XX:MaxTenuringThreshold=1`,
            
            compatibility: `-Xmx2G
-Xms1G
-XX:+UseConcMarkSweepGC
-XX:+CMSIncrementalMode
-XX:-UseAdaptiveSizePolicy
-Dfml.ignoreInvalidMinecraftCertificates=true
-Dfml.ignorePatchDiscrepancies=true
-Djava.net.preferIPv4Stack=true`,
            
            minimal: `-Xmx1G
-Xms512M
-XX:+UseG1GC`
        };
        
        if (presets[preset]) {
            jvmArgsTextarea.value = presets[preset];
        }
    }
    
    async calculateDiskUsage() {
        const diskFill = document.getElementById('disk-fill');
        const diskUsed = document.getElementById('disk-used');
        const diskTotal = document.getElementById('disk-total');
        const diskPercent = document.getElementById('disk-percent');
        
        if (!diskFill || !diskUsed) return;
        
        // 模拟计算磁盘使用
        const used = 8.5; // GB
        const total = 256; // GB
        const percent = Math.round((used / total) * 100);
        
        diskFill.style.width = `${percent}%`;
        diskUsed.textContent = `${used} GB`;
        if (diskTotal) diskTotal.textContent = `${total} GB`;
        if (diskPercent) diskPercent.textContent = `${percent}%`;
    }
    
    updateCacheInfo() {
        const cachePath = document.getElementById('cache-path');
        const cacheSize = document.getElementById('cache-size');
        
        if (cachePath && this.paths) {
            cachePath.textContent = this.paths.cacheDir || '未设置';
        }
        
        if (cacheSize) {
            cacheSize.textContent = '125 MB'; // 模拟缓存大小
        }
    }
    
    setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        this.config.theme = theme;
        this.markChanged();
    }
    
    updateSystemInfo() {
        const elements = {
            'sys-os': () => navigator.platform || '未知',
            'sys-arch': () => navigator.userAgent.includes('x64') ? 'x64' : 'x86',
            'sys-memory': () => `${Math.round(navigator.deviceMemory || 8)} GB`,
            'sys-electron': () => 'Electron 25.0.0',
            'sys-node': () => 'Node.js 18.0.0',
            'sys-chrome': () => navigator.userAgent.match(/Chrome\/(\S+)/)?.[1] || '未知'
        };
        
        Object.entries(elements).forEach(([id, getter]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = getter();
            }
        });
    }
    
    updatePathInfo() {
        if (!this.paths) return;
        
        const elements = {
            'path-app': this.paths.exeDir,
            'path-data': this.paths.appDataPath,
            'path-game': this.paths.gameDirectory,
            'path-logs': this.paths.logDir
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element && value) {
                element.textContent = value;
            }
        });
    }
    
    setSelect(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value;
        }
    }
    
    setInput(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value;
        }
    }
    
    setTextarea(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value;
        }
    }
    
    setSlider(id, value, displayId = null, isPercent = false) {
        const slider = document.getElementById(id);
        if (slider) {
            slider.value = value;
        }
        
        if (displayId) {
            const display = document.getElementById(displayId);
            if (display) {
                display.textContent = isPercent ? `${value}%` : value;
            }
        }
    }
    
    setCheckbox(id, checked) {
        const element = document.getElementById(id);
        if (element) {
            element.checked = checked;
        }
    }
    
    setRadio(name, value) {
        const radios = document.querySelectorAll(`input[name="${name}"]`);
        radios.forEach(radio => {
            radio.checked = radio.value === value;
        });
    }
    
    markChanged() {
        if (!this.hasUnsavedChanges) {
            this.hasUnsavedChanges = true;
            this.updateSaveStatus('有未保存的更改');
        }
    }
    
    updateSaveStatus(message) {
        const statusElement = document.getElementById('config-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.style.color = '#ff9800';
        }
    }
    
    updateSavedStatus() {
        const statusElement = document.getElementById('config-status');
        if (statusElement) {
            statusElement.textContent = '配置已保存';
            statusElement.style.color = '#00c853';
        }
    }
    
    updateUI() {
        // 更新版本号
        const versionElement = document.querySelector('.version-badge');
        if (versionElement) {
            versionElement.textContent = this.config.version || 'v1.0.0';
        }
        
        // 更新主题
        if (this.config.theme) {
            this.setTheme(this.config.theme);
        }
        
        console.log('🎨 界面更新完成');
    }
    
    // 公共方法
    switchSection(section) {
        this.switchSection(section);
    }
    
    async saveSettings() {
        if (this.isSaving) return;
        
        this.isSaving = true;
        console.log('💾 正在保存设置...');
        
        try {
            // 更新配置状态
            this.updateSaveStatus('正在保存...');
            
            // 如果是 Electron 环境，保存到主进程
            if (typeof window.electronAPI !== 'undefined') {
                const success = await window.electronAPI.invoke('save-config', this.config);
                if (success) {
                    this.updateSavedStatus();
                    this.hasUnsavedChanges = false;
                    this.showSuccess('设置保存成功');
                } else {
                    throw new Error('保存失败');
                }
            } else {
                // 模拟保存
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.updateSavedStatus();
                this.hasUnsavedChanges = false;
                this.showSuccess('设置保存成功（模拟）');
            }
            
            console.log('✅ 设置保存完成');
        } catch (error) {
            console.error('❌ 保存设置失败:', error);
            this.showError('保存失败', error.message);
        } finally {
            this.isSaving = false;
        }
    }
    
    async exportConfig() {
        try {
            if (typeof window.electronAPI !== 'undefined') {
                const filePath = await window.electronAPI.invoke('show-save-dialog', {
                    title: '导出配置',
                    defaultPath: 'hcl-config-backup.json',
                    filters: [{ name: 'JSON Files', extensions: ['json'] }]
                });
                
                if (filePath) {
                    const success = await window.electronAPI.invoke('export-config', filePath);
                    if (success) {
                        this.showSuccess('配置导出成功');
                    }
                }
            } else {
                this.showInfo('导出功能在浏览器中不可用');
            }
        } catch (error) {
            this.showError('导出失败', error.message);
        }
    }
    
    async importConfig() {
        try {
            if (typeof window.electronAPI !== 'undefined') {
                const filePath = await window.electronAPI.invoke('show-open-dialog', {
                    title: '导入配置',
                    filters: [{ name: 'JSON Files', extensions: ['json'] }],
                    properties: ['openFile']
                });
                
                if (filePath && filePath[0]) {
                    const success = await window.electronAPI.invoke('import-config', filePath[0]);
                    if (success) {
                        this.showSuccess('配置导入成功');
                        // 重新加载配置
                        this.config = await window.electronAPI.invoke('get-config') || {};
                        await this.loadSettings();
                    }
                }
            } else {
                this.showInfo('导入功能在浏览器中不可用');
            }
        } catch (error) {
            this.showError('导入失败', error.message);
        }
    }
    
    async resetConfig() {
        if (confirm('确定要重置所有设置吗？这将恢复为默认设置。')) {
            try {
                if (typeof window.electronAPI !== 'undefined') {
                    const newConfig = await window.electronAPI.invoke('reset-config');
                    if (newConfig) {
                        this.config = newConfig;
                        await this.loadSettings();
                        this.showSuccess('设置已重置为默认值');
                    }
                } else {
                    // 模拟重置
                    this.config = await this.loadMockData();
                    await this.loadSettings();
                    this.showSuccess('设置已重置为默认值（模拟）');
                }
            } catch (error) {
                this.showError('重置失败', error.message);
            }
        }
    }
    
    // 辅助方法
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showError(title, message) {
        this.showNotification(`${title}: ${message}`, 'error');
    }
    
    showInfo(message) {
        this.showNotification(message, 'info');
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 300px;
            max-width: 400px;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.SettingsManager = SettingsManager;
}
