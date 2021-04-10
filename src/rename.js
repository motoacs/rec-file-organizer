// 指定したフォルダ以下すべてのサブフォルダのファイルをリネームする

const fs = require('fs').promises;
const testMode = false;
const TARGET_DIR = 'T:';

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
    resolve();
  });
}


function rename (path) {
  return new Promise(async (resolve) => {
    count += 1;
    let newPath = path.split('/');
    let fileName = newPath.slice(-1)[0];

    // リネームする必要があれば
    if (/^20\d\d\d\d\d\d\d\d\d\d\d\d\d\d\d\d.*\.(mkv|mp4|webm)$/.test(fileName)) {
      fileName = getTitleDateReverted(fileName);
      fileName = getTitleFormatted(fileName);

      newPath.pop();
      newPath.push(fileName);
      newPath = newPath.join('/');
      console.log(`${count}: ${path} ▶ ${newPath}`);

      !testMode && await fs.rename(path, newPath);
    }

    resolve();
  });
}

// "yyyyMMddhhmmss010*-Program Title.mkv" → "Program Title-yyyyMMddhhmmss010*.mkv"
function getTitleDateReverted(fileName) {
  const dateStr = fileName.match(/^20\d\d\d\d\d\d\d\d\d\d\d\d\d\d\d\d/)[0];
  const extension = fileName.match(/(mp4|mkv|webm|ts|m2ts)$/)[0];
  const title = fileName.replace(/^20\d\d\d\d\d\d\d\d\d\d\d\d\d\d\d\d-/, '').replace(/\.(mp4|mkv|webm|ts|m2ts)$/, '');

  return `${title}-${dateStr}.${extension}`;
}


// [再]などを取り除く
function getTitleFormatted(fileName) {
  let ret = fileName.replace(/(\[再\]|\[二\]|\[双\]|\[解\]|\[字\]|\[終\]|\[新\]|\[S\])/g, '');
  ret = ret.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
  ret = ret.replace(/　/g, ' ');

  // 題1話 → 題01話
  const idx = ret.search(/第\d話/);
  if (idx >= 0) ret = `${ret.slice(0, idx + 1)}0${ret.slice(idx + 1)}`;
  return ret;
}


main();