// src/components/AvatarComponent.js
/**
 * 头像显示组件
 */
class HCLAvatarComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.avatarManager = null;
        this.username = '';
        this.uuid = '';
        this.size = 64;
        this.showLoading = true;
        this.onClick = null;
    }
    
    static get observedAttributes() {
        return ['username', 'uuid', 'size', 'loading'];
    }
    
    connectedCallback() {
        this.render();
        this.loadAvatar();
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            if (name === 'username' || name === 'uuid') {
                this.loadAvatar();
            } else if (name === 'size') {
                this.size = parseInt(newValue) || 64;
                this.updateSize();
            }
        }
    }
    
    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: inline-block;
                }
                
                .avatar-container {
                    position: relative;
                    display: inline-block;
                }
                
                .avatar-img {
                    border-radius: 8px;
                    object-fit: cover;
                    transition: transform 0.2s;
                }
                
                .avatar-img:hover {
                    transform: scale(1.05);
                }
                
                .avatar-img.clickable {
                    cursor: pointer;
                }
                
                .loading {
                    display: none;
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    border-radius: 8px;
                    align-items: center;
                    justify-content: center;
                }
                
                .loading.show {
                    display: flex;
                }
                
                .loading-spinner {
                    width: 24px;
                    height: 24px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .error {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #4a90e2;
                    color: white;
                    font-weight: bold;
                    border-radius: 8px;
                }
            </style>
            
            <div class="avatar-container">
                <img class="avatar-img" 
                     alt="玩家头像" 
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iOCIgZmlsbD0iIzRhOTBlMiIvPgo8dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjMwIiBmaWxsPSJ3aGl0ZSI+RzwvdGV4dD4KPC9zdmc+'">
                <div class="loading">
                    <div class="loading-spinner"></div>
                </div>
            </div>
        `;
        
        this.imgElement = this.shadowRoot.querySelector('.avatar-img');
        this.loadingElement = this.shadowRoot.querySelector('.loading');
    }
    
    async loadAvatar() {
        if (!this.avatarManager) {
            this.avatarManager = getAvatarManager();
            if (!this.avatarManager) {
                console.error('AvatarManager 未初始化');
                return;
            }
        }
        
        this.username = this.getAttribute('username') || '';
        this.uuid = this.getAttribute('uuid') || '';
        this.size = parseInt(this.getAttribute('size')) || 64;
        this.showLoading = this.getAttribute('loading') !== 'false';
        
        if (!this.username && !this.uuid) {
            this.showDefaultAvatar();
            return;
        }
        
        if (this.showLoading) {
            this.showLoadingState();
        }
        
        try {
            const avatar = await this.avatarManager.getAvatar(this.username, this.uuid);
            this.imgElement.src = avatar;
            this.imgElement.style.width = `${this.size}px`;
            this.imgElement.style.height = `${this.size}px`;
            
            if (this.onClick) {
                this.imgElement.classList.add('clickable');
                this.imgElement.addEventListener('click', this.onClick);
            }
        } catch (error) {
            console.warn('加载头像失败:', error);
            this.showDefaultAvatar();
        } finally {
            this.hideLoadingState();
        }
    }
    
    showDefaultAvatar() {
        this.imgElement.src = this.avatarManager.defaultAvatar;
        this.updateSize();
    }
    
    showLoadingState() {
        if (this.loadingElement) {
            this.loadingElement.classList.add('show');
        }
    }
    
    hideLoadingState() {
        if (this.loadingElement) {
            this.loadingElement.classList.remove('show');
        }
    }
    
    updateSize() {
        if (this.imgElement) {
            this.imgElement.style.width = `${this.size}px`;
            this.imgElement.style.height = `${this.size}px`;
        }
    }
    
    set onClickHandler(handler) {
        this.onClick = handler;
        if (this.imgElement) {
            this.imgElement.classList.add('clickable');
            this.imgElement.addEventListener('click', handler);
        }
    }
}

// 注册自定义元素
if (!customElements.get('hcl-avatar')) {
    customElements.define('hcl-avatar', HCLAvatarComponent);
}
