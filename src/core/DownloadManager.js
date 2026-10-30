// src/core/DownloadManager.js
/**
 * HCL 下载管理器
 * 负责版本清单获取、版本 JSON 下载、游戏文件（客户端 / 依赖库 / 资源）下载
 */
const EventEmitter = require('events');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fsp = fs.promises;
const { pipeline } = require('stream/promises');
const axios = require('axios');

const DEFAULT_MIRRORS = {
    official: 'https://launchermeta.mojang.com',
    bmclapi: 'https://bmclapi2.bangbang93.com'
};

class HCLDownloadManager extends EventEmitter {
    constructor(configManager = null) {
        super();

        this.configManager = configManager;
        this.config = (configManager && configManager.getConfig()) || {};
        this.gameDirectory = (configManager && configManager.getGameDirectory())
            || path.join(os.homedir(), '.hcl-minecraft');

        this.maxRetries = this.config.maxRetries || 3;
        this.maxThreads = this.config.maxThreads || 2;
        this.timeout = this.config.downloadTimeout || 30000;
        this.mirrors = Object.assign({}, DEFAULT_MIRRORS, this.config.mirrorSites || {});
        this.downloadSource = this.config.downloadSource || 'bmclapi';

        this.manifestCache = null;
        this.cancelled = false;
    }

    /**
     * 当前使用的镜像地址
     */
    getMirrorBase() {
        return this.mirrors[this.downloadSource] || this.mirrors.bmclapi || DEFAULT_MIRRORS.bmclapi;
    }

    /**
     * 获取版本清单
     */
    async getVersionList() {
        if (this.manifestCache) {
            return this.manifestCache;
        }

        const url = `${this.getMirrorBase()}/mc/game/version_manifest.json`;

        try {
            const response = await axios.get(url, { timeout: this.timeout });
            this.manifestCache = response.data;
            return this.manifestCache;
        } catch (error) {
            this.emit('download-error', { url, error: error.message });
            throw new Error(`获取版本列表失败: ${error.message}`);
        }
    }

    /**
     * 下载指定版本的 version.json
     */
    async downloadVersionJson(versionId) {
        const manifest = await this.getVersionList();
        const summary = (manifest.versions || []).find(item => item.id === versionId);

        if (!summary) {
            throw new Error(`未找到版本: ${versionId}`);
        }

        const versionDir = path.join(this.gameDirectory, 'versions', versionId);
        const targetPath = path.join(versionDir, `${versionId}.json`);

        await fsp.mkdir(versionDir, { recursive: true });
        await this.downloadFile(summary.url, targetPath, { name: `${versionId}.json` });

        const raw = await fsp.readFile(targetPath, 'utf8');
        const versionJson = JSON.parse(raw);
        versionJson.id = versionJson.id || versionId;

        return versionJson;
    }

    /**
     * 下载版本所需的全部文件
     */
    async downloadGameFiles(versionJson) {
        const versionId = versionJson.id;
        const tasks = [];

        // 1. 客户端 jar
        if (versionJson.downloads && versionJson.downloads.client) {
            const versionDir = path.join(this.gameDirectory, 'versions', versionId);
            tasks.push({
                url: versionJson.downloads.client.url,
                dest: path.join(versionDir, `${versionId}.jar`),
                name: `${versionId}.jar`,
                size: versionJson.downloads.client.size || 0
            });
        }

        // 2. 依赖库
        for (const library of versionJson.libraries || []) {
            const artifact = this.resolveLibraryArtifact(library);
            if (!artifact || !artifact.url) {
                continue;
            }
            tasks.push({
                url: artifact.url,
                dest: path.join(this.gameDirectory, 'libraries', artifact.path),
                name: path.basename(artifact.path),
                size: artifact.size || 0
            });
        }

        // 3. 资源索引与资源文件
        const assetIndex = versionJson.assetIndex || null;

        if (assetIndex && assetIndex.url) {
            const indexPath = path.join(this.gameDirectory, 'assets', 'indexes', `${assetIndex.id}.json`);

            await this.downloadFile(assetIndex.url, indexPath, { name: `${assetIndex.id}.json` });

            const indexRaw = await fsp.readFile(indexPath, 'utf8');
            const indexJson = JSON.parse(indexRaw);
            const objects = (indexJson && indexJson.objects) || {};

            for (const [name, object] of Object.entries(objects)) {
                const hash = object.hash;
                if (!hash) {
                    continue;
                }
                tasks.push({
                    url: `${this.getAssetsBase()}/${hash.slice(0, 2)}/${hash}`,
                    dest: path.join(this.gameDirectory, 'assets', 'objects', hash.slice(0, 2), hash),
                    name,
                    size: object.size || 0
                });
            }
        }

        await this.runTasks(tasks, versionId);

        return { success: true, version: versionId, files: tasks.length };
    }

    /**
     * 资源文件下载基址
     */
    getAssetsBase() {
        return this.downloadSource === 'bmclapi'
            ? 'https://bmclapi2.bangbang93.com/assets'
            : 'https://resources.download.minecraft.net';
    }

    /**
     * 解析依赖库下载信息（处理 rules 与 natives）
     */
    resolveLibraryArtifact(library) {
        if (library.rules && !this.rulesAllow(library.rules)) {
            return null;
        }

        const natives = library.natives;
        const platformKey = natives ? natives[this.getPlatformKey()] : null;

        if (platformKey) {
            const classifier = library.downloads && library.downloads.classifiers
                ? library.downloads.classifiers[platformKey]
                : null;
            if (!classifier) {
                return null;
            }
            return { url: classifier.url, path: classifier.path || library.name, size: classifier.size };
        }

        const artifact = library.downloads && library.downloads.artifact;
        if (!artifact) {
            return null;
        }

        return { url: artifact.url, path: artifact.path, size: artifact.size };
    }

    /**
     * 判断 rules 是否允许当前平台
     */
    rulesAllow(rules) {
        const platformKey = this.getPlatformKey();
        let allowed = false;

        for (const rule of rules) {
            if (rule.os) {
                const matches = rule.os.name === this.getOSName()
                    || (rule.os.name === 'osx' && platformKey === 'osx');
                if (matches) {
                    allowed = rule.action === 'allow';
                }
            } else {
                allowed = rule.action === 'allow';
            }
        }

        return allowed;
    }

    getOSName() {
        if (process.platform === 'win32') return 'windows';
        if (process.platform === 'darwin') return 'osx';
        return 'linux';
    }

    getPlatformKey() {
        if (process.platform === 'win32') return 'windows';
        if (process.platform === 'darwin') return 'osx';
        return 'linux';
    }

    /**
     * 并发执行下载任务并上报进度
     */
    async runTasks(tasks, versionId) {
        this.cancelled = false;

        const total = tasks.length;
        let completed = 0;
        let cursor = 0;

        const worker = async () => {
            while (cursor < tasks.length) {
                if (this.cancelled) {
                    return;
                }

                const task = tasks[cursor++];
                try {
                    await this.downloadFile(task.url, task.dest, task);
                } catch (error) {
                    this.emit('download-error', { version: versionId, file: task.name, error: error.message });
                } finally {
                    completed++;
                    this.emit('download-progress', {
                        version: versionId,
                        file: task.name,
                        completed,
                        total,
                        percent: total > 0 ? Math.round((completed / total) * 100) : 100
                    });
                }
            }
        };

        const workers = [];
        for (let i = 0; i < Math.max(1, this.maxThreads); i++) {
            workers.push(worker());
        }

        await Promise.all(workers);
    }

    /**
     * 下载单个文件（带重试与进度）
     */
    async downloadFile(url, dest, meta = {}) {
        if (!url) {
            throw new Error('下载地址为空');
        }

        if (!/^https?:\/\//i.test(url)) {
            url = `${this.getMirrorBase()}${url.startsWith('/') ? '' : '/'}${url}`;
        }

        await fsp.mkdir(path.dirname(dest), { recursive: true });

        try {
            const stats = await fsp.stat(dest);
            if (stats.isFile() && stats.size > 0 && meta.size && stats.size === meta.size) {
                return dest;
            }
        } catch (error) {
            // 文件不存在，继续下载
        }

        let lastError = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await axios.get(url, {
                    responseType: 'stream',
                    timeout: this.timeout
                });

                const totalSize = Number(response.headers['content-length'] || meta.size || 0);
                let received = 0;

                response.data.on('data', (chunk) => {
                    received += chunk.length;
                    this.emit('download-progress', {
                        file: meta.name || path.basename(dest),
                        url,
                        received,
                        total: totalSize,
                        percent: totalSize > 0 ? Math.round((received / totalSize) * 100) : 0
                    });
                });

                const writer = fs.createWriteStream(dest);
                await pipeline(response.data, writer);

                return dest;
            } catch (error) {
                lastError = error;
                await fsp.rm(dest, { force: true }).catch(() => {});
                console.warn(`下载失败（第 ${attempt} 次）: ${url} - ${error.message}`);
            }
        }

        throw new Error(`下载失败: ${url} - ${lastError ? lastError.message : '未知错误'}`);
    }

    /**
     * 取消当前下载
     */
    cancel() {
        this.cancelled = true;
    }

    /**
     * 清理下载缓存
     */
    async clearCache() {
        if (!this.configManager) {
            return false;
        }

        const paths = this.configManager.getPaths();
        await fsp.rm(paths.cacheDir, { recursive: true, force: true });
        await fsp.mkdir(paths.cacheDir, { recursive: true });
        return true;
    }
}

module.exports = HCLDownloadManager;
