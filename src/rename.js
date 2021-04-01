// 指定したフォルダ以下すべてのサブフォルダのファイルをリネームする

const fs = require('fs').promises;
const testMode = true;
const TARGET_DIR = 'D:Games';

let count = 0;


async function main() {
  console.log('開始');

  await scan(TARGET_DIR);

  console.log('終了');
}


// ファイルをリストアップ・再帰的にサブフォルダを探索
async function scan(currentPath) {
  return new Promise(async (resolve) => {
    const dir = await fs.readdir(currentPath);

    for (let i = 0; i < dir.length; i++) {
      const stat = await fs.stat(`${currentPath}/${dir[i]}`);

      if (stat.isDirectory()) await scan(`${currentPath}/${dir[i]}`);
      else await rename(`${currentPath}/${dir[i]}`);
    }

    // dir.forEach(async (name) => {
    //   const stat = await fs.stat(`${currentPath}/${name}`);

    //   if (stat.isDirectory()) await scan(`${currentPath}/${name}`);
    //   else await rename(`${currentPath}/${name}`);
    // });

    resolve();
  });
}


async function rename (path) {
  return new Promise((resolve) => {
    count += 1;
    console.log(`${count}: ${path}`);

    resolve();
  });
}

main();