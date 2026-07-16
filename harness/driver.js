/**
 * GameDriver — 「いつきくんの冒険」用テストドライバ
 *
 * 基盤（ブラウザ起動・step記録・タップ変換・汎用の遮蔽チェック）は
 * real-input-harness（framework/）の BaseDriver。ここには**このゲーム固有**の
 * 操作と不変条件だけを置く。
 *
 * 絶対原則（CLAUDE.md / KNOWLEDGE.md 参照）:
 *   - 操作は「実入力」のみ: canvas への実タップ、DOMボタンの実クリック。
 *   - page.evaluate は【読み取り専用】。S/G への書き込み・内部関数呼び出しは禁止。
 *     例外はテスト入力の注入（URL パラメータ ?ts= / ?v1= / ?v2=）と、
 *     原則40の「禁止表現の機械検証」用 fillText/strokeText ラップ（ゲーム状態に触れない）。
 */
const { BaseDriver } = require('real-input-harness');

const GAME_W = 960, GAME_H = 540; // index.html の W/H と一致させる
const TS = 8;                     // テスト用タイムスケール（原則39）

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

  /* ---------- 起動・シーン入場（すべて実クリック） ---------- */
  /** タイトル→シーン選択→シーンプレイまで。variant はテスト注入（?v1=/?v2=） */
  async openPlay(scene, { v1, v2 } = {}) {
    const q = new URLSearchParams({ ts: String(TS) });
    if (v1) q.set('v1', v1);
    if (v2) q.set('v2', v2);
    await this.page.goto(this.profile.url + '?' + q.toString());
    await this.installTextGuard();
    await this.page.click('#btnStart');
    await this.page.click(scene === 's1' ? '#btnScene1' : '#btnScene2');
    await this.page.waitForFunction(() => G.mode === 'play');
  }

  /* ---------- 実入力（ゲーム固有） ---------- */
  /** tapTargets() を読み取り専用で読んで座標を得て、実タップ→いつきくんの到着と動作完了を待つ */
  async tapTarget(id, { settle = true } = {}) {
    const targets = await this.read(() => tapTargets());
    const t = targets.find(o => o.id === id);
    if (!t) throw new Error(`tapTarget(${id}): 対象が見つからない（現在: ${targets.map(o => o.id).join(',')}）`);
    await this.tap(t.x, t.y);
    if (settle) await this.settle();
  }
  /** 歩行・短い動作（ふく等）の完了を待つ。演出（clear）はモード遷移側の wait を使う */
  async settle(timeout = 20000) {
    await this.page.waitForFunction(() => !G.walk && G.simT >= G.busyUntil, null, { timeout });
  }
  async waitMode(mode, timeout = 20000) {
    await this.page.waitForFunction(m => G.mode === m, mode, { timeout });
  }

  /* ---------- 読み取りヘルパ ---------- */
  async readState() {
    return this.read(() => ({
      mode: G.mode, scene: S.scene, variant: S.variant, cleared: S.cleared,
      holding: G.holding, lastBubble: G.lastBubble || null,
      s1: S.s1, s2: S.s2,
      it: { x: G.it.x, y: G.it.y },
    }));
  }

  /* ---------- 禁止表現の機械検証（原則40） ----------
   * 「✗・スコア・数字・漢字カナ英字を canvas に描かない」（仕様§2-1・§2-6）を、
   * fillText/strokeText のラップで全シナリオ常時監視する。
   * ひらがな・長音・和文記号・空白のみ許可。違反は window.__textViolations に溜まる。 */
  async installTextGuard() {
    await this.page.evaluate(() => {
      if (window.__textGuardInstalled) return;
      window.__textGuardInstalled = true;
      window.__textViolations = [];
      const ALLOWED = /^[ぁ-ゟー　？！。、…♪\s]*$/;
      for (const m of ['fillText', 'strokeText']) {
        const orig = CanvasRenderingContext2D.prototype[m];
        CanvasRenderingContext2D.prototype[m] = function (text, ...rest) {
          if (!ALLOWED.test(String(text))) window.__textViolations.push(`${m}: "${text}"`);
          return orig.call(this, text, ...rest);
        };
      }
    });
  }
  async assertTextClean() {
    const v = await this.read(() => window.__textViolations || []);
    this.assert(v.length === 0, `canvas に禁止文字が描かれた: ${v.join(' | ')}`);
  }

  /* ---------- 不変条件チェック ---------- */
  /** タップ対象同士の判定の重なり＋DOM UI によるタップ対象の遮蔽 */
  async checkTargets() {
    const objs = await this.read(() => tapTargets());
    this.checkTapTargetSeparation(objs);
    await this.checkPointsUncovered(objs, ['.hbtn']);
    // 当たり判定の最小 60×60px 相当（仕様§3.1）
    for (const o of objs) this.assert(o.rad >= 28, `当たり判定が小さすぎる: ${o.id} rad=${o.rad}`);
    // 判定円の重なり下限（監査所見: lid_on↔suitou の重なりクラスの恒久検出。
    // 基盤の separation は同座標(d<12)しか fail にしないため、ゲーム側で「半径和-8px」を下限にする）
    for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++) {
      const a = objs[i], b = objs[j], dd = Math.hypot(a.x - b.x, a.y - b.y);
      this.assert(dd >= a.rad + b.rad - 8, `判定円が重なりすぎ: ${a.id}↔${b.id} d=${dd.toFixed(0)} < ${a.rad + b.rad - 8}`);
    }
  }
  /** インタラクティブDOMの相互遮蔽・画面外＋バーと遊び場の分離 */
  async checkUiOcclusion() {
    await this.checkLeafOverlap(['.hbtn']);
    await this.checkBarsClearOfCanvas(['#hud', '#dock']);
  }
  /** セーブ不使用（仕様§8）の恒久検証 */
  async checkNoStorage() {
    const n = await this.read(() => localStorage.length + sessionStorage.length);
    this.assert(n === 0, `localStorage/sessionStorage が使われている（${n} 件）`);
  }
}

module.exports = { GameDriver, GAME_W, GAME_H };
