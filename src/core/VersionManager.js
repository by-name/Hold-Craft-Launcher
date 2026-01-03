const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

class HCLVersionManager extends EventEmitter {
    constructor(configManager, downloadManager) {
        super();
        this.configManager = configManager;
        this.downloadManager = downloadManager;
        this.versions = new Map();
        this.installedVersions = new Set();
    }

    async loadVersionList() {
        try {
            const versionManifest = await this.downloadManager.getVersionList();
            this.versions.clear();

            versionManifest.versions.forEach(version => {
                this.versions.set(version.id, {
                    id: version.id,
                    type: version.type,
                    releaseTime: version.releaseTime,
                    url: version.url,
                    installed: this.installedVersions.has(version.id)
                });
            });

            this.emit('versions-loaded', Array.from(this.versions.values()));
            return Array.from(this.versions.values());
        } catch (error) {
            this.emit('versions-error', error.message);
            throw error;
        }
    }

    async getVersionInfo(versionId) {
        if (this.versions.has(versionId)) {
            return this.versions.get(versionId);
        }
        
        try {
            const versionJson = await this.downloadManager.downloadVersionJson(versionId);
            return {
                id: versionId,
                ...versionJson,
                installed: this.installedVersions.has(versionId)
            };
        } catch (error) {
            throw new Error(`无法获取版本信息: ${versionId}`);
        }
    }

    async scanInstalledVersions() {
        const gameDir = this.configManager.getGameDirectory();
        const versionsDir = path.join(gameDir, 'versions');
        
        try {
            await fs.access(versionsDir);
            const versionDirs = await fs.readdir(versionsDir);
            
            this.installedVersions.clear();
            
            for (const versionDir of versionDirs) {
                const versionJsonPath = path.join(versionsDir, versionDir, `${versionDir}.json`);
                if (await this.fileExists(versionJsonPath)) {
                    this.installedVersions.add(versionDir);
                }
            }
            
            this.emit('installed-versions-scanned', Array.from(this.installedVersions));
            return Array.from(this.installedVersions);
        } catch (error) {
            console.warn('扫描已安装版本失败:', error);
            return [];
        }
    }

    async installVersion(versionId) {
        if (this.installedVersions.has(versionId)) {
            throw new Error(`版本 ${versionId} 已安装`);
        }

        try {
            this.emit('version-install-start', versionId);
            
            // 下载版本文件
            const versionJson = await this.downloadManager.downloadVersionJson(versionId);
            
            // 创建版本目录
            const versionDir = path.join(this.configManager.getGameDirectory(), 'versions', versionId);
            await fs.mkdir(versionDir, { recursive: true });
            
            // 保存版本JSON
            await fs.writeFile(
                path.join(versionDir, `${versionId}.json`),
                JSON.stringify(versionJson, null, 2)
            );
            
            // 下载客户端JAR
            await this.downloadManager.downloadClient(versionJson, versionDir);
            
            // 下载资源文件
            await this.downloadManager.downloadAssets(versionJson);
            
            // 下载库文件
            await this.downloadManager.downloadLibraries(versionJson);
            
            this.installedVersions.add(versionId);
            this.emit('version-install-complete', versionId);
            
            return { success: true, version: versionId };
        } catch (error) {
            this.emit('version-install-error', { version: versionId, error: error.message });
            throw error;
        }
    }

    async uninstallVersion(versionId) {
        if (!this.installedVersions.has(versionId)) {
            throw new Error(`版本 ${versionId} 未安装`);
        }

        try {
            const versionDir = path.join(this.configManager.getGameDirectory(), 'versions', versionId);
            await fs.rm(versionDir, { recursive: true, force: true });
            
            this.installedVersions.delete(versionId);
            this.emit('version-uninstalled', versionId);
            
            return { success: true, version: versionId };
        } catch (error) {
            throw new Error(`卸载版本失败: ${error.message}`);
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    getInstalledVersions() {
        return Array.from(this.installedVersions).map(id => ({
            id,
            installed: true,
            ...this.versions.get(id)
        }));
    }

    getRecommendedVersion() {
        const releases = Array.from(this.versions.values())
            .filter(v => v.type === 'release')
            .sort((a, b) => new Date(b.releaseTime) - new Date(a.releaseTime));
        
        return releases[0] || null;
    }
}

module.exports = HCLVersionManager;
