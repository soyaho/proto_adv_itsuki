# real-input-harness

実入力主義のブラウザゲーム用テストハーネス基盤（Playwright）。ゲーム非依存の
ランナーとドライバ基盤だけを提供する。**このディレクトリは単独のリポジトリに
切り出せるよう自己完結している**（proto_ae 本体への参照を持たない）。

## 絶対原則

- **実入力主義**: シナリオは本物の pointer イベント（タップ・長押し・DOMボタンクリック）
  だけでゲームを操作する。`page.evaluate` での**状態書き込み・内部関数呼び出しは禁止**。
  読み取り（アサーション用）のみ可。
  - 理由: 内部関数を呼ぶテストは「プレイヤーが実際に操作できるか」を証明しない
- シナリオが最後まで通ること自体が「全進行が実操作で到達可能」の証明（到達可能性テスト）

## 提供するもの

- `BaseDriver` — ブラウザ起動、step 記録（失敗時スクショ）、論理座標→実座標のタップ変換
  （`persistentMessageSelector` を渡すと「タップで閉じる」永続メッセージが目標座標を
  覆っている場合に、実プレイヤーと同じく閉じてから再タップする）、
  読み取り専用 `read()`、汎用の不変条件チェック:
  - `checkTapTargetSeparation(objs)` — タップ対象同士の判定重なり（同座標 fail／近接は警告）
  - `checkPointsUncovered(objs, selectors)` — タップ対象の中心が DOM UI に覆われていないか
  - `checkLeafOverlap(selectors)` — インタラクティブ要素の相互遮蔽（fail）と画面外はみ出し（警告）
  - `checkBarsClearOfCanvas(selectors)` — UIバーが遊び場 canvas に重なっていないか
- `runHarness(config)` — 全プロファイル×全シナリオの実行、`--profile` / `--scenario`
  フィルタ、report.json 出力、exit code

## 使い方

ゲームごとに `BaseDriver` を継承してゲーム固有の操作を足し、`runHarness` に渡す:

```js
const { BaseDriver, runHarness } = require('real-input-harness');

class GameDriver extends BaseDriver {
  static async launch(profile) {
    return super.launch(profile, {
      canvasSelector: '#cv',
      logicalWidth: 960, logicalHeight: 540,
      shotsDir: __dirname + '/shots',
      browserArgs: ['--autoplay-policy=no-user-gesture-required'],
    });
  }
  // ゲーム固有の操作（walkTo / 道具ボタン / マップ移動 / ダイアログ送り…）をここに足す
}

runHarness({
  profiles: [{ name: 'desktop', viewport: { width: 1100, height: 700 }, url: GAME_URL }],
  scenarioDir: __dirname + '/scenarios', // {name, run(driver)} を export する .js 群
  Driver: GameDriver,
  reportPath: __dirname + '/report.json',
});
```

Chromium は `PLAYWRIGHT_CHROMIUM_PATH`（既定 `/opt/pw-browsers/chromium`）を使う。
