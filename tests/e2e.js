const { chromium, devices } = require('playwright-core');
const out = __dirname + '/out/'; require('fs').mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const [skin, dev, scheme] of [['ios', 'iPhone 13', 'light'], ['gboard', 'Pixel 7', 'dark'], ['samsung', 'Galaxy S9+', 'light']]) {
    const ctx = await browser.newContext({ ...devices[dev], colorScheme: scheme });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://localhost:8765/index.html?n=3&seed=test&kb=${skin}`);
    await page.tap('#btn-start');
    const center = k => page.evaluate(k => { const r = curKb().s.keys.find(o => o.k === k).el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, k);
    const tapKey = async k => { const [x, y] = await center(k); await page.touchscreen.tap(x, y); await page.waitForTimeout(30); };
    const twoFingers = async (a, b) => { // hold one finger, tap with a second -> blocked
      const [ax, ay] = await center(a), [bx, by] = await center(b);
      await page.evaluate(([ax, ay, bx, by]) => {
        const el = curKb().el, pe = (t, id, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch' }));
        pe('pointerdown', 91, ax, ay); pe('pointerdown', 92, bx, by); pe('pointerup', 92, bx, by); pe('pointerup', 91, ax, ay);
      }, [ax, ay, bx, by]);
    };
    for (let pass = 0; pass < 2; pass++) {
      await page.waitForSelector('#s-pass.on'); await page.waitForTimeout(450);
      if (skin === 'ios') await page.screenshot({ path: `${out}pass${pass + 1}-intro.png` });
      await page.tap('#btn-pass');
      for (let w = 0; w < 3; w++) {
        await page.waitForFunction(() => S.kb && S.kb.enabled);
        const word = await page.evaluate(() => S.plan[S.p].words[S.i]);
        let seq = [...word];
        if (pass === 1 && w === 0) seq[1] = 'q';
        for (const k of seq) await tapKey(k);
        if (pass === 1 && w === 1) await twoFingers('a', 'b');
        await tapKey('enter');
      }
      // Numbers: intro screen, then 3 sequences on the pad.
      await page.waitForSelector('#s-pass.on'); await page.waitForTimeout(450);
      if (skin === 'ios' && pass === 0) await page.screenshot({ path: `${out}numbers-intro.png` });
      await page.tap('#btn-pass');
      for (let q = 0; q < 3; q++) {
        await page.waitForFunction(() => S.pad && S.pad.enabled && S.num);
        if (pass === 0 && q === 0) await page.screenshot({ path: `${out}${skin}-pad.png` });
        const digits = [...await page.evaluate(() => S.plan[S.p].seqs[S.i])];
        const wrong = d => String((+d + 1) % 10);
        if (pass === 0 && q === 1) { await tapKey(wrong(digits[0])); await tapKey('<'); } // fixed with ⌫
        if (pass === 0 && q === 2) digits[3] = wrong(digits[3]); // left wrong
        for (const d of digits) await tapKey(d);
        if (pass === 1 && q === 0) await twoFingers('5', '8');
        if (pass === 1 && q === 1) await tapKey(skin === 'ios' ? 'blank' : 'go'); // inert, recorded
        await tapKey('enter');
      }
      if (pass === 0) { await page.waitForSelector('#s-pass.on'); if (skin === 'ios') await page.screenshot({ path: `${out}pass1-summary.png` }); await page.waitForTimeout(450); await page.tap('#btn-pass'); }
    }
    await page.waitForSelector('#s-result.on'); await page.waitForFunction(() => !!S.link);
    await page.screenshot({ path: `${out}${skin}-result2.png`, fullPage: true });
    const res = await page.evaluate(() => ({
      v: S.rec.v, grips: S.rec.passes.map(p => p.grip),
      words: S.rec.passes.map(p => p.trials.map(t => t.word).join(',')),
      typed: S.rec.passes.map(p => p.trials.map(t => typedOf(t.ev)).join(',')),
      vis7: S.rec.passes.every(p => p.trials.every(t => t.vis.length === 7)),
      labelsDiffer: S.rec.passes[0].trials.some(t => JSON.stringify(t.vis) !== JSON.stringify(S.rec.passes[1].trials.find(u => u.word === t.word).vis)),
      blocked: S.rec.passes.map(p => p.trials.map(t => (t.blocked || []).length)),
      nums: S.rec.passes.map(p => p.nums.map(t => t.seq).join(',')),
      numsTyped: S.rec.passes.map(p => p.nums.map(t => typedOf(t.ev)).join(',')),
      numVis: S.rec.passes.every(p => p.nums.every(t => t.vis.length === 2 && t.vis[0] === t.seq[0] && !t.seq.includes(t.vis[1]))),
      numBlocked: S.rec.passes.map(p => p.nums.map(t => (t.blocked || []).length)),
      numStray: S.rec.passes.map(p => p.nums.map(t => t.ev.filter(e => !isTyping(e[2])).map(e => e[2]).join('') || '-')),
      numRows: document.querySelectorAll('#r-nrows .row').length,
      linkLen: S.link.length,
    }));
    console.log(skin, JSON.stringify(res));
    const p2 = await ctx.newPage(); const errs2 = []; p2.on('pageerror', e => errs2.push(e.message));
    await p2.goto(await page.evaluate(() => S.link)); await p2.waitForSelector('#s-result.on');
    console.log(skin, 'link identical:', await p2.evaluate(o => JSON.stringify(S.rec) === o, await page.evaluate(() => JSON.stringify(S.rec))));
    // Share hands over the file (.json on iOS, .txt elsewhere), and loading that file gives back the same recording.
    const shared = await page.evaluate(async () => {
      let got; navigator.canShare = () => true; navigator.share = async d => { got = d.files[0]; };
      await $('#btn-share').onclick();
      return { name: got.name, type: got.type, text: await got.text() };
    });
    const p3 = await ctx.newPage(); p3.on('pageerror', e => errs2.push(e.message));
    await p3.goto('http://localhost:8765/index.html');
    await p3.setInputFiles('#file', { name: shared.name, mimeType: shared.type, buffer: Buffer.from(shared.text) });
    await p3.waitForSelector('#s-result.on');
    console.log(skin, 'shared', shared.name, shared.type, '-> loaded identical:', await p3.evaluate(o => JSON.stringify(S.rec) === o, await page.evaluate(() => JSON.stringify(S.rec))));
    await p3.close();
    await p2.waitForTimeout(450); await p2.tap('#btn-replay');
    const replayAt = async (label, shot) => {
      await p2.evaluate(l => { Replay.pause(); Replay.select(Replay.items.findIndex(it => it.label === l)); Replay.t = Replay.end(); Replay.render(); }, label);
      if (shot) await p2.screenshot({ path: `${out}${shot}.png` });
      console.log(skin, 'replay', label + ':', await p2.textContent('#rp-target'), '| pos', await p2.textContent('#rp-pos'),
        '| pad', await p2.evaluate(() => !!document.querySelector('#rp-kb .kb.pad')), '| blocked dots', await p2.evaluate(() => document.querySelectorAll('.dot.blocked').length));
    };
    await replayAt('Pass 2 · Word 2 of 3', skin === 'gboard' && 'replay-blocked');
    await replayAt('Pass 2 · Number 1 of 3', `${skin}-replay-pad`);
    console.log(skin, 'errors:', errs, errs2);
    await ctx.close();
  }
  // v1 recording still loads as a single pass
  const ctx = await browser.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage();
  const v1 = { v: 1, kb: 'ios', seed: 's', n: 1, trials: [{ word: 'people', vis: ['p', 'q', 'x'], ev: [[100, 50, 'p', 950, 130]], submit: 400 }] };
  await p.goto('http://localhost:8765/index.html');
  await p.setInputFiles('#file', { name: 'v1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(v1)) });
  await p.waitForSelector('#s-result.on');
  console.log('v1 load:', await p.evaluate(() => JSON.stringify({ v: S.rec.v, passes: S.rec.passes.length, grip: S.rec.passes[0].grip, cmp: !!document.querySelector('.cmp'), tiles: document.querySelectorAll('.tile').length })));
  await p.waitForTimeout(450); await p.tap('#btn-replay'); console.log('v1 replay:', await p.textContent('#rp-target'));
  // ?d=0: words only, no numbers intro
  await p.goto('http://localhost:8765/index.html?n=1&d=0&seed=test&kb=gboard'); await p.tap('#btn-start');
  await p.waitForSelector('#s-pass.on'); await p.waitForTimeout(450); await p.tap('#btn-pass');
  await p.waitForFunction(() => S.kb && S.kb.enabled); await p.evaluate(() => onPress({ k: 'enter', t: performance.now() }));
  await p.waitForSelector('#s-pass.on');
  console.log('d=0:', await p.evaluate(() => JSON.stringify({ title: $('#p-title').textContent, d: S.rec.d, introHidden: [...document.querySelectorAll('.num-only')].every(e => e.hidden) })));
  await browser.close();
})();
