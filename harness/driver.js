/**
 * GameDriver — スターターゲーム用テストドライバ
 *
 * 基盤（ブラウザ起動・step記録・タップ変換・汎用の遮蔽チェック）は
 * real-input-harness（framework/）の BaseDriver。ここには**このゲーム固有**の
 * 操作と不変条件だけを置く。新しいゲームを作るときは、このファイルを
 * ゲームの道具・UIモードに合わせて書き換える。
 *
 * 絶対原則（CLAUDE.md / KNOWLEDGE.md 参照）:
 *   - 操作は「実入力」のみ: canvas への実タップ、DOMボタンの実クリック、実長押し。
 *   - page.evaluate は【読み取り専用】。S/G への書き込み・内部関数呼び出しは禁止。
 */
const { BaseDriver } = require('real-input-harness');

const GAME_W = 960, GAME_H = 540; // ゲームの論理座標系（index.html の W/H と一致させる）

class GameDriver extends BaseDriver {
  static async launch(profile) {
    return super.launch(profile, {
      canvasSelector: '#cv',
      logicalWidth: GAME_W,
      logicalHeight: GAME_H,
      shotsDir: `${__dirname}/shots`,
      browserArgs: ['--autoplay-policy=no-user-gesture-required'],
    });
  }

  /* ---------- 実入力（ゲーム固有） ---------- */
  /** tapTargets() を読み取り専用で読んで座標を得て、実タップする */
  async tapTarget(id) {
    const targets = await this.read(() => tapTargets());
    const t = targets.find(o => o.id === id);
    if (!t) throw new Error(`tapTarget(${id}): 対象が見つからない`);
    await this.tap(t.x, t.y);
  }

  /* ---------- 読み取りヘルパ ---------- */
  /** 進行状態の読み取り専用スナップショット */
  async readState() {
    return this.read(() => ({ mode: G.mode, lit: [...S.lit], done: S.done }));
  }

  /* ---------- 不変条件チェック（ゲーム固有のセレクタで基盤を呼ぶ） ---------- */
  /** タップ対象同士の判定の重なり＋DOM UI によるタップ対象の遮蔽 */
  async checkTargets() {
    const objs = await this.read(() => tapTargets());
    this.checkTapTargetSeparation(objs);
    await this.checkPointsUncovered(objs, ['.hbtn']);
  }
  /** インタラクティブDOMの相互遮蔽・画面外＋バーと遊び場の分離 */
  async checkUiOcclusion() {
    await this.checkLeafOverlap(['.hbtn', '#dbg button']);
    await this.checkBarsClearOfCanvas(['#hud', '#dock']);
  }
}

module.exports = { GameDriver, GAME_W, GAME_H };
