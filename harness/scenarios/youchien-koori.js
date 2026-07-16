/**
 * シーン2・バリエーションB（冷凍室に氷がない）の通しシナリオ。
 * ママに聞くと「れいぞうこの したよ」→下段に氷（仕様§6）。
 */
module.exports = {
  name: 'youchien-koori',
  async run(d) {
    await d.step('ようちえん(B)に入場——冷凍室は空', async () => {
      await d.openPlay('s2', { v2: 'B' });
      const s = await d.readState();
      d.assert(s.variant === 'B', `バリエーション注入が効いていない`);
      await d.tapTarget('freezer');
      const ids = await d.read(() => tapTargets().map(t => t.id));
      d.assert(!ids.includes('ice'), `空のはずの冷凍室に氷がある`);
    });

    await d.step('ママに聞く→「れいぞうこの したよ」', async () => {
      await d.tapTarget('mama');
      const s = await d.readState();
      d.assert(s.lastBubble && s.lastBubble.text === 'れいぞうこの したよ', `ママのヒントが出ていない: ${JSON.stringify(s.lastBubble)}`);
    });

    await d.step('下段を開けると氷がある→水筒の用意', async () => {
      await d.tapTarget('lower');
      await d.tapTarget('ice');
      await d.tapTarget('suitou');
      let s = await d.readState();
      d.assert(s.s2.suitou.ice === true, `下段の氷が水筒に入らない`);
      await d.tapTarget('suitou');
      await d.tapTarget('faucet');
      await d.tapTarget('lid');
      await d.tapTarget('bag');
      s = await d.readState();
      d.assert(s.s2.suitou.inBag === true && s.s2.suitou.water === true, `水筒の用意が完了しない: ${JSON.stringify(s.s2.suitou)}`);
    });

    await d.step('残りの持ち物と日焼け止め→クリア', async () => {
      await d.tapTarget('bento'); await d.tapTarget('bag');
      await d.tapTarget('hashiset'); await d.tapTarget('bag');
      await d.tapTarget('tube'); await d.tapTarget('mirror');
      await d.tapTarget('fz0'); await d.tapTarget('fz1'); await d.tapTarget('fz2');
      await d.tapTarget('bag');
      await d.tapTarget('door');
      const s = await d.readState();
      d.assert(s.s2.done === true && s.cleared.s2 === true, `クリアにならない`);
      await d.waitMode('select');
      await d.assertTextClean();
    });
  },
};
