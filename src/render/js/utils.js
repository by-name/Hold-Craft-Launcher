// src/utils/utils.js
/**
 * HCL 启动器工具函数
 * 专为 Electron Windows 桌面版设计
 */

const { app, dialog, shell, clipboard, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const crypto = require('crypto');

// ==================== 文件系统工具 ====================

class FileUtils {
    /**
     * 确保目录存在
     */
    static async ensureDirectory(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
            return dirPath;
        } catch (error) {
            console.error('创建目录失败:', error);
            throw error;
        }
    }

    /**
     * 复制文件或目录
     */
    static async copy(source, target) {
        try {
            const stats = await fs.stat(source);
            
            if (stats.isDirectory()) {
                await this.copyDirectory(source, target);
            } else {
                await this.copyFile(source, target);
            }
            
            return true;
        } catch (error) {
            console.error('复制失败:', error);
            throw error;
        }
    }

    /**
     * 复制文件
     */
    static async copyFile(source, target) {
        try {
            await fs.copyFile(source, target);
            return true;
        } catch (error) {
            throw new Error(`复制文件失败: ${error.message}`);
        }
    }

    /**
     * 复制目录
     */
    static async copyDirectory(source, target) {
        try {
            await this.ensureDirectory(target);
            
            const files = await fs.readdir(source);
            
            for (const file of files) {
                const sourcePath = path.join(source, file);
                const targetPath = path.join(target, file);
                
                const stats = await fs.stat(sourcePath);
                if (stats.isDirectory()) {
                    await this.copyDirectory(sourcePath, targetPath);
                } else {
                    await this.copyFile(sourcePath, targetPath);
                }
            }
            
            return true;
        } catch (error) {
            throw new Error(`复制目录失败: ${error.message}`);
        }
    }

    /**
     * 删除文件或目录
     */
    static async delete(path) {
        try {
            const stats = await fs.stat(path);
            
            if (stats.isDirectory()) {
                await fs.rm(path, { recursive: true, force: true });
            } else {
                await fs.unlink(path);
            }
            
            return true;
        } catch (error) {
            console.error('删除失败:', error);
            return false;
        }
    }

    /**
     * 计算文件大小
     */
    static async getFileSize(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return stats.size;
        } catch (error) {
            return 0;
        }
    }

    /**
     * 计算目录大小
     */
    static async getDirectorySize(dirPath) {
        let totalSize = 0;
        
        async function calculateSize(currentPath) {
            const files = await fs.readdir(currentPath);
            
            for (const file of files) {
                const filePath = path.join(currentPath, file);
                const stats = await fs.stat(filePath);
                
                if (stats.isDirectory()) {
                    await calculateSize(filePath);
                } else {
                    totalSize += stats.size;
                }
            }
        }
        
        try {
            await calculateSize(dirPath);
            return totalSize;
        } catch (error) {
            console.error('计算目录大小失败:', error);
            return 0;
        }
    }

    /**
     * 格式化文件大小
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 检查文件是否存在
     */
    static async exists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 读取 JSON 文件
     */
    static async readJson(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('读取 JSON 失败:', error);
            throw error;
        }
    }

    /**
     * 写入 JSON 文件
     */
    static async writeJson(filePath, data) {
        try {
            const json = JSON.stringify(data, null, 2);
            await fs.writeFile(filePath, json, 'utf8');
            return true;
        } catch (error) {
            console.error('写入 JSON 失败:', error);
            throw error;
        }
    }

    /**
     * 搜索文件
     */
    static async searchFiles(dirPath, pattern) {
        const results = [];
        
        async function search(currentPath) {
            try {
                const files = await fs.readdir(currentPath);
                
                for (const file of files) {
                    const filePath = path.join(currentPath, file);
                    const stats = await fs.stat(filePath);
                    
                    if (stats.isDirectory()) {
                        await search(filePath);
                    } else if (file.match(pattern)) {
                        results.push(filePath);
                    }
                }
            } catch (error) {
                // 忽略权限错误
            }
        }
        
        await search(dirPath);
        return results;
    }

    /**
     * 获取文件哈希
     */
    static async getFileHash(filePath, algorithm = 'sha256') {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash(algorithm);
            const stream = fs.createReadStream(filePath);
            
            stream.on('data', data => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }
}

// ==================== 系统工具 ====================

class SystemUtils {
    /**
     * 获取系统信息
     */
    static getSystemInfo() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus(),
            cpuCount: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            usedMemory: os.totalmem() - os.freemem(),
            uptime: os.uptime(),
            hostname: os.hostname(),
            homedir: os.homedir(),
            tempdir: os.tmpdir(),
            networkInterfaces: os.networkInterfaces()
        };
    }

    /**
     * 格式化系统信息
     */
    static getFormattedSystemInfo() {
        const info = this.getSystemInfo();
        
        return {
            os: `${info.platform} ${info.arch}`,
            cpu: `${info.cpuCount} 核心`,
            memory: `${this.formatMemory(info.totalMemory)} 总内存`,
            freeMemory: `${this.formatMemory(info.freeMemory)} 可用内存`,
            uptime: `${Math.floor(info.uptime / 3600)} 小时`,
            user: info.hostname
        };
    }

    /**
     * 格式化内存大小
     */
    static formatMemory(bytes) {
        const mb = bytes / 1024 / 1024;
        if (mb < 1024) {
            return `${mb.toFixed(2)} MB`;
        } else {
            return `${(mb / 1024).toFixed(2)} GB`;
        }
    }

    /**
     * 检查管理员权限
     */
    static async checkAdminPrivileges() {
        if (process.platform !== 'win32') return false;
        
        try {
            const { execSync } = require('child_process');
            execSync('net session', { stdio: 'ignore' });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取 Windows 版本
     */
    static getWindowsVersion() {
        if (process.platform !== 'win32') return null;
        
        const version = os.release();
        const versions = {
            '10.0': 'Windows 10/11',
            '6.3': 'Windows 8.1',
            '6.2': 'Windows 8',
            '6.1': 'Windows 7',
            '6.0': 'Windows Vista',
            '5.1': 'Windows XP',
            '5.0': 'Windows 2000'
        };
        
        const majorVersion = version.split('.')[0] + '.' + version.split('.')[1];
        return versions[majorVersion] || `Windows ${version}`;
    }

    /**
     * 检查 .NET Framework
     */
    static async checkDotNetFramework() {
        if (process.platform !== 'win32') return false;
        
        try {
            const { execSync } = require('child_process');
            const output = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full" /v Release', { encoding: 'utf8' });
            
            if (output.includes('Release')) {
                const match = output.match(/Release\s+DWORD\s+0x(\w+)/);
                if (match) {
                    const release = parseInt(match[1], 16);
                    return release >= 378389; // .NET 4.5
                }
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * 检查 DirectX
     */
    static async checkDirectX() {
        if (process.platform !== 'win32') return false;
        
        try {
            const dxdiag = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'dxdiag.exe');
            const exists = await FileUtils.exists(dxdiag);
            return exists;
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取显卡信息
     */
    static async getGraphicsInfo() {
        if (process.platform !== 'win32') return null;
        
        try {
            const { execSync } = require('child_process');
            
            // 通过 WMI 获取显卡信息
            const command = 'wmic path win32_VideoController get Name,AdapterRAM,DriverVersion /format:list';
            const output = execSync(command, { encoding: 'utf8' });
            
            const gpus = [];
            const lines = output.split('\n').filter(line => line.trim());
            
            let currentGpu = {};
            for (const line of lines) {
                if (line.includes('Name=')) {
                    if (Object.keys(currentGpu).length > 0) {
                        gpus.push(currentGpu);
                    }
                    currentGpu = { name: line.split('=')[1] };
                } else if (line.includes('AdapterRAM=')) {
                    const vram = parseInt(line.split('=')[1]) || 0;
                    currentGpu.vram = `${(vram / 1024 / 1024).toFixed(0)} MB`;
                } else if (line.includes('DriverVersion=')) {
                    currentGpu.driver = line.split('=')[1];
                }
            }
            
            if (Object.keys(currentGpu).length > 0) {
                gpus.push(currentGpu);
            }
            
            return gpus;
        } catch (error) {
            console.error('获取显卡信息失败:', error);
            return null;
        }
    }
}

// ==================== 网络工具 ====================

class NetworkUtils {
    /**
     * 检查网络连接
     */
    static async checkInternetConnection(timeout = 5000) {
        return new Promise((resolve) => {
            const testUrls = [
                'https://www.minecraft.net',
                'https://www.baidu.com',
                'https://www.google.com'
            ];
            
            let connected = false;
            let completed = 0;
            
            const checkUrl = (url) => {
                const https = require('https');
                const req = https.get(url, { timeout }, (res) => {
                    connected = true;
                    resolve(true);
                });
                
                req.on('timeout', () => {
                    req.destroy();
                    onComplete();
                });
                
                req.on('error', onComplete);
                req.on('close', onComplete);
            };
            
            const onComplete = () => {
                completed++;
                if (!connected && completed === testUrls.length) {
                    resolve(false);
                }
            };
            
            testUrls.forEach(url => checkUrl(url));
        });
    }

    /**
     * 获取本机 IP 地址
     */
    static getLocalIP() {
        const interfaces = os.networkInterfaces();
        
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        
        return '127.0.0.1';
    }

    /**
     * 下载文件
     */
    static async downloadFile(url, filePath, onProgress = null) {
        return new Promise((resolve, reject) => {
            const https = require('https');
            const http = require('http');
            const fs = require('fs');
            
            const protocol = url.startsWith('https') ? https : http;
            const tempPath = filePath + '.downloading';
            
            const fileStream = fs.createWriteStream(tempPath);
            let downloaded = 0;
            let totalSize = 0;
            let lastProgress = 0;
            
            const request = protocol.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                
                totalSize = parseInt(response.headers['content-length']) || 0;
                
                response.on('data', (chunk) => {
                    downloaded += chunk.length;
                    fileStream.write(chunk);
                    
                    if (onProgress && totalSize > 0) {
                        const percent = Math.floor((downloaded / totalSize) * 100);
                        
                        // 避免频繁回调
                        if (percent >= lastProgress + 5 || percent === 100) {
                            lastProgress = percent;
                            onProgress({
                                downloaded,
                                total: totalSize,
                                percent,
                                speed: 0
                            });
                        }
                    }
                });
                
                response.on('end', () => {
                    fileStream.end();
                    
                    // 重命名为最终文件名
                    fs.rename(tempPath, filePath, (error) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve({ path: filePath, size: downloaded });
                        }
                    });
                });
            });
            
            request.on('error', (error) => {
                fileStream.destroy();
                fs.unlink(tempPath, () => {});
                reject(error);
            });
            
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('请求超时'));
            });
        });
    }

    /**
     * 获取公网 IP
     */
    static async getPublicIP() {
        try {
            const https = require('https');
            
            return new Promise((resolve, reject) => {
                const req = https.get('https://api.ipify.org?format=json', (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const result = JSON.parse(data);
                            resolve(result.ip);
                        } catch (error) {
                            reject(error);
                        }
                    });
                });
                
                req.on('error', reject);
                req.setTimeout(5000, () => {
                    req.destroy();
                    reject(new Error('超时'));
                });
            });
        } catch (error) {
            return null;
        }
    }
}

// ==================== 加密安全工具 ====================

class SecurityUtils {
    /**
     * 加密数据
     */
    static encrypt(text, key = 'hcl-launcher-key') {
        try {
            const algorithm = 'aes-256-gcm';
            const salt = crypto.randomBytes(16);
            const derivedKey = crypto.scryptSync(key, salt, 32);
            const iv = crypto.randomBytes(16);
            
            const cipher = crypto.createCipheriv(algorithm, derivedKey, iv);
            cipher.setAAD(Buffer.from('hcl-launcher'));
            
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return {
                iv: iv.toString('hex'),
                salt: salt.toString('hex'),
                data: encrypted,
                tag: authTag.toString('hex')
            };
        } catch (error) {
            console.error('加密失败:', error);
            return null;
        }
    }

    /**
     * 解密数据
     */
    static decrypt(encryptedData, key = 'hcl-launcher-key') {
        try {
            const algorithm = 'aes-256-gcm';
            const iv = Buffer.from(encryptedData.iv, 'hex');
            const salt = Buffer.from(encryptedData.salt, 'hex');
            const derivedKey = crypto.scryptSync(key, salt, 32);
            
            const decipher = crypto.createDecipheriv(algorithm, derivedKey, iv);
            decipher.setAAD(Buffer.from('hcl-launcher'));
            decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
            
            let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('解密失败:', error);
            return null;
        }
    }

    /**
     * 哈希密码
     */
    static hashPassword(password, salt = null) {
        if (!salt) {
            salt = crypto.randomBytes(16).toString('hex');
        }
        
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512');
        return {
            hash: hash.toString('hex'),
            salt: salt
        };
    }

    /**
     * 验证密码
     */
    static verifyPassword(password, hash, salt) {
        const newHash = this.hashPassword(password, salt);
        return newHash.hash === hash;
    }

    /**
     * 生成随机字符串
     */
    static generateRandomString(length = 32) {
        return crypto.randomBytes(length).toString('hex').substring(0, length);
    }

    /**
     * 生成 UUID
     */
    static generateUUID() {
        return crypto.randomUUID();
    }

    /**
     * 验证文件签名
     */
    static async verifyFileSignature(filePath, expectedHash, algorithm = 'sha256') {
        try {
            const fileHash = await FileUtils.getFileHash(filePath, algorithm);
            return fileHash === expectedHash;
        } catch (error) {
            return false;
        }
    }
}

// ==================== 界面工具 ====================

class UIUtils {
    /**
     * 显示消息对话框
     */
    static async showMessage(title, message, type = 'info') {
        if (typeof dialog !== 'undefined') {
            const buttons = ['确定'];
            const options = {
                type: type,
                title: title,
                message: message,
                buttons: buttons
            };
            
            return await dialog.showMessageBox(options);
        } else {
            console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
            return { response: 0 };
        }
    }

    /**
     * 显示错误对话框
     */
    static async showError(title, message) {
        return await this.showMessage(title, message, 'error');
    }

    /**
     * 显示警告对话框
     */
    static async showWarning(title, message) {
        return await this.showMessage(title, message, 'warning');
    }

    /**
     * 显示信息对话框
     */
    static async showInfo(title, message) {
        return await this.showMessage(title, message, 'info');
    }

    /**
     * 显示确认对话框
     */
    static async showConfirm(title, message, buttons = ['确定', '取消']) {
        if (typeof dialog !== 'undefined') {
            const options = {
                type: 'question',
                title: title,
                message: message,
                buttons: buttons,
                defaultId: 0,
                cancelId: 1
            };
            
            const result = await dialog.showMessageBox(options);
            return result.response === 0;
        } else {
            console.log(`[CONFIRM] ${title}: ${message}`);
            return true;
        }
    }

    /**
     * 显示文件选择对话框
     */
    static async showFileDialog(options = {}) {
        if (typeof dialog !== 'undefined') {
            const defaultOptions = {
                title: '选择文件',
                properties: ['openFile']
            };
            
            const result = await dialog.showOpenDialog({ ...defaultOptions, ...options });
            return result.filePaths[0] || null;
        } else {
            console.log('文件对话框不可用');
            return null;
        }
    }

    /**
     * 显示目录选择对话框
     */
    static async showFolderDialog(title = '选择目录') {
        return await this.showFileDialog({
            title: title,
            properties: ['openDirectory', 'createDirectory']
        });
    }

    /**
     * 保存文件对话框
     */
    static async showSaveDialog(options = {}) {
        if (typeof dialog !== 'undefined') {
            const defaultOptions = {
                title: '保存文件',
                properties: ['createDirectory']
            };
            
            const result = await dialog.showSaveDialog({ ...defaultOptions, ...options });
            return result.filePath || null;
        } else {
            console.log('保存对话框不可用');
            return null;
        }
    }

    /**
     * 复制文本到剪贴板
     */
    static copyToClipboard(text) {
        if (typeof clipboard !== 'undefined') {
            clipboard.writeText(text);
        } else {
            console.log('剪贴板不可用');
        }
    }

    /**
     * 从剪贴板读取文本
     */
    static readFromClipboard() {
        if (typeof clipboard !== 'undefined') {
            return clipboard.readText();
        } else {
            console.log('剪贴板不可用');
            return '';
        }
    }

    /**
     * 打开外部链接
     */
    static openExternal(url) {
        if (typeof shell !== 'undefined') {
            shell.openExternal(url).catch(console.error);
        } else {
            console.log(`打开链接: ${url}`);
        }
    }

    /**
     * 打开文件所在目录
     */
    static showItemInFolder(filePath) {
        if (typeof shell !== 'undefined') {
            shell.showItemInFolder(filePath);
        } else {
            console.log(`打开目录: ${filePath}`);
        }
    }

    /**
     * 打开文件
     */
    static openPath(filePath) {
        if (typeof shell !== 'undefined') {
            shell.openPath(filePath).catch(console.error);
        } else {
            console.log(`打开文件: ${filePath}`);
        }
    }
}

// ==================== 路径工具 ====================

class PathUtils {
    /**
     * 获取应用数据目录
     */
    static getAppDataPath() {
        if (typeof app !== 'undefined') {
            return app.getPath('userData');
        } else {
            return path.join(os.homedir(), '.hcl-launcher');
        }
    }

    /**
     * 获取游戏目录
     */
    static getGameDirectory() {
        const configPath = path.join(this.getAppDataPath(), 'hcl-config.json');
        
        try {
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.gameDirectory) {
                    return config.gameDirectory;
                }
            }
        } catch (error) {
            // 使用默认目录
        }
        
        return path.join(os.homedir(), '.hcl-minecraft');
    }

    /**
     * 获取临时目录
     */
    static getTempDir() {
        return path.join(os.tmpdir(), 'hcl-launcher');
    }

    /**
     * 获取日志目录
     */
    static getLogDir() {
        return path.join(this.getAppDataPath(), 'logs');
    }

    /**
     * 获取缓存目录
     */
    static getCacheDir() {
        return path.join(this.getAppDataPath(), 'cache');
    }

    /**
     * 获取模组目录
     */
    static getModsDir(version = null) {
        const gameDir = this.getGameDirectory();
        if (version) {
            return path.join(gameDir, 'mods', version);
        }
        return path.join(gameDir, 'mods');
    }

    /**
     * 获取资源包目录
     */
    static getResourcePacksDir() {
        return path.join(this.getGameDirectory(), 'resourcepacks');
    }

    /**
     * 获取光影包目录
     */
    static getShaderPacksDir() {
        return path.join(this.getGameDirectory(), 'shaderpacks');
    }

    /**
     * 获取截图目录
     */
    static getScreenshotsDir() {
        return path.join(this.getGameDirectory(), 'screenshots');
    }

    /**
     * 获取保存目录
     */
    static getSavesDir() {
        return path.join(this.getGameDirectory(), 'saves');
    }

    /**
     * 规范化路径
     */
    static normalizePath(filePath) {
        return path.normalize(filePath);
    }

    /**
     * 获取相对路径
     */
    static relativePath(from, to) {
        return path.relative(from, to);
    }

    /**
     * 获取绝对路径
     */
    static resolvePath(...paths) {
        return path.resolve(...paths);
    }
}

// ==================== 日志工具 ====================

class Logger {
    constructor() {
        this.logLevel = 'info';
        this.logFile = null;
        this.init();
    }

    async init() {
        const logDir = PathUtils.getLogDir();
        await FileUtils.ensureDirectory(logDir);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.logFile = path.join(logDir, `hcl-${timestamp}.log`);
        
        await fs.writeFile(this.logFile, `=== HCL 启动器日志开始 ===\n时间: ${new Date().toISOString()}\n\n`, 'utf8');
    }

    setLogLevel(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        if (levels.includes(level)) {
            this.logLevel = level;
        }
    }

    async log(level, message, data = null) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const levelIndex = levels.indexOf(level);
        const minLevelIndex = levels.indexOf(this.logLevel);
        
        if (levelIndex < minLevelIndex) return;
        
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            data
        };
        
        // 控制台输出
        const color = this.getLogColor(level);
        console.log(`%c[${timestamp}] ${level.toUpperCase()}: ${message}`, `color: ${color};`, data || '');
        
        // 文件输出
        if (this.logFile) {
            const logText = `${timestamp} [${level.toUpperCase()}] ${message} ${data ? JSON.stringify(data) : ''}\n`;
            await fs.appendFile(this.logFile, logText, 'utf8');
        }
    }

    getLogColor(level) {
        const colors = {
            debug: '#9b59b6',
            info: '#3498db',
            warn: '#f39c12',
            error: '#e74c3c'
        };
        return colors[level] || '#ffffff';
    }

    debug(message, data = null) {
        this.log('debug', message, data);
    }

    info(message, data = null) {
        this.log('info', message, data);
    }

    warn(message, data = null) {
        this.log('warn', message, data);
    }

    error(message, data = null) {
        this.log('error', message, data);
    }

    async getLogs(limit = 100) {
        if (!this.logFile) return [];
        
        try {
            const content = await fs.readFile(this.logFile, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            return lines.slice(-limit);
        } catch (error) {
            return [];
        }
    }

    async clearLogs() {
        if (this.logFile) {
            await fs.writeFile(this.logFile, '', 'utf8');
        }
    }
}

// ==================== IPC 通信工具 ====================

class IPCHelper {
    /**
     * 发送消息到主进程
     */
    static send(channel, ...args) {
        if (typeof ipcRenderer !== 'undefined') {
            ipcRenderer.send(channel, ...args);
        } else {
            console.log(`[IPC Send] ${channel}:`, args);
        }
    }

    /**
     * 发送消息并等待响应
     */
    static invoke(channel, ...args) {
        if (typeof ipcRenderer !== 'undefined') {
            return ipcRenderer.invoke(channel, ...args);
        } else {
            console.log(`[IPC Invoke] ${channel}:`, args);
            return Promise.resolve(null);
        }
    }

    /**
     * 监听消息
     */
    static on(channel, callback) {
        if (typeof ipcRenderer !== 'undefined') {
            ipcRenderer.on(channel, (event, ...args) => callback(...args));
        } else {
            console.log(`[IPC On] ${channel} 监听已设置`);
        }
    }

    /**
     * 监听一次消息
     */
    static once(channel, callback) {
        if (typeof ipcRenderer !== 'undefined') {
            ipcRenderer.once(channel, (event, ...args) => callback(...args));
        } else {
            console.log(`[IPC Once] ${channel} 监听已设置`);
        }
    }

    /**
     * 移除监听器
     */
    static removeListener(channel, callback) {
        if (typeof ipcRenderer !== 'undefined') {
            ipcRenderer.removeListener(channel, callback);
        }
    }

    /**
     * 移除所有监听器
     */
    static removeAllListeners(channel) {
        if (typeof ipcRenderer !== 'undefined') {
            ipcRenderer.removeAllListeners(channel);
        }
    }
}

// ==================== 其他工具 ====================

class MiscUtils {
    /**
     * 延迟执行
     */
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 生成版本号
     */
    static generateVersion() {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hour = now.getHours().toString().padStart(2, '0');
        const minute = now.getMinutes().toString().padStart(2, '0');
        
        return `${year}.${month}.${day}.${hour}${minute}`;
    }

    /**
     * 深度克隆对象
     */
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * 合并对象
     */
    static mergeObjects(...objects) {
        return Object.assign({}, ...objects);
    }

    /**
     * 防抖函数
     */
    static debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    /**
     * 节流函数
     */
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * 格式化时间
     */
    static formatTime(date = new Date(), format = 'YYYY-MM-DD HH:mm:ss') {
        const pad = (num) => num.toString().padStart(2, '0');
        
        const replacements = {
            'YYYY': date.getFullYear(),
            'MM': pad(date.getMonth() + 1),
            'DD': pad(date.getDate()),
            'HH': pad(date.getHours()),
            'mm': pad(date.getMinutes()),
            'ss': pad(date.getSeconds())
        };
        
        return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => replacements[match]);
    }

    /**
     * 计算耗时
     */
    static async timeExecution(func) {
        const start = Date.now();
        const result = await func();
        const end = Date.now();
        
        return {
            result,
            duration: end - start
        };
    }
}

// ==================== 导出所有工具类 ====================

module.exports = {
    FileUtils,
    SystemUtils,
    NetworkUtils,
    SecurityUtils,
    UIUtils,
    PathUtils,
    Logger,
    IPCHelper,
    MiscUtils
};
