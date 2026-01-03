const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');

class HCLModManager extends EventEmitter {
    constructor(configManager) {
        super();
        this.configManager = configManager;
        this.mods = new Map();
        this.modLoaders = new Map();
    }

    async scanMods(versionId) {
        const gameDir = this.configManager.getGameDirectory();
        const modsDir = path.join(gameDir, 'mods');
        const versionModsDir = path.join(modsDir, versionId);

        try {
            await fs.access(versionModsDir);
            const modFiles = await fs.readdir(versionModsDir);
            
            const mods = [];
            for (const modFile of modFiles) {
                if (modFile.endsWith('.jar') || modFile.endsWith('.disabled')) {
                    const modPath = path.join(versionModsDir, modFile);
                    const modInfo = await this.getModInfo(modPath);
                    mods.push({
                        name: modFile,
                        path: modPath,
                        enabled: !modFile.endsWith('.disabled'),
                        ...modInfo
                    });
                }
            }
            
            this.emit('mods-scanned', { version: versionId, mods });
            return mods;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    async getModInfo(modPath) {
        // 简化版模组信息提取
        // 实际实现需要解析JAR文件的manifest或mods.toml
        return {
            name: path.basename(modPath, path.extname(modPath)),
            version: 'unknown',
            description: ''
        };
    }

    async installMod(modUrl, versionId) {
        try {
            this.emit('mod-install-start', { url: modUrl, version: versionId });
            
            const modsDir = path.join(this.configManager.getGameDirectory(), 'mods', versionId);
            await fs.mkdir(modsDir, { recursive: true });
            
            const fileName = path.basename(modUrl);
            const filePath = path.join(modsDir, fileName);
            
            // 下载模组文件
            const response = await axios({
                method: 'GET',
                url: modUrl,
                responseType: 'stream'
            });
            
            const writer = require('fs').createWriteStream(filePath);
            response.data.pipe(writer);
            
            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    this.emit('mod-install-complete', { filePath, version: versionId });
                    resolve({ success: true, filePath });
                });
                writer.on('error', reject);
            });
        } catch (error) {
            this.emit('mod-install-error', { url: modUrl, error: error.message });
            throw error;
        }
    }

    async toggleMod(modName, versionId, enable) {
        const modsDir = path.join(this.configManager.getGameDirectory(), 'mods', versionId);
        const currentPath = path.join(modsDir, modName);
        const newPath = enable ? 
            currentPath.replace('.disabled', '') : 
            currentPath + '.disabled';

        try {
            await fs.rename(currentPath, newPath);
            this.emit('mod-toggled', { mod: modName, version: versionId, enabled: enable });
            return { success: true };
        } catch (error) {
            throw new Error(`切换模组状态失败: ${error.message}`);
        }
    }

    async searchMods(query, loader = 'fabric') {
        try {
            // 搜索CurseForge或Modrinth的模组
            const searchUrl = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&facets=[["project_type:mod"],["categories:${loader}"]]`;
            const response = await axios.get(searchUrl);
            
            return response.data.hits.map(mod => ({
                id: mod.project_id,
                name: mod.title,
                description: mod.description,
                downloads: mod.downloads,
                author: mod.author,
                version: mod.latest_version,
                url: `https://modrinth.com/mod/${mod.slug}`
            }));
        } catch (error) {
            console.error('搜索模组失败:', error);
            return [];
        }
    }
}

module.exports = HCLModManager;
