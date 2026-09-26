const { chromium, devices } = require('playwright-core');
const zlib = require('zlib');
const b64u = buf => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const link = (obj, z = true) => z ? 'z' + b64u(zlib.deflateRawSync(Buffer.from(JSON.stringify(obj)))) : 'j' + b64u(Buffer.from(JSON.stringify(obj)));
const good = { v: 1, kb: 'ios', seed: 's', n: 1, trials: [{ word: 'people', vis: ['p'], ev: [[100, 50, 'p', 950, 130]], submit: 400 }] };
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  const run = async (name, url, fn) => {
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); await p.waitForTimeout(600);
    const r = await fn(p);
    console.log(name.padEnd(34), JSON.stringify(r), errs.length ? 'PAGE ERRORS: ' + errs : 'no page errors');
    await p.close();
  };
  const base = 'http://localhost:8765/index.html';
  const state = p => p.evaluate(() => ({ screen: document.querySelector('.screen.on').id, toast: document.querySelector('#toast').textContent, hash: location.hash.slice(0, 12) }));
  // 1. empty trials
  await run('1 empty trials link', base + '#r=' + link({ ...good, trials: [] }), state);
  await run('1 empty trials file', base, async p => { await p.setInputFiles('#file', { name: 'e.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...good, trials: [] })) }); await p.waitForTimeout(300); return state(p); });
  // 2. prototype keys
  await run('2 kb=constructor link + replay', base + '#r=' + link({ ...good, kb: 'constructor' }), async p => { await p.waitForTimeout(500); await p.tap('#btn-replay'); await p.waitForTimeout(300); return { ...(await state(p)), kb: await p.evaluate(() => Replay.kb.skin) }; });
  await run('2 ?kb=constructor start', base + '?kb=constructor&n=1', async p => { await p.tap('#btn-start'); await p.waitForSelector('#s-pass.on'); await p.waitForTimeout(450); await p.tap('#btn-pass'); await p.waitForTimeout(1000); return { ...(await state(p)), kb: await p.evaluate(() => S.kb && S.kb.skin), enabled: await p.evaluate(() => S.kb && S.kb.enabled) }; });
  await run('2 ?kb=__proto__ start', base + '?kb=__proto__&n=1', async p => { await p.tap('#btn-start'); await p.waitForSelector('#s-pass.on'); await p.waitForTimeout(450); await p.tap('#btn-pass'); await p.waitForTimeout(1000); return { kb: await p.evaluate(() => S.kb && S.kb.skin) }; });
  // 3. decompression bomb: ~60MB of zeros-ish JSON compressed
  const bomb = 'z' + b64u(zlib.deflateRawSync(Buffer.from('{"v":1,"trials":[],"x":"' + 'a'.repeat(60e6) + '"}'), { level: 9 }));
  console.log('bomb link length', bomb.length);
  await run('3 decompression bomb link', base + '#r=' + bomb, async p => { await p.waitForTimeout(1000); return state(p); });
  // 5. no DecompressionStream
  const p5 = await ctx.newPage(); await p5.addInitScript(() => { delete window.DecompressionStream; });
  await p5.goto(base + '#r=' + link(good)); await p5.waitForTimeout(600); console.log('5 no DecompressionStream'.padEnd(34), JSON.stringify(await state(p5))); await p5.close();
  await run('5 uncompressed j-link still works', base + '#r=' + link(good, false), state);
  // 4. skin switching destroys old keyboard
  await run('4 replay ios then gboard', base, async p => p.evaluate(async r => {
    const a = validate(r), g = validate({ ...r, kb: 'gboard' });
    showResult(a, false); Replay.open(a); Replay.pause(); const old = Replay.kb;
    showResult(g, false); Replay.open(g); Replay.pause();
    return { oldAttached: old.el.isConnected, kbs: document.querySelectorAll('#rp-kb .kb').length, skin: Replay.kb.skin };
  }, good));
  // 7. number trials (format v3): v2 without nums loads; junk seq/vis is cleaned; pad keyboards are cleaned up too
  const v2 = { v: 2, kb: 'samsung', seed: 's', n: 1, passes: [{ grip: 'comfortable', trials: good.trials }] };
  await run('7 v2 file (no numbers)', base + '#r=' + link(v2), p => p.evaluate(() => ({ v: S.rec.v, d: S.rec.d, nums: S.rec.passes[0].nums.length, numsHidden: $('#r-nums').hidden })));
  const v3 = { v: 3, kb: 'ios', seed: 's', n: 0, d: 1, passes: [{ grip: 'comfortable', trials: [], nums: [{ seq: '12a3<b>45', vis: ['1', 'x', 7, '99'], ev: [[100, 50, '1', 200, 300]], submit: 400 }] }] };
  await run('7 v3 numbers only, junk seq/vis', base + '#r=' + link(v3), p => p.evaluate(() => ({ seq: S.rec.passes[0].nums[0].seq, vis: S.rec.passes[0].nums[0].vis, rows: document.querySelectorAll('#r-nrows .row').length, wordRows: document.querySelectorAll('#r-rows .row').length })));
  await run('7 replay pads cleaned up on skin change', base, async p => p.evaluate(async r => {
    const a = validate(r), g = validate({ ...r, kb: 'gboard' });
    showResult(a, false); Replay.open(a); Replay.pause(); const old = Replay.pad;
    showResult(g, false); Replay.open(g); Replay.pause();
    return { oldAttached: old.el.isConnected, kbs: document.querySelectorAll('#rp-kb .kb').length, pad: Replay.cur === Replay.pad, target: $('#rp-target').textContent };
  }, v3));
  // 6. align correctness
  await run('6 align', base, p => p.evaluate(() => [align('people', 'peqple').dist, align('coming', 'comin').dist, align('abc', '').dist, align('', 'xy').dist, align('kitten', 'sitting').dist]));
  await b.close();
})();
