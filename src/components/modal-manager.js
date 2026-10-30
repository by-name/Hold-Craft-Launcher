// src/renderer/js/components/modal-manager.js
/**
 * 模态窗口管理器
 */
class ModalManager {
    constructor() {
        this.currentModal = null;
        this.modalStack = [];
    }
    
    /**
     * 显示模态窗口
     */
    show(options) {
        const {
            title = '提示',
            content = '',
            type = 'info',
            buttons = [{ text: '确定', action: 'close', className: 'btn-primary' }],
            onClose = null,
            size = 'medium' // small, medium, large
        } = options;
        
        // 如果已有模态窗口，先关闭
        if (this.currentModal) {
            this.close();
        }
        
        // 创建模态窗口
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        const modalDialog = document.createElement('div');
        modalDialog.className = `modal-dialog modal-${size}`;
        
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        
        const modalTitle = document.createElement('h3');
        modalTitle.textContent = title;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => this.close();
        
        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeBtn);
        
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        
        if (typeof content === 'string') {
            modalBody.innerHTML = content;
        } else {
            modalBody.appendChild(content);
        }
        
        const modalFooter = document.createElement('div');
        modalFooter.className = 'modal-footer';
        
        buttons.forEach(buttonConfig => {
            const button = document.createElement('button');
            button.className = `btn ${buttonConfig.className || 'btn-secondary'}`;
            button.textContent = buttonConfig.text;
            
            button.onclick = () => {
                if (buttonConfig.action === 'close') {
                    this.close();
                } else if (typeof buttonConfig.action === 'function') {
                    buttonConfig.action();
                }
            };
            
            modalFooter.appendChild(button);
        });
        
        modalDialog.appendChild(modalHeader);
        modalDialog.appendChild(modalBody);
        modalDialog.appendChild(modalFooter);
        modal.appendChild(modalDialog);
        
        // 添加到页面
        document.body.appendChild(modal);
        
        // 显示动画
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
        
        // 保存引用
        this.currentModal = {
            element: modal,
            onClose
        };
        this.modalStack.push(this.currentModal);
        
        // ESC 键关闭
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };
        document.addEventListener('keydown', escHandler);
        modal._escHandler = escHandler;
    }
    
    /**
     * 关闭模态窗口
     */
    close() {
        if (!this.currentModal) return;
        
        const modal = this.currentModal.element;
        
        // 移除 ESC 监听
        if (modal._escHandler) {
            document.removeEventListener('keydown', modal._escHandler);
        }
        
        // 隐藏动画
        modal.classList.remove('show');
        
        setTimeout(() => {
            if (modal.parentElement) {
                modal.parentElement.removeChild(modal);
            }
            
            // 调用关闭回调
            if (this.currentModal.onClose) {
                this.currentModal.onClose();
            }
            
            // 从堆栈中移除
            this.modalStack.pop();
            
            // 恢复上一个模态窗口
            this.currentModal = this.modalStack.length > 0 
                ? this.modalStack[this.modalStack.length - 1]
                : null;
        }, 300);
    }
    
    /**
     * 显示确认对话框
     */
    confirm(options) {
        return new Promise((resolve) => {
            this.show({
                title: options.title || '确认',
                content: options.message || '确定要执行此操作吗？',
                type: 'confirm',
                buttons: [
                    {
                        text: '取消',
                        action: () => resolve(false),
                        className: 'btn-secondary'
                    },
                    {
                        text: '确定',
                        action: () => resolve(true),
                        className: 'btn-primary'
                    }
                ]
            });
        });
    }
    
    /**
     * 显示提示对话框
     */
    prompt(options) {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = options.type || 'text';
            input.className = 'modal-input';
            input.placeholder = options.placeholder || '';
            input.value = options.defaultValue || '';
            
            if (options.pattern) {
                input.pattern = options.pattern;
            }
            
            this.show({
                title: options.title || '输入',
                content: (() => {
                    const wrapper = document.createElement('div');
                    if (options.message) {
                        const message = document.createElement('p');
                        message.textContent = options.message;
                        wrapper.appendChild(message);
                    }
                    wrapper.appendChild(input);
                    return wrapper;
                })(),
                buttons: [
                    {
                        text: '取消',
                        action: () => resolve(null),
                        className: 'btn-secondary'
                    },
                    {
                        text: '确定',
                        action: () => resolve(input.value),
                        className: 'btn-primary'
                    }
                ],
                onClose: () => {
                    input.focus();
                }
            });
        });
    }
    
    /**
     * 显示加载中模态窗口
     */
    showLoading(message = '加载中...') {
        this.show({
            title: '',
            content: `
                <div class="loading-modal">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">${message}</div>
                </div>
            `,
            buttons: [],
            onClose: null
        });
    }
    
    /**
     * 隐藏加载中模态窗口
     */
    hideLoading() {
        this.close();
    }
}

// 全局实例
if (typeof window !== 'undefined') {
    window.modalManager = new ModalManager();
}
