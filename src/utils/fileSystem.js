// src/utils/fileSystem.js
const fs = require('fs').promises;
const path = require('path');

class HCLFileUtils {
  static async ensureDirectory(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
  }
  
  static async copyDirectory(src, dest) {
    // 目录复制工具
  }
}
