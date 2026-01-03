const { spawn } = require('child_process');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

class HCLGameManager extends EventEmitter {
    constructor(configManager, downloadManager) {
        super();
        this.configManager = configManager;
        this.downloadManager = downloadManager;
        this.gameProcess = null;
        this.isRunning = false;
    }

    async launchGame(launchConfig) {
        if (this.isRunning) {
            throw new Error('游戏正在运行中');
        }

        try {
            const { account, version, javaPath, memory } = launchConfig;
            const gameDir = this.configManager.getGameDirectory();
            
            // 准备启动参数
            const jvmArgs = this.generateJVMArgs(memory, gameDir, account);
            const gameArgs = this.generateGameArgs(version, account);
            
            // 检查Java是否存在
            await this.validateJavaPath(javaPath);
            
            // 启动游戏进程
            this.gameProcess = spawn(javaPath, [...jvmArgs, ...gameArgs], {
                cwd: gameDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.isRunning = true;

            // 处理游戏输出
            this.gameProcess.stdout.on('data', (data) => {
                const output = data.toString();
                this.emit('game-output', { type: 'stdout', data: output });
            });

            this.gameProcess.stderr.on('data', (data) => {
                const output = data.toString();
                this.emit('game-output', { type: 'stderr', data: output });
            });

            // 处理游戏退出
            this.gameProcess.on('close', (code) => {
                this.isRunning = false;
                this.emit('game-exit', { code, type: 'normal' });
            });

            this.gameProcess.on('error', (error) => {
                this.isRunning = false;
                this.emit('game-exit', { error: error.message, type: 'error' });
            });

            return { success: true, pid: this.gameProcess.pid };

        } catch (error) {
            this.isRunning = false;
            throw error;
        }
    }

    generateJVMArgs(memory, gameDir, account) {
        const args = [
            `-Xmx${memory}M`,
            `-Xms${Math.floor(memory / 4)}M`,
            '-Djava.library.path=${natives_directory}',
            '-Dminecraft.launcher.brand=hcl',
            '-Dminecraft.launcher.version=1.0.0',
            '-cp', '${classpath}'
        ];

        // 添加认证相关参数
        if (account.type !== 'offline') {
            args.push(`-Dminecraft.api.auth.host=https://authserver.mojang.com`);
            args.push(`-Dminecraft.api.account.host=https://api.mojang.com`);
            args.push(`-Dminecraft.api.session.host=https://sessionserver.mojang.com`);
        }

        return args;
    }

    generateGameArgs(version, account) {
        const args = [
            'net.minecraft.client.main.Main',
            '--username', account.username,
            '--version', version.id,
            '--gameDir', this.configManager.getGameDirectory(),
            '--assetsDir', path.join(this.configManager.getGameDirectory(), 'assets'),
            '--assetIndex', version.assets,
            '--uuid', account.uuid || 'offline-uuid',
            '--accessToken', account.accessToken || '0',
            '--userType', 'mojang',
            '--versionType', 'release'
        ];

        if (account.type === 'offline') {
            args.push('--demo');
        }

        return args;
    }

    async validateJavaPath(javaPath) {
        try {
            await fs.access(javaPath);
            // 检查Java版本
            const versionOutput = await this.getJavaVersion(javaPath);
            if (!versionOutput.includes('version "1.8') && !versionOutput.includes('version "8')) {
                console.warn('建议使用Java 8以获得最佳兼容性');
            }
        } catch (error) {
            throw new Error(`Java路径无效: ${javaPath}`);
        }
    }

    getJavaVersion(javaPath) {
        return new Promise((resolve, reject) => {
            const process = spawn(javaPath, ['-version']);
            let output = '';
            let error = '';

            process.stderr.on('data', (data) => {
                output += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error(`Java版本检查失败: ${error}`));
                }
            });

            process.on('error', reject);
        });
    }

    stopGame() {
        if (this.gameProcess && this.isRunning) {
            this.gameProcess.kill();
            this.isRunning = false;
            return true;
        }
        return false;
    }

    async installVersion(versionId) {
        try {
            this.emit('download-start', { version: versionId });
            
            const versionJson = await this.downloadManager.downloadVersionJson(versionId);
            await this.downloadManager.downloadGameFiles(versionJson);
            
            this.emit('download-complete', { version: versionId });
            return { success: true, version: versionId };
        } catch (error) {
            this.emit('download-error', { version: versionId, error: error.message });
            throw error;
        }
    }
}

module.exports = HCLGameManager;
