const fs = require('fs').promises;
const moveFile = require('move-file');

// 設定ファイルのパス
const CONF_JSON_PATH = './RecFileOrganizer.json';
// 読み込んだ設定JSON
let conf;
// mainのタイマーid
let intervalIdMain;
// ログ保存のタイマーid
let intervalIdLog;
// ログを一時的に溜めるArray
let logs = [];

// デバッグモード
const debug = false;
// テストモード（ファイルを移動しない） JSONの設定値で上書き
let testMode = true;


// initialize
async function init() {
  const confJson = await fs.readFile(CONF_JSON_PATH).catch(async (e) => {
    error(`Error: conf.jsonの読み込みに失敗: ${e}`);
    await sleep(10000);
    return;
  });
  conf = JSON.parse(confJson);
  testMode = conf.testMode;

  intervalId = setInterval(main, conf.intervalMinutes * 60 * 1000);
  intervalIdLog = setInterval(saveLogs, 10000);
  main();
}


async function main() {
  // EDCB録画ファイルの日時表記 yyyyMMddhhmmss????
  const reg = /20\d\d\d\d\d\d\d\d\d\d\d\d\d\d\d\d/;
  // conf.json読み込み
  const cf = await fs.readFile(CONF_JSON_PATH).catch(async (e) => {
    error(`Error: conf.jsonの読み込みに失敗: ${e}`);
    debug && (await sleep(10000));
    return;
  });
  conf = JSON.parse(cf);
  debug && log(`Loaded: conf.json = ${JSON.stringify(conf)}`);

  // ==================================================================
  // リネーム
  // ==================================================================
  // ファイル一覧を取得
  var files = await fs.readdir(conf.sourceDir).catch(async (e) => {
    error(`Error: ターゲットディレクトリの読み込みに失敗: ${e}`);
    debug && (await sleep(10000));
    return;
  });

  debug && log(`AllFiles: ${JSON.stringify(files)}`);

  for (let i = 0; i < files.length; i++) {
    // 切れ端ファイルを移動
    var fragment = await isFragment(files[i]);

    // Amatsukazeの切れ端ファイルなら
    if (fragment) {
      log(`Fragment: ${files[i]} ▶ ${conf.fragmentDir}`);
      // 切れ端用フォルダに移動
      !testMode &&
        (await moveFile(`${conf.sourceDir}${files[i]}`, `${conf.fragmentDir}${files[i]}`, { overwrite: true }).catch((e) =>
          error(`Error: moveFragment: ${e}`)
        ));
    }

    // ファイル名の先頭に日時文字列があれば
    else if (/^20\d\d\d\d\d\d\d\d\d\d\d\d\d\d\d\d/.test(files[i])) {
      // 日時とタイトルをひっくり返す
      var newFileName = getTitleDateReverted(files[i]);
      // [再] などの記号を取り除く
      newFileName = getTitleFormatted(newFileName);

      log(`Rename: ${files[i]} ▷ ${newFileName}`);
      !testMode && (await fs.rename(`${conf.sourceDir}${files[i]}`, `${conf.sourceDir}${newFileName}`));
    }
  }

  // ==================================================================
  // 移動
  // ==================================================================
  // ファイル一覧を再取得
  files = await fs.readdir(conf.sourceDir).catch(async (e) => {
    error(`Error: ターゲットディレクトリの読み込みに失敗: ${e}`);
    debug && (await sleep(10000));
    return;
  });

  for (let i = 0; i < files.length; i++) {
    // 設定日数より経過したファイルなら
    if (reg.test(files[i]) && isOld(files[i].match(reg)[0], conf.thresholdDays)) {
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
      log(`Move: ${file}  ▶  ${matchedRule[0].dest}/`);
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
        // log(`TestMode: Move: ${conf.sourceDir}${file}  ▶  ${conf.targetDir}${matchedRule[0].dest}/${file}`);
        resolve();
      }
    }
    else {
      warning(`Warning: マッチするルールが見つかりません: ${file}`);
      resolve();
    }
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
