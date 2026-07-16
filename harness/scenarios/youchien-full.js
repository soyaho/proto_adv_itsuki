/**
 * シーン2（ようちえん・通常A）の通しシナリオ（実入力のみ）。
 * 「水が先だと氷が入らない」→シンクにあけてやり直し（考えるポイント）、
 * フタを閉めれば運べる（D6）、忘れ物ゲート、鏡の日焼け止め（D9）まで全経路を通す。
 */
module.exports = {
  name: 'youchien-full',
  async run(d) {
    await d.step('タイトル→シーン選択→ようちえん(A)', async () => {
      await d.openPlay('s2', { v2: 'A' });
      const s = await d.readState();
      d.assert(s.mode === 'play' && s.scene === 's2' && s.variant === 'A', `入場状態が不正`);
      await d.checkUiOcclusion();
      await d.checkTargets();
    });

    await d.step('先に水を入れてしまう（間違い順の体験）', async () => {
      await d.tapTarget('suitou');                 // 水筒を持つ
      await d.tapTarget('faucet');                 // 水を注ぐ
      const s = await d.readState();
      d.assert(s.s2.suitou.water === true && s.s2.suitou.ice === false, `水が入っていない`);
      await d.tapTarget('suitou');                 // いったんカウンターに戻す
    });

    await d.step('氷が入らない（タプタプ→うーん。氷は手に残る）', async () => {
      await d.tapTarget('freezer');
      await d.tapTarget('ice');
      let s = await d.readState();
      d.assert(s.holding && s.holding.t === 'ice', `氷を持てていない`);
      await d.tapTarget('suitou');
      s = await d.readState();
      d.assert(s.s2.suitou.ice === false && s.holding && s.holding.t === 'ice', `水入りの水筒に氷が入ってしまった/氷が消えた: ${JSON.stringify({ suitou: s.s2.suitou, holding: s.holding })}`);
    });

    await d.step('氷を冷凍庫に戻し、水をシンクにあける（やり直し可能・仕様§3.3）', async () => {
      await d.tapTarget('freezer');                // 氷をもどす（D8）
      let s = await d.readState();
      d.assert(s.holding === null, `氷を戻せていない`);
      await d.tapTarget('suitou');                 // 水筒を持つ
      await d.tapTarget('sink');                   // あける
      s = await d.readState();
      d.assert(s.s2.suitou.water === false, `水をあけられていない`);
      await d.tapTarget('suitou');                 // カウンターへ戻す
    });

    await d.step('正しい順: 氷→水', async () => {
      await d.tapTarget('ice');
      await d.tapTarget('suitou');
      let s = await d.readState();
      d.assert(s.s2.suitou.ice === true && s.holding === null, `氷が入っていない`);
      await d.tapTarget('suitou');                 // 持って
      await d.tapTarget('faucet');                 // 水
      s = await d.readState();
      d.assert(s.s2.suitou.water === true, `水が入っていない`);
    });

    await d.step('フタを閉め忘れて運ぶとこぼれる→拭く（世界のルール D6・シーン2側）', async () => {
      await d.tapTarget('bag');                    // 開いたままカバンへ→途中でこぼれる→うーん
      let s = await d.readState();
      d.assert(s.s2.suitou.water === false && s.s2.suitou.inBag === false, `開いた水筒がこぼれず入ってしまった: ${JSON.stringify(s.s2.suitou)}`);
      d.assert(s.s2.puddles.length === 1, `水たまりができていない`);
      await d.tapTarget(s.s2.puddles[0].id);       // 拭く（水筒を持ったままでも拭ける）
      s = await d.readState();
      d.assert(s.s2.puddles.length === 0, `シーン2で水たまりが拭けない`);
    });

    await d.step('水を入れ直し→フタ→閉めた水筒は運んでもこぼれない→カバンへ（D6）', async () => {
      await d.tapTarget('faucet');
      await d.tapTarget('lid');                    // フタを閉める（持ったまま）
      let s = await d.readState();
      d.assert(s.s2.suitou.closed === true && s.s2.suitou.water === true, `フタが閉まっていない: ${JSON.stringify(s.s2.suitou)}`);
      await d.tapTarget('bag');
      s = await d.readState();
      d.assert(s.s2.suitou.inBag === true && s.s2.suitou.water === true && s.holding === null,
        `水筒がカバンに入っていない/水がこぼれた: ${JSON.stringify(s.s2.suitou)}`);
      d.assert(s.s2.puddles.length === 0, `閉じた容器なのにこぼれた`);
    });

    await d.step('お弁当→カバン', async () => {
      await d.tapTarget('bento');
      await d.tapTarget('bag');
      const s = await d.readState();
      d.assert(s.s2.bento === true, `お弁当が入っていない`);
    });

    await d.step('お箸を忘れて出発→ママの忘れ物ゲート（仕様§5.2）', async () => {
      await d.tapTarget('door');
      const s = await d.readState();
      d.assert(s.mode === 'play' && s.s2.done === false, `忘れ物があるのにクリアしてしまった`);
      d.assert(s.lastBubble && s.lastBubble.text === 'おはしは？', `ママの指摘が出ていない: ${JSON.stringify(s.lastBubble)}`);
    });

    await d.step('お箸セット→カバン', async () => {
      await d.tapTarget('hashiset');
      await d.tapTarget('bag');
      const s = await d.readState();
      d.assert(s.s2.hashiset === true, `お箸セットが入っていない`);
    });

    await d.step('日焼け止め: チューブ→鏡→顔3ヶ所（鏡がインタラクション面・D9）', async () => {
      await d.tapTarget('tube');
      await d.tapTarget('mirror');
      let s = await d.readState();
      d.assert(s.holding && s.holding.t === 'tube', `チューブを持てていない`);
      await d.checkTargets();                      // 鏡ズーム中のゾーンも座標分離を検査
      await d.tapTarget('fz0');
      await d.tapTarget('fz1');
      s = await d.readState();
      d.assert(s.s2.sun[0] === 1 && s.s2.sun[1] === 1 && s.s2.sunDone === false, `塗り progress が不正: ${JSON.stringify(s.s2.sun)}`);
      await d.tapTarget('fz2');                    // 3ヶ所目＝この瞬間に完了確定
      s = await d.readState();
      d.assert(s.s2.sunDone === true && s.holding === null, `日焼け止めが完了しない: ${JSON.stringify(s.s2.sun)}`);
    });

    await d.step('カバンを背負う→玄関ドア→いってきます！（クリア）', async () => {
      await d.tapTarget('bag');
      let s = await d.readState();
      d.assert(s.s2.bagWorn === true, `カバンを背負えていない`);
      await d.tapTarget('door');
      s = await d.readState();
      d.assert(s.s2.done === true && s.cleared.s2 === true, `クリアにならない: ${JSON.stringify(s.s2)}`);
      await d.waitMode('select');
      const fl = await d.page.locator('#fl2').isVisible();
      d.assert(fl, `クリア済みマークが表示されていない`);
      await d.assertTextClean();
      await d.checkNoStorage();
    });
  },
};
