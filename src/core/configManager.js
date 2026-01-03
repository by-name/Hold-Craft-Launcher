// src/core/ConfigManager.js
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class HCLConfigManager {
    constructor() {
        this.isPortable = this.checkPortableMode();
        this.initPaths();
    }
    
    /**
     * 检查是否为便携模式
     */
    checkPortableMode() {
        // 检查是否在可执行文件同目录有便携模式标记
        const exeDir = process.cwd(); // 可执行文件所在目录
        const portableFlag = path.join(exeDir, 'portable.flag');
        
        try {
            if (fs.existsSync(portableFlag)) {
                return true;
            }
        } catch (error) {
            // 忽略错误
        }
        
        // 检查是否在可执行文件同目录运行
        if (process.argv[0].includes('HCL Launcher.exe') || 
            process.argv[0].includes('hcl-launcher')) {
            return true;
        }
        
        return false;
    }
    
    /**
     * 初始化路径
     */
    initPaths() {
        if (this.isPortable) {
            // 便携模式：使用可执行文件同目录
            this.exeDir = process.cwd();
            this.appDataPath = path.join(this.exeDir, 'hcl-data');
            this.configPath = path.join(this.appDataPath, 'hcl-config.json');
            this.gameDirectory = path.join(this.exeDir, '.minecraft');
        } else {
            // 安装模式：使用系统用户数据目录
            const { app } = require('electron');
            this.appDataPath = app.getPath('userData');
            this.configPath = path.join(this.appDataPath, 'hcl-config.json');
            this.gameDirectory = path.join(os.homedir(), '.hcl-minecraft');
        }
    }
    
    /**
     * 创建所有必要的目录结构
     */
    async createDirectoryStructure() {
        console.log('创建目录结构...');
        
        const directories = [
            // 应用数据目录
            this.appDataPath,
            path.join(this.appDataPath, 'logs'),
            path.join(this.appDataPath, 'cache'),
            path.join(this.appDataPath, 'avatars'),
            path.join(this.appDataPath, 'temp'),
            
            // 游戏目录
            this.gameDirectory,
            path.join(this.gameDirectory, 'versions'),
            path.join(this.gameDirectory, 'libraries'),
            path.join(this.gameDirectory, 'assets'),
            path.join(this.gameDirectory, 'assets', 'objects'),
            path.join(this.gameDirectory, 'assets', 'indexes'),
            path.join(this.gameDirectory, 'mods'),
            path.join(this.gameDirectory, 'resourcepacks'),
            path.join(this.gameDirectory, 'shaderpacks'),
            path.join(this.gameDirectory, 'saves'),
            path.join(this.gameDirectory, 'screenshots'),
            path.join(this.gameDirectory, 'logs'),
            path.join(this.gameDirectory, 'crash-reports')
        ];
        
        try {
            for (const dir of directories) {
                await fs.mkdir(dir, { recursive: true });
                console.log(`✓ 创建目录: ${dir}`);
            }
            
            console.log('目录结构创建完成');
            return true;
        } catch (error) {
            console.error('创建目录结构失败:', error);
            throw error;
        }
    }
    
    /**
     * 创建默认配置文件
     */
    async createDefaultConfig() {
        const defaultConfig = {
            version: '1.0.0',
            isPortable: this.isPortable,
            firstRun: true,
            firstRunTime: new Date().toISOString(),
            
            // 游戏设置
            gameDirectory: this.gameDirectory,
            downloadSource: 'bmclapi',
            memory: 2048,
            javaPath: '',
            javaArgs: '',
            gameArgs: '',
            
            // 界面设置
            language: 'zh_CN',
            theme: 'dark',
            windowBounds: { width: 1200, height: 800 },
            
            // 账户设置
            lastUsedAccount: null,
            autoLogin: false,
            
            // 下载设置
            maxThreads: 2,
            maxRetries: 3,
            downloadTimeout: 30000,
            
            // 启动设置
            closeOnLaunch: false,
            showConsole: false,
            
            // 网络设置
            proxy: '',
            mirrorSites: {
                official: 'https://launchermeta.mojang.com',
                bmclapi: 'https://bmclapi2.bangbang93.com'
            }
        };
        
        try {
            await fs.writeFile(
                this.configPath,
                JSON.stringify(defaultConfig, null, 2),
                'utf8'
            );
            
            console.log('✓ 创建默认配置文件');
            return defaultConfig;
        } catch (error) {
            console.error('创建配置文件失败:', error);
            throw error;
        }
    }
    
    /**
     * 检查并创建便携模式标志
     */
    async createPortableFlag() {
        if (this.isPortable) {
            const flagPath = path.join(this.exeDir, 'portable.flag');
            const flagContent = `HCL Launcher 便携模式标志
创建时间: ${new Date().toISOString()}
版本: 1.0.0
说明: 删除此文件可禁用便携模式`;
            
            try {
                await fs.writeFile(flagPath, flagContent, 'utf8');
                console.log('✓ 创建便携模式标志文件');
                return true;
            } catch (error) {
                console.warn('创建便携模式标志失败:', error);
            }
        }
        return false;
    }
    
    /**
     * 创建使用说明文件
     */
    async createReadmeFile() {
        const readmePath = path.join(this.exeDir, 'README-PORTABLE.txt');
        const readmeContent = `=== HCL 启动器便携版使用说明 ===

一、目录结构
HCL Launcher.exe       - 主程序
hcl-data/             - 用户数据和配置
  ├── hcl-config.json - 配置文件
  ├── data.json       - 账户数据
  ├── logs/           - 日志文件
  └── avatars/        - 头像缓存
.minecraft/           - 游戏文件目录
  ├── versions/       - 游戏版本
  ├── mods/           - 模组文件
  ├── saves/          - 游戏存档
  └── resourcepacks/  - 资源包

二、使用方法
1. 将整个文件夹复制到U盘或任意位置
2. 直接运行 HCL Launcher.exe
3. 所有文件都会保存在当前目录
4. 移动到其他电脑可直接使用

三、注意事项
1. 请勿删除 .minecraft 和 hcl-data 目录
2. 首次运行会自动创建必要目录
3. 支持多版本游戏共存
4. 所有配置本地保存

四、技术支持
日志文件: hcl-data/logs/
配置文件: hcl-data/hcl-config.json
问题反馈: 查看文档

更新时间: ${new Date().toLocaleDateString()}
`;

        try {
            await fs.writeFile(readmePath, readmeContent, 'utf8');
            console.log('✓ 创建使用说明文件');
            return true;
        } catch (error) {
            console.warn('创建使用说明文件失败:', error);
            return false;
        }
    }
    
    /**
     * 初始化配置管理器
     */
    async initialize() {
        console.log('初始化配置管理器...');
        console.log('便携模式:', this.isPortable);
        console.log('应用数据目录:', this.appDataPath);
        console.log('游戏目录:', this.gameDirectory);
        
        try {
            // 1. 创建目录结构
            await this.createDirectoryStructure();
            
            // 2. 创建便携模式标志
            await this.createPortableFlag();
            
            // 3. 创建使用说明
            await this.createReadmeFile();
            
            // 4. 加载或创建配置
            let config;
            try {
                const configData = await fs.readFile(this.configPath, 'utf8');
                config = JSON.parse(configData);
                
                // 更新配置
                config.isPortable = this.isPortable;
                config.gameDirectory = this.gameDirectory;
                
                console.log('✓ 加载现有配置文件');
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // 配置文件不存在，创建默认配置
                    config = await this.createDefaultConfig();
                } else {
                    throw error;
                }
            }
            
            // 5. 保存配置
            this.config = config;
            await this.saveConfig();
            
            console.log('配置管理器初始化完成');
            return this.config;
        } catch (error) {
            console.error('配置管理器初始化失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取配置
     */
    getConfig() {
        return { ...this.config };
    }
    
    /**
     * 保存配置
     */
    async saveConfig(newConfig = null) {
        if (newConfig) {
            this.config = { ...this.config, ...newConfig };
        }
        
        this.config.lastModified = new Date().toISOString();
        
        try {
            await fs.writeFile(
                this.configPath,
                JSON.stringify(this.config, null, 2),
                'utf8'
            );
            return true;
        } catch (error) {
            console.error('保存配置失败:', error);
            return false;
        }
    }
    
    /**
     * 导出当前配置
     */
    async exportConfig(exportPath) {
        try {
            const exportData = {
                config: this.config,
                exportTime: new Date().toISOString(),
                version: '1.0.0'
            };
            
            await fs.writeFile(
                exportPath,
                JSON.stringify(exportData, null, 2),
                'utf8'
            );
            return true;
        } catch (error) {
            console.error('导出配置失败:', error);
            return false;
        }
    }
    
    /**
     * 导入配置
     */
    async importConfig(importPath) {
        try {
            const importData = await fs.readFile(importPath, 'utf8');
            const data = JSON.parse(importData);
            
            if (data.config) {
                this.config = data.config;
                await this.saveConfig();
                return true;
            }
            return false;
        } catch (error) {
            console.error('导入配置失败:', error);
            return false;
        }
    }
    
    /**
     * 重置为默认配置
     */
    async resetToDefault() {
        return await this.createDefaultConfig();
    }
    
    /**
     * 获取路径信息
     */
    getPaths() {
        return {
            isPortable: this.isPortable,
            exeDir: this.exeDir,
            appDataPath: this.appDataPath,
            configPath: this.configPath,
            gameDirectory: this.gameDirectory,
            logDir: path.join(this.appDataPath, 'logs'),
            cacheDir: path.join(this.appDataPath, 'cache'),
            avatarDir: path.join(this.appDataPath, 'avatars'),
            tempDir: path.join(this.appDataPath, 'temp')
        };
    }
}

module.exports = HCLConfigManager;
