/**
 * システム系の通しシナリオ:
 * もどるの2段階確認（誤タップで進行が消えない・所見9）、
 * やめる→再入場でリセット（セーブなし・仕様§7）、ストレージ不使用、UI遮蔽。
 */
module.exports = {
  name: 'system-flow',
  async run(d) {
    await d.step('タイトル→あさごはん(A)→箸を1膳置く', async () => {
      await d.openPlay('s1', { v1: 'A' });
      await d.tapTarget('hashi_src');
      await d.tapTarget('seat_mama');
      const s = await d.readState();
      d.assert(s.s1.seats.mama.hashi === true, `箸を置けていない`);
      await d.checkUiOcclusion();
    });

    await d.step('もどる→「まだ」→進行はそのまま（2段階確認）', async () => {
      await d.page.click('#btnBack');
      const confirmShown = await d.page.locator('#hudConfirm').isVisible();
      d.assert(confirmShown, `確認が出ていない`);
      await d.checkUiOcclusion();                  // 確認表示中もバーは遊び場に重ならない
      await d.page.click('#btnNo');
      const s = await d.readState();
      d.assert(s.mode === 'play' && s.s1.seats.mama.hashi === true, `「まだ」で進行が壊れた`);
    });

    await d.step('もどる→「うん」→シーン選択へ', async () => {
      await d.page.click('#btnBack');
      await d.page.click('#btnYes');
      const s = await d.readState();
      d.assert(s.mode === 'select', `シーン選択に戻れていない: ${s.mode}`);
    });

    await d.step('再入場すると最初から（セーブなし・仕様§7）', async () => {
      await d.page.click('#btnScene1');
      await d.waitMode('play');
      const s = await d.readState();
      d.assert(s.s1.seats.mama.hashi === false, `再入場で前回の進行が残っている（セーブなしのはず）`);
      await d.checkNoStorage();
      await d.assertTextClean();
    });
  },
};
