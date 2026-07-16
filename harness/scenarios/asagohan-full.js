/**
 * シーン1（あさごはん・通常A）の通しシナリオ（実入力のみ）
 * これが green であること＝「クリアまで実際のタップ・ボタン操作だけで到達可能」の証明。
 * こぼし→拭く（世界のルール D6）と、みずさし正解経路の両方を通る。
 */
module.exports = {
  name: 'asagohan-full',
  async run(d) {
    await d.step('タイトル→シーン選択→あさごはん(A)', async () => {
      await d.openPlay('s1', { v1: 'A' });
      const s = await d.readState();
      d.assert(s.mode === 'play' && s.scene === 's1' && s.variant === 'A', `入場状態が不正: ${JSON.stringify({ mode: s.mode, scene: s.scene, variant: s.variant })}`);
      await d.checkUiOcclusion();
      await d.checkTargets();
      await d.checkNoStorage();
    });

    await d.step('関係ないもの（炊飯器・パパ）も反応する（仕様§2-3）', async () => {
      await d.tapTarget('suihanki');
      await d.tapTarget('papa');
      const s = await d.readState();
      d.assert(s.lastBubble && s.lastBubble.who === 'papa', `パパが反応していない: ${JSON.stringify(s.lastBubble)}`);
    });

    await d.step('お箸を3膳（1膳ずつ＝数の考えるポイント）', async () => {
      for (const seat of ['seat_papa', 'seat_mama', 'seat_itsuki']) {
        await d.tapTarget('hashi_src');
        let s = await d.readState();
        d.assert(s.holding && s.holding.t === 'hashi', `箸を持てていない: ${JSON.stringify(s.holding)}`);
        await d.tapTarget(seat);
        s = await d.readState();
        d.assert(s.holding === null, `箸を置けていない(${seat})`);
      }
      const s = await d.readState();
      d.assert(['papa', 'mama', 'itsuki'].every(k => s.s1.seats[k].hashi), `箸が3席に揃っていない: ${JSON.stringify(s.s1.seats)}`);
    });

    await d.step('おしぼりの山をまとめ持ち→3席へ', async () => {
      await d.tapTarget('oshibori_src');
      let s = await d.readState();
      d.assert(s.holding && s.holding.t === 'oshibori' && s.holding.n === 3, `おしぼりの束を持てていない: ${JSON.stringify(s.holding)}`);
      for (const seat of ['seat_papa', 'seat_mama', 'seat_itsuki']) await d.tapTarget(seat);
      s = await d.readState();
      d.assert(s.holding === null && ['papa', 'mama', 'itsuki'].every(k => s.s1.seats[k].oshibori), `おしぼりが3席に揃っていない`);
    });

    await d.step('コップの重ねをまとめ持ち→3席へ（からのまま）', async () => {
      await d.tapTarget('cups_src');
      for (const seat of ['seat_papa', 'seat_mama', 'seat_itsuki']) await d.tapTarget(seat);
      const s = await d.readState();
      d.assert(['papa', 'mama', 'itsuki'].every(k => s.s1.seats[k].cup === 'empty'), `コップが3席に置けていない: ${JSON.stringify(s.s1.seats)}`);
      await d.checkTargets();
    });

    await d.step('コップ直持ちで水→運ぶとこぼれる（世界のルール D6）', async () => {
      await d.tapTarget('seat_itsuki');           // 空のコップを取り上げる
      let s = await d.readState();
      d.assert(s.holding && s.holding.t === 'cup' && s.s1.seats.itsuki.cup === 'none', `コップを取れていない`);
      await d.tapTarget('faucet');                // 蛇口で水を入れる
      s = await d.readState();
      d.assert(s.holding.filled === true, `コップに水が入っていない`);
      await d.tapTarget('seat_itsuki');           // 席まで運ぶ→途中でこぼれる
      s = await d.readState();
      d.assert(s.holding === null && s.s1.seats.itsuki.cup === 'empty', `こぼれた後のコップが空で置かれていない: ${JSON.stringify(s.s1.seats.itsuki)}`);
      d.assert(s.s1.puddles.length === 1, `水たまりができていない: ${JSON.stringify(s.s1.puddles)}`);
    });

    await d.step('水たまりを拭く（罰ではなく遊び）', async () => {
      const s0 = await d.readState();
      await d.tapTarget(s0.s1.puddles[0].id);
      const s = await d.readState();
      d.assert(s.s1.puddles.length === 0, `水たまりが拭けていない`);
    });

    await d.step('みずさし（フタつき）で水を運んで3杯注ぐ→クリア', async () => {
      await d.tapTarget('pitcher');
      await d.tapTarget('faucet');
      let s = await d.readState();
      d.assert(s.holding && s.holding.t === 'pitcher' && s.holding.filled, `みずさしに水が入っていない`);
      await d.tapTarget('seat_papa');
      await d.tapTarget('seat_mama');
      s = await d.readState();
      d.assert(s.s1.seats.papa.cup === 'full' && s.s1.seats.mama.cup === 'full', `注げていない: ${JSON.stringify(s.s1.seats)}`);
      d.assert(s.s1.done === false, `2席の時点でクリアしてしまっている`);
      await d.tapTarget('seat_itsuki');           // 3杯目＝この接触の瞬間にクリア確定
      s = await d.readState();
      d.assert(s.s1.done === true && s.cleared.s1 === true, `3席揃ってもクリアにならない: ${JSON.stringify(s.s1)}`);
    });

    await d.step('クリア演出→シーン選択に戻る（お花が咲く）', async () => {
      await d.waitMode('select');
      const fl = await d.page.locator('#fl1').isVisible();
      d.assert(fl, `クリア済みマークが表示されていない`);
      await d.assertTextClean();
      await d.checkNoStorage();
    });
  },
};
