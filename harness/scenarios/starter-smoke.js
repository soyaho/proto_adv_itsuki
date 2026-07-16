/**
 * スターターゲームの通しシナリオ（実入力のみ）
 * これが green であること＝「クリアまで実際のタップ・ボタン操作だけで到達可能」の証明。
 * 新しいゲームに置き換えたら、このファイルをそのゲームの full-playthrough に置き換える。
 * 進行フラグやタップ対象の配置を変えたら必ずここを通すこと。
 */
module.exports = {
  name: 'starter-smoke',
  async run(d) {
    const R = fn => d.read(fn);

    await d.step('タイトル→はじめる', async () => {
      await d.page.click('#btnStart');
      await d.page.waitForTimeout(200);
      const s = await d.readState();
      d.assert(s.mode === 'play', `mode が play でない: ${JSON.stringify(s)}`);
      await d.checkUiOcclusion();
      await d.checkTargets();
    });

    await d.step('灯aを点ける（フラグとセーブは操作の瞬間に確定）', async () => {
      await d.tapTarget('a');
      const s = await d.readState();
      d.assert(s.lit[0] === true && s.done === false, `点灯直後の状態がおかしい: ${JSON.stringify(s)}`);
      // localStorage の読み取りは可（内部関数呼び出しではない）。「タップの瞬間にセーブ」の実証
      const saved = await d.page.evaluate(() => JSON.parse(localStorage.getItem('html-game-template:starter')));
      d.assert(saved && saved.lit[0] === true, `セーブに反映されていない: ${JSON.stringify(saved)}`);
    });

    await d.step('中断→つづきから（途中セーブ復帰）', async () => {
      await d.page.reload();
      await d.page.waitForTimeout(200);
      await d.page.click('#btnCont');
      await d.page.waitForTimeout(200);
      const s = await d.readState();
      d.assert(s.mode === 'play' && s.lit[0] === true && s.lit[1] === false,
        `途中セーブからの復帰が正しくない: ${JSON.stringify(s)}`);
    });

    await d.step('残り2つを点けてクリア', async () => {
      await d.tapTarget('b');
      await d.tapTarget('c');
      const s = await d.readState();
      d.assert(s.done === true, `全点灯してもクリアにならない: ${JSON.stringify(s)}`);
      const prog = await d.page.locator('#prog').textContent();
      d.assert(prog === '灯 3/3', `#prog の表示が更新されていない: ${prog}`);
    });

    await d.step('リロード→つづきから→クリア状態が復元される', async () => {
      await d.page.reload();
      await d.page.waitForTimeout(200);
      await d.page.click('#btnCont');
      await d.page.waitForTimeout(200);
      const s = await d.readState();
      d.assert(s.done === true, `クリア状態が復元されていない: ${JSON.stringify(s)}`);
      await d.checkUiOcclusion();
    });

    await d.step('はじめから（リセット）', async () => {
      await d.page.click('#btnReset');
      await d.page.waitForTimeout(200);
      const s = await d.readState();
      d.assert(s.mode === 'play' && s.lit.every(v => v === false) && s.done === false,
        `リセットが正しく初期化されていない: ${JSON.stringify(s)}`);
    });
  },
};
