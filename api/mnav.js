// mNAV API: every coin is a treasury company.
// Every coin launches on the mNAV launchpad on Raydium LaunchLab. Its 1% launchpad fee is claimed by the treasury wallet and spent on the coin's own
// treasury asset (Bitcoin, Ether or staked SOL). Every treasury buy and buyback is one Solana transaction with a memo naming the coin, so each coin's
// treasury is a public ledger anyone can rebuild from the chain. mNAV = market cap / treasury value. Under 1x, the treasury buys the coin back and burns it.
// GET  a=market · a=coins · a=coin&mint= · a=ledger · a=reserves · a=t (token metadata) · a=wallet&addr= · a=profiles · a=profile&wallet= · a=holders&mint= · a=pad · a=bal
// POST a=buildPad · a=buildLaunch · a=buildProfile · a=claim · a=buildBuy · a=buildBuyback · a=send   (every transaction is signed in the visitor's own wallet)
const { Connection, PublicKey, Keypair, SystemProgram, ComputeBudgetProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction, AddressLookupTableAccount } = require('@solana/web3.js');
const SPL = require('@solana/spl-token');
const BN = require('bn.js');
const R = require('@raydium-io/raydium-sdk-v2');
const CFG = require('./mnav-config.json');

const RPC = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const LAUNCH_API = 'https://launch-mint-v1.raydium.io', JUP = 'https://lite-api.jup.ag';
const WSOL = new PublicKey('So11111111111111111111111111111111111111112');
const PROGRAM = R.LAUNCHPAD_PROGRAM, RAYDIUM_PLATFORM = R.LAUNCHPAD_PLATFORM;
const CONFIG = R.getPdaLaunchpadConfigId(PROGRAM, WSOL, 0, 0).publicKey;
// three fixed addresses that receive a 0 SOL transfer, so the chain itself indexes everything: launches, profiles, the treasury ledger
const TAG = new PublicKey(process.env.MNAV_TAG || 'FmLPouUS2otTqCYnzRJmfWao6RreYKwjKcizGAe1hUqm');
const PTAG = new PublicKey(process.env.MNAV_PTAG || 'BdboWBXEmDgjXsJhQ6NHU8zmfB9rFmADUvwrp9bvT4XZ');
const LTAG = new PublicKey(process.env.MNAV_LTAG || '2jDBHBngbhN3iBTK5y5r1uDPQkMk6wG51KRrBvmWxvLJ');
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const SUPPLY = new BN('1000000000000000'), SELL = new BN('793100000000000'), SUPPLY_UI = 1e9;
const PPM = 1e6;
const conn = new Connection(RPC, 'confirmed');
const PIN = { pad: process.env.MNAV_PAD || CFG.pad };
const ASSETS = CFG.assets, ACODE = Object.fromEntries(ASSETS.map(a => [a.code, a])), AMINT = Object.fromEntries(ASSETS.map(a => [a.mint, a]));

const out = (res, code, body, cache) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', cache || 'no-store'); res.end(JSON.stringify(body)); };
const b64u = s => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
const host = req => process.env.MNAV_HOST || ('https://' + (req.headers['x-forwarded-host'] || req.headers.host));
const body = req => new Promise(ok => { if (req.body) return ok(typeof req.body === 'string' ? JSON.parse(req.body) : req.body); let d = ''; req.on('data', c => d += c); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } }); });
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const str = b => Buffer.from(b).toString('utf8').replace(/\0/g, '').trim();
const pk = (s, what) => { try { return new PublicKey(String(s)); } catch { throw new Error(what || 'bad address'); } };
const padIdOf = admin => R.getPdaPlatformId(PROGRAM, admin).publicKey;
const vaultOf = padId => R.getPdaPlatformVault(PROGRAM, padId, WSOL).publicKey;
const pct = n => +(+n.toString() / PPM * 100).toFixed(4);
const getJ = async (url, ms = 8000) => { const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json' } }); if (!r.ok) throw new Error(url.split('/')[2] + ' ' + r.status); return r.json(); };
const memoIx = (signer, text) => new TransactionInstruction({ programId: MEMO, keys: [{ pubkey: signer, isSigner: true, isWritable: false }], data: Buffer.from(text, 'utf8') });
const tagTo = (from, to, extra) => { const ix = SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: 0 }); if (extra) ix.keys.push({ pubkey: extra, isSigner: false, isWritable: false }); return ix; };
const ser = t => Buffer.from(t.serialize({ requireAllSignatures: false, verifySignatures: false })).toString('base64');

// ---------------------------------------------------------------- prices: Jupiter's token index (symbol, icon, decimals, live USD price)
async function jupInfo(mints) { const o = {}; for (let i = 0; i < mints.length; i += 90) { const part = mints.slice(i, i + 90); try { const j = await getJ(`${JUP}/tokens/v2/search?query=${part.join(',')}`); for (const t of j || []) o[t.id] = { symbol: t.symbol, name: t.name, icon: t.icon, decimals: t.decimals, usd: t.usdPrice ?? null, ch24: t.stats24h ? t.stats24h.priceChange ?? null : null, mcap: t.mcap ?? t.fdv ?? null }; } catch { } } return o; }
let mktCache = null;
async function market() { if (mktCache && Date.now() - mktCache.t < 30000) return mktCache.v;
  const P = await jupInfo([WSOL.toBase58(), ...ASSETS.map(a => a.mint)]);
  const v = { at: Date.now(), pad: PIN.pad || null, sol: P[WSOL.toBase58()] || null, assets: ASSETS.map(a => ({ ...a, price: P[a.mint] || null })) }; mktCache = { t: Date.now(), v }; return v; }

// ---------------------------------------------------------------- the launchpad (the p4d engine)
let chainCache = null;
async function chain() {
  if (chainCache && Date.now() - chainCache.t < 60000) return chainCache.v;
  const [ca, pa] = await conn.getMultipleAccountsInfo([CONFIG, RAYDIUM_PLATFORM]);
  if (!ca) throw new Error('LaunchLab config not found');
  const v = { cfg: R.LaunchpadConfig.decode(ca.data), ray: pa ? R.PlatformConfig.decode(pa.data) : null };
  chainCache = { t: Date.now(), v }; return v;
}
function decodePad(id, data) { const p = R.PlatformConfig.decode(data); return { id: id.toBase58(), name: str(p.name), web: str(p.web), img: str(p.img), feePct: pct(p.feeRate), creatorFeePct: pct(p.creatorFeeRate), lp: { burn: pct(p.burnScale), platform: pct(p.platformScale), creator: pct(p.creatorScale) }, claimWallet: p.platformClaimFeeWallet.toBase58() }; }
let padCache = null;
async function padInfo(idStr) { const id = pk(idStr, 'bad pad id'); if (padCache && padCache.id === idStr && Date.now() - padCache.t < 60000) return padCache.v;
  const [acc, vault] = await conn.getMultipleAccountsInfo([id, vaultOf(id)]);
  if (!acc || !acc.owner.equals(PROGRAM)) return { exists: false, id: id.toBase58() };
  let unclaimedSol = 0; if (vault && vault.data.length >= 72) unclaimedSol = Number(vault.data.readBigUInt64LE(64)) / 1e9;
  const v = { exists: true, ...decodePad(id, acc.data), vault: vaultOf(id).toBase58(), unclaimedSol }; padCache = { id: idStr, t: Date.now(), v }; return v; }
async function pad(q) { const id = q.get('id') ? pk(q.get('id'), 'bad pad id') : padIdOf(pk(q.get('admin'), 'bad wallet')); padCache = null; return padInfo(id.toBase58()); }
const fits = t => { try { t.serialize({ requireAllSignatures: false, verifySignatures: false }); return true; } catch { return false; } };
async function finish(txs, wallet, signers, tagFn, simulate) {
  const { blockhash } = await conn.getLatestBlockhash('confirmed');
  const mk = ixs => { const t = new Transaction(); t.add(...ixs); t.feePayer = wallet; t.recentBlockhash = blockhash; const need = signers.filter(s => t.instructions.some(ix => ix.keys.some(k => k.isSigner && k.pubkey.equals(s.publicKey)))); if (need.length) t.partialSign(...need); return t; };
  let list = txs.map((tx, i) => mk(i === 0 && tagFn ? [...tx.instructions, tagFn(false)] : tx.instructions));
  if (tagFn && !fits(list[0])) { list = txs.map(tx => mk(tx.instructions)); list.push(mk([tagFn(true)])); }
  let sim = null;
  if (simulate) sim = await Promise.all(list.slice(0, 1).map(async t => { const r = await conn.simulateTransaction(t); return { err: r.value.err, units: r.value.unitsConsumed, logs: (r.value.logs || []).slice(-16) }; }));
  return { txs: list.map(ser), sim };
}
const txsOf = m => m.transactions ? m.transactions : [{ instructions: m.transaction && m.transaction.instructions && m.transaction.instructions.length ? m.transaction.instructions : m.builder.allInstructions }];
async function sdk(owner) { const r = await R.Raydium.load({ connection: conn, owner, cluster: 'mainnet', disableLoadToken: true, disableFeatureCheck: true, blockhashCommitment: 'confirmed' }); if (module.exports._t && module.exports._t.onLoad) module.exports._t.onLoad(r); return r; }

// the mNAV launchpad: 1% of every curve trade goes to the wallet that created it (the treasury wallet); half the graduation LP is burned, half kept as a Raydium fee key
async function buildPad(req) {
  const b = await body(req); const wallet = pk(b.wallet, 'connect a wallet first');
  const id = padIdOf(wallet); if (await conn.getAccountInfo(id)) throw new Error(`this wallet already has a launchpad (${id.toBase58()}). one per wallet.`);
  const { ray } = await chain(); if (!ray) throw new Error('could not read Raydium’s platform settings');
  const feePct = Math.max(0, Math.min(5, +(b.feePct ?? 1))), burn = Math.round(Math.max(0, Math.min(100, +(b.burnPct ?? 50))) * 1e4);
  const raydium = await sdk(wallet);
  const made = await raydium.launchpad.createPlatformConfig({
    programId: PROGRAM, platformAdmin: wallet, platformClaimFeeWallet: wallet, platformLockNftWallet: wallet, platformVestingWallet: wallet,
    cpConfigId: ray.cpConfigId, migrateCpLockNftScale: { platformScale: new BN(PPM - burn), creatorScale: new BN(0), burnScale: new BN(burn) },
    transferFeeExtensionAuth: wallet, creatorFeeRate: new BN(0), feeRate: new BN(Math.round(feePct * 1e4)),
    name: CFG.name, web: clean(b.web || host(req), 120), img: clean(b.img || host(req) + '/icon.png', 200), txVersion: R.TxVersion.LEGACY, feePayer: wallet,
  });
  const r = await finish(txsOf(made), wallet, [], () => tagTo(wallet, TAG), !!b.simulate);
  return { pad: id.toBase58(), ...r };
}
async function buildLaunch(req) {
  const b = await body(req); const wallet = pk(b.wallet, 'connect a wallet first'), padId = pk(b.pad || PIN.pad || '', 'the mNAV launchpad is not open yet');
  const padAcc = await conn.getAccountInfo(padId); if (!padAcc || !padAcc.owner.equals(PROGRAM)) throw new Error('the mNAV launchpad is not open yet');
  const { cfg } = await chain(); const raise = 85;
  const name = clean(b.name, 32), symbol = String(b.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (name.length < 2) throw new Error('give your coin a name'); if (symbol.length < 2) throw new Error('give your coin a ticker (2 to 10 letters)');
  const asset = ACODE[String(b.asset || 'BTC').toUpperCase()]; if (!asset) throw new Error('pick the treasury asset');
  let img = String(b.image || '1'); if (/^[1-6]$/.test(img)) img = img; else if (/^https:\/\/[^\s"'<>]{6,160}$/.test(img)) img = 'u' + b64u(img); else throw new Error('pick an image, or paste an https image link');
  const uri = host(req) + '/api/mnav?a=t&n=' + encodeURIComponent(name) + '&s=' + symbol + '&t=' + asset.code + '&i=' + img;
  if (uri.length > 200) throw new Error('name or image link too long for on-chain metadata. use a preset image or a shorter link');
  const buySol = Math.max(0, +b.buySol || 0); if (buySol > 20) throw new Error('first buy is capped at 20 SOL here');
  const mint = Keypair.generate(); const raydium = await sdk(wallet);
  const { transactions, extInfo } = await raydium.launchpad.createLaunchpad({
    programId: PROGRAM, mintA: mint.publicKey, decimals: 6, name, symbol, uri, migrateType: 'cpmm', configId: CONFIG, configInfo: cfg, mintBDecimals: 9, platformId: padId,
    txVersion: R.TxVersion.LEGACY, slippage: new BN(100), buyAmount: new BN(Math.round(buySol * 1e9)), createOnly: buySol === 0,
    supply: SUPPLY, totalSellA: SELL, totalFundRaisingB: new BN(Math.round(raise * 1e9)), totalLockedAmount: new BN(0), cliffPeriod: new BN(0), unlockPeriod: new BN(0),
    extraSigners: [mint], feePayer: wallet, computeBudgetConfig: { units: 600000, microLamports: 60000 },
  });
  const r = await finish(transactions, wallet, [mint], extra => tagTo(wallet, TAG, extra ? mint.publicKey : null), !!b.simulate);
  return { mint: mint.publicKey.toBase58(), pool: extInfo?.address?.poolId?.toBase58() || R.getPdaLaunchpadPoolId(PROGRAM, mint.publicKey, WSOL).publicKey.toBase58(), uri, asset: asset.code, ...r };
}
// the token's metadata: the treasury asset lives in the link, so anyone can read a coin's treasury asset from the chain
function tokenMeta(req, q) { const name = clean(q.get('n'), 32), symbol = clean(q.get('s'), 10), i = String(q.get('i') || '1'), a = ACODE[String(q.get('t') || '').toUpperCase()];
  const image = /^[1-6]$/.test(i) ? host(req) + '/coins/' + i + '.png' : i[0] === 'u' ? unb64u(i.slice(1)) : host(req) + '/coins/1.png';
  return { name, symbol, image, description: `Launched on mNAV. $${symbol} is a treasury company: 1% of every trade buys ${a ? a.name + ' (' + a.symbol + ')' : 'its treasury asset'} for its treasury. When $${symbol} trades below its treasury (under 1x mNAV), the treasury buys $${symbol} back and burns it.`, external_url: host(req), attributes: a ? [{ trait_type: 'treasury', value: a.symbol }] : [], createdOn: host(req) }; }

// ---------------------------------------------------------------- the ledger: every treasury buy and buyback, read from the chain
// a buy:     memo  mnav:buy:<coin>:<lamports>   + 0 SOL to LTAG, signed by the treasury wallet; what it bought is the wallet's balance change in that tx
// a buyback: memo  mnav:bb:<coin>               + 0 SOL to LTAG; the treasury asset it sold is the balance change, the coins it burned are the burn instruction
let ledgerCache = null;
async function ledger() {
  if (!PIN.pad) return { treasury: null, entries: [] };
  if (ledgerCache && Date.now() - ledgerCache.t < 30000) return ledgerCache.v;
  const p = await padInfo(PIN.pad); if (!p.exists) return { treasury: null, entries: [] };
  const T = p.claimWallet, sigs = [];
  let before; for (let k = 0; k < 3; k++) { const s = await conn.getSignaturesForAddress(LTAG, { limit: 1000, before }); sigs.push(...s); if (s.length < 1000) break; before = s[s.length - 1].signature; }
  const ok = sigs.filter(x => !x.err), entries = [];
  for (let i = 0; i < ok.length; i += 50) { const txs = await conn.getParsedTransactions(ok.slice(i, i + 50).map(x => x.signature), { maxSupportedTransactionVersion: 0 }).catch(() => []);
    txs.forEach((t, k) => { if (!t || !t.meta || t.meta.err) return; const keys = t.transaction.message.accountKeys, payer = (keys[0].pubkey || keys[0]).toString(); if (payer !== T) return;
      const memo = t.transaction.message.instructions.find(ix => ix.program === 'spl-memo' && typeof ix.parsed === 'string' && ix.parsed.startsWith('mnav:'));
      if (!memo) return; const parts = memo.parsed.split(':'), kind = parts[1], coin = parts[2]; if (!['buy', 'bb'].includes(kind) || !coin) return;
      const delta = {}; const bal = (arr, sign) => (arr || []).forEach(b => { if (b.owner !== T || !AMINT[b.mint] && b.mint !== coin) return; delta[b.mint] = (delta[b.mint] || 0n) + sign * BigInt(b.uiTokenAmount.amount); });
      bal(t.meta.postTokenBalances, 1n); bal(t.meta.preTokenBalances, -1n);
      let burned = 0n; const ixs = [...t.transaction.message.instructions, ...(t.meta.innerInstructions || []).flatMap(x => x.instructions)];
      for (const ix of ixs) if (ix.program === 'spl-token' && ix.parsed && /^burn/.test(ix.parsed.type) && ix.parsed.info.mint === coin) burned += BigInt(ix.parsed.info.amount || (ix.parsed.info.tokenAmount && ix.parsed.info.tokenAmount.amount) || 0);
      entries.push({ sig: ok[i + k].signature, time: t.blockTime, kind, coin, sol: kind === 'buy' ? (+parts[3] || 0) / 1e9 : null, delta: Object.fromEntries(Object.entries(delta).map(([m, v]) => [m, v.toString()])), burned: burned.toString() }); }); }
  const v = { treasury: T, entries }; ledgerCache = { t: Date.now(), v }; return v;
}

// ---------------------------------------------------------------- coins: Raydium's launch index + the ledger = every coin as a treasury company
let coinCache = null;
async function coins(force) {
  if (!PIN.pad) return { open: false, coins: [], totals: null };
  if (!force && coinCache && Date.now() - coinCache.t < 20000) return coinCache.v;
  const [j, L, M, P] = await Promise.all([getJ(`${LAUNCH_API}/get/list?sort=new&size=60&mintType=default&platformId=${PIN.pad}`).catch(() => null), ledger().catch(() => ({ entries: [] })), market(), padInfo(PIN.pad).catch(() => ({ feePct: 1 }))]);
  const rows = ((j && j.data && j.data.rows) || []).filter(r => !r.platformInfo || r.platformInfo.pubKey === PIN.pad), feeRate = (P.feePct ?? 1) / 100;
  const px = Object.fromEntries(M.assets.map(a => [a.code, a.price && a.price.usd])), solUsd = M.sol && M.sol.usd, now = Date.now() / 1000;
  const list = rows.map(r => { let code = ''; try { code = (new URL(r.metadataUrl).searchParams.get('t') || '').toUpperCase(); } catch { } const a = ACODE[code] || null;
    const mine = L.entries.filter(e => e.coin === r.mint), dec = a ? a.decimals : 8;
    const held = (until) => mine.filter(e => !until || e.time <= until).reduce((s, e) => s + BigInt(a ? e.delta[a.mint] || '0' : '0'), 0n);
    const burnedRaw = (until) => mine.filter(e => !until || e.time <= until).reduce((s, e) => s + BigInt(e.burned || '0'), 0n);
    const raw = held(), amount = Number(raw) / 10 ** dec, tUsd = a && px[code] != null ? amount * px[code] : null, burned = Number(burnedRaw()) / 1e6, supply = SUPPLY_UI - burned;
    const raw7 = held(now - 7 * 86400), sup7 = SUPPLY_UI - Number(burnedRaw(now - 7 * 86400)) / 1e6, perM = amount / (supply / 1e6), perM7 = Number(raw7) / 10 ** dec / (sup7 / 1e6);
    const fundedSol = mine.filter(e => e.kind === 'buy').reduce((s, e) => s + (e.sol || 0), 0), earnedSol = (+r.volumeB || 0) * feeRate, mcap = r.marketCap || null;
    return { mint: r.mint, pool: r.poolId, name: r.name, symbol: r.symbol, image: r.imgUrl, created: r.createAt, creator: r.creator || null, mcapUsd: mcap, volumeUsd: r.volumeU || 0, volumeSol: +r.volumeB || 0, progress: r.finishingRate, graduated: r.finishingRate >= 100,
      asset: code || null, treasury: { raw: raw.toString(), amount, usd: tUsd, perM, yield7d: perM7 > 0 ? (perM / perM7 - 1) * 100 : null, buys: mine.filter(e => e.kind === 'buy').length, buybacks: mine.filter(e => e.kind === 'bb').length, burned, fundedSol },
      earnedSol, unfundedSol: Math.max(0, earnedSol - fundedSol), mnav: mcap && tUsd > 0 ? mcap / tUsd : null, supply }; });
  const totals = { coins: list.length, treasuryUsd: list.reduce((s, c) => s + (c.treasury.usd || 0), 0), earnedSol: list.reduce((s, c) => s + c.earnedSol, 0), fundedSol: list.reduce((s, c) => s + c.treasury.fundedSol, 0), burned: list.reduce((s, c) => s + c.treasury.burned, 0), entries: L.entries.length,
    byAsset: Object.fromEntries(ASSETS.map(a => [a.code, list.filter(c => c.asset === a.code).reduce((s, c) => s + c.treasury.amount, 0)])), solUsd };
  const v = { open: true, pad: PIN.pad, treasury: L.treasury || null, feePct: P.feePct ?? 1, coins: list, totals }; coinCache = { t: Date.now(), v }; return v;
}
// proof of reserves: the treasury wallet's real balances against the sum of every coin's ledger
async function reserves() { const c = await coins(); if (!c.open || !c.treasury) return { open: c.open, rows: [] };
  const w = new PublicKey(c.treasury), M = await market();
  const accs = await conn.getParsedTokenAccountsByOwner(w, { programId: SPL.TOKEN_PROGRAM_ID }); const held = {}; for (const x of accs.value) { const i = x.account.data.parsed.info; held[i.mint] = (held[i.mint] || 0n) + BigInt(i.tokenAmount.amount); }
  return { open: true, wallet: c.treasury, rows: ASSETS.map(a => { const owed = c.coins.filter(x => x.asset === a.code).reduce((s, x) => s + BigInt(x.treasury.raw), 0n), has = held[a.mint] || 0n, p = M.assets.find(x => x.code === a.code);
    return { code: a.code, symbol: a.symbol, mint: a.mint, ledger: Number(owed) / 10 ** a.decimals, wallet: Number(has) / 10 ** a.decimals, covered: has >= owed, usd: p && p.price ? Number(has) / 10 ** a.decimals * p.price.usd : null }; }) }; }

async function claim(req) {
  const b = await body(req); const wallet = pk(b.wallet, 'connect a wallet first'), id = padIdOf(wallet);
  if (!(await conn.getAccountInfo(id))) throw new Error('this wallet has no launchpad');
  const raydium = await sdk(wallet);
  const made = await raydium.launchpad.claimVaultPlatformFee({ programId: PROGRAM, platformId: id, mintB: WSOL, claimFeeWallet: wallet, txVersion: R.TxVersion.LEGACY, feePayer: wallet });
  return finish(txsOf(made), wallet, [], null, !!b.simulate);
}

// ---------------------------------------------------------------- treasury operations: a Jupiter swap + the ledger memo, in one transaction
const toIx = i => new TransactionInstruction({ programId: new PublicKey(i.programId), keys: i.accounts.map(a => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })), data: Buffer.from(i.data, 'base64') });
async function jupTx(w, inMint, outMint, amount, memo, extra = () => [], slip = 150) {
  for (const maxAcc of [40, 30, 22]) {
    const q = await getJ(`${JUP}/swap/v1/quote?inputMint=${inMint}&outputMint=${outMint}&amount=${amount}&slippageBps=${slip}&maxAccounts=${maxAcc}`, 10000); if (!q.outAmount) throw new Error(q.error || 'no route right now');
    const r = await fetch(`${JUP}/swap/v1/swap-instructions`, { method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteResponse: q, userPublicKey: w.toBase58(), wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 300000, priorityLevel: 'high' } } }) });
    const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || 'Jupiter returned no swap');
    const altMap = j.addressesByLookupTableAddress || null; let alts;
    if (altMap) alts = Object.entries(altMap).map(([k, a]) => new AddressLookupTableAccount({ key: new PublicKey(k), state: { deactivationSlot: BigInt('18446744073709551615'), lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, authority: undefined, addresses: a.map(x => new PublicKey(x)) } }));
    else alts = (await Promise.all((j.addressLookupTableAddresses || []).map(k => conn.getAddressLookupTable(new PublicKey(k))))).map(x => x.value).filter(Boolean);
    const cu = ComputeBudgetProgram.setComputeUnitLimit({ units: Math.min(1400000, (+j.computeUnitLimit || 300000) + 90000) }); // room for the memo, the tag and a burn
    const ixs = [cu, ...(j.computeBudgetInstructions || []).filter(i => Buffer.from(i.data, 'base64')[0] !== 2).map(toIx), ...(j.setupInstructions || []).map(toIx), toIx(j.swapInstruction), ...(j.cleanupInstruction ? [toIx(j.cleanupInstruction)] : []), ...(j.otherInstructions || []).map(toIx), ...extra(q), memoIx(w, memo), tagTo(w, LTAG)];
    const { blockhash } = await conn.getLatestBlockhash('confirmed');
    const tx = new VersionedTransaction(new TransactionMessage({ payerKey: w, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message(alts));
    let bytes; try { bytes = tx.serialize(); } catch { continue; } if (bytes.length > 1232) continue;
    return { tx: Buffer.from(bytes).toString('base64'), quote: { in: q.inAmount, out: q.outAmount, min: q.otherAmountThreshold, impact: +q.priceImpactPct, route: (q.routePlan || []).map(x => x.swapInfo.label) } };
  }
  throw new Error('the route is too big for one transaction right now. try a different amount');
}
async function treasuryWallet(w) { if (!PIN.pad) throw new Error('the mNAV launchpad is not open yet'); const p = await padInfo(PIN.pad); if (!p.exists) throw new Error('launchpad not found'); if (p.claimWallet !== w.toBase58()) throw new Error('only the treasury wallet (the one that created the launchpad) can run treasury operations'); return p; }
// fund a coin's treasury: spend SOL on its treasury asset
async function buildBuy(req) { const b = await body(req), w = pk(b.wallet, 'connect the treasury wallet'); await treasuryWallet(w);
  const c = (await coins(true)).coins.find(x => x.mint === String(b.coin)); if (!c) throw new Error('pick a coin on the mNAV launchpad'); const a = ACODE[c.asset]; if (!a) throw new Error('this coin has no treasury asset in its metadata');
  const lamports = Math.floor(+b.sol * 1e9); if (!(lamports >= 1e6)) throw new Error('spend at least 0.001 SOL');
  const r = await jupTx(w, WSOL.toBase58(), a.mint, lamports, `mnav:buy:${c.mint}:${lamports}`);
  return { txs: [r.tx], versioned: true, quote: r.quote, asset: a.code }; }
// buy back and burn: only while the coin trades below its treasury (mNAV under 1x)
async function buildBuyback(req) { const b = await body(req), w = pk(b.wallet, 'connect the treasury wallet'); await treasuryWallet(w);
  const c = (await coins(true)).coins.find(x => x.mint === String(b.coin)); if (!c) throw new Error('pick a coin on the mNAV launchpad'); const a = ACODE[c.asset]; if (!a) throw new Error('this coin has no treasury asset');
  if (!(c.mnav != null && c.mnav < 1)) throw new Error(`$${c.symbol} trades at ${c.mnav ? c.mnav.toFixed(2) + 'x' : 'no'} mNAV. the rule only buys back under 1x`);
  const share = Math.max(1, Math.min(100, +b.pct || 25)), raw = BigInt(c.treasury.raw) * BigInt(Math.round(share * 100)) / 10000n; if (raw <= 0n) throw new Error('this treasury is empty');
  const mint = new PublicKey(c.mint), macc = await conn.getAccountInfo(mint), prog = macc.owner, ata = SPL.getAssociatedTokenAddressSync(mint, w, false, prog);
  const r = await jupTx(w, a.mint, c.mint, raw.toString(), `mnav:bb:${c.mint}`, q => [SPL.createBurnInstruction(ata, mint, w, BigInt(q.otherAmountThreshold), [], prog)]);
  return { txs: [r.tx], versioned: true, quote: r.quote, sold: Number(raw) / 10 ** a.decimals, asset: a.code }; }

// ---------------------------------------------------------------- wallets and profiles
async function walletView(addr) { const w = pk(addr, 'bad wallet');
  const [bal, a1, a2] = await Promise.all([conn.getBalance(w), conn.getParsedTokenAccountsByOwner(w, { programId: SPL.TOKEN_PROGRAM_ID }), conn.getParsedTokenAccountsByOwner(w, { programId: SPL.TOKEN_2022_PROGRAM_ID })]);
  const held = {}; for (const x of [...a1.value, ...a2.value]) { const i = x.account.data.parsed.info, ui = +i.tokenAmount.uiAmount || 0; if (!ui) continue; held[i.mint] = (held[i.mint] || 0) + ui; }
  const mints = Object.keys(held), info = await jupInfo([WSOL.toBase58(), ...mints]), solUsd = (info[WSOL.toBase58()] || {}).usd ?? null;
  const tokens = mints.map(m => { const t = info[m] || {}; return { mint: m, amount: held[m], symbol: t.symbol || m.slice(0, 4), name: t.name || '', icon: t.icon || null, usd: t.usd != null ? t.usd * held[m] : null, treasury: !!AMINT[m] }; }).sort((x, y) => (y.usd || 0) - (x.usd || 0));
  const sol = bal / 1e9; return { wallet: w.toBase58(), sol, solUsd, solValue: solUsd != null ? sol * solUsd : null, tokens, totalUsd: (solUsd != null ? sol * solUsd : 0) + tokens.reduce((a, t) => a + (t.usd || 0), 0) }; }
let profCache = null;
async function profiles() { if (profCache && Date.now() - profCache.t < 30000) return profCache.v;
  const sigs = await conn.getSignaturesForAddress(PTAG, { limit: 500 }); const ok = sigs.filter(x => !x.err), map = {};
  for (let i = 0; i < ok.length; i += 50) { const txs = await conn.getParsedTransactions(ok.slice(i, i + 50).map(x => x.signature), { maxSupportedTransactionVersion: 0 }).catch(() => []);
    txs.forEach((t, k) => { if (!t || (t.meta && t.meta.err)) return; const sig = ok[i + k].signature, who = (t.transaction.message.accountKeys[0].pubkey || t.transaction.message.accountKeys[0]).toString(), time = t.blockTime;
      for (const ix of t.transaction.message.instructions) { if (ix.program !== 'spl-memo' || typeof ix.parsed !== 'string' || !ix.parsed.startsWith('mnav:profile:')) continue; if (map[who] && map[who].time >= time) continue;
        try { const j = JSON.parse(ix.parsed.slice(13)); map[who] = { wallet: who, name: clean(j.n, 24), bio: clean(j.b, 140), avatar: /^https:\/\//.test(j.a || '') ? clean(j.a, 160) : '', x: clean(j.x, 16).replace(/[^A-Za-z0-9_]/g, ''), time, sig }; } catch { } } }); }
  profCache = { t: Date.now(), v: map }; return map; }
async function buildProfile(req) { const b = await body(req), w = pk(b.wallet, 'connect a wallet first');
  const j = { n: clean(b.name, 24), b: clean(b.bio, 140), a: /^https:\/\/[^\s"'<>]{6,160}$/.test(b.avatar || '') ? b.avatar : '', x: clean(b.x, 16).replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '') };
  if (j.n.length < 2) throw new Error('pick a name, at least 2 characters');
  const t = new Transaction().add(memoIx(w, 'mnav:profile:' + JSON.stringify(j)), tagTo(w, PTAG));
  const { blockhash } = await conn.getLatestBlockhash('confirmed'); t.recentBlockhash = blockhash; t.feePayer = w; profCache = null;
  return { txs: [ser(t)] }; }
async function holdersOf(mintStr) { const mint = pk(mintStr, 'bad mint'), acc = await conn.getAccountInfo(mint); if (!acc) throw new Error('mint not found'); const prog = acc.owner;
  let rows = [], full = true;
  try { const r = await Promise.race([conn.getParsedProgramAccounts(prog, { filters: [...(prog.equals(SPL.TOKEN_PROGRAM_ID) ? [{ dataSize: 165 }] : []), { memcmp: { offset: 0, bytes: mint.toBase58() } }] }), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 9000))]);
    rows = r.map(x => ({ owner: x.account.data.parsed.info.owner, raw: BigInt(x.account.data.parsed.info.tokenAmount.amount) })); }
  catch (e) { full = false; const top = await conn.getTokenLargestAccounts(mint); const infos = await conn.getMultipleParsedAccounts(top.value.map(x => x.address)); rows = infos.value.map((x, i) => x ? { owner: x.data.parsed.info.owner, raw: BigInt(top.value[i].amount) } : null).filter(Boolean); }
  const by = {}; for (const r of rows) { if (r.raw <= 0n) continue; let on = false; try { on = PublicKey.isOnCurve(new PublicKey(r.owner).toBytes()); } catch { } if (!on) continue; by[r.owner] = (by[r.owner] || 0n) + r.raw; }
  const list = Object.entries(by).map(([owner, raw]) => ({ owner, raw })).sort((a, b) => (b.raw > a.raw ? 1 : -1)); return { full, list }; }
async function sendTxs(req) {
  const b = await body(req); if (!Array.isArray(b.txs) || !b.txs.length || b.txs.length > 6) throw new Error('nothing to send');
  const sigs = [];
  for (const t of b.txs) { const sig = await conn.sendRawTransaction(Buffer.from(t, 'base64'), { skipPreflight: false, maxRetries: 3 }); sigs.push(sig);
    for (let k = 0; k < 30; k++) { const s = (await conn.getSignatureStatuses([sig])).value[0]; if (s && s.err) throw new Error('transaction failed: ' + JSON.stringify(s.err)); if (s && /confirmed|finalized/.test(s.confirmationStatus || '')) break; await new Promise(r => setTimeout(r, 800)); } }
  ledgerCache = null; coinCache = null; profCache = null; return { sigs };
}

module.exports = async (req, res) => { if (req.method === 'GET') res.setHeader('access-control-allow-origin', '*');
  const q = new URL(req.url, 'http://x').searchParams, a = q.get('a');
  try {
    if (a === 'market') return out(res, 200, await market(), 's-maxage=30, stale-while-revalidate=90');
    if (a === 'coins') return out(res, 200, await coins(), 's-maxage=15, stale-while-revalidate=60');
    if (a === 'coin') { const c = await coins(), m = String(q.get('mint') || ''), L = await ledger().catch(() => ({ entries: [] })); return out(res, 200, { coin: c.coins.find(x => x.mint === m) || null, open: c.open, entries: L.entries.filter(e => e.coin === m) }, 's-maxage=15'); }
    if (a === 'ledger') { const L = await ledger(); return out(res, 200, { treasury: L.treasury, entries: L.entries.slice(0, 200) }, 's-maxage=15'); }
    if (a === 'reserves') return out(res, 200, await reserves(), 's-maxage=30');
    if (a === 't') return out(res, 200, tokenMeta(req, q), 'public, max-age=31536000, immutable');
    if (a === 'wallet') return out(res, 200, await walletView(q.get('addr')));
    if (a === 'profiles') { const v = await profiles(); return out(res, 200, { profiles: Object.values(v).sort((x, y) => y.time - x.time) }, 's-maxage=20'); }
    if (a === 'profile') { const v = await profiles(); return out(res, 200, { profile: v[pk(q.get('wallet'), 'bad wallet').toBase58()] || null }); }
    if (a === 'holders') { const h = await holdersOf(q.get('mint')); return out(res, 200, { full: h.full, count: h.list.length }, 's-maxage=60'); }
    if (a === 'bal') { const w = pk(q.get('wallet'), 'bad wallet'), m = pk(q.get('mint'), 'bad mint'); const r = await conn.getParsedTokenAccountsByOwner(w, { mint: m }); return out(res, 200, { accounts: r.value.map(x => ({ address: x.pubkey.toBase58(), raw: x.account.data.parsed.info.tokenAmount.amount, decimals: x.account.data.parsed.info.tokenAmount.decimals })) }); }
    if (a === 'pad') return out(res, 200, await pad(q), 's-maxage=10');
    // a dry run of the treasury-buy builder: builds the same transaction for any wallet and simulates it (nothing is signed or sent)
    if (a === 'simBuy') { const w = pk(q.get('wallet'), 'bad wallet'), as = ACODE[String(q.get('asset') || 'BTC').toUpperCase()]; if (!as) throw new Error('bad asset'); const r = await jupTx(w, WSOL.toBase58(), as.mint, Math.floor(Math.min(1, +q.get('sol') || .01) * 1e9), 'mnav:buy:' + as.mint + ':' + Math.floor(Math.min(1, +q.get('sol') || .01) * 1e9));
      const raw = Buffer.from(r.tx, 'base64'), s = await conn.simulateTransaction(VersionedTransaction.deserialize(raw), { sigVerify: false, replaceRecentBlockhash: true }); return out(res, 200, { bytes: raw.length, quote: r.quote, err: s.value.err, units: s.value.unitsConsumed, logs: (s.value.logs || []).filter(l => /Memo|rror|ail/.test(l)).slice(-6) }); }
    if (req.method === 'POST' && a === 'buildPad') return out(res, 200, await buildPad(req));
    if (req.method === 'POST' && a === 'buildLaunch') return out(res, 200, await buildLaunch(req));
    if (req.method === 'POST' && a === 'buildProfile') return out(res, 200, await buildProfile(req));
    if (req.method === 'POST' && a === 'claim') return out(res, 200, await claim(req));
    if (req.method === 'POST' && a === 'buildBuy') return out(res, 200, await buildBuy(req));
    if (req.method === 'POST' && a === 'buildBuyback') return out(res, 200, await buildBuyback(req));
    if (req.method === 'POST' && a === 'send') return out(res, 200, await sendTxs(req));
    return out(res, 404, { error: 'unknown action' });
  } catch (e) { return out(res, 400, { error: e.message || String(e) }); }
};
module.exports._t = { market, coins, ledger, buildPad, buildLaunch, buildBuy, buildBuyback, claim, conn, PIN, setChain: v => { chainCache = { t: Date.now() + 1e9, v }; } };
