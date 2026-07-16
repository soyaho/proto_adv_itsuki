/**
 * BaseDriver — 実入力主義のブラウザゲーム用テストドライバ基盤（ゲーム非依存）
 *
 * 絶対原則:
 *   - 操作は「実入力」のみ: canvas への実タップ、DOMボタンの実クリック、実長押し。
 *   - page.evaluate は【読み取り専用】。ゲーム内部状態への書き込み・内部関数呼び出しは禁止。
 *     （内部関数を呼ぶテストは、プレイヤーが実際に操作可能かを証明しないため）
 *
 * 使い方: ゲームごとに BaseDriver を継承し、静的 launch(profile) で opts
 * （canvasSelector / logicalWidth / logicalHeight / shotsDir / browserArgs）を渡した上で、
 * ゲーム固有の操作（移動・道具・UI進行）をメソッドとして足す。
 */
const fs = require('fs');
const { chromium } = require('playwright');

class BaseDriver {
  constructor(browser, page, profile, opts) {
    this.browser = browser;
    this.page = page;
    this.profile = profile;
    this.opts = opts;
    this.errors = [];    // console error / pageerror
    this.warnings = [];  // 不変条件の警告（fail はしない）
    this.steps = [];     // {name, ok, ms, err}
  }

  static async launch(profile, opts = {}) {
    const o = Object.assign({
      chromiumPath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium',
      browserArgs: [],
      canvasSelector: 'canvas', // ゲームの遊び場（論理座標系を持つ要素）
      logicalWidth: null,       // ゲームの論理座標系（tap 等を使うなら必須）
      logicalHeight: null,
      shotsDir: null,           // step 失敗時のスクリーンショット保存先
      persistentMessageSelector: null, // 「タップで閉じる」永続メッセージの要素。
                                       // 目標座標を覆っていたら実プレイヤーと同じく閉じてから再タップする
    }, opts);
    const browser = await chromium.launch({ executablePath: o.chromiumPath, args: o.browserArgs });
    const page = await browser.newPage({ viewport: profile.viewport });
    const d = new this(browser, page, profile, o);
    page.on('console', m => { if (m.type() === 'error') d.errors.push('console: ' + m.text()); });
    page.on('pageerror', e => d.errors.push('pageerror: ' + e.message));
    if (o.shotsDir) fs.mkdirSync(o.shotsDir, { recursive: true });
    await page.goto(profile.url);
    return d;
  }

  async close() { await this.browser.close(); }

  /* ---------- ステップ記録 ---------- */
  async step(name, fn) {
    const t0 = Date.now();
    try {
      await fn();
      this.steps.push({ name, ok: true, ms: Date.now() - t0 });
    } catch (e) {
      this.steps.push({ name, ok: false, ms: Date.now() - t0, err: String(e.message || e) });
      if (this.opts.shotsDir)
        await this.page.screenshot({ path: `${this.opts.shotsDir}/FAIL-${this.profile.name}-${this.steps.length}.png` }).catch(() => {});
      throw e; // 進行系シナリオは前提が崩れるので即中断
    }
  }
  assert(cond, msg) { if (!cond) throw new Error('ASSERT: ' + msg); }

  /* ---------- 読み取り（専用） ---------- */
  async read(fn) { return this.page.evaluate(fn); } // 規約: 読み取り以外に使わないこと

  /* ---------- 実入力（論理座標→実座標） ---------- */
  async _box() { return await this.page.locator(this.opts.canvasSelector).boundingBox(); }
  async _toScreen(x, y) {
    const b = await this._box();
    return { x: b.x + x / this.opts.logicalWidth * b.width, y: b.y + y / this.opts.logicalHeight * b.height };
  }
  /** ゲーム論理座標への実タップ。
   *  永続メッセージ（persistentMessageSelector）が目標座標を覆っている場合、1度目のタップは
   *  「閉じる」に化けるので、実プレイヤーと同じく閉じてからもう一度タップする */
  async tap(x, y) {
    const p = await this._toScreen(x, y);
    if (this.opts.persistentMessageSelector) {
      // 閉じた直後に「空き待ち」の保留メッセージが発火して再び目標を覆うことがあるため、
      // 1回で済ませず覆いが外れるまで繰り返す（上限つき。proto_ae #41b で実証されたクラス）
      for (let i = 0; i < 4; i++) {
        const tb = await this.page.locator(this.opts.persistentMessageSelector).boundingBox().catch(() => null);
        if (!(tb && p.x >= tb.x && p.x <= tb.x + tb.width && p.y >= tb.y && p.y <= tb.y + tb.height)) break;
        await this.page.mouse.click(p.x, p.y); // メッセージを閉じるだけ
        await this.page.waitForTimeout(700);   // 保留メッセージの再発火を待って再判定
      }
    }
    await this.page.mouse.click(p.x, p.y);
    await this.page.waitForTimeout(120);
  }

  /* ---------- 画面の実測（汎用） ---------- */
  /** 現在の画面の輝度統計（平均輝度・暗部画素率）。
   *  「見た目の効果が実際に画素として出ているか」の機械検証に使う——
   *  描画系が無音でフォールバック／飽和して緑のまま効果が消える事故の恒久検出
   *  （KNOWLEDGE 原則40「出さないと約束したもの・出すと約束したものはラップ等で機械検証」）。
   *  page.screenshot を測定用の一時 canvas でデコードするだけで、ゲーム状態には触れない */
  async screenshotLumaStats({ darkThreshold = 0.35, quantLevels = null, quantTol = 0.02 } = {}) {
    const buf = await this.page.screenshot();
    const dataUrl = 'data:image/png;base64,' + buf.toString('base64');
    return this.page.evaluate(([url, th, levels, tol]) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); // DOM に追加しない測定専用 canvas
        c.width = img.width; c.height = img.height;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let sum = 0, dark = 0, quant = 0;
        const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) {
          const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
          sum += l; if (l < th) dark++;
          if (levels) for (const q of levels) { if (Math.abs(l - q) <= tol) { quant++; break; } }
        }
        resolve({ mean: sum / n, darkFrac: dark / n, quantFrac: levels ? quant / n : null, w: c.width, h: c.height });
      };
      img.onerror = () => reject(new Error('screenshotLumaStats: decode failed'));
      img.src = url;
    }), [dataUrl, darkThreshold, quantLevels, quantTol]);
  }

  /* ---------- 不変条件チェック（汎用） ---------- */
  /** セレクタ群の実 boundingBox を収集する */
  async collectBoxes(selectors) {
    const boxes = [];
    for (const sel of selectors) {
      const els = this.page.locator(sel);
      const n = await els.count();
      for (let i = 0; i < n; i++) { const b = await els.nth(i).boundingBox(); if (b) boxes.push({ sel: `${sel}[${i}]`, ...b }); }
    }
    return boxes;
  }

  /** タップ対象（{id,x,y,rad} 論理座標）同士の判定重なり: 同座標は fail、近接は警告 */
  checkTapTargetSeparation(objs, { minDist = 12, nearRatio = 0.6 } = {}) {
    for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++) {
      const a = objs[i], b = objs[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < minDist) throw new Error(`オブジェクト重なり: ${a.id} と ${b.id} が同座標（d=${d.toFixed(0)}）`);
      if (d < Math.min(a.rad, b.rad) * nearRatio)
        this.warnings.push(`[${this.profile.name}] タップ判定近接: ${a.id}↔${b.id} d=${d.toFixed(0)}（最近傍優先で解決されるが要確認）`);
    }
  }

  /** タップ対象（論理座標）の中心が、pointer-events を奪う DOM UI に覆われていないか */
  async checkPointsUncovered(objs, coveringSelectors) {
    const box = await this._box();
    const domBoxes = await this.collectBoxes(coveringSelectors);
    for (const o of objs) {
      const sx = box.x + o.x / this.opts.logicalWidth * box.width;
      const sy = box.y + o.y / this.opts.logicalHeight * box.height;
      for (const b of domBoxes) {
        if (sx >= b.x && sx <= b.x + b.width && sy >= b.y && sy <= b.y + b.height)
          throw new Error(`DOM遮蔽: オブジェクト ${o.id} の中心が ${b.sel} に覆われていてタップ不能`);
      }
    }
  }

  /** 葉のインタラクティブ要素の画面外はみ出し（警告）と相互遮蔽（fail） */
  async checkLeafOverlap(leafSelectors, { maxOverlapRatio = 0.3 } = {}) {
    const leaves = await this.collectBoxes(leafSelectors);
    const vp = this.profile.viewport;
    for (const b of leaves) {
      if (b.x < -1 || b.y < -1 || b.x + b.width > vp.width + 1 || b.y + b.height > vp.height + 1)
        this.warnings.push(`[${this.profile.name}] 画面外にはみ出し: ${b.sel}`);
    }
    for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i], b = leaves[j];
      const ox = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
      const oy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      const overlap = ox * oy, small = Math.min(a.width * a.height, b.width * b.height);
      if (overlap > small * maxOverlapRatio)
        throw new Error(`UI遮蔽: ${a.sel} と ${b.sel} が ${(overlap / small * 100).toFixed(0)}% 重なっている`);
    }
  }

  /** 構造検証: バー状の DOM UI が遊び場 canvas と一切重なってはならない
   *  （canvas 上のタップ対象を DOM が奪う事故の恒久対策） */
  async checkBarsClearOfCanvas(barSelectors) {
    const cvb = await this._box();
    for (const b of await this.collectBoxes(barSelectors)) {
      const ox = Math.max(0, Math.min(cvb.x + cvb.width, b.x + b.width) - Math.max(cvb.x, b.x));
      const oy = Math.max(0, Math.min(cvb.y + cvb.height, b.y + b.height) - Math.max(cvb.y, b.y));
      if (ox > 2 && oy > 2) throw new Error(`UIバーが遊び場に重なっている: ${b.sel}（バー分離の破れ／チップ遮蔽の恐れ）`);
    }
  }
}

module.exports = { BaseDriver };
