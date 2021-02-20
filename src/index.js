const fs = require('fs').promises;
const moveFile = require('move-file');

let conf, intervalId;

// デバッグモード
const debug = false;
// テストモード（ファイルを移動しない）
let testMode = true;


async function init() {
  const cf = await fs.readFile('./conf.json').catch(async (e) => {
    error(`Error: conf.jsonの読み込みに失敗: ${e}`);
    await sleep(10000);
    return;
  });
  conf = JSON.parse(cf);
  testMode = conf.testMode;

  intervalId = setInterval(main, conf.intervalMinutes * 60 * 1000);
  main();
  // await sleep(5000);
}


async function main() {
  // EDCB録画ファイルの日時表記 yyyyMMddhhmmss????
  const reg = /^20\d\d\d\d\d\d\d\d\d\d\d\d\d\d\d\d/;
  // conf.json読み込み
  const cf = await fs.readFile('./conf.json').catch(async (e) => {
    error(`Error: conf.jsonの読み込みに失敗: ${e}`);
    await sleep(10000);
    return;
  });
  conf = JSON.parse(cf);
  debug && log(`Loaded: conf.json = ${JSON.stringify(conf)}`);

  // ファイル一覧を取得
  var files = await fs.readdir(conf.sourceDir).catch(async (e) => {
    error(`Error: ターゲットディレクトリの読み込みに失敗: ${e}`);
    await sleep(10000);
    return;
  });
  debug && log(`AllFiles: ${JSON.stringify(files)}`);


  for (let idx = 0; idx < files.length; idx++) {
    // 設定日数より経過したファイルなら
    if (reg.test(files[idx]) && isOld(files[idx], conf.thresholdDays)) {
      // ファイルを移動
      await move(files[idx]).catch((e) => error(e));
    }

    // まだ新しいファイルなら
    else debug && log(`Pass: 移動非外ファイル: ${files[idx]}`);
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
          {
            overwrite: false, // overwrite
          }
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


// プロセスの動作監視
function watchDog() {

}


function log(s) {
  const d = new Date();
  console.log(`[${d.toLocaleDateString()} ${('0' + d.toLocaleTimeString()).slice(-8)}] ${s}`);
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


init();
