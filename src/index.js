const fs = require('fs').promises;
const moveFile = require('move-file');

// 読み込んだconf.json
let conf
// mainのタイマーid
let intervalIdMain;
// ログ保存のタイマーid
let intervalIdLog;
// ログ
let logs = [];

// デバッグモード
const debug = false;
// テストモード（ファイルを移動しない）
let testMode = true;


// initialize
async function init() {
  const cf = await fs.readFile('./conf.json').catch(async (e) => {
    error(`Error: conf.jsonの読み込みに失敗: ${e}`);
    await sleep(10000);
    return;
  });
  conf = JSON.parse(cf);
  testMode = conf.testMode;

  intervalId = setInterval(main, conf.intervalMinutes * 60 * 1000);
  intervalIdLog = setInterval(saveLogs, 10000);
  main();
}


async function main() {
  // EDCB録画ファイルの日時表記 yyyyMMddhhmmss????
  const reg = /^20\d\d\d\d\d\d\d\d\d\d\d\d\d\d\d\d/;
  // conf.json読み込み
  const cf = await fs.readFile('./conf.json').catch(async (e) => {
    error(`Error: conf.jsonの読み込みに失敗: ${e}`);
    debug && await sleep(10000);
    return;
  });
  conf = JSON.parse(cf);
  debug && log(`Loaded: conf.json = ${JSON.stringify(conf)}`);

  // ファイル一覧を取得
  var files = await fs.readdir(conf.sourceDir).catch(async (e) => {
    error(`Error: ターゲットディレクトリの読み込みに失敗: ${e}`);
    debug && await sleep(10000);
    return;
  });
  debug && log(`AllFiles: ${JSON.stringify(files)}`);


  for (let i = 0; i < files.length; i++) {
    var fragment = await isFragment(files[i]);
    debug && log(`moveFragment: ${fragment}: ${files[i]}`);

    // Amatsukazeの切れ端ファイルなら
    if (fragment && !testMode) {
      // 切れ端用フォルダに移動
      await moveFile(
        `${conf.sourceDir}${files[i]}`,
        `${conf.fragmentDir}${files[i]}`,
        { overwrite: true },
      ).catch((e) => error(`Error: moveFragment: ${e}`));
    }

    // 設定日数より経過したファイルなら
    else if (reg.test(files[i]) && isOld(files[i], conf.thresholdDays)) {
      // ファイルを移動
      await move(files[i]).catch((e) => error(e));
    }

    // まだ新しいファイルなら
    else debug && log(`Pass: 対象外ファイル: ${files[i]}`);
  }
}


// ルールに従ってファイルを移動
function move(file) {
  return new Promise((resolve, reject) => {
    const matchedRule = conf.rules.filter((rule) => new RegExp(rule.match).test(file));
    if (matchedRule.length > 0) {
      debug && log(`RuleFound: ${JSON.stringify(matchedRule[0])}`);
      log(`Move: ${file}  ▶  ${matchedRule[0].dest}/${file}`);
      // テストモードでなければ
      if (!testMode){
        // 移動
        moveFile(
          `${conf.sourceDir}${file}`, // source
          `${conf.targetDir}${matchedRule[0].dest}/${file}`, // destination
          { overwrite: false }, // overwrite
        ).then(
          () => resolve(), // 成功
          (e) => reject(`Error: moveFile: ${JSON.stringify(e)}`) // 失敗
        );
      }
      else {
        log(`TestMode: Move: ${conf.sourceDir}${file}  ▶  ${conf.targetDir}${matchedRule[0].dest}/${file}`);
        resolve();
      }
    }
    else {
      warning(`Warning: マッチするルールが見つかりません: ${file}`);
      resolve();
    }
  });
}


// Amatsukazeが作った切れ端ファイル（CM・前後番組など）を移動
function isFragment(fileName) {
  return new Promise(async (resolve) => {
    // ファイル名が -1.mkv などだったら
    if (/-\d\.mkv$/.test(fileName)) {
      // ファイルサイズを取得
      const stat = await fs.stat(`${conf.sourceDir}${fileName}`).catch((e) => error(`Error: isFragment: ${e}`));
      debug && log(`isFragment: ${fileName}: ${stat.size}`);

      resolve(stat.size < 50 * 1024 * 1024); // 50MB未満ならtrue
    }
    else resolve(false);
  });
}


// ファイル名の日時が設定日数より古いか判定
function isOld(dateStr, threshold) {
  const d = new Date(
    Number(dateStr.slice(0, 4)), // yyyy
    Number(dateStr.slice(4, 6)) - 1, // MM
    Number(dateStr.slice(6, 8)), // dd
    Number(dateStr.slice(8, 10)), // hh
    Number(dateStr.slice(10, 12)), // mm
    0, // s
  );

  return d.getTime() < (Date.now() - (threshold * 24 * 60 * 60 * 1000));
}


// 定期的にログを保存
async function saveLogs() {
  if (logs.length === 0) return;

  const copy = logs.slice(0);
  logs = [];

  await fs.writeFile(
    `${conf.logDir}log.txt`,
    copy.join('\r\n') + '\r\n',
    { flag: 'a' } // append
  )
  .catch((e) => error(`Error: saveLogs: ${JSON.stringify(e)}`));
}


// =============================================
// Utilities
// =============================================

function log(s) {
  const d = new Date();
  const ls = `[${d.toLocaleDateString()} ${('0' + d.toLocaleTimeString()).slice(-8)}] ${s}`;
  console.log(ls);
  logs.push(ls.replace(/\x1b\[\d\d?m/g, ''));
}

function error(es) {
  log(`\x1b[31m${es}\x1b[0m`);
}

function warning(ws) {
  log(`\x1b[33m${ws}\x1b[0m`);
}


function sleep(t) {
  return new Promise((resolve) => {
    setTimeout(resolve, t);
  });
}


// =============================================
// Initialize
// =============================================
init();
