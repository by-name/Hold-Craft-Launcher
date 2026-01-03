// src/core/JavaLauncher.js
/**
 * HCL Java 启动器
 * 负责检测 Java 环境、启动 Minecraft 游戏进程、监控游戏运行状态
 */
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const EventEmitter = require('events');

class HCLJavaLauncher extends EventEmitter {
    constructor(configManager, dataManager) {
        super();
        this.configManager = configManager;
        this.dataManager = dataManager;
        this.gameProcess = null;
        this.isRunning = false;
        this.gameOutput = [];
        this.javaVersions = [];
        this.javaCache = new Map();
        
        this.init();
    }
    
    async init() {
        console.log('Java 启动器初始化');
        await this.detectJavaVersions();
    }
    
    /**
     * 检测系统上的 Java 版本
     */
    async detectJavaVersions() {
        this.javaVersions = [];
        
        // 检查常见 Java 安装路径
        const commonPaths = this.getCommonJavaPaths();
        const detectionPromises = [];
        
        for (const javaPath of commonPaths) {
            detectionPromises.push(this.checkJavaVersion(javaPath));
        }
        
        // 使用系统 PATH 查找 Java
        detectionPromises.push(this.findJavaInPath());
        
        const results = await Promise.allSettled(detectionPromises);
        
        // 过滤有效结果并去重
        const uniqueVersions = new Map();
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                const javaInfo = result.value;
                const key = `${javaInfo.version}-${javaInfo.path}`;
                if (!uniqueVersions.has(key)) {
                    uniqueVersions.set(key, javaInfo);
                }
            }
        });
        
        this.javaVersions = Array.from(uniqueVersions.values())
            .sort((a, b) => this.compareJavaVersions(a.version, b.version));
        
        console.log(`检测到 ${this.javaVersions.length} 个 Java 版本`);
        this.emit('java-versions-detected', this.javaVersions);
        
        return this.javaVersions;
    }
    
    /**
     * 获取常见的 Java 安装路径
     */
    getCommonJavaPaths() {
        const paths = [];
        const platform = os.platform();
        
        if (platform === 'win32') {
            // Windows
            const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
            const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
            
            // Java 安装路径
            paths.push(
                path.join(programFiles, 'Java', 'jdk-*', 'bin', 'java.exe'),
                path.join(programFiles, 'Java', 'jre-*', 'bin', 'java.exe'),
                path.join(programFilesX86, 'Java', 'jdk-*', 'bin', 'java.exe'),
                path.join(programFilesX86, 'Java', 'jre-*', 'bin', 'java.exe'),
                'C:\\Program Files\\AdoptOpenJDK\\*\\bin\\java.exe',
                'C:\\Program Files\\Eclipse Adoptium\\*\\bin\\java.exe',
                'C:\\Program Files\\Microsoft\\jdk-*\\bin\\java.exe'
            );
        } else if (platform === 'darwin') {
            // macOS
            paths.push(
                '/Library/Java/JavaVirtualMachines/*/Contents/Home/bin/java',
                '/usr/local/opt/openjdk*/bin/java',
                '/opt/homebrew/opt/openjdk*/bin/java',
                '/System/Library/Frameworks/JavaVM.framework/Versions/Current/Commands/java'
            );
        } else {
            // Linux/Unix
            paths.push(
                '/usr/lib/jvm/*/bin/java',
                '/usr/lib/jvm/*/jre/bin/java',
                '/usr/bin/java',
                '/usr/local/bin/java',
                '/opt/jdk*/bin/java',
                '/opt/jre*/bin/java'
            );
        }
        
        // 展开通配符路径
        const expandedPaths = [];
        for (const pattern of paths) {
            try {
                const matches = require('glob').sync(pattern, { windowsPathsNoEscape: true });
                expandedPaths.push(...matches);
            } catch (error) {
                // 忽略通配符匹配错误
            }
        }
        
        return expandedPaths;
    }
    
    /**
     * 在系统 PATH 中查找 Java
     */
    async findJavaInPath() {
        const commands = os.platform() === 'win32' ? ['java.exe', 'where java'] : ['which java', 'command -v java'];
        
        for (const cmd of commands) {
            try {
                const javaPath = await this.execCommand(cmd);
                if (javaPath && javaPath.trim()) {
                    const cleanPath = javaPath.trim().split('\n')[0];
                    return await this.checkJavaVersion(cleanPath);
                }
            } catch (error) {
                // 继续尝试下一个命令
            }
        }
        
        return null;
    }
    
    /**
     * 检查 Java 版本信息
     */
    async checkJavaVersion(javaPath) {
        if (this.javaCache.has(javaPath)) {
            return this.javaCache.get(javaPath);
        }
        
        try {
            const versionOutput = await this.execCommand(`"${javaPath}" -version`);
            const versionInfo = this.parseJavaVersion(versionOutput, javaPath);
            
            if (versionInfo) {
                this.javaCache.set(javaPath, versionInfo);
                return versionInfo;
            }
        } catch (error) {
            // Java 路径无效
        }
        
        return null;
    }
    
    /**
     * 解析 Java 版本输出
     */
    parseJavaVersion(output, javaPath) {
        const lines = output.split('\n');
        let version = '';
        let vendor = '';
        let bitness = '64-bit';
        let type = 'JRE';
        
        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            
            // 提取版本号
            const versionMatch = line.match(/version\s+"([^"]+)"/) || 
                                line.match(/\(build\s+([^)]+)\)/);
            if (versionMatch) {
                version = versionMatch[1];
                
                // 规范化版本号
                if (version.includes('.')) {
                    const parts = version.split('.');
                    if (parts[0] === '1') {
                        version = parts[1]; // 1.8.x -> 8
                    } else {
                        version = parts[0]; // 11.x.x -> 11
                    }
                }
            }
            
            // 检测供应商
            if (lowerLine.includes('openjdk')) {
                vendor = 'OpenJDK';
                type = 'JDK';
            } else if (lowerLine.includes('java(tm)') || lowerLine.includes('oracle')) {
                vendor = 'Oracle';
            } else if (lowerLine.includes('adoptopenjdk') || lowerLine.includes('adoptium')) {
                vendor = 'Adoptium';
            } else if (lowerLine.includes('microsoft')) {
                vendor = 'Microsoft';
            } else if (lowerLine.includes('zulu')) {
                vendor = 'Zulu';
            } else if (lowerLine.includes('amazon')) {
                vendor = 'Amazon Corretto';
            }
            
            // 检测位数
            if (lowerLine.includes('64-bit')) {
                bitness = '64-bit';
            } else if (lowerLine.includes('32-bit')) {
                bitness = '32-bit';
            }
            
            // 检测类型
            if (lowerLine.includes('jdk')) {
                type = 'JDK';
            } else if (lowerLine.includes('jre')) {
                type = 'JRE';
            }
        }
        
        if (!version) {
            return null;
        }
        
        const javaInfo = {
            path: javaPath,
            version: parseInt(version) || version,
            vendor,
            bitness,
            type,
            isValid: true
        };
        
        return javaInfo;
    }
    
    /**
     * 比较 Java 版本
     */
    compareJavaVersions(versionA, versionB) {
        const a = parseInt(versionA) || 0;
        const b = parseInt(versionB) || 0;
        return b - a; // 降序排列
    }
    
    /**
     * 获取推荐的 Java 版本
     */
    getRecommendedJavaVersion() {
        // 优先选择 Java 8
        const java8 = this.javaVersions.find(j => j.version === 8);
        if (java8) return java8;
        
        // 其次选择 Java 11
        const java11 = this.javaVersions.find(j => j.version === 11);
        if (java11) return java11;
        
        // 选择最新的 Java 版本
        if (this.javaVersions.length > 0) {
            return this.javaVersions[0];
        }
        
        return null;
    }
    
    /**
     * 启动 Minecraft 游戏
     */
    async launchGame(launchConfig) {
        if (this.isRunning) {
            throw new Error('游戏正在运行中');
        }
        
        const config = this.configManager.getConfig();
        const { account, version, javaPath, memory, jvmArgs = [], gameArgs = [] } = launchConfig;
        
        try {
            // 验证 Java
            const javaInfo = await this.validateJava(javaPath || config.javaPath);
            
            // 验证游戏版本
            const versionInfo = await this.validateVersion(version);
            
            // 验证账户
            await this.validateAccount(account);
            
            // 准备启动参数
            const { jvmArguments, gameArguments } = this.prepareLaunchArguments(
                account, 
                versionInfo, 
                memory || config.memory,
                javaInfo
            );
            
            // 合并自定义参数
            const finalJvmArgs = [...jvmArguments, ...jvmArgs];
            const finalGameArgs = [...gameArguments, ...gameArgs];
            
            // 启动游戏进程
            this.gameProcess = this.spawnGameProcess(
                javaInfo.path,
                finalJvmArgs,
                finalGameArgs
            );
            
            this.isRunning = true;
            this.gameOutput = [];
            
            // 监听进程事件
            this.setupProcessListeners();
            
            // 发射启动事件
            this.emit('game-launched', {
                pid: this.gameProcess.pid,
                account: account.username,
                version: versionInfo.id,
                javaVersion: javaInfo.version
            });
            
            return {
                success: true,
                pid: this.gameProcess.pid,
                javaVersion: javaInfo.version
            };
        } catch (error) {
            this.emit('game-launch-failed', {
                error: error.message,
                account: account.username,
                version: version.id
            });
            
            throw error;
        }
    }
    
    /**
     * 验证 Java
     */
    async validateJava(javaPath) {
        if (!javaPath) {
            // 尝试自动检测
            const recommended = this.getRecommendedJavaVersion();
            if (recommended) {
                return recommended;
            }
            throw new Error('未找到 Java 运行时环境');
        }
        
        const javaInfo = await this.checkJavaVersion(javaPath);
        if (!javaInfo) {
            throw new Error(`Java 路径无效: ${javaPath}`);
        }
        
        // 检查 Java 版本兼容性
        if (javaInfo.version < 8) {
            throw new Error(`Java 版本过低 (${javaInfo.version})，需要 Java 8 或更高版本`);
        }
        
        return javaInfo;
    }
    
    /**
     * 验证游戏版本
     */
    async validateVersion(version) {
        const gameDir = this.configManager.getConfig().gameDirectory;
        const versionDir = path.join(gameDir, 'versions', version.id);
        const versionJson = path.join(versionDir, `${version.id}.json`);
        
        try {
            await fs.access(versionJson);
            const data = await fs.readFile(versionJson, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            throw new Error(`游戏版本未安装: ${version.id}`);
        }
    }
    
    /**
     * 验证账户
     */
    async validateAccount(account) {
        if (!account || !account.username) {
            throw new Error('账户信息不完整');
        }
        
        if (account.type === 'microsoft' && !account.accessToken) {
            throw new Error('Microsoft 账户需要访问令牌');
        }
    }
    
    /**
     * 准备启动参数
     */
    prepareLaunchArguments(account, versionInfo, memory, javaInfo) {
        const gameDir = this.configManager.getConfig().gameDirectory;
        const assetsDir = path.join(gameDir, 'assets');
        
        // 基础 JVM 参数
        const jvmArguments = [
            `-Xmx${memory}M`,
            `-Xms${Math.floor(memory / 2)}M`,
            '-XX:+UnlockExperimentalVMOptions',
            '-XX:+UseG1GC',
            '-XX:G1NewSizePercent=20',
            '-XX:G1ReservePercent=20',
            '-XX:MaxGCPauseMillis=50',
            '-XX:G1HeapRegionSize=32M',
            '-Djava.library.path=${natives_directory}',
            '-Dminecraft.launcher.brand=hcl',
            '-Dminecraft.launcher.version=1.0.0',
            '-cp', '${classpath}'
        ];
        
        // 根据 Java 版本调整参数
        if (javaInfo.version >= 9) {
            jvmArguments.push(
                '--add-opens=java.base/java.util.jar=ALL-UNNAMED',
                '--add-opens=java.base/java.lang=ALL-UNNAMED',
                '--add-opens=java.base/java.io=ALL-UNNAMED'
            );
        }
        
        // 游戏参数
        const gameArguments = [
            'net.minecraft.client.main.Main',
            '--username', account.username,
            '--version', versionInfo.id,
            '--gameDir', gameDir,
            '--assetsDir', assetsDir,
            '--assetIndex', versionInfo.assets || 'legacy',
            '--uuid', account.uuid || this.generateOfflineUUID(account.username),
            '--accessToken', account.accessToken || '0',
            '--userType', account.type === 'microsoft' ? 'mojang' : 'legacy',
            '--versionType', 'release'
        ];
        
        // 离线账户特殊处理
        if (account.type === 'offline') {
            gameArguments.push('--demo');
        }
        
        return { jvmArguments, gameArguments };
    }
    
    /**
     * 生成离线账户 UUID
     */
    generateOfflineUUID(username) {
        const crypto = require('crypto');
        const hash = crypto.createHash('md5').update('OfflinePlayer:' + username).digest('hex');
        return hash.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    }
    
    /**
     * 生成类路径
     */
    generateClasspath(versionInfo) {
        const gameDir = this.configManager.getConfig().gameDirectory;
        const libraries = [];
        
        if (versionInfo.libraries) {
            for (const lib of versionInfo.libraries) {
                if (lib.downloads && lib.downloads.artifact) {
                    const libPath = path.join(gameDir, 'libraries', lib.downloads.artifact.path);
                    libraries.push(libPath);
                }
            }
        }
        
        // 添加主客户端 JAR
        const clientJar = path.join(gameDir, 'versions', versionInfo.id, `${versionInfo.id}.jar`);
        libraries.push(clientJar);
        
        return libraries.join(path.delimiter);
    }
    
    /**
     * 生成原生库路径
     */
    generateNativesPath(versionInfo) {
        const gameDir = this.configManager.getConfig().gameDirectory;
        const nativesDir = path.join(gameDir, 'versions', versionInfo.id, 'natives');
        
        // 确保目录存在
        fs.mkdir(nativesDir, { recursive: true }).catch(console.error);
        
        return nativesDir;
    }
    
    /**
     * 启动游戏进程
     */
    spawnGameProcess(javaPath, jvmArgs, gameArgs) {
        const platform = os.platform();
        const isWindows = platform === 'win32';
        
        // 处理参数中的变量替换
        const processedJvmArgs = jvmArgs.map(arg => {
            return arg.replace(/\$\{natives_directory\}/g, this.generateNativesPath(this.currentVersionInfo))
                     .replace(/\$\{classpath\}/g, this.generateClasspath(this.currentVersionInfo));
        });
        
        const allArgs = [...processedJvmArgs, ...gameArgs];
        
        console.log('启动游戏参数:', allArgs.join(' '));
        
        const processOptions = {
            cwd: this.configManager.getConfig().gameDirectory,
            env: {
                ...process.env,
                'JAVA_HOME': path.dirname(path.dirname(javaPath)),
                'GAME_DIR': this.configManager.getConfig().gameDirectory
            },
            stdio: ['pipe', 'pipe', 'pipe']
        };
        
        if (isWindows) {
            // Windows 下隐藏控制台窗口
            processOptions.windowsHide = true;
        }
        
        return spawn(javaPath, allArgs, processOptions);
    }
    
    /**
     * 设置进程监听器
     */
    setupProcessListeners() {
        this.gameProcess.stdout.on('data', (data) => {
            const output = data.toString();
            this.gameOutput.push({ type: 'stdout', data: output, timestamp: Date.now() });
            this.emit('game-output', { type: 'stdout', data: output });
        });
        
        this.gameProcess.stderr.on('data', (data) => {
            const output = data.toString();
            this.gameOutput.push({ type: 'stderr', data: output, timestamp: Date.now() });
            this.emit('game-output', { type: 'stderr', data: output });
            
            // 检查常见错误
            this.checkForErrors(output);
        });
        
        this.gameProcess.on('close', (code) => {
            this.isRunning = false;
            this.emit('game-exit', { 
                code, 
                type: code === 0 ? 'normal' : 'error',
                output: this.gameOutput
            });
            
            this.gameProcess = null;
        });
        
        this.gameProcess.on('error', (error) => {
            this.isRunning = false;
            this.emit('game-error', { error: error.message });
            this.gameProcess = null;
        });
    }
    
    /**
     * 检查游戏输出中的错误
     */
    checkForErrors(output) {
        const errorPatterns = [
            { pattern: /java.lang.OutOfMemoryError/, message: '内存不足，请增加分配的内存' },
            { pattern: /Could not find or load main class/, message: '游戏文件损坏，请重新安装' },
            { pattern: /Authentication failed/, message: '账户认证失败，请重新登录' },
            { pattern: /Failed to download/, message: '文件下载失败，请检查网络连接' },
            { pattern: /Invalid access token/, message: '访问令牌无效，请重新登录' }
        ];
        
        for (const { pattern, message } of errorPatterns) {
            if (pattern.test(output)) {
                this.emit('game-error-detected', { error: output, message });
                break;
            }
        }
    }
    
    /**
     * 停止游戏
     */
    stopGame() {
        if (!this.gameProcess || !this.isRunning) {
            return false;
        }
        
        try {
            if (os.platform() === 'win32') {
                // Windows: 使用 taskkill
                spawn('taskkill', ['/pid', this.gameProcess.pid.toString(), '/f', '/t']);
            } else {
                // Unix: 发送 SIGTERM
                this.gameProcess.kill('SIGTERM');
            }
            
            this.isRunning = false;
            this.emit('game-stopped', { pid: this.gameProcess.pid });
            return true;
        } catch (error) {
            console.error('停止游戏失败:', error);
            return false;
        }
    }
    
    /**
     * 强制终止游戏
     */
    forceKillGame() {
        if (!this.gameProcess) return false;
        
        try {
            this.gameProcess.kill('SIGKILL');
            this.isRunning = false;
            this.emit('game-killed', { pid: this.gameProcess.pid });
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * 获取游戏运行状态
     */
    getGameStatus() {
        if (!this.gameProcess) {
            return { isRunning: false };
        }
        
        return {
            isRunning: this.isRunning,
            pid: this.gameProcess.pid,
            startTime: this.gameProcess.spawnTime,
            outputLength: this.gameOutput.length
        };
    }
    
    /**
     * 获取游戏输出
     */
    getGameOutput(limit = 100) {
        return this.gameOutput.slice(-limit);
    }
    
    /**
     * 清空游戏输出
     */
    clearGameOutput() {
        this.gameOutput = [];
    }
    
    /**
     * 发送命令到游戏进程
     */
    sendCommandToGame(command) {
        if (!this.gameProcess || !this.isRunning) {
            return false;
        }
        
        try {
            this.gameProcess.stdin.write(command + '\n');
            this.emit('command-sent', { command });
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * 检查 Java 版本兼容性
     */
    checkJavaCompatibility(version) {
        const javaVersion = parseInt(version) || 0;
        
        if (javaVersion < 8) {
            return { compatible: false, message: '需要 Java 8 或更高版本' };
        }
        
        if (javaVersion > 21) {
            return { 
                compatible: true, 
                message: '新版 Java 可能需要额外参数',
                warning: '某些模组可能不兼容新版 Java'
            };
        }
        
        return { compatible: true };
    }
    
    /**
     * 优化 JVM 参数
     */
    optimizeJVMArgs(javaVersion, memory, osType) {
        const args = [];
        
        // 内存设置
        args.push(`-Xmx${memory}M`);
        args.push(`-Xms${Math.floor(memory / 4)}M`);
        
        // GC 设置
        if (javaVersion >= 9) {
            args.push('-XX:+UseG1GC');
            args.push('-XX:G1NewSizePercent=20');
            args.push('-XX:G1ReservePercent=20');
            args.push('-XX:MaxGCPauseMillis=50');
            args.push('-XX:G1HeapRegionSize=32M');
        } else {
            args.push('-XX:+UseConcMarkSweepGC');
            args.push('-XX:+CMSIncrementalMode');
            args.push('-XX:-UseAdaptiveSizePolicy');
        }
        
        // 其他优化
        args.push('-XX:+UnlockExperimentalVMOptions');
        args.push('-XX:+DisableExplicitGC');
        
        // 根据操作系统优化
        if (osType === 'darwin') {
            args.push('-XstartOnFirstThread');
        }
        
        return args;
    }
    
    /**
     * 保存启动配置
     */
    async saveLaunchProfile(name, config) {
        const profiles = await this.dataManager.loadData('launch-profiles') || {};
        profiles[name] = {
            ...config,
            savedAt: Date.now()
        };
        
        await this.dataManager.saveData('launch-profiles', profiles);
        return true;
    }
    
    /**
     * 加载启动配置
     */
    async loadLaunchProfile(name) {
        const profiles = await this.dataManager.loadData('launch-profiles') || {};
        return profiles[name] || null;
    }
    
    /**
     * 执行命令
     */
    execCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout || stderr);
                }
            });
        });
    }
    
    /**
     * 测试 Java 安装
     */
    async testJavaInstallation(javaPath) {
        try {
            const result = await this.execCommand(`"${javaPath}" -version`);
            return {
                success: true,
                output: result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 获取系统信息
     */
    getSystemInfo() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            totalMemory: Math.floor(os.totalmem() / 1024 / 1024), // MB
            freeMemory: Math.floor(os.freemem() / 1024 / 1024), // MB
            homedir: os.homedir(),
            hostname: os.hostname()
        };
    }
    
    /**
     * 计算推荐内存
     */
    calculateRecommendedMemory() {
        const systemInfo = this.getSystemInfo();
        const totalMemoryMB = systemInfo.totalMemory;
        
        if (totalMemoryMB <= 2048) { // 2GB
            return 1024;
        } else if (totalMemoryMB <= 4096) { // 4GB
            return 2048;
        } else if (totalMemoryMB <= 8192) { // 8GB
            return 4096;
        } else if (totalMemoryMB <= 16384) { // 16GB
            return 6144;
        } else { // 16GB+
            return 8192;
        }
    }
    
    /**
     * 清理临时文件
     */
    async cleanupTempFiles() {
        const gameDir = this.configManager.getConfig().gameDirectory;
        const tempDirs = [
            path.join(gameDir, 'crash-reports'),
            path.join(gameDir, 'logs'),
            path.join(gameDir, '.mixin.out')
        ];
        
        for (const tempDir of tempDirs) {
            try {
                const files = await fs.readdir(tempDir);
                for (const file of files) {
                    if (file.endsWith('.txt') || file.endsWith('.log')) {
                        const fileAge = Date.now() - (await fs.stat(path.join(tempDir, file))).mtimeMs;
                        if (fileAge > 7 * 24 * 60 * 60 * 1000) { // 7天前
                            await fs.unlink(path.join(tempDir, file));
                        }
                    }
                }
            } catch (error) {
                // 目录不存在，跳过
            }
        }
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HCLJavaLauncher;
}

export { HCLJavaLauncher };
