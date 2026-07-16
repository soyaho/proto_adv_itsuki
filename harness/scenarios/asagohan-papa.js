/**
 * シーン1・バリエーションB（パパがもう席に着いている）の通しシナリオ。
 * パパ席は揃い済み（D12/所見10の定義）。3膳目は「もうあるよ」→食器棚に戻せる（D8）。
 */
module.exports = {
  name: 'asagohan-papa',
  async run(d) {
    await d.step('あさごはん(B)に入場——パパ席は揃い済み', async () => {
      await d.openPlay('s1', { v1: 'B' });
      const s = await d.readState();
      d.assert(s.variant === 'B', `バリエーション注入が効いていない: ${s.variant}`);
      d.assert(s.s1.papaSeated === true, `パパが着席していない`);
      const p = s.s1.seats.papa;
      d.assert(p.hashi && p.oshibori && p.cup === 'full', `パパ席が揃っていない: ${JSON.stringify(p)}`);
      d.assert(s.s1.oshiboriPile === 2 && s.s1.cupStack === 2, `残り2席分の数になっていない`);
      await d.checkTargets();
    });

    await d.step('3膳目をパパ席へ→「もうあるよ」→食器棚に戻す', async () => {
      await d.tapTarget('hashi_src');
      await d.tapTarget('seat_papa');
      let s = await d.readState();
      d.assert(s.holding && s.holding.t === 'hashi', `箸が手元に残っていない（勝手に置かれた）`);
      d.assert(s.lastBubble && s.lastBubble.text === 'もう あるよ', `パパの「もうあるよ」が出ていない: ${JSON.stringify(s.lastBubble)}`);
      await d.tapTarget('hashi_src');             // 取った場所に戻す（D8）
      s = await d.readState();
      d.assert(s.holding === null, `箸を戻せていない`);
    });

    await d.step('ママ席・いつき席を揃えてクリア（2席分）', async () => {
      for (const seat of ['seat_mama', 'seat_itsuki']) {
        await d.tapTarget('hashi_src');
        await d.tapTarget(seat);
      }
      await d.tapTarget('oshibori_src');
      await d.tapTarget('seat_mama');
      await d.tapTarget('seat_itsuki');
      await d.tapTarget('cups_src');
      await d.tapTarget('seat_mama');
      await d.tapTarget('seat_itsuki');
      await d.tapTarget('pitcher');
      await d.tapTarget('faucet');
      await d.tapTarget('seat_mama');
      let s = await d.readState();
      d.assert(s.s1.done === false, `1席残しでクリアしてしまっている`);
      await d.tapTarget('seat_itsuki');
      s = await d.readState();
      d.assert(s.s1.done === true && s.cleared.s1 === true, `2席揃えてもクリアにならない: ${JSON.stringify(s.s1.seats)}`);
      await d.waitMode('select');
      await d.assertTextClean();
    });
  },
};
