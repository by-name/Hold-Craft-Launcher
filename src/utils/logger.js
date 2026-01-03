const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;

class HCLLogger {
    constructor() {
        this.logFile = path.join(app.getPath('userData'), 'hcl.log');
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
    }

    async log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data
        };

        // 控制台输出
        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data || '');

        // 文件输出
        try {
            await this.writeToFile(JSON.stringify(logEntry) + '\n');
        } catch (error) {
            console.error('写入日志失败:', error);
        }
    }

    async writeToFile(content) {
        try {
            // 检查文件大小
            const stats = await fs.stat(this.logFile).catch(() => null);
            if (stats && stats.size > this.maxFileSize) {
                await this.rotateLog();
            }

            await fs.appendFile(this.logFile, content, 'utf8');
        } catch (error) {
            // 如果文件不存在，创建它
            if (error.code === 'ENOENT') {
                await fs.writeFile(this.logFile, content, 'utf8');
            } else {
                throw error;
            }
        }
    }

    async rotateLog() {
        const backupFile = this.logFile + '.bak';
        try {
            await fs.rename(this.logFile, backupFile);
        } catch (error) {
            console.warn('日志轮转失败:', error);
        }
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

    debug(message, data = null) {
        if (process.env.NODE_ENV === 'development') {
            this.log('debug', message, data);
        }
    }
}

module.exports = new HCLLogger();
