// 指定したフォルダ以下すべてのサブフォルダのファイルをリネームする

const fs = require('fs').promises;
const moveFile = require('move-file');

const testMode = true;

const TARGET_DIR = 'T:/';

async function rename () {
  const files = await fs.readdir(TARGET_DIR);
}

rename();