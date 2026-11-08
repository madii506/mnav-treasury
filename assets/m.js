// mNAV: every coin is a treasury company. Everything here is read live: Raydium (coins), Jupiter (prices, trades), Solana (wallets, profiles, the treasury ledger).
(() => {
  const $ = (s, e = document) => e.querySelector(s), $$ = (s, e = document) => [...e.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches, DPR = Math.min(2, devicePixelRatio || 1), JUP = 'https://lite-api.jup.ag', SOL = 'So11111111111111111111111111111111111111112';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const usd = (x, d) => x == null || !isFinite(x) ? '—' : '$' + (+x).toLocaleString('en-US', { minimumFractionDigits: d ?? (Math.abs(x) >= 1 ? 2 : 4), maximumFractionDigits: d ?? (Math.abs(x) >= 1 ? 2 : 6) });
  const big = x => x == null || !isFinite(x) ? '—' : x >= 1e9 ? '$' + (x / 1e9).toFixed(2) + 'B' : x >= 1e6 ? '$' + (x / 1e6).toFixed(2) + 'M' : x >= 1e3 ? '$' + (x / 1e3).toFixed(1) + 'K' : usd(x, x < 10 ? 2 : 0);
  const spct = x => x == null || !isFinite(x) ? '—' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2) + '%', cls = x => x == null ? '' : x < 0 ? 'dn' : 'up';
  const num = (x, d = 4) => x == null || !isFinite(x) ? '—' : (+x).toLocaleString('en-US', { maximumFractionDigits: x >= 1000 ? 2 : d });
  const amt = x => x == null || !isFinite(x) ? '—' : x === 0 ? '0' : x < .0001 ? x.toFixed(8) : x < 1 ? x.toFixed(6) : num(x, 4);
  const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '', clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ago = t => { const s = Date.now() / 1000 - t; return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + 'm ago' : s < 86400 ? Math.floor(s / 3600) + 'h ago' : Math.floor(s / 86400) + 'd ago'; };
  const setT = (sel, v, c) => { const el = $(sel); if (!el) return; el.textContent = v; if (c !== undefined) el.className = c; };
  const mx = v => v == null || !isFinite(v) ? '—' : v >= 1000 ? Math.round(v).toLocaleString('en-US') + 'x' : v >= 100 ? v.toFixed(0) + 'x' : v.toFixed(2) + 'x';
  function toast(m) { const t = $('#toast'); t.innerHTML = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 4200); }
  async function api(a, q = '') { const r = await fetch('/api/mnav?a=' + a + q); const j = await r.json().catch(() => ({ error: 'bad response' })); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j; }
  async function post(a, b) { const r = await fetch('/api/mnav?a=' + a, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); const j = await r.json().catch(() => ({ error: 'bad response' })); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j; }
  const b64 = u => { let s = ''; u.forEach(c => s += String.fromCharCode(c)); return btoa(s); }, unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  let w3 = null; const web3 = () => w3 || (w3 = new Promise((ok, no) => { if (window.solanaWeb3) return ok(window.solanaWeb3); const s = document.createElement('script'); s.src = '/assets/web3.min.js'; s.onload = () => ok(window.solanaWeb3); s.onerror = () => no(new Error('could not load the signer')); document.head.append(s); }));
  const S = { m: null, coins: null, ledger: null, res: null, profiles: null, me: null };
  const avatarHtml = (p, w) => p && p.avatar ? `<img src="${esc(p.avatar)}" alt="" onerror="this.remove()">` : esc(((p && p.name) || w || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 1).toUpperCase() || '?');
  const tsx = sig => `<a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">${short(sig)} ↗</a>`;
  const asset = code => ((S.m && S.m.assets) || []).find(a => a.code === code) || null;

  // ---------------------------------------------------------------- the mark: m (the market) over the treasury coin
  const ticks = (cx, cy, r, n) => { let d = ''; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; d += `M${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}L${(cx + Math.cos(a) * (r - 2.2)).toFixed(2)} ${(cy + Math.sin(a) * (r - 2.2)).toFixed(2)}`; } return d; };
  const mark = (id, glow = 1.4) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs>
    <radialGradient id="${id}o" gradientUnits="userSpaceOnUse" cx="45" cy="70" r="22"><stop offset="0" stop-color="#ffc56b"/><stop offset=".55" stop-color="#f7931a"/><stop offset="1" stop-color="#b85d00"/></radialGradient>
    <radialGradient id="${id}c" gradientUnits="userSpaceOnUse" cx="44" cy="22" r="22"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#f4efe6"/><stop offset="1" stop-color="#b9b0a2"/></radialGradient>
    <linearGradient id="${id}b" gradientUnits="userSpaceOnUse" x1="14" y1="0" x2="86" y2="0"><stop offset="0" stop-color="#f4efe6"/><stop offset=".5" stop-color="#ffd9a0"/><stop offset="1" stop-color="#f7931a"/></linearGradient>
    <filter id="${id}l" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${glow}" result="b"/><feColorMatrix in="b" type="matrix" values="1 0 0 0 0 0 .75 0 0 0 0 0 .4 0 0 0 0 0 .55 0" result="bb"/><feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <g filter="url(#${id}l)"><text class="m-top" x="49" y="43.5" text-anchor="middle" font-family="IS, serif" font-style="italic" font-size="60" fill="url(#${id}c)">m</text>
    <rect class="m-bar" x="15" y="50.5" width="70" height="5.6" rx="2.8" fill="url(#${id}b)"/>
    <g class="m-coin"><circle cx="50" cy="77" r="13.5" fill="url(#${id}o)"/><circle cx="50" cy="77" r="9" fill="none" stroke="#8a4500" stroke-opacity=".45" stroke-width="1.1"/><path d="${ticks(50, 77, 12.9, 40)}" stroke="#8a4500" stroke-opacity=".32" stroke-width=".7"/></g></g></svg>`;

  // ---------------------------------------------------------------- the field: the market above the line, the treasury below; trades cross it as 1% sparks
  function field() { const c = $('#cv'), g = c.getContext('2d'); let W, H, sy = 0; const LO = innerWidth < 700;
    const size = () => { W = innerWidth; H = innerHeight; c.width = W * DPR; c.height = H * DPR; g.setTransform(DPR, 0, 0, DPR, 0, 0); }; size(); addEventListener('resize', size);
    addEventListener('scroll', () => sy = scrollY, { passive: true });
    const up = Array.from({ length: LO ? 140 : 300 }, () => ({ x: Math.random(), t: Math.random(), r: .4 + Math.random() * 1.3, v: .0004 + Math.random() * .0012, a: .1 + Math.random() * .45 }));
    const dn = Array.from({ length: LO ? 150 : 320 }, () => ({ x: Math.random(), t: Math.pow(Math.random(), 1.8), r: .6 + Math.random() * 2, a: .12 + Math.random() * .5, ph: Math.random() * 6.3 }));
    const sp = []; let skip = false;
    function frame(now) { requestAnimationFrame(frame); if (document.hidden || (skip = !skip)) return; const t = now / 1000, ly = H * (.62 - clamp(sy / (H * 3), 0, .25));
      const bg = g.createRadialGradient(W / 2, ly, 10, W / 2, ly, Math.max(W, H) * .8); bg.addColorStop(0, '#1d1106'); bg.addColorStop(.4, '#0c0805'); bg.addColorStop(1, '#050404'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      for (const p of up) { if (!RM) p.t += p.v; if (p.t > 1) { p.t = 0; p.x = Math.random(); if (sp.length < 40 && Math.random() < .35) sp.push({ x: p.x * W, y: ly, vy: .4 + Math.random() * .6, life: 1 }); }
        const y = ly - 8 - (1 - p.t) * (ly - 8); g.beginPath(); g.arc(p.x * W, y, p.r, 0, 6.3); g.fillStyle = `rgba(244,239,230,${p.a * (.25 + .75 * p.t)})`; g.fill(); }
      for (const p of dn) { const y = ly + 8 + p.t * (H - ly), tw = .7 + .3 * Math.sin(t * 1.3 + p.ph); g.beginPath(); g.arc(p.x * W, y, p.r, 0, 6.3); g.fillStyle = `rgba(247,${130 + (p.ph * 8 | 0)},40,${p.a * (1 - p.t * .85) * tw})`; g.fill(); }
      g.globalCompositeOperation = 'lighter';
      for (let i = sp.length - 1; i >= 0; i--) { const s = sp[i]; if (!RM) { s.y += s.vy; s.vy += .02; s.life -= .012; } if (s.life <= 0) { sp.splice(i, 1); continue; } g.beginPath(); g.arc(s.x, s.y, 2.2, 0, 6.3); g.fillStyle = `rgba(255,180,77,${s.life})`; g.fill(); }
      const ln = g.createLinearGradient(0, 0, W, 0); ln.addColorStop(0, 'rgba(244,239,230,0)'); ln.addColorStop(.3, 'rgba(244,239,230,.25)'); ln.addColorStop(.5, 'rgba(255,214,150,.5)'); ln.addColorStop(.7, 'rgba(247,147,26,.35)'); ln.addColorStop(1, 'rgba(247,147,26,0)'); g.fillStyle = ln; g.fillRect(0, ly - .6, W, 1.2);
      g.globalCompositeOperation = 'source-over'; }
    requestAnimationFrame(frame);
    if (!matchMedia('(pointer: coarse)').matches) addEventListener('pointermove', e => { const gl = $('#glow'); gl.style.setProperty('--gx', e.clientX + 'px'); gl.style.setProperty('--gy', e.clientY + 'px'); }, { passive: true }); }

  // ---------------------------------------------------------------- wallet: connect, live balance, profile
  const WL = { pk: null, p: null, name: '', view: null };
  const providers = () => [['Phantom', window.phantom && window.phantom.solana], ['Solflare', window.solflare && window.solflare.isSolflare && window.solflare], ['Backpack', window.backpack]].filter(([, p]) => p);
  async function connect() { if (WL.pk) return WL.pk; const ps = providers(); if (!ps.length) { toast('No Solana wallet found. Open this page in Phantom, Solflare or Backpack.'); throw new Error('no wallet'); }
    const [name, p] = ps[0]; const r = await p.connect(); onConnect(((r && r.publicKey) || p.publicKey).toString(), p, name); return WL.pk; }
  function onConnect(pk, p, name) { WL.pk = pk; WL.p = p; WL.name = name; $('#connect').hidden = true; $('#wbtn').hidden = false; $('#dAddr').textContent = short(pk); $('#dProfile').href = '#/u/' + pk;
    if (p.on && !p._mnav) { p._mnav = 1; p.on('accountChanged', k => { if (k) { onConnect(k.toString(), p, name); toast('Switched to ' + short(k.toString())); } else disconnect(); }); }
    refreshWallet(); loadMe(); render(); }
  async function disconnect() { try { await WL.p.disconnect(); } catch (e) { } WL.pk = null; WL.view = null; S.me = null; $('#connect').hidden = false; $('#wbtn').hidden = true; $('#drop').classList.remove('on'); render(); }
  function countTo(el, v, fmt) { if (!el || v == null) return; const from = el._v ?? (el.dataset.from != null ? +el.dataset.from : v); el._v = v; if (RM || from === v) { el.textContent = fmt(v); return; } const t0 = performance.now(); cancelAnimationFrame(el._r); const st = n => { const k = clamp((n - t0) / 900); el.textContent = fmt(from + (v - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) el._r = requestAnimationFrame(st); }; el._r = requestAnimationFrame(st); }
  const tokRow = t => `<div class="tok">${t.icon ? `<img src="${esc(t.icon)}" alt="" onerror="this.outerHTML='<span class=ph></span>'">` : '<span class="ph"></span>'}<span><b>${esc(t.symbol)}${t.treasury ? '<span class="tag">treasury</span>' : ''}</b><small>${esc(t.name)}</small></span><span class="v">${num(t.amount)}<small>${usd(t.usd, 2)}</small></span></div>`;
  async function refreshWallet() { if (!WL.pk) return; try { const v = await api('wallet', '&addr=' + WL.pk); if (v.wallet !== WL.pk) return; const prev = WL.view; WL.view = v;
      countTo($('#wSol'), v.sol, x => x.toFixed(3) + ' SOL'); countTo($('#dTot'), v.totalUsd, x => usd(x, 2));
      $('#dToks').innerHTML = `<div class="tok"><span class="ph"></span><span><b>SOL</b><small>Solana</small></span><span class="v">${num(v.sol)}<small>${usd(v.solValue, 2)}</small></span></div>` + v.tokens.slice(0, 30).map(tokRow).join('');
      if (prev && Math.abs(prev.sol - v.sol) > 1e-9) toast(`Balance updated: ${v.sol >= prev.sol ? '+' : '−'}${Math.abs(v.sol - prev.sol).toFixed(4)} SOL`);
      $$('[data-live="bal"]').forEach(el => el.dispatchEvent(new Event('bal'))); } catch (e) { } }
  async function loadMe() { if (!WL.pk) return; try { const r = await api('profile', '&wallet=' + WL.pk); S.me = r.profile; } catch (e) { S.me = null; } $('#wAv').innerHTML = avatarHtml(S.me, WL.pk); }
  function walletInit() { $('#connect').onclick = () => connect().catch(() => { }); $('#wbtn').onclick = e => { e.stopPropagation(); $('#drop').classList.toggle('on'); }; $('#dOut').onclick = disconnect;
    document.addEventListener('click', e => { if (!e.target.closest('#acct')) $('#drop').classList.remove('on'); }); $$('#drop a').forEach(a => a.addEventListener('click', () => $('#drop').classList.remove('on')));
    const ps = providers(); if (ps.length && ps[0][1].connect) ps[0][1].connect({ onlyIfTrusted: true }).then(r => { if (r && r.publicKey) onConnect(r.publicKey.toString(), ps[0][1], ps[0][0]); }).catch(() => { });
    setInterval(refreshWallet, 10000); }
  async function signSend(list, st, versioned) { const W = await web3(); const txs = list.map(t => versioned ? W.VersionedTransaction.deserialize(unb64(t)) : W.Transaction.from(unb64(t)));
    st('check your wallet…'); const signed = WL.p.signAllTransactions && txs.length > 1 ? await WL.p.signAllTransactions(txs) : [await WL.p.signTransaction(txs[0])];
    st('sending…'); const r = await post('send', { txs: signed.map(t => b64(t.serialize())) }); setTimeout(refreshWallet, 1500); setTimeout(refreshWallet, 6000); return r; }
  const stat = sel => (m, c = '') => { const el = $(sel); if (!el) return; el.className = 'stat2 ' + c; el.innerHTML = m; };

  // ---------------------------------------------------------------- data
  async function loadMarket() { try { S.m = await api('market'); } catch (e) { } }
  async function loadCoins() { try { S.coins = await api('coins'); } catch (e) { S.coins = S.coins || { open: false, coins: [], error: true }; } }
  async function loadLedger() { try { S.ledger = await api('ledger'); } catch (e) { S.ledger = S.ledger || { entries: [] }; } try { S.res = await api('reserves'); } catch (e) { } }
  async function loadSocial() { try { S.profiles = (await api('profiles')).profiles; } catch (e) { S.profiles = S.profiles || []; } }
  const coinBy = m => ((S.coins && S.coins.coins) || []).find(c => c.mint === m) || null;

  // ---------------------------------------------------------------- the home page
  const app = () => $('#app');
  const words = s => s.split(' ').map((w, i) => `<span class="w" style="animation-delay:${(.15 + i * .07).toFixed(2)}s">${w}</span>`).join(' ');
  function home() { return `
  <section class="hero"><div class="wrap">
    <div class="mk" id="heroMark">${mark('hm', 1.6)}</div>
    <span class="eye"><span class="pulse"></span>live on Raydium LaunchLab</span>
    <h1>${words('Every coin is a')}<br><span class="it">${words('treasury company.')}</span></h1>
    <p class="lede rv">Launch a coin and <b>1% of every trade buys Bitcoin, Ether or staked SOL</b> for its own treasury. When the coin trades for less than its treasury, under <b>1x mNAV</b>, the treasury buys it back and burns it.</p>
    <div class="cta rv d1"><a class="btn go" href="#/launch">Launch a treasury company</a><a class="btn" href="#/league">See the league</a></div>
    <div class="kpis rv d2"><div><small>Bitcoin</small><b id="kBtc">—</b><em id="kBtcC"></em></div><div><small>Ether</small><b id="kEth">—</b><em id="kEthC"></em></div><div><small>SOL</small><b id="kSol">—</b><em id="kSolC"></em></div><div><small>treasury companies</small><b id="kCoins">—</b><em class="dim" id="kPad">launchpad</em></div><div><small>held in treasuries</small><b id="kTre">—</b><em class="dim" id="kTreN">ledger</em></div></div>
  </div><span class="scrollcue" aria-hidden="true"></span></section>
  <div class="tape" id="tape"><div class="in2" id="tapeIn"></div></div>

  <section class="sec" id="ratio"><div class="wrap">
    <div class="head rv"><span class="kick">the ratio</span><h2>One number.<br><span class="it">Is the coin worth its treasury?</span></h2><p>mNAV is the market cap divided by the value of the treasury. Above 1x, the market pays a premium for the coin. Under 1x, the coin trades for less than what it owns, and that's when the treasury buys it back.</p></div>
    <div class="ratio">
      <div class="card frac rv"><div class="lbl"><span>market cap</span><span>drag</span></div><div class="val" id="rM">$250K</div><input class="rng" id="rMr" type="range" min="0" max="1000" value="560" aria-label="market cap">
        <div class="bar"></div><div class="lbl"><span>treasury value</span><span>drag</span></div><div class="val t" id="rT">$50K</div><input class="rng" id="rTr" type="range" min="0" max="1000" value="470" aria-label="treasury value"></div>
      <div class="card gauge rv d1"><svg viewBox="0 0 400 230" id="gSvg"></svg><div class="big" id="gBig">5.00<small>x</small></div><span class="state prem" id="gState">premium</span><p id="gTxt"></p><div class="note">calculator · try your own numbers</div></div>
    </div></div></section>

  <section class="sec" id="how"><div class="wrap">
    <div class="head rv"><span class="kick">how it works</span><h2>Fees in.<br><span class="it">Treasury up.</span> Discount out.</h2><p>Every coin on mNAV runs the same three-step playbook as the companies that buy Bitcoin with their cash, except the cash is its own trading fees.</p></div>
    <div class="steps">
      <div class="card step3 rv"><canvas id="h1"></canvas><span class="n">01</span><h3>Every trade pays 1%</h3><p>Every buy and sell on the curve pays the 1% mNAV launchpad fee, set in Raydium LaunchLab's program. 0% to the creator, 0% to mNAV.</p></div>
      <div class="card step3 rv d1"><canvas id="h2"></canvas><span class="n">02</span><h3>The fee buys the treasury</h3><p>The treasury wallet spends each coin's fees on its treasury asset through Jupiter. Every buy is one transaction with a memo naming the coin: <code>mnav:buy:&lt;coin&gt;:&lt;lamports&gt;</code></p></div>
      <div class="card step3 rv d2"><canvas id="h3"></canvas><span class="n">03</span><h3>Under 1x, it buys back</h3><p>When a coin's market cap falls below its treasury, the treasury sells some of its asset, buys the coin and burns it in the same transaction. Fewer coins, same treasury per coin or more.</p></div>
    </div>
    <div class="defs">
      <div class="card rv"><b><span class="it">mNAV</span></b><p>market cap ÷ treasury value. Under 1x means the coin trades below what it owns.</p></div>
      <div class="card rv d1"><b>per <span class="it">1M</span> tokens</b><p>treasury held for every million tokens in supply. Buybacks burn supply, so it goes up.</p></div>
      <div class="card rv d2"><b>7d <span class="it">yield</span></b><p>how much the treasury per token grew in seven days, from the ledger.</p></div>
      <div class="card rv d3"><b><span class="it">unfunded</span> fees</b><p>1% of the coin's curve volume, minus what the treasury has already bought for it.</p></div>
    </div></div></section>

  <section class="sec" id="league"><div class="wrap">
    <div class="head rv"><span class="kick">the league</span><h2>Memecoin<br><span class="it">treasury companies.</span></h2><p>Every coin on the mNAV launchpad, ranked by what it holds. Treasuries come from the on-chain ledger, market caps from Raydium.</p></div>
    <div class="ltool rv"><button class="chip on" data-s="tre">biggest treasury</button><button class="chip" data-s="mnav">lowest mNAV</button><button class="chip" data-s="mcap">market cap</button><button class="chip" data-s="new">newest</button><span class="sp"></span><span class="mono dim" id="lCount"></span></div>
    <div class="card league rv" id="lList"><div class="empty">reading the launchpad…</div></div></div></section>

  <section class="sec" id="launch"><div class="wrap">
    <div class="head rv"><span class="kick">launch</span><h2>Start a<br><span class="it">treasury company.</span></h2><p>Pick what your coin's treasury holds, name it, sign once. It launches on Raydium LaunchLab with the treasury asset written into its on-chain metadata.</p></div>
    <div class="launch">
      <div class="card lform rv"><h3>01 · the treasury holds</h3><div class="assets" id="assets"></div>
        <h3>02 · the coin</h3><div><div class="frow"><label class="fld"><span>Name</span><input id="cName" maxlength="32" placeholder="MicroCoin"></label><label class="fld"><span>Ticker</span><input id="cSym" maxlength="10" placeholder="MCOIN"></label></div>
          <span class="fld"><span>Image</span></span><div class="imgs" id="imgs"></div><label class="fld"><input id="cImg" placeholder="or paste an https image link"></label>
          <label class="fld"><span>First buy (SOL, optional)</span><input id="cBuy" type="number" min="0" max="20" step="0.1" placeholder="0"></label></div></div>
      <div class="card prevw rv d1"><div class="pcard" id="prev"></div><div class="padst" id="padSt"><i></i>reading the launchpad…</div><button class="btn go wide" id="launchBtn">Connect wallet</button><div class="stat2" id="lStat"></div>
        <div class="cost">Supply 1,000,000,000 · 793.1M sold on the curve · graduates to a Raydium pool at 85 SOL · no mint or freeze authority · costs about 0.03 SOL plus your first buy.</div></div>
    </div></div></section>

  <section class="sec" id="trade"><div class="wrap">
    <div class="head rv"><span class="kick">trade</span><h2>Buy the coin,<br><span class="it">or the treasury.</span></h2><p>Any mNAV coin, Bitcoin, Ether or staked SOL, with SOL. Routed by Jupiter and signed in your wallet.</p></div>
    ${tradeHtml('home', '')}</div></section>

  <section class="sec" id="ledger"><div class="wrap">
    <div class="head rv"><span class="kick">the ledger</span><h2>Every buy.<br><span class="it">Every burn.</span></h2><p>Each line is a Solana transaction signed by the treasury wallet. The site rebuilds every coin's treasury from these and nothing else.</p></div>
    <div class="lgrid"><div class="card entries rv" id="eList"><div class="empty">reading the ledger…</div></div>
      <div class="card por rv d1"><h3>Proof of reserves</h3><p>The treasury wallet's real balances against the sum of every coin's ledger.</p><div id="porRows"><div class="empty">reading…</div></div><div class="note" id="porW"></div></div></div></div></section>

  <section class="sec" id="people"><div class="wrap">
    <div class="head rv"><span class="kick">people</span><h2>The <span class="it">shareholders.</span></h2><p>Profiles live on Solana as a memo signed by your wallet. Only you can change yours. About 0.000005 SOL.</p></div>
    <div class="pbar rv"><span class="mono dim" id="pCount"></span><button class="btn sm go" id="mkProfile">Make my profile</button></div><div class="people" id="peopleList"><div class="card empty">reading…</div></div></div></section>

  <section class="sec" id="faq"><div class="wrap"><div class="head c rv"><span class="kick">faq</span><h2>Questions.</h2></div><div class="faq rv">
    <details><summary>What is mNAV?</summary><p>Market cap divided by net asset value: what the market pays for a coin, over what the coin's treasury holds. Treasury companies are judged on it. On mNAV, every coin gets the number, live.</p></details>
    <details><summary>Where does the treasury come from?</summary><p>Every trade on a coin's curve pays a 1% launchpad fee. The treasury wallet claims those fees from Raydium LaunchLab and spends them on the coin's treasury asset. The site shows, per coin, what its fees have earned and what has already been bought.</p></details>
    <details><summary>Who holds the treasury?</summary><p>The treasury wallet, the one that created the mNAV launchpad. Every coin's share is a public ledger of memo transactions, and the proof of reserves shows whether the wallet's real balances cover every ledger.</p></details>
    <details><summary>When does a coin buy itself back?</summary><p>Only when it trades under 1x mNAV, meaning its market cap is below its treasury value. The buyback sells part of the treasury, buys the coin through Jupiter and burns it in the same transaction. The site refuses to build a buyback above 1x.</p></details>
    <details><summary>Are buybacks automatic?</summary><p>Treasury buys and buybacks are run from the console by the treasury wallet, and every one is a public transaction on the ledger above.</p></details>
    <details><summary>What does launching cost?</summary><p>Solana network fees and rent, about 0.03 SOL, plus any first buy. There's no launch fee and no creator fee.</p></details>
    <details><summary>Which treasury should I pick?</summary><p>Bitcoin (cbBTC) for the classic treasury company, Ether (Portal ETH) for the ether-treasury play, or staked SOL (JitoSOL), which keeps earning staking rewards while it sits. The choice is written into the coin's metadata and can't change.</p></details>
  </div></div></section>
  <section class="closer"><div class="wrap rv"><h2>Every coin is a<br><span class="it">treasury company.</span></h2><p>Pick a treasury. Name a coin. Sign once.</p><a class="btn go" href="#/launch">Launch on mNAV</a></div></section>`; }

  // ---------------------------------------------------------------- the ratio calculator (log scale)
  const lg = (v, lo, hi) => lo * Math.pow(hi / lo, v / 1000);
  function gaugeSvg(v) { const cx = 200, cy = 200, R = 160, a = x => Math.PI * (1 - clamp(x / 3)), pt = (x, r) => [cx + Math.cos(a(x)) * r, cy - Math.sin(a(x)) * r];
    const arc = (x0, x1, col, w) => { const [sx, sy] = pt(x0, R), [ex, ey] = pt(x1, R); return `<path d="M${sx} ${sy} A${R} ${R} 0 0 1 ${ex} ${ey}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`; };
    let tk = ''; for (let i = 0; i <= 30; i++) { const [x1, y1] = pt(i / 10, R + 14), [x2, y2] = pt(i / 10, R + (i % 5 ? 20 : 26)); tk += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(244,239,230,${i % 5 ? .15 : .4})"/>`; }
    const lb = [0, 1, 2, 3].map(x => { const [lx, ly] = pt(x, R + 42); return `<text x="${lx}" y="${ly + 4}" text-anchor="middle" font-family="GM, monospace" font-size="12" fill="${x === 1 ? '#ffb44d' : 'rgba(244,239,230,.4)'}">${x}x${x === 3 ? '+' : ''}</text>`; }).join('');
    const [nx, ny] = pt(Math.min(v, 3.05), R - 26);
    return `${arc(0, 3, 'rgba(244,239,230,.07)', 14)}${arc(0, 1, 'rgba(127,224,166,.55)', 14)}${arc(1, 3, 'url(#gg)', 14)}<defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="#ffd59a"/><stop offset="1" stop-color="#f7931a"/></linearGradient></defs>${tk}${lb}
      <line id="gNeedle" x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#fff3e2" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="8" fill="#f7931a"/>`; }
  function ratioInit() { const m = $('#rMr'), t = $('#rTr'); if (!m) return; let shown = null;
    const upd = () => { const M = lg(+m.value, 1e3, 1e8), T = lg(+t.value, 1e2, 1e7), v = M / T; m.style.setProperty('--p', m.value / 10 + '%'); t.style.setProperty('--p', t.value / 10 + '%');
      setT('#rM', big(M)); setT('#rT', big(T)); const tgt = v; const from = shown ?? tgt; shown = tgt; const t0 = performance.now();
      const step = n => { const k = RM ? 1 : clamp((n - t0) / 450), x = from + (tgt - from) * (1 - Math.pow(1 - k, 3)); $('#gSvg').innerHTML = gaugeSvg(x); $('#gBig').innerHTML = (x >= 100 ? x.toFixed(0) : x.toFixed(2)) + '<small>x</small>'; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
      const disc = v < 1, st = $('#gState'); st.className = 'state ' + (disc ? 'disc' : 'prem'); st.innerHTML = disc ? '<span class="pulse" style="background:var(--up)"></span>discount · the treasury buys back' : 'premium · the treasury keeps buying';
      setT('#gTxt', disc ? `The coin trades at ${Math.round((1 - v) * 100)}% below what it owns. The treasury sells part of its asset, buys the coin and burns it, so every coin left owns more.` : `The market pays ${v.toFixed(2)}x what the treasury holds. Fees keep buying the treasury asset, and the number falls as the treasury grows.`); };
    m.oninput = t.oninput = upd; upd(); }

  // ---------------------------------------------------------------- the "how" canvases
  function howInit() { const mk = (id, draw) => { const c = $('#' + id); if (!c) return; const g = c.getContext('2d'); let vis = false; new IntersectionObserver(e => vis = e[0].isIntersecting).observe(c); const D = Array.from({ length: 30 }, () => ({ t: Math.random(), v: .004 + Math.random() * .006, k: Math.random() }));
      const fr = now => { if (!c.isConnected) return; requestAnimationFrame(fr); if (!vis || document.hidden) return; const w = c.clientWidth, h = c.clientHeight; if (c.width !== w * DPR) { c.width = w * DPR; c.height = h * DPR; } g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, w, h); draw(g, w, h, D, now / 1000); }; requestAnimationFrame(fr); };
    const coin = (g, x, y, r, a = 1) => { const gr = g.createRadialGradient(x - r * .3, y - r * .3, 1, x, y, r); gr.addColorStop(0, `rgba(255,197,107,${a})`); gr.addColorStop(.6, `rgba(247,147,26,${a})`); gr.addColorStop(1, `rgba(184,93,0,${a})`); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); };
    mk('h1', (g, w, h, D) => { const vx = w * .78, vy = h / 2; D.forEach(d => { if (!RM) d.t += d.v; if (d.t > 1) { d.t = 0; d.k = Math.random(); } const x = 20 + (w - 40) * d.t, y = 30 + d.k * (h - 60); g.beginPath(); g.arc(x, y, 2.4, 0, 6.3); g.fillStyle = `rgba(244,239,230,${.15 + .5 * Math.sin(Math.PI * d.t)})`; g.fill();
        if (Math.abs(d.t - .5) < .004) d.f = 1; if (d.f) { d.f -= .02; g.beginPath(); g.arc(vx + (x - vx) * d.f, vy + (y - vy) * d.f, 2, 0, 6.3); g.fillStyle = `rgba(255,180,77,${d.f + .2})`; g.fill(); } });
      g.strokeStyle = 'rgba(247,147,26,.5)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(vx - 34, vy - 26, 68, 52, 12); g.stroke(); g.fillStyle = '#ffb44d'; g.font = '500 12px GM, monospace'; g.textAlign = 'center'; g.fillText('1%', vx, vy + 4); g.fillStyle = 'rgba(244,239,230,.4)'; g.fillText('trades', w * .22, h - 14); g.fillText('vault', vx, vy + 44); });
    mk('h2', (g, w, h, D, t) => { const cx = w * .72, base = h - 34, n = 6 + Math.floor((t * .6) % 6); for (let i = 0; i < n; i++) { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, base - i * 9 + 4, 34, 9, 0, 0, 6.3); g.fill(); const gr = g.createLinearGradient(cx - 34, 0, cx + 34, 0); gr.addColorStop(0, '#b85d00'); gr.addColorStop(.5, '#ffb44d'); gr.addColorStop(1, '#b85d00'); g.fillStyle = gr; g.beginPath(); g.ellipse(cx, base - i * 9, 34, 9, 0, 0, 6.3); g.fill(); }
      const k = ((t * .6) % 1), sx = w * .2, sy = h * .32; g.fillStyle = 'rgba(244,239,230,.4)'; g.font = '500 12px GM, monospace'; g.textAlign = 'center'; g.fillText('SOL', sx, sy + 28); coin(g, sx, sy, 12, 1); g.beginPath(); g.arc(sx, sy, 12, 0, 6.3); g.fillStyle = 'rgba(244,239,230,.85)'; g.fill();
      const x = sx + (cx - sx) * k, y = sy + (base - n * 9 - 10 - sy) * k * k; coin(g, x, y, 10, 1 - Math.max(0, k - .9) * 10); g.fillStyle = 'rgba(244,239,230,.4)'; g.fillText('treasury', cx, h - 8); });
    mk('h3', (g, w, h, D, t) => { const cx = w / 2, y = h * .44, ph = (t * .35) % 1, burn = ph > .55; g.fillStyle = 'rgba(244,239,230,.4)'; g.font = '500 12px GM, monospace'; g.textAlign = 'center';
      const v = burn ? .78 + (ph - .55) * .5 : 1.4 - ph * 1.1; g.fillText('mNAV', cx, 34); g.font = '400 44px IS, serif'; g.fillStyle = v < 1 ? '#7fe0a6' : '#ffe2b8'; g.fillText(v.toFixed(2) + 'x', cx, 82);
      for (let i = 0; i < 18; i++) { const x = 30 + i * (w - 60) / 17, gone = burn && i < (ph - .55) / .45 * 8; g.globalAlpha = gone ? .08 : .9; g.beginPath(); g.arc(x, h * .72, 6, 0, 6.3); g.fillStyle = '#f4efe6'; g.fill(); if (gone) { g.globalAlpha = .5 * (1 - (ph - .55) / .45); g.beginPath(); g.arc(x, h * .72 - 14, 3, 0, 6.3); g.fillStyle = '#ff7a63'; g.fill(); } } g.globalAlpha = 1;
      g.font = '500 12px GM, monospace'; g.fillStyle = 'rgba(244,239,230,.4)'; g.fillText(burn ? 'bought back · burned' : 'supply', cx, h - 14); }); }

  // ---------------------------------------------------------------- the trade widget (Jupiter)
  function tradeHtml(id, mint) { return `<div class="card trade rv" data-trade="${id}" data-mint="${esc(mint || '')}" data-live="bal">
    <div class="tr-l"><div class="picker"><input class="tq" placeholder="paste a token address, or pick one" autocomplete="off" value="${esc(mint || '')}"></div><div class="picks"></div><div class="tinfo"></div><div class="tstat"></div></div>
    <div class="tr-r"><div class="side"><button class="buy on" data-side="buy">Buy</button><button class="sell" data-side="sell">Sell</button></div>
      <div class="box"><small><span>You pay</span><a class="max">balance —</a></small><div class="r"><input class="amt" inputmode="decimal" placeholder="0.0"><span class="tsel tin">SOL</span></div><div class="pct"><button data-p=".25">25%</button><button data-p=".5">50%</button><button data-p="1">MAX</button></div></div>
      <div class="box"><small><span>You get</span><span class="outusd"></span></small><div class="r"><input class="out" readonly placeholder="0.0"><span class="tsel tout">—</span></div></div>
      <div class="qinfo"><div>price impact<b class="qi">—</b></div><div>route<b class="qr">—</b></div><div>slippage<b>1%</b></div></div>
      <button class="btn go wide tgo">Connect wallet</button><div class="stat2 tst"></div></div></div>`; }
  const TI = {}; async function tokInfo(m) { if (TI[m]) return TI[m]; if (m === SOL) return TI[m] = { id: SOL, symbol: 'SOL', name: 'Solana', decimals: 9, icon: '' };
    const j = await fetch(`${JUP}/tokens/v2/search?query=${m}`).then(r => r.json()).catch(() => []); const t = (j || []).find(x => x.id === m); if (!t) throw new Error('Jupiter does not know this token'); return TI[m] = t; }
  function tradeInit(el) { if (!el || el._on) return; el._on = 1; const T = { side: 'buy', mint: el.dataset.mint || '', q: null, t: null, seq: 0 };
    const picks = $('.picks', el), q = $('.tq', el), amtEl = $('.amt', el), st = (m, c = '') => { const s = $('.tst', el); s.className = 'stat2 tst ' + c; s.innerHTML = m; };
    const list = () => [...((S.coins && S.coins.coins) || []).slice(0, 6).map(c => ({ mint: c.mint, sym: c.symbol, img: c.image })), ...((S.m && S.m.assets) || []).map(a => ({ mint: a.mint, sym: a.symbol, img: '' }))];
    const drawPicks = () => { picks.innerHTML = list().map(p => `<button data-m="${p.mint}">${p.img ? `<img src="${esc(p.img)}" alt="">` : '<img alt="" src="/favicon.png">'}${esc(p.sym)}</button>`).join(''); labels(); }; el._picks = drawPicks; drawPicks();
    picks.onclick = e => { const b = e.target.closest('button'); if (!b) return; q.value = b.dataset.m; pick(b.dataset.m); };
    q.addEventListener('input', () => { const v = q.value.trim(); if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) pick(v); });
    $('.side', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; T.side = b.dataset.side; $$('.side button', el).forEach(x => x.classList.toggle('on', x === b)); labels(); amtEl.value = ''; quote(); };
    $('.pct', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; const bal = balOf(); if (bal == null) return; const f = +b.dataset.p; amtEl.value = String(+(T.side === 'buy' ? Math.max(0, bal * f - (f === 1 ? .01 : 0)) : bal * f).toFixed(T.side === 'buy' ? 4 : 6)); quote(); };
    $('.max', el).onclick = () => $('.pct button[data-p="1"]', el).click();
    let deb; amtEl.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(quote, 350); }); el.addEventListener('bal', labels); $('.tgo', el).onclick = go;
    function balOf() { if (!WL.view) return null; if (T.side === 'buy') return WL.view.sol; const t = WL.view.tokens.find(x => x.mint === T.mint); return t ? t.amount : 0; }
    function labels() { const bal = balOf(); $('.max', el).textContent = 'balance ' + (bal == null ? '—' : num(bal)); const sym = T.t ? T.t.symbol : '—', ic = T.t && T.t.icon ? `<img src="${esc(T.t.icon)}" alt="">` : '';
      $('.tin', el).innerHTML = T.side === 'buy' ? 'SOL' : ic + esc(sym); $('.tout', el).innerHTML = T.side === 'buy' ? ic + esc(sym) : 'SOL';
      $('.tgo', el).textContent = !WL.pk ? 'Connect wallet' : !T.t ? 'Pick a token' : (T.side === 'buy' ? 'Buy ' : 'Sell ') + sym; $$('.picks button', el).forEach(b => b.classList.toggle('on', b.dataset.m === T.mint)); }
    async function pick(m) { T.mint = m; T.t = null; labels(); $('.tinfo', el).innerHTML = '<small>reading the token…</small>'; try { const t = await tokInfo(m); if (T.mint !== m) return; T.t = t;
        const mc = t.mcap ?? t.fdv, ch = t.stats24h && t.stats24h.priceChange; $('.tinfo', el).innerHTML = `${t.icon ? `<img src="${esc(t.icon)}" alt="">` : '<img alt="" src="/favicon.png">'}<b>${esc(t.name || t.symbol)} <span class="o">$${esc(t.symbol)}</span></b><small>${esc(m)}</small>`;
        $('.tstat', el).innerHTML = `<div><small>price</small><b>${usd(t.usdPrice)}</b></div><div><small>24h</small><b class="${cls(ch)}">${spct(ch)}</b></div><div><small>market cap</small><b>${big(mc)}</b></div>`; labels(); quote(); }
      catch (e) { $('.tinfo', el).innerHTML = `<small class="dn">${esc(e.message)}</small>`; $('.tstat', el).innerHTML = ''; } }
    async function quote() { const a = +amtEl.value; $('.out', el).value = ''; $('.qi', el).textContent = '—'; $('.qr', el).textContent = '—'; $('.outusd', el).textContent = ''; T.q = null; if (!T.t || !(a > 0)) return;
      const inM = T.side === 'buy' ? SOL : T.mint, outM = T.side === 'buy' ? T.mint : SOL, inD = T.side === 'buy' ? 9 : T.t.decimals, outD = T.side === 'buy' ? T.t.decimals : 9, my = ++T.seq;
      try { const r = await fetch(`${JUP}/swap/v1/quote?inputMint=${inM}&outputMint=${outM}&amount=${Math.floor(a * 10 ** inD)}&slippageBps=100`).then(x => x.json()); if (my !== T.seq) return; if (!r.outAmount) throw new Error(r.error || 'no route right now');
        T.q = r; const o = r.outAmount / 10 ** outD; $('.out', el).value = num(o, 6); $('.qi', el).textContent = (+r.priceImpactPct * 100).toFixed(2) + '%'; $('.qr', el).textContent = (r.routePlan || []).map(x => x.swapInfo.label).join(' → ');
        const px = T.side === 'buy' ? T.t.usdPrice : (WL.view && WL.view.solUsd); if (px) $('.outusd', el).textContent = '≈ ' + usd(o * px, 2); st(''); } catch (e) { if (my === T.seq) st(esc(e.message), 'err'); } }
    async function go() { try { if (!WL.pk) { await connect(); return; } if (!T.q) throw new Error('enter an amount first'); st('building the swap…');
        const s = await fetch(`${JUP}/swap/v1/swap`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteResponse: T.q, userPublicKey: WL.pk, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 400000, priorityLevel: 'high' } } }) }).then(r => r.json());
        if (!s.swapTransaction) throw new Error('Jupiter returned no swap'); const r = await signSend([s.swapTransaction], st, true); st(`done. ${tsx(r.sigs[0])}`, 'ok'); toast(`Swap confirmed · ${tsx(r.sigs[0])}`); amtEl.value = ''; quote(); }
      catch (e) { if (e.message !== 'no wallet') st(esc(e.message || String(e)), 'err'); } }
    labels(); if (T.mint) pick(T.mint); }

  // ---------------------------------------------------------------- the launcher
  const LN = { asset: 'BTC', img: '1', busy: false };
  function launchInit() { const box = $('#assets'); if (!box || !S.m) return; if (!box._on) { box._on = 1; box.onclick = e => { const b = e.target.closest('.as'); if (!b) return; LN.asset = b.dataset.a; renderLaunch(); };
      $('#imgs').innerHTML = [1, 2, 3, 4, 5, 6].map(i => `<button data-i="${i}" aria-label="image ${i}"><img src="/coins/${i}.png" alt=""></button>`).join('');
      $('#imgs').onclick = e => { const b = e.target.closest('button'); if (!b) return; LN.img = b.dataset.i; $('#cImg').value = ''; renderLaunch(); };
      ['#cName', '#cSym', '#cImg', '#cBuy'].forEach(id => $(id).addEventListener('input', () => { if (id === '#cSym') $(id).value = $(id).value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (id === '#cImg') LN.img = $('#cImg').value.trim() || '1'; renderLaunch(); }));
      $('#launchBtn').onclick = doLaunch; }
    box.innerHTML = S.m.assets.map(a => { const p = a.price || {}; return `<button class="as" data-a="${a.code}"><span class="ring"></span><b>${esc(a.name)}</b><small>${esc(a.symbol)} · ${esc(a.full)}</small><em class="${cls(p.ch24)}">${usd(p.usd)} <span>${spct(p.ch24)}</span></em></button>`; }).join(''); renderLaunch(); }
  function renderLaunch() { if (!$('#launchBtn')) return; $$('.as').forEach(b => b.classList.toggle('on', b.dataset.a === LN.asset)); const custom = /^https:\/\//.test(LN.img); $$('#imgs button').forEach(b => b.classList.toggle('on', !custom && b.dataset.i === LN.img));
    const a = asset(LN.asset) || { name: LN.asset, symbol: LN.asset }, name = $('#cName').value.trim() || 'Your coin', sym = $('#cSym').value.trim() || 'TICKER', src = custom ? LN.img : `/coins/${/^[1-6]$/.test(LN.img) ? LN.img : 1}.png`;
    $('#prev').innerHTML = `<img src="${esc(src)}" alt="" onerror="this.src='/coins/1.png'"><b>${esc(name)} <span>$${esc(sym)}</span></b><div class="pfr"><div>treasury<b>${esc(a.name)} (${esc(a.symbol)})</b></div><div>fee to treasury<b>1% of every trade</b></div><div>creator fee<b>0%</b></div><div>buyback rule<b>under 1x mNAV</b></div></div>`;
    const open = S.m && S.m.pad, ps = $('#padSt'); ps.className = 'padst' + (open ? ' open' : ''); ps.innerHTML = `<i></i>${open ? 'launchpad open · ' + short(S.m.pad) : 'launchpad opening soon'}`;
    if (LN.busy) return; const b = $('#launchBtn'); if (!WL.pk) { b.textContent = 'Connect wallet'; b.disabled = false; return; } b.textContent = open ? 'Launch on Raydium →' : 'Launchpad opening soon'; b.disabled = !open; }
  async function doLaunch() { const st = stat('#lStat'); if (LN.busy) return; try { if (!WL.pk) { await connect(); return; } if (!(S.m && S.m.pad)) { st('The mNAV launchpad isn’t open yet. This button lights up the moment it is.'); return; }
      const name = $('#cName').value.trim(), symbol = $('#cSym').value.trim(); if (name.length < 2) throw new Error('Give your coin a name.'); if (symbol.length < 2) throw new Error('Give your coin a ticker.');
      LN.busy = true; $('#launchBtn').disabled = true; st('building your launch on Raydium LaunchLab…');
      const r = await post('buildLaunch', { wallet: WL.pk, pad: S.m.pad, name, symbol, image: LN.img, asset: LN.asset, buySol: +$('#cBuy').value || 0 }); const s = await signSend(r.txs, st, false);
      st(`$${esc(symbol)} is live.\nmint <b>${esc(r.mint)}</b>\n<a href="#/c/${r.mint}">open its page</a> · ${tsx(s.sigs[0])}`, 'ok'); setTimeout(async () => { await loadCoins(); renderLeague(); }, 5000); }
    catch (e) { if (e.message !== 'no wallet') st(esc(e.message || String(e)), 'err'); } finally { LN.busy = false; renderLaunch(); } }

  // ---------------------------------------------------------------- league, ledger, reserves, people, tape, kpis
  let SORT = 'tre';
  const mvCell = c => `<span class="mv ${c.mnav != null && c.mnav < 1 ? 'disc' : 'prem'}">${mx(c.mnav)}</span>`;
  function renderLeague() { const el = $('#lList'); if (!el || !S.coins) return; const c = S.coins; setT('#lCount', c.open ? `${c.coins.length} coin${c.coins.length === 1 ? '' : 's'}` : '');
    if (!c.open) { el.innerHTML = '<div class="empty">The mNAV launchpad opens soon. The first treasury company shows up here with its live mNAV.</div>'; return; }
    if (!c.coins.length) { el.innerHTML = '<div class="empty">No treasury companies yet. Launch the first one below.</div>'; return; }
    const L = [...c.coins].sort((a, b) => SORT === 'tre' ? (b.treasury.usd || 0) - (a.treasury.usd || 0) : SORT === 'mnav' ? (a.mnav ?? 1e12) - (b.mnav ?? 1e12) : SORT === 'mcap' ? (b.mcapUsd || 0) - (a.mcapUsd || 0) : (b.created || 0) > (a.created || 0) ? 1 : -1);
    el.innerHTML = `<div class="lrow h"><span>#</span><span></span><span>company</span><span class="hs">treasury</span><span class="n hm">holdings</span><span class="n hs">treasury $</span><span class="n hm">market cap</span><span class="n hm">per 1M</span><span class="n">mNAV</span></div>` +
      L.map((x, i) => `<a class="lrow" href="#/c/${x.mint}"><span class="rk">${i + 1}</span><img src="${esc(x.image || '/coins/1.png')}" alt="" onerror="this.src='/coins/1.png'"><span><b>${esc(x.name)}</b><small>$${esc(x.symbol)}</small></span><span class="hs"><span class="atag ${x.asset || ''}"><i></i>${esc((asset(x.asset) || {}).symbol || '—')}</span></span><span class="n hm">${amt(x.treasury.amount)}</span><span class="n hs">${big(x.treasury.usd)}</span><span class="n hm">${big(x.mcapUsd)}</span><span class="n hm">${amt(x.treasury.perM)}</span>${mvCell(x)}</a>`).join(''); }
  function entryRow(e) { const c = coinBy(e.coin), a = c && asset(c.asset), d = a ? Number(e.delta[a.mint] || 0) / 10 ** a.decimals : null;
    const what = e.kind === 'buy' ? `bought <b>${d != null ? amt(d) : '?'} ${esc(a ? a.symbol : '')}</b> with ${num(e.sol, 4)} SOL` : `sold <b>${d != null ? amt(Math.abs(d)) : '?'} ${esc(a ? a.symbol : '')}</b>, burned ${num(Number(e.burned) / 1e6, 0)} ${c ? '$' + esc(c.symbol) : 'tokens'}`;
    return `<div class="ent"><span class="ic ${e.kind}">${e.kind === 'buy' ? '+' : '🔥'}</span><span><b>${c ? '$' + esc(c.symbol) : short(e.coin)}</b> ${what}<small>${ago(e.time)}</small></span>${tsx(e.sig)}</div>`; }
  function renderLedger() { const el = $('#eList'); if (!el || !S.ledger) return; const E = S.ledger.entries || [];
    el.innerHTML = !(S.coins && S.coins.open) ? '<div class="empty">The ledger starts with the first treasury buy, the moment the launchpad opens.</div>' : E.length ? E.slice(0, 40).map(entryRow).join('') : '<div class="empty">No treasury buys yet. The first one lands here, linked to Solscan.</div>';
    const r = $('#porRows'); if (!r) return; const R = S.res; if (!R || !R.open || !R.rows || !R.rows.length) { r.innerHTML = '<div class="empty">Shows once the launchpad is open.</div>'; setT('#porW', ''); return; }
    r.innerHTML = R.rows.map(x => `<div class="prow"><span>${esc(x.code)}<small>${esc(x.symbol)}</small></span><span>ledger ${amt(x.ledger)}<small>wallet ${amt(x.wallet)} · ${usd(x.usd, 2)}</small></span><span class="${x.covered ? 'ok' : 'no'}">${x.covered ? 'covered ✓' : 'short ✕'}</span></div>`).join('');
    $('#porW').innerHTML = `treasury wallet <a class="o" href="https://solscan.io/account/${R.wallet}" target="_blank" rel="noopener">${short(R.wallet)} ↗</a>`; }
  function personCard(p) { return `<a class="card pc" href="#/u/${p.wallet}"><span class="av">${avatarHtml(p, p.wallet)}</span><b>${esc(p.name)}</b><small>${p.x ? '@' + esc(p.x) + ' · ' : ''}${short(p.wallet)}</small>${p.bio ? `<p>${esc(p.bio)}</p>` : ''}</a>`; }
  function renderPeople() { const el = $('#peopleList'); if (!el || !S.profiles) return; setT('#pCount', `${S.profiles.length} profile${S.profiles.length === 1 ? '' : 's'} on-chain`); el.innerHTML = S.profiles.length ? S.profiles.slice(0, 24).map(personCard).join('') : '<div class="card empty" style="grid-column:1/-1">No profiles yet. Be the first: it takes one signature.</div>'; }
  function renderTape() { const el = $('#tapeIn'); if (!el || !S.m) return; const items = [...S.m.assets.map(a => ({ s: a.symbol, p: a.price })), { s: 'SOL', p: S.m.sol }, ...((S.coins && S.coins.coins) || []).slice(0, 10).map(c => ({ s: '$' + c.symbol, mv: c.mnav, p: { usd: null } }))].filter(x => x.p);
    const one = items.map(x => x.mv !== undefined ? `<span><b>${esc(x.s)}</b>mNAV <em class="${x.mv != null && x.mv < 1 ? 'up' : 'o'}">${mx(x.mv)}</em></span>` : `<span><b>${esc(x.s)}</b>${usd(x.p.usd)}<em class="${cls(x.p.ch24)}">${spct(x.p.ch24)}</em></span>`).join(''); el.innerHTML = one + one; }
  function renderKpis() { if (S.m) { const A = c => S.m.assets.find(a => a.code === c) || {}; [['BTC', '#kBtc'], ['ETH', '#kEth']].forEach(([c, id]) => { const p = A(c).price; if (p) { countTo($(id), p.usd, x => usd(x, 0)); setT(id + 'C', spct(p.ch24), cls(p.ch24)); } });
      if (S.m.sol) { countTo($('#kSol'), S.m.sol.usd, x => usd(x, 2)); setT('#kSolC', spct(S.m.sol.ch24), cls(S.m.sol.ch24)); } }
    if (S.coins) { const o = S.coins.open; countTo($('#kCoins'), o ? S.coins.coins.length : 0, x => String(Math.round(x))); setT('#kPad', o ? 'on the launchpad' : 'launchpad opening soon', 'dim'); countTo($('#kTre'), o ? S.coins.totals.treasuryUsd : 0, x => usd(x, 2)); setT('#kTreN', o ? `${S.coins.totals.entries} ledger entr${S.coins.totals.entries === 1 ? 'y' : 'ies'}` : 'ledger opens with the launchpad', 'dim'); } }

  // ---------------------------------------------------------------- coin page
  function treasuryChart(entries, a) { if (!a || !entries.length) return '<div class="empty">No treasury buys for this coin yet.</div>';
    const E = [...entries].sort((x, y) => x.time - y.time); let acc = 0; const pts = E.map(e => { acc += Number(e.delta[a.mint] || 0) / 10 ** a.decimals; return [e.time, Math.max(0, acc)]; }); pts.push([Date.now() / 1000, acc]);
    const t0 = pts[0][0], t1 = Math.max(pts[pts.length - 1][0], t0 + 60), max = Math.max(...pts.map(p => p[1])) || 1, W = 600, H = 220, X = t => 10 + (t - t0) / (t1 - t0) * (W - 20), Y = v => H - 20 - v / max * (H - 40);
    let d = `M${X(pts[0][0])} ${Y(0)}`; pts.forEach((p, i) => { if (i) d += ` H${X(p[0])}`; d += ` V${Y(p[1])}`; });
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><linearGradient id="cf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(247,147,26,.35)"/><stop offset="1" stop-color="rgba(247,147,26,0)"/></linearGradient></defs><path d="${d} V${H - 20} H${X(pts[0][0])} Z" fill="url(#cf)"/><path d="${d}" fill="none" stroke="#f7931a" stroke-width="2" vector-effect="non-scaling-stroke"/><text x="${W - 10}" y="${Y(max) - 6}" text-anchor="end" font-family="GM, monospace" font-size="12" fill="#ffb44d">${amt(max)} ${esc(a.symbol)}</text></svg>`; }
  async function coinPage(mint) { app().innerHTML = `<div class="page"><div class="wrap"><div class="card empty">reading the treasury…</div></div></div>`; let d; try { d = await api('coin', '&mint=' + mint); } catch (e) { d = { coin: null, entries: [] }; }
    if (location.hash !== '#/c/' + mint) return; const c = d.coin, a = c && asset(c.asset), disc = c && c.mnav != null && c.mnav < 1;
    app().innerHTML = `<div class="page"><div class="wrap">
      <div class="card phead rv"><span class="ph-av">${c && c.image ? `<img src="${esc(c.image)}" alt="">` : '$'}</span><div><h1>${c ? esc(c.name) + ' <span class="o">$' + esc(c.symbol) + '</span>' : 'Trade ' + short(mint)}</h1><p>${c ? `A treasury company holding ${a ? esc(a.name) + ' (' + esc(a.symbol) + ')' : 'its treasury asset'}. ${disc ? '<b class="up">Trading under its treasury.</b>' : ''}` : 'This token is not on the mNAV launchpad, but you can still trade it here.'}</p>
        <div class="meta"><span class="mono">${esc(mint)}</span><a href="https://raydium.io/launchpad/token/?mint=${mint}" target="_blank" rel="noopener">raydium ↗</a><a href="https://solscan.io/token/${mint}" target="_blank" rel="noopener">solscan ↗</a><span id="hCount"></span></div></div></div>
      ${c ? `<div class="cgrid"><div class="card gauge rv"><svg viewBox="0 0 400 230">${gaugeSvg(c.mnav ?? 3.05)}</svg><div class="big">${c.mnav != null ? (c.mnav >= 100 ? c.mnav.toFixed(0) : c.mnav.toFixed(2)) + '<small>x</small>' : '—'}</div><span class="state ${disc ? 'disc' : 'prem'}">${c.mnav == null ? 'no treasury yet' : disc ? 'discount · buyback zone' : 'premium'}</span><p>market cap ${big(c.mcapUsd)} ÷ treasury ${big(c.treasury.usd)}</p></div>
        <div class="card chart rv d1"><h3>treasury over time · from the ledger</h3>${treasuryChart(d.entries, a)}</div></div>
      <div class="kv" style="margin-top:14px"><div class="card rv"><small>holdings</small><b>${amt(c.treasury.amount)}</b><em>${esc(a ? a.symbol : '')}</em></div><div class="card rv d1"><small>treasury value</small><b>${big(c.treasury.usd)}</b><em>live price</em></div><div class="card rv d2"><small>per 1M tokens</small><b>${amt(c.treasury.perM)}</b><em>${esc(a ? a.symbol : '')}</em></div>
        <div class="card rv"><small>7d yield</small><b class="${cls(c.treasury.yield7d)}">${c.treasury.yield7d != null ? spct(c.treasury.yield7d) : '—'}</b><em>treasury per token</em></div><div class="card rv d1"><small>fees earned</small><b>${num(c.earnedSol, 4)} SOL</b><em>1% of ${num(c.volumeSol, 2)} SOL volume</em></div><div class="card rv d2"><small>unfunded</small><b>${num(c.unfundedSol, 4)} SOL</b><em>${num(c.treasury.fundedSol, 4)} SOL bought so far</em></div></div>
      <div class="card entries rv" style="margin-top:14px">${d.entries.length ? d.entries.map(entryRow).join('') : '<div class="empty">No ledger entries for this coin yet.</div>'}</div>` : ''}
      <div style="margin-top:14px">${tradeHtml('coin', mint)}</div></div></div>`; tradeInit($('[data-trade="coin"]')); reveals();
    try { const h = await api('holders', '&mint=' + mint); setT('#hCount', `${h.count}${h.full ? '' : '+'} holders`); } catch (e) { } }

  // ---------------------------------------------------------------- profile page
  async function profilePage(w) { app().innerHTML = `<div class="page"><div class="wrap"><div class="card empty">reading the profile…</div></div></div>`; let p = null; try { p = (await api('profile', '&wallet=' + w)).profile; } catch (e) { app().innerHTML = `<div class="page"><div class="wrap"><div class="card empty">${esc(e.message)}</div></div></div>`; return; }
    const mine = WL.pk === w; app().innerHTML = `<div class="page"><div class="wrap">
      <div class="card phead rv"><span class="ph-av">${avatarHtml(p, w)}</span><div><h1>${esc(p ? p.name : short(w))}</h1>${p && p.bio ? `<p>${esc(p.bio)}</p>` : `<p>${mine ? 'No profile yet. Make one: it takes one signature.' : 'This wallet has no profile yet.'}</p>`}
        <div class="meta"><span class="mono">${esc(w)}</span>${p && p.x ? `<a href="https://x.com/${esc(p.x)}" target="_blank" rel="noopener">@${esc(p.x)} ↗</a>` : ''}<a href="https://solscan.io/account/${w}" target="_blank" rel="noopener">solscan ↗</a>${p ? `<span>updated ${ago(p.time)}</span>` : ''}</div></div>
        ${mine ? `<button class="btn go" id="edit">${p ? 'Edit profile' : 'Make my profile'}</button>` : ''}</div>
      <div class="pgrid"><div class="card pbox rv"><h3>wallet · live</h3><div class="bigbal"><b id="pTot">—</b><small id="pSol">—</small></div><div class="toks" id="pToks" style="max-height:none"></div></div>
        <div class="card pbox rv d1"><h3>treasury companies held</h3><div class="toks" id="pCoins" style="max-height:none"><div class="empty">reading…</div></div></div></div></div></div>`;
    if (mine) $('#edit').onclick = () => editProfile(p); reveals();
    const fill = v => { setT('#pTot', usd(v.totalUsd, 2)); setT('#pSol', `${num(v.sol)} SOL · ${usd(v.solValue, 2)}`); $('#pToks').innerHTML = v.tokens.slice(0, 20).map(tokRow).join('') || '<div class="empty">no tokens</div>';
      const held = v.tokens.filter(t => coinBy(t.mint)); $('#pCoins').innerHTML = held.map(t => { const c = coinBy(t.mint); return `<a class="tok" href="#/c/${t.mint}" style="text-decoration:none">${c.image ? `<img src="${esc(c.image)}" alt="">` : '<span class="ph"></span>'}<span><b>$${esc(c.symbol)}</b><small>mNAV ${mx(c.mnav)}</small></span><span class="v">${num(t.amount, 0)}<small>${usd(t.usd, 2)}</small></span></a>`; }).join('') || '<div class="empty">No mNAV coins in this wallet yet.</div>'; };
    const load = async () => { try { const v = mine && WL.view ? WL.view : await api('wallet', '&addr=' + w); if (location.hash === '#/u/' + w) fill(v); } catch (e) { } }; load(); clearInterval(profilePage.t); profilePage.t = setInterval(() => { if (location.hash === '#/u/' + w) load(); else clearInterval(profilePage.t); }, 10000); }
  function editProfile(p) { const m = $('#modal'); $('#mCard').innerHTML = `<h3>Your profile, on Solana</h3><label class="fld"><span>Name</span><input id="eName" maxlength="24" value="${esc(p ? p.name : '')}" placeholder="satoshi"></label><label class="fld"><span>Bio</span><textarea id="eBio" maxlength="140" rows="3" placeholder="what you hold, what you build">${esc(p ? p.bio : '')}</textarea></label><label class="fld"><span>Avatar (https image link)</span><input id="eAv" value="${esc(p ? p.avatar : '')}" placeholder="https://…"></label><label class="fld"><span>X handle</span><input id="eX" maxlength="16" value="${esc(p ? p.x : '')}" placeholder="@handle"></label><button class="btn go wide" id="eSave">Save on-chain</button><div class="stat2" id="eStat"></div>`;
    m.classList.add('on'); m.onclick = e => { if (e.target === m) m.classList.remove('on'); };
    $('#eSave').onclick = async () => { const st = stat('#eStat'); try { await connect(); st('building the memo…'); const r = await post('buildProfile', { wallet: WL.pk, name: $('#eName').value, bio: $('#eBio').value, avatar: $('#eAv').value.trim(), x: $('#eX').value });
        const s = await signSend(r.txs, st, false); st(`saved on-chain. ${tsx(s.sigs[0])}`, 'ok'); toast('Profile saved on Solana.'); setTimeout(async () => { m.classList.remove('on'); await loadMe(); await loadSocial(); if (location.hash.startsWith('#/u/')) profilePage(WL.pk); else renderPeople(); }, 2200); } catch (e) { if (e.message !== 'no wallet') st(esc(e.message), 'err'); } }; }

  // ---------------------------------------------------------------- console: for the treasury wallet
  function consolePage() { app().innerHTML = `<div class="page"><div class="wrap"><div class="head"><span class="kick">console</span><h2>Run the <span class="it">treasury.</span></h2><p>For the wallet that runs mNAV. Every step is a transaction you sign, and every treasury buy and buyback lands on the public ledger.</p></div>
    <div class="con">
      <div class="card cstep"><h3><span>01</span>Create the mNAV launchpad</h3><p>One transaction on Raydium LaunchLab: 1% fee to this wallet (the treasury wallet), 0% creator fee, half the LP burned at graduation and half kept as a fee key.</p><div class="crow"><button class="btn go sm" id="kPad">Create the launchpad</button><span class="mono" id="kPadInfo"></span></div><div class="stat2" id="kPadSt"></div></div>
      <div class="card cstep"><h3><span>02</span>Claim the fees</h3><p>Moves what every coin has paid from LaunchLab's vault to this wallet, as SOL.</p><div class="crow"><button class="btn sm" id="kClaim">Claim</button><span class="mono" id="kVault"></span></div><div class="stat2" id="kClaimSt"></div></div>
      <div class="card cstep"><h3><span>03</span>Fund the treasuries · buy back under 1x</h3><p>Each coin's unfunded fees are 1% of its curve volume minus what's already been bought. Buy fills its treasury through Jupiter with the ledger memo. Buy back only works under 1x mNAV: it sells part of the treasury, buys the coin and burns it.</p>
        <div class="ctable" id="kTable"><div class="empty">reading the launchpad…</div></div><div class="stat2" id="kSt"></div></div>
    </div></div></div>`;
    const ref = async () => { if (!WL.pk) { setT('#kPadInfo', 'connect the wallet that runs mNAV'); return; } try { const p = await api('pad', '&admin=' + WL.pk); setT('#kPadInfo', p.exists ? `launchpad ${short(p.id)} · ${p.feePct}% fee` : 'no launchpad on this wallet yet'); setT('#kVault', p.exists ? `${(+p.unclaimedSol).toFixed(4)} SOL waiting` : ''); } catch (e) { setT('#kPadInfo', e.message); } }; ref();
    const table = () => { const el = $('#kTable'), C = (S.coins && S.coins.coins) || []; if (!S.coins || !S.coins.open) { el.innerHTML = '<div class="empty">Opens once the launchpad address is set on the site.</div>'; return; } if (!C.length) { el.innerHTML = '<div class="empty">No coins on the launchpad yet.</div>'; return; }
      el.innerHTML = `<div class="ctr h"><span>coin</span><span>treasury</span><span>unfunded</span><span>holdings</span><span>mNAV</span><span></span></div>` + C.map(c => `<div class="ctr" data-m="${c.mint}"><span>$${esc(c.symbol)}</span><span>${esc((asset(c.asset) || {}).symbol || '—')}</span><span>${num(c.unfundedSol, 4)} SOL</span><span>${amt(c.treasury.amount)}</span><span class="${c.mnav != null && c.mnav < 1 ? 'up' : ''}">${mx(c.mnav)}</span>
        <span class="act"><input class="kSol" type="number" min="0" step="0.01" value="${Math.max(.001, +c.unfundedSol.toFixed(4))}" aria-label="SOL"><button class="btn sm go kB">Buy</button><input class="kPct" type="number" min="1" max="100" value="25" style="width:64px" aria-label="percent"><button class="btn sm kBB" ${c.mnav != null && c.mnav < 1 ? '' : 'disabled title="only under 1x mNAV"'}>Buy back %</button></span></div>`).join(''); };
    table(); $('#kTable').onclick = async e => { const b = e.target.closest('button'); if (!b) return; const row = b.closest('.ctr'), mint = row.dataset.m, st = stat('#kSt');
      try { await connect(); if (b.classList.contains('kB')) { st('building the treasury buy…'); const r = await post('buildBuy', { wallet: WL.pk, coin: mint, sol: +$('.kSol', row).value }); const s = await signSend(r.txs, st, true); st(`treasury bought ~${amt(r.quote.out / 10 ** (asset(r.asset) || { decimals: 8 }).decimals)} ${esc(r.asset)}. ${tsx(s.sigs[0])}`, 'ok'); }
        else { st('building the buyback…'); const r = await post('buildBuyback', { wallet: WL.pk, coin: mint, pct: +$('.kPct', row).value }); const s = await signSend(r.txs, st, true); st(`sold ${amt(r.sold)} ${esc(r.asset)}, bought back and burned. ${tsx(s.sigs[0])}`, 'ok'); }
        setTimeout(async () => { await Promise.all([loadCoins(), loadLedger()]); if (location.hash === '#/console') table(); }, 3000); } catch (e) { if (e.message !== 'no wallet') st(esc(e.message), 'err'); } };
    $('#kPad').onclick = async () => { const st = stat('#kPadSt'); try { await connect(); st('building…'); const r = await post('buildPad', { wallet: WL.pk, feePct: 1, burnPct: 50, web: location.origin, img: location.origin + '/icon.png' }); const s = await signSend(r.txs, st, false); st(`the mNAV launchpad is live: <b>${esc(r.pad)}</b> ${tsx(s.sigs[0])}\nsend this address over so the site can open the launcher.`, 'ok'); ref(); } catch (e) { if (e.message !== 'no wallet') st(esc(e.message), 'err'); } };
    $('#kClaim').onclick = async () => { const st = stat('#kClaimSt'); try { await connect(); st('building the claim…'); const r = await post('claim', { wallet: WL.pk }); const s = await signSend(r.txs, st, false); st(`claimed. ${tsx(s.sigs[0])}`, 'ok'); ref(); } catch (e) { if (e.message !== 'no wallet') st(esc(e.message), 'err'); } }; }

  // ---------------------------------------------------------------- router + glue
  function reveals() { if (RM) { $$('.rv').forEach(e => e.classList.add('shown')); return; } const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('shown'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' }); $$('.rv:not(.shown)').forEach(e => io.observe(e)); }
  function tilt() { if (matchMedia('(pointer: coarse)').matches || RM) return; document.addEventListener('pointermove', e => { const el = e.target.closest('.pc, .as, .defs .card, .kv .card'); $$('.tilted').forEach(x => { if (x !== el) { x.style.transform = ''; x.classList.remove('tilted'); } }); if (!el) return; const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.classList.add('tilted'); el.style.transform = `perspective(700px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-3px)`; }); }
  function heroParallax() { const mk = $('#heroMark'); if (!mk || RM) return; addEventListener('scroll', () => { const k = Math.min(1, scrollY / innerHeight); mk.style.transform = `translateY(${k * 60}px) scale(${1 - k * .18})`; mk.style.opacity = String(1 - k * .9); }, { passive: true }); }
  const SECTIONS = ['ratio', 'how', 'league', 'launch', 'trade', 'ledger', 'people', 'faq'];
  let homeOn = false;
  function render() { const h = location.hash || '#/', [, view, arg] = h.split('/');
    $$('#links a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === h));
    if (view === 'u' && arg) { homeOn = false; return profilePage(arg); } if (view === 'c' && arg) { homeOn = false; return coinPage(arg); } if (view === 'console') { homeOn = false; return consolePage(); }
    if (!homeOn) { homeOn = true; app().innerHTML = home(); reveals(); ratioInit(); howInit(); heroParallax();
      $$('.ltool .chip').forEach(b => b.onclick = () => { SORT = b.dataset.s; $$('.ltool .chip').forEach(x => x.classList.toggle('on', x === b)); renderLeague(); });
      $('#mkProfile').onclick = async () => { try { await connect(); editProfile(S.me); } catch (e) { } }; fillHome(); }
    else { $$('[data-trade]').forEach(el => el.dispatchEvent(new Event('bal'))); renderLaunch(); }
    if (SECTIONS.includes(view)) { const el = $('#' + view); if (el) setTimeout(() => el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }), 30); } else if (view === '' || view == null) scrollTo({ top: 0, behavior: 'smooth' }); }
  function fillHome() { renderTape(); renderKpis(); renderLeague(); renderLedger(); renderPeople(); launchInit(); const t = $('[data-trade="home"]'); tradeInit(t); if (t && t._picks) t._picks(); }
  function navInit() { const top = $('#top'); addEventListener('scroll', () => top.classList.toggle('sc', scrollY > 20), { passive: true }); addEventListener('hashchange', render); $('#fMark').innerHTML = mark('fm', .8); }
  field(); walletInit(); navInit(); tilt(); render();
  Promise.all([loadMarket(), loadCoins(), loadLedger(), loadSocial()]).then(() => { if (homeOn) fillHome(); else render(); });
  setInterval(async () => { await loadMarket(); if (homeOn) { renderTape(); renderKpis(); } }, 30000);
  setInterval(async () => { await Promise.all([loadCoins(), loadLedger(), loadSocial()]); if (homeOn) { renderLeague(); renderLedger(); renderPeople(); renderKpis(); renderTape(); } }, 60000);
})();
