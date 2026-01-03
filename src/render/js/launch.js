// src/renderer/js/launch.js
class HCLGameLauncher {
    constructor() {
        this.configManager = null;
        this.init();
    }
    
    async init() {
        console.log('初始化游戏启动器...');
        
        // 从主进程获取配置
        const config = await window.electronAPI.invoke('get-config');
        const paths = await window.electronAPI.invoke('get-paths');
        
        console.log('加载配置:', config);
        console.log('路径信息:', paths);
        
        // 显示路径信息
        this.updatePathDisplay(paths);
        
        // 检查是否为首次运行
        if (config.firstRun) {
            await this.showFirstRunWelcome();
            
            // 更新配置
            config.firstRun = false;
            await window.electronAPI.invoke('save-config', config);
        }
        
        // 其他初始化代码...
    }
    
    updatePathDisplay(paths) {
        const pathInfo = document.getElementById('path-info');
        if (pathInfo) {
            pathInfo.innerHTML = `
                <div class="path-info">
                    <h4>📁 路径信息</h4>
                    <div class="path-item">
                        <span class="path-label">模式:</span>
                        <span class="path-value">${paths.isPortable ? '便携模式' : '安装模式'}</span>
                    </div>
                    <div class="path-item">
                        <span class="path-label">游戏目录:</span>
                        <span class="path-value">${paths.gameDirectory}</span>
                    </div>
                    <div class="path-item">
                        <span class="path-label">配置目录:</span>
                        <span class="path-value">${paths.appDataPath}</span>
                    </div>
                </div>
            `;
        }
    }
    
    async showFirstRunWelcome() {
        const welcomeHtml = `
            <div class="welcome-modal">
                <div class="welcome-content">
                    <h2>🎉 欢迎使用 HCL 启动器！</h2>
                    
                    <div class="welcome-section">
                        <h3>📁 已为您创建必要目录：</h3>
                        <ul>
                            <li><strong>.minecraft/</strong> - 游戏文件目录</li>
                            <li><strong>hcl-data/</strong> - 配置和账户数据</li>
                            <li><strong>hcl-config.json</strong> - 配置文件</li>
                        </ul>
                    </div>
                    
                    <div class="welcome-section">
                        <h3>🚀 快速开始：</h3>
                        <ol>
                            <li>添加 Minecraft 账户</li>
                            <li>选择游戏版本并安装</li>
                            <li>配置 Java 和内存设置</li>
                            <li>点击启动游戏！</li>
                        </ol>
                    </div>
                    
                    <div class="welcome-tip">
                        💡 <strong>提示：</strong> 所有文件都保存在当前目录，可复制到U盘或移动设备使用！
                    </div>
                    
                    <button class="btn-primary" onclick="closeWelcome()">开始使用</button>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.innerHTML = welcomeHtml;
        document.body.appendChild(modal);
        
        // 样式
        modal.querySelector('.welcome-modal').style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            backdrop-filter: blur(5px);
        `;
        
        modal.querySelector('.welcome-content').style.cssText = `
            background: #2d2d44;
            border-radius: 12px;
            padding: 30px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            color: white;
        `;
        
        // 全局关闭函数
        window.closeWelcome = () => {
            modal.remove();
        };
    }
}
