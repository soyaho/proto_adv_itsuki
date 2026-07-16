/**
 * ハーネスランナー：このゲームのプロファイル定義を real-input-harness の
 * 汎用ランナーに渡すだけの薄い入口
 *   node run.js [--profile desktop|mobile|mobile-landscape] [--scenario <name>]
 */
const path = require('path');
const { runHarness } = require('real-input-harness');
const { GameDriver } = require('./driver');

const GAME_URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const PROFILES = [
  { name: 'desktop', viewport: { width: 1100, height: 700 }, url: GAME_URL },
  { name: 'mobile', viewport: { width: 390, height: 844 }, url: GAME_URL },           // iPhone縦
  { name: 'mobile-landscape', viewport: { width: 844, height: 390 }, url: GAME_URL }, // iPhone横
];

runHarness({
  profiles: PROFILES,
  scenarioDir: path.join(__dirname, 'scenarios'),
  Driver: GameDriver,
  reportPath: path.join(__dirname, 'report.json'),
}).catch(e => { console.error(e); process.exit(1); });
