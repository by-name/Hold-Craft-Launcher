<!-- 下载设置部分 -->
<div class="settings-section">
    <h3>⚡ 下载设置</h3>
    
    <div class="setting-item">
        <label>下载源:</label>
        <select id="download-source">
            <option value="official">官方源 (国际)</option>
            <option value="bmclapi">BMCLAPI (国内镜像)</option>
        </select>
    </div>
    
    <div class="setting-item">
        <label>下载线程数:</label>
        <select id="download-threads">
            <option value="1">1 线程</option>
            <option value="2" selected>2 线程</option>
            <option value="4">4 线程</option>
        </select>
    </div>
    
    <div class="setting-item">
        <label>最大重试次数:</label>
        <input type="number" id="download-retries" min="1" max="10" value="3">
    </div>
    
    <button onclick="testDownloadSpeed()">测试下载速度</button>
    <button onclick="clearDownloadCache()">清理下载缓存</button>
</div>

<!-- 下载进度显示 -->
<div class="download-progress" id="download-progress" style="display: none;">
    <div class="progress-header">
        <span>正在下载</span>
        <span id="download-filename"></span>
    </div>
    
    <div class="progress-bar">
        <div class="progress-fill" id="progress-fill"></div>
    </div>
    
    <div class="progress-info">
        <span id="progress-percent">0%</span>
        <span id="progress-size">0/0 MB</span>
        <span id="progress-speed">0 KB/s</span>
    </div>
    
    <div class="progress-actions">
        <button onclick="pauseDownload()">暂停</button>
        <button onclick="cancelDownload()">取消</button>
    </div>
</div>
