// script.js - 交互脚本
document.addEventListener('DOMContentLoaded', function() {
    // 1. 代码高亮
    function highlightCode() {
        document.querySelectorAll('code').forEach(code => {
            const text = code.textContent;
            
            // 简单的关键词高亮
            const highlighted = text
                .replace(/\b(const|let|var|function|class|return|await|async|new)\b/g, '<span class="keyword">$1</span>')
                .replace(/\b(getAvatar|batchGetAvatars|launchGame|downloadFile)\b/g, '<span class="function">$1</span>')
                .replace(/(".*?"|'.*?')/g, '<span class="string">$1</span>')
                .replace(/\/\/.*$/gm, '<span class="comment">$&</span>');
            
            code.innerHTML = highlighted;
        });
    }
    
    // 2. 目录导航
    function setupNav() {
        const currentPage = window.location.pathname.split('/').pop();
        const navLinks = document.querySelectorAll('nav a');
        
        navLinks.forEach(link => {
            if (link.getAttribute('href') === currentPage) {
                link.style.fontWeight = 'bold';
                link.style.color = '#4a90e2';
            }
        });
    }
    
    // 3. 返回顶部按钮
    function addBackToTop() {
        const btn = document.createElement('button');
        btn.innerHTML = '↑';
        btn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            background: #4a90e2;
            color: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            font-size: 20px;
            display: none;
            z-index: 1000;
        `;
        
        document.body.appendChild(btn);
        
        window.addEventListener('scroll', () => {
            btn.style.display = window.scrollY > 300 ? 'block' : 'none';
        });
        
        btn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    
    // 4. 详情展开动画
    function setupDetails() {
        document.querySelectorAll('details').forEach(detail => {
            detail.addEventListener('toggle', function() {
                if (this.open) {
                    this.style.maxHeight = this.scrollHeight + 'px';
                } else {
                    this.style.maxHeight = null;
                }
            });
        });
    }
    
    // 5. 复制代码功能
    function addCopyButtons() {
        document.querySelectorAll('pre').forEach(pre => {
            const btn = document.createElement('button');
            btn.innerHTML = '📋';
            btn.title = '复制代码';
            btn.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                background: #4a90e2;
                color: white;
                border: none;
                border-radius: 3px;
                padding: 5px 10px;
                cursor: pointer;
                font-size: 12px;
            `;
            
            pre.style.position = 'relative';
            pre.appendChild(btn);
            
            btn.addEventListener('click', async function() {
                const code = pre.textContent.replace('📋', '').trim();
                
                try {
                    await navigator.clipboard.writeText(code);
                    const original = this.innerHTML;
                    this.innerHTML = '✅';
                    
                    setTimeout(() => {
                        this.innerHTML = original;
                    }, 2000);
                } catch (err) {
                    this.innerHTML = '❌';
                }
            });
        });
    }
    
    // 初始化所有功能
    highlightCode();
    setupNav();
    addBackToTop();
    setupDetails();
    addCopyButtons();
    
    // 添加页面加载动画
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.3s';
    
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
    
    // 页面内锚点滚动
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});
