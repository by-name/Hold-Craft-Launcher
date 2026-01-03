// src/renderer/js/utils/settings-utils.js
/**
 * 设置页面工具函数
 */

class SettingsUtils {
    /**
     * 验证表单数据
     */
    static validateFormData(data, rules) {
        const errors = [];
        
        for (const [field, rule] of Object.entries(rules)) {
            const value = data[field];
            
            if (rule.required && (value === undefined || value === null || value === '')) {
                errors.push(`${rule.label} 不能为空`);
                continue;
            }
            
            if (rule.type === 'number' && isNaN(parseFloat(value))) {
                errors.push(`${rule.label} 必须是数字`);
                continue;
            }
            
            if (rule.type === 'integer' && (!Number.isInteger(parseFloat(value)) || parseFloat(value) < 0)) {
                errors.push(`${rule.label} 必须是正整数`);
                continue;
            }
            
            if (rule.min !== undefined && parseFloat(value) < rule.min) {
                errors.push(`${rule.label} 不能小于 ${rule.min}`);
                continue;
            }
            
            if (rule.max !== undefined && parseFloat(value) > rule.max) {
                errors.push(`${rule.label} 不能大于 ${rule.max}`);
                continue;
            }
            
            if (rule.pattern && !rule.pattern.test(String(value))) {
                errors.push(rule.message || `${rule.label} 格式不正确`);
                continue;
            }
        }
        
        return errors;
    }
    
    /**
     * 格式化为文件大小
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * 格式化为时间
     */
    static formatTime(milliseconds) {
        if (milliseconds < 1000) {
            return `${milliseconds} 毫秒`;
        } else if (milliseconds < 60000) {
            return `${(milliseconds / 1000).toFixed(1)} 秒`;
        } else if (milliseconds < 3600000) {
            return `${Math.floor(milliseconds / 60000)} 分钟`;
        } else {
            return `${(milliseconds / 3600000).toFixed(1)} 小时`;
        }
    }
    
    /**
     * 深度克隆对象
     */
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    
    /**
     * 防抖函数
     */
    static debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    /**
     * 节流函数
     */
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * 生成随机 ID
     */
    static generateId(prefix = '') {
        return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    /**
     * 复制文本到剪贴板
     */
    static copyToClipboard(text) {
        return new Promise((resolve, reject) => {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text)
                    .then(resolve)
                    .catch(reject);
            } else {
                // 回退方案
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                try {
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    if (successful) {
                        resolve();
                    } else {
                        reject(new Error('复制失败'));
                    }
                } catch (err) {
                    document.body.removeChild(textArea);
                    reject(err);
                }
            }
        });
    }
    
    /**
     * 保存文件
     */
    static saveFile(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    /**
     * 读取文件
     */
    static readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }
    
    /**
     * 验证 URL
     */
    static isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
    
    /**
     * 验证邮箱
     */
    static isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    /**
     * 验证用户名
     */
    static isValidUsername(username) {
        return username && username.length >= 3 && username.length <= 16 && /^[a-zA-Z0-9_]+$/.test(username);
    }
}

// 添加到全局
if (typeof window !== 'undefined') {
    window.SettingsUtils = SettingsUtils;
}
