// src/utils/network.js
const axios = require('axios');

class HCLNetworkUtils {
  static async checkInternetConnection() {
    try {
      await axios.get('https://www.minecraft.net', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
  
  static async downloadWithRetry(url, options = {}) {
    // 带重试的下载方法
  }
}

module.exports = HCLNetworkUtils;
