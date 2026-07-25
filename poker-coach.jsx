import React, { useRef, useReducer, useEffect, useState } from "react";

/* ============================ CARD ENGINE ============================ */
const SUITS = ["s", "h", "d", "c"];
const RS = { 2:"2",3:"3",4:"4",5:"5",6:"6",7:"7",8:"8",9:"9",10:"T",11:"J",12:"Q",13:"K",14:"A" };
const GLYPH = { s: "\u2660", h: "\u2665", d: "\u2666", c: "\u2663" };
const cardStr = (c) => RS[c.r] + c.s;
const cardsStr = (a) => a.map(cardStr).join(" ") || "\u2014";

function makeDeck() { const d = []; for (let r = 2; r <= 14; r++) for (const s of SUITS) d.push({ r, s }); return d; }
function shuffle(d) { const a = d.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function score5(cs) {
  const rs = cs.map((c) => c.r).sort((a, b) => b - a);
  const flush = cs.every((c) => c.s === cs[0].s);
  const uniq = [...new Set(rs)];
  let sh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) sh = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) sh = 5;
  }
  const counts = {}; rs.forEach((r) => (counts[r] = (counts[r] || 0) + 1));
  const groups = Object.entries(counts).map(([r, n]) => ({ r: +r, n })).sort((a, b) => b.n - a.n || b.r - a.r);
  const kick = groups.map((g) => g.r);
  if (sh && flush) return [8, sh];
  if (groups[0].n === 4) return [7, ...kick];
  if (groups[0].n === 3 && groups[1] && groups[1].n === 2) return [6, ...kick];
  if (flush) return [5, ...rs];
  if (sh) return [4, sh];
  if (groups[0].n === 3) return [3, ...kick];
  if (groups[0].n === 2 && groups[1].n === 2) return [2, ...kick];
  if (groups[0].n === 2) return [1, ...kick];
  return [0, ...rs];
}
const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] || 0, y = b[i] || 0; if (x !== y) return x - y; } return 0; };
const C5 = (() => { const o = []; for (let a=0;a<7;a++) for (let b=a+1;b<7;b++) for (let c=b+1;c<7;c++) for (let d=c+1;d<7;d++) for (let e=d+1;e<7;e++) o.push([a,b,c,d,e]); return o; })();
function best(cards) {
  if (cards.length < 5) return [0];
  if (cards.length === 5) return score5(cards);
  if (cards.length === 7) { let bs = null; for (const ix of C5) { const s = score5(ix.map((i) => cards[i])); if (!bs || cmp(s, bs) > 0) bs = s; } return bs; }
  let bs = null;
  for (let i = 0; i < cards.length; i++) { const s = best(cards.filter((_, j) => j !== i)); if (!bs || cmp(s, bs) > 0) bs = s; }
  return bs;
}
const CAT = ["High card","Pair","Two pair","Three of a kind","Straight","Flush","Full house","Four of a kind","Straight flush"];
const handName = (sc) => (sc[0] === 8 && sc[1] === 14 ? "Royal flush" : CAT[sc[0]]);

function equity(hole, board, nOpp, iters = 220) {
  if (nOpp <= 0) return 1;
  const dead = new Set([...hole, ...board].map(cardStr));
  const rest = makeDeck().filter((c) => !dead.has(cardStr(c)));
  let win = 0, tie = 0;
  const need = 5 - board.length + nOpp * 2;
  for (let it = 0; it < iters; it++) {
    const pool = rest.slice();
    for (let i = 0; i < need; i++) { const j = i + Math.floor(Math.random() * (pool.length - i)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    let k = 5 - board.length;
    const b = board.concat(pool.slice(0, k));
    const me = best(hole.concat(b));
    let bo = null;
    for (let o = 0; o < nOpp; o++) { const s = best([pool[k++], pool[k++]].concat(b)); if (!bo || cmp(s, bo) > 0) bo = s; }
    const c = cmp(me, bo);
    if (c > 0) win++; else if (c === 0) tie++;
  }
  return (win + tie / 2) / iters;
}

function settle(list) {
  const levels = [...new Set(list.filter((p) => p.contrib > 0).map((p) => p.contrib))].sort((a, b) => a - b);
  let prev = 0; const awards = {};
  for (const L of levels) {
    let amt = 0;
    for (const p of list) amt += Math.max(0, Math.min(p.contrib, L) - Math.min(p.contrib, prev));
    const elig = list.filter((p) => !p.folded && p.contrib >= L);
    if (!elig.length) { prev = L; continue; }
    let bs = null; for (const p of elig) if (!bs || cmp(p.score, bs) > 0) bs = p.score;
    const w = elig.filter((p) => cmp(p.score, bs) === 0);
    const share = Math.floor(amt / w.length), rem = amt - share * w.length;
    w.forEach((x, i) => { awards[x.i] = (awards[x.i] || 0) + share + (i < rem ? 1 : 0); });
    prev = L;
  }
  return awards;
}

/* ============================ TABLE ============================ */
const SB = 5, BB = 10, START = 500;
const BOTS = [
  { name: "Bishop", tag: "The Rock", tight: "12/9",
    style: "an old-school tight rock. You fold the vast majority of your starting hands and only enter pots with genuinely strong holdings. You do not bluff — when you put chips in, you have it. You lay down one-pair hands facing heavy river aggression, and you size your value bets large because you know you get paid by curious players." },
  { name: "Marla", tag: "The Maniac", tight: "58/44",
    style: "a loose-aggressive maniac who plays for fun and for pressure. You raise far too many hands, barrel on every street, and fire huge bluffs at any board that looks scary. You would rather make someone fold the best hand than win a showdown. You fold only when you're clearly beaten and the price is bad." },
  { name: "Otto", tag: "The Station", tight: "44/6",
    style: "a pure calling station. You call far too often and hate folding once you hold any piece of the board — bottom pair, a gutshot, ace-high, it's all a reason to look him up. You almost never bluff. You raise only with a very strong made hand, which makes your raises glaringly obvious." },
  { name: "Nash", tag: "The Solver", tight: "24/19",
    style: "a disciplined, balanced, near-GTO player. You reason explicitly in pot odds, equity and range advantage. You use small continuation bets on boards that favour your range and larger polarised sizings on later streets. You bluff at a mathematically reasonable frequency with hands that have backdoor equity, and you defend against bets just often enough that you cannot be exploited by relentless aggression." },
  { name: "Ruby", tag: "The Reader", tight: "30/24",
    style: "an exploitative player who plays the person, not the cards. You pay close attention to the human's tendencies and attack them. If they fold too much, you bluff them relentlessly. If they call too much, you stop bluffing and value bet thin and hard. If they only raise with monsters, you fold to their raises. You state your reads out loud at the table." },
];
const N = BOTS.length + 1;
const SEATS = ["You", ...BOTS.map((b) => b.name)];
const STREETS = ["Preflop", "Flop", "Turn", "River"];

function newGame() {
  return {
    players: Array.from({ length: N }, (_, i) => ({
      i, name: SEATS[i], stack: START, hole: [], folded: false, allIn: false,
      bet: 0, contrib: 0, acted: false, last: "", say: "", out: false, won: 0,
      thinking: false, shown: false, mucked: false,
    })),
    button: N - 1, hand: 0, board: [], deck: [], street: 0,
    currentBet: 0, minRaise: BB, aggressor: null, turn: null, phase: "idle",
    log: [], decisions: [], result: null, seq: 0, over: false,
  };
}
const pot = (G) => G.players.reduce((s, p) => s + p.contrib, 0);
const alive = (G) => G.players.filter((p) => !p.out);
const inHand = (G) => G.players.filter((p) => !p.folded && !p.out);
const canAct = (p) => !p.folded && !p.allIn && !p.out && p.stack > 0;
function nextIdx(G, from, test) { for (let k = 1; k <= N; k++) { const j = (from + k) % N; if (test(G.players[j])) return j; } return null; }

function startHand(G) {
  if (alive(G).length < 2) { G.over = true; G.phase = "over"; return; }
  G.hand++; G.board = []; G.street = 0; G.currentBet = 0; G.minRaise = BB; G.aggressor = null;
  G.result = null; G.decisions = []; G.log = []; G.deck = shuffle(makeDeck());
  G.button = nextIdx(G, G.button, (p) => !p.out);
  G.players.forEach((p) => { p.hole = []; p.folded = p.out; p.allIn = false; p.bet = 0; p.contrib = 0; p.acted = false; p.last = ""; p.say = ""; p.won = 0; p.shown = false; p.mucked = false; });
  const heads = alive(G).length === 2;
  const sb = heads ? G.button : nextIdx(G, G.button, (p) => !p.out);
  const bb = nextIdx(G, sb, (p) => !p.out);
  post(G, sb, SB); post(G, bb, BB);
  G.currentBet = BB;
  for (let k = 0; k < 2; k++) G.players.forEach((p) => { if (!p.out) p.hole.push(G.deck.pop()); });
  G.turn = nextIdx(G, bb, canAct);
  G.phase = "betting";
  G.log.push({ t: "street", text: `Hand ${G.hand} \u00b7 blinds ${SB}/${BB} \u00b7 ${G.players[G.button].name} has the button` });
}
function post(G, i, amt) {
  const p = G.players[i], a = Math.min(amt, p.stack);
  p.stack -= a; p.bet += a; p.contrib += a;
  if (p.stack === 0) p.allIn = true;
}
function roundDone(G) {
  const live = inHand(G);
  if (live.length <= 1) return true;
  const actors = G.players.filter(canAct);
  if (actors.length === 0) return true;
  if (actors.length === 1) {
    const a = actors[0];
    if (a.bet >= G.currentBet && (a.acted || live.every((p) => p === a || p.allIn))) return true;
  }
  return actors.every((p) => p.acted && p.bet === G.currentBet);
}

function applyAction(G, i, act) {
  const p = G.players[i];
  const toCall = Math.min(G.currentBet - p.bet, p.stack);
  p.say = act.say || "";
  if (act.action === "fold" && toCall > 0) { p.folded = true; p.last = "Fold"; }
  else if (act.action === "raise" && p.stack > 0) {
    const maxTo = p.bet + p.stack;
    let to = Math.min(Math.max(Math.round(act.amount) || 0, G.currentBet + G.minRaise), maxTo);
    if (to <= G.currentBet) to = Math.min(maxTo, G.currentBet + G.minRaise);
    const add = to - p.bet;
    p.stack -= add; p.bet = to; p.contrib += add;
    if (p.stack === 0) p.allIn = true;
    if (to >= G.currentBet + G.minRaise) { G.minRaise = to - G.currentBet; G.players.forEach((q) => { if (q !== p) q.acted = false; }); }
    p.last = (G.currentBet === 0 ? "Bet " : "Raise to ") + to + (p.allIn ? " (all in)" : "");
    G.currentBet = Math.max(G.currentBet, to);
    G.aggressor = i;
  } else if (toCall > 0) {
    p.stack -= toCall; p.bet += toCall; p.contrib += toCall;
    if (p.stack === 0) p.allIn = true;
    p.last = "Call " + toCall + (p.allIn ? " (all in)" : "");
  } else p.last = "Check";
  p.acted = true;
  G.log.push({ t: "act", who: p.name, text: p.last, say: p.say, street: G.street });
  G.seq++;
  if (roundDone(G)) advance(G); else G.turn = nextIdx(G, i, canAct);
}

function advance(G) {
  if (inHand(G).length <= 1) { finish(G, true); return; }
  G.players.forEach((p) => { p.bet = 0; p.acted = false; p.last = ""; });
  G.currentBet = 0; G.minRaise = BB;
  if (G.street === 3) { finish(G, false); return; }
  G.street++; G.aggressor = null;
  for (let k = 0; k < (G.street === 1 ? 3 : 1); k++) G.board.push(G.deck.pop());
  G.log.push({ t: "street", text: `${STREETS[G.street]} \u2014 ${cardsStr(G.board)}` });
  if (G.players.filter(canAct).length <= 1) { G.phase = "runout"; G.turn = null; G.seq++; return; }
  G.turn = nextIdx(G, G.button, canAct);
  G.phase = "betting"; G.seq++;
}

/* showdown with real table rules: first to show is the last aggressor (or first
   live seat left of the button); after that you only turn your hand over if it
   beats what is already face up. Everyone else mucks, face down. */
function finish(G, byFold) {
  const live = inHand(G);
  const scored = G.players.filter((p) => !p.out).map((p) => ({
    i: p.i, contrib: p.contrib, folded: p.folded,
    score: p.folded ? [-1] : best(p.hole.concat(G.board)),
  }));
  const awards = settle(scored);
  if (!byFold) {
    let start = G.aggressor;
    if (start === null || G.players[start].folded) start = nextIdx(G, G.button, (p) => !p.folded && !p.out);
    const order = [];
    for (let k = 0; k < N; k++) { const j = (start + k) % N; if (live.includes(G.players[j])) order.push(G.players[j]); }
    let bestShown = null;
    for (const p of order) {
      const sc = scored.find((x) => x.i === p.i).score;
      const mustShow = !bestShown || cmp(sc, bestShown) >= 0 || (awards[p.i] || 0) > 0;
      if (mustShow) { p.shown = true; if (!bestShown || cmp(sc, bestShown) > 0) bestShown = sc; }
      else p.mucked = true;
    }
  } else live.forEach((p) => { p.mucked = true; });
  const lines = [];
  Object.entries(awards).forEach(([i, amt]) => {
    const p = G.players[+i]; p.stack += amt; p.won = amt;
    const sc = scored.find((x) => x.i === +i).score;
    lines.push(`${p.name} wins ${amt}${p.shown ? " with " + handName(sc) : ""}`);
  });
  const mucked = G.players.filter((p) => p.mucked);
  if (mucked.length) lines.push(`${mucked.map((p) => p.name).join(", ")} muck${mucked.length === 1 ? "s" : ""}`);
  G.players.forEach((p) => { if (!p.out && p.stack === 0) p.out = true; });
  G.result = { lines, byFold, net: G.players[0].won - G.players[0].contrib, showdown: !byFold };
  G.log.push({ t: "result", text: lines.join(" \u00b7 ") });
  G.phase = "handover"; G.turn = null; G.seq++;
  if (alive(G).length < 2 || G.players[0].out) G.over = true;
}

/* ============================ API ============================ */
const KEY = { get: () => (typeof window !== "undefined" && window.__pokerKey ? window.__pokerKey() : "") };
async function askClaude(messages, system, maxTokens = 300) {
  const headers = { "Content-Type": "application/json" };
  const k = KEY.get();
  if (k) { headers["x-api-key"] = k; headers["anthropic-version"] = "2023-06-01"; headers["anthropic-dangerous-direct-browser-access"] = "true"; }
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers,
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages }),
  });
  if (!r.ok) throw new Error("http " + r.status);
  const d = await r.json();
  return (d.content || []).map((b) => (b.type === "text" ? b.text : "")).join("");
}
function parseJSON(txt) {
  const s = txt.indexOf("{"), e = txt.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("no json");
  return JSON.parse(txt.slice(s, e + 1));
}

/* ============================ OPPONENTS ============================ */
/* Opponents are only ever told their OWN two cards, the community cards and the
   public betting action. The human's hole cards are never in an opponent prompt. */
function heuristic(G, i, eq, stats) {
  const p = G.players[i];
  const toCall = Math.min(G.currentBet - p.bet, p.stack);
  const P = pot(G);
  const odds = toCall > 0 ? toCall / (P + toCall) : 0;
  const e = eq + (Math.random() - 0.5) * 0.08;
  const to = (f) => Math.round(G.currentBet + f * (P + toCall));
  switch (i) {
    case 1: // rock
      if (toCall === 0) return e > 0.64 ? { action: "raise", amount: to(0.75) } : { action: "check" };
      if (e > 0.8) return { action: "raise", amount: to(0.9) };
      return e > odds + 0.14 ? { action: "call" } : { action: "fold" };
    case 2: // maniac
      if (toCall === 0) return Math.random() < 0.6 || e > 0.5 ? { action: "raise", amount: to(0.85) } : { action: "check" };
      if (e > 0.68 || (Math.random() < 0.2 && e < 0.3)) return { action: "raise", amount: to(1.1) };
      return e > odds - 0.06 ? { action: "call" } : { action: "fold" };
    case 3: // station
      if (toCall === 0) return e > 0.82 ? { action: "raise", amount: to(0.5) } : { action: "check" };
      if (e > 0.88) return { action: "raise", amount: to(0.6) };
      return e > odds - 0.12 ? { action: "call" } : { action: "fold" };
    case 4: { // solver
      const bluff = Math.random() < 0.28 && e < 0.28;
      if (toCall === 0) return e > 0.56 || bluff ? { action: "raise", amount: to(e > 0.72 ? 0.72 : 0.4) } : { action: "check" };
      if (e > 0.74) return { action: "raise", amount: to(0.7) };
      return e > odds + 0.01 ? { action: "call" } : { action: "fold" };
    }
    default: { // reader
      const foldy = stats && stats.decisions > 8 ? stats.foldRate : 0.35;
      const bluff = Math.random() < (foldy > 0.45 ? 0.4 : 0.12) && e < 0.3;
      if (toCall === 0) return e > (foldy > 0.45 ? 0.44 : 0.6) || bluff ? { action: "raise", amount: to(foldy > 0.45 ? 0.9 : 0.6) } : { action: "check" };
      if (e > 0.7) return { action: "raise", amount: to(0.8) };
      return e > odds + 0.03 ? { action: "call" } : { action: "fold" };
    }
  }
}

function blurb(G, i, eq, stats) {
  const p = G.players[i];
  const toCall = Math.min(G.currentBet - p.bet, p.stack);
  const others = G.players.filter((q) => q.i !== i && !q.out)
    .map((q) => `${q.name}: stack ${q.stack}, in this pot for ${q.contrib}${q.folded ? " (FOLDED)" : ""}${q.last ? `, just: ${q.last}` : ""}`).join("\n");
  const hist = G.log.filter((l) => l.t === "act" && l.street === G.street).map((l) => `${l.who} ${l.text}`).join("; ") || "no action yet";
  const read = i === 5 && stats && stats.decisions > 5
    ? `\nYour read on the human so far: they have voluntarily entered ${Math.round(stats.vpip * 100)}% of pots, they fold to bets ${Math.round(stats.foldRate * 100)}% of the time, and they raise on ${Math.round(stats.aggRate * 100)}% of their decisions. Exploit that.`
    : "";
  return `Street: ${STREETS[G.street]}
Your hole cards: ${cardsStr(p.hole)}
Community cards: ${cardsStr(G.board)}
Your all-in equity against ${inHand(G).length - 1} live opponent(s): ${(eq * 100).toFixed(0)}%
Pot: ${pot(G)}
Amount to call: ${toCall}
Your stack: ${p.stack}
Minimum legal raise-to: ${Math.min(G.currentBet + G.minRaise, p.bet + p.stack)}
Maximum raise-to (all in): ${p.bet + p.stack}
Other players:\n${others}
Betting this street: ${hist}${read}`;
}

async function decide(G, i, useAI, stats) {
  const p = G.players[i];
  const eq = equity(p.hole, G.board, Math.max(1, inHand(G).length - 1), 200);
  const fb = heuristic(G, i, eq, stats);
  if (!useAI) return fb;
  const bot = BOTS[i - 1];
  const system = `You are ${bot.name}, ${bot.style} You are playing 6-handed No-Limit Texas Hold'em for real stakes and you are trying to win chips. Stay in character.
You can only see your own two cards, the community cards and the public betting. You have no idea what anyone else holds.
Reply with ONLY a JSON object, no markdown fences, no explanation:
{"action":"fold"|"check"|"call"|"raise","amount":<number: the TOTAL your bet for this street should reach, required only for raise>,"say":"<at most 8 words of table talk, or an empty string>"}
"check" is legal only when the amount to call is 0. Folding when the amount to call is 0 is never correct.`;
  try {
    const txt = await Promise.race([
      askClaude([{ role: "user", content: blurb(G, i, eq, stats) }], system, 180),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000)),
    ]);
    const j = parseJSON(txt);
    const toCall = Math.min(G.currentBet - p.bet, p.stack);
    let a = String(j.action || "").toLowerCase();
    if (!["fold", "check", "call", "raise"].includes(a)) return fb;
    if (a === "check" && toCall > 0) a = "call";
    if ((a === "fold" || a === "call") && toCall === 0) a = "check";
    return { action: a, amount: Number(j.amount) || 0, say: typeof j.say === "string" ? j.say.slice(0, 46) : "" };
  } catch (e) { return fb; }
}

/* ============================ COACH ============================ */
function localReview(ds) {
  const notes = ds.map((d) => {
    const eqp = Math.round(d.eq * 100), op = Math.round(d.odds * 100);
    let verdict = "ok", better = "";
    if (d.action === "fold") {
      if (d.eq > d.odds + 0.1) { verdict = "mistake"; better = `Calling ${d.toCall} into ${d.pot} needed ${op}% and you held about ${eqp}%. That fold gives away money.`; }
      else better = `Clean release \u2014 you needed ${op}% to continue and held about ${eqp}%.`;
    } else if (d.action === "call") {
      if (d.eq < d.odds - 0.04) { verdict = "mistake"; better = `You paid ${d.toCall} into ${d.pot}, so you needed ${op}% to break even and held about ${eqp}%. Fold.`; }
      else if (d.eq > 0.72) { verdict = "thin"; better = `About ${eqp}% equity at a price of only ${op}%. Raising here builds the pot while you are the favourite.`; }
      else better = `Priced in: ${op}% needed, about ${eqp}% held.`;
    } else if (d.action === "raise") {
      if (d.eq < 0.35) { verdict = "bluff"; better = `A bluff with about ${eqp}% equity. Fine if their range folds often \u2014 make sure that is a read and not impatience.`; }
      else if (d.eq > 0.65) { verdict = "good"; better = `Good aggression with about ${eqp}% equity.`; }
      else { verdict = "thin"; better = `About ${eqp}% is a thin value raise. It plays badly against a re-raise.`; }
    } else {
      if (d.eq > 0.72 && d.opp > 0) { verdict = "thin"; better = `Checking with about ${eqp}% equity leaves value behind. Bet here.`; }
      else better = `Reasonable check with about ${eqp}% equity.`;
    }
    return { street: d.street, played: d.label, verdict, better };
  });
  const bad = notes.filter((n) => n.verdict === "mistake").length;
  const thin = notes.filter((n) => n.verdict === "thin").length;
  return {
    score: Math.max(20, Math.min(97, 88 - bad * 22 - thin * 9)),
    headline: bad ? "Money left on the table this hand." : "Solid, disciplined hand.",
    notes, leak: bad ? "Check the price before you call." : "Keep pressing when you hold the equity edge.",
  };
}

async function coachHand(G, ds, useAI) {
  const fallback = localReview(ds);
  if (!useAI || !ds.length) return fallback;
  const transcript = ds.map((d, n) =>
    `${n + 1}. ${d.street} | your cards ${d.hole} | board ${d.board} | pot ${d.pot} | to call ${d.toCall} | pot odds ${(d.odds * 100).toFixed(0)}% | your all-in equity ${(d.eq * 100).toFixed(0)}% | live opponents ${d.opp} | YOU: ${d.label}`
  ).join("\n");
  const shown = G.players.filter((p) => !p.out && (p.shown || p.i === 0)).map((p) => `${p.name}: ${cardsStr(p.hole)}`).join(" | ");
  const system = `You are a sharp, warm poker coach reviewing one hand of 6-handed No-Limit Hold'em for a student. Be concrete about chips, prices and ranges \u2014 never vague, never generic. Reply with ONLY this JSON, no fences:
{"score": <0-100 integer for how well they played THIS hand>, "headline": "<one sentence verdict, max 18 words>", "notes": [{"street":"Preflop|Flop|Turn|River","played":"<what they did>","verdict":"good|ok|thin|mistake|bluff","better":"<max 40 words: the better line and why, in chips and odds>"}], "leak": "<one sentence: the single habit to fix next hand, max 20 words>"}
Judge each decision on the information available at the time, not on the result. A correct call that lost is still correct, and a lucky win is still a mistake.`;
  const user = `Blinds ${SB}/${BB}, six-handed. Opponents at the table: ${BOTS.map((b) => `${b.name} (${b.tag})`).join(", ")}.
Student's stack at the start of the hand: ${G.players[0].contrib + G.players[0].stack}.
Their decisions:
${transcript}

Final board: ${cardsStr(G.board)}
Hands seen: ${shown}
Result: ${G.result.lines.join("; ")}
Student's net for the hand: ${G.result.net >= 0 ? "+" : ""}${G.result.net}`;
  try {
    const j = parseJSON(await askClaude([{ role: "user", content: user }], system, 900));
    if (typeof j.score !== "number" || !Array.isArray(j.notes)) return fallback;
    return j;
  } catch (e) { return fallback; }
}

/* ============================ STYLE ============================ */
const T = { ink:"#171310", ink2:"#221C18", felt:"#3E1B25", felt2:"#552836", bone:"#EFE7D9",
  bone2:"#C9BFAE", brass:"#C79A3C", ice:"#7FD1DE", red:"#B24A3C", sage:"#8FA76B", line:"#3A322C" };
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const SERIF = "'Iowan Old Style', Georgia, 'Times New Roman', serif";
const label = { fontFamily: SANS, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: T.bone2 };

function Card({ c, hidden, mucked, small }) {
  const w = small ? 30 : 44, h = small ? 42 : 62;
  if (!c) return <div style={{ width: w, height: h, borderRadius: 5, border: `1px dashed ${T.line}` }} />;
  if (hidden)
    return <div style={{ width: w, height: h, borderRadius: 5, opacity: mucked ? 0.45 : 1,
      background: `repeating-linear-gradient(45deg, ${T.felt2}, ${T.felt2} 4px, ${T.felt} 4px, ${T.felt} 8px)`,
      border: `1px solid ${T.brass}55` }} />;
  const red = c.s === "h" || c.s === "d";
  return (
    <div style={{ width: w, height: h, borderRadius: 5, background: T.bone, color: red ? T.red : T.ink,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 6px rgba(0,0,0,.45)", fontFamily: MONO }}>
      <div style={{ fontSize: small ? 15 : 20, fontWeight: 700, lineHeight: 1 }}>{RS[c.r]}</div>
      <div style={{ fontSize: small ? 12 : 16, lineHeight: 1.1 }}>{GLYPH[c.s]}</div>
    </div>
  );
}

function Seat({ p, bot, isTurn, isButton, showHole }) {
  const dim = p.folded || p.out;
  return (
    <div style={{ opacity: dim ? 0.4 : 1, border: `1px solid ${isTurn ? T.brass : T.line}`,
      background: isTurn ? "#2A2119" : T.ink2, borderRadius: 8, padding: "7px 9px", width: 148 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: T.bone }}>
          {p.name}{isButton ? <span style={{ color: T.brass, fontSize: 9 }}> {"\u2B24"}</span> : null}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: p.out ? T.red : T.brass }}>{p.out ? "OUT" : p.stack}</span>
      </div>
      {bot && <div style={{ ...label, fontSize: 8.5, marginTop: 1 }}>{bot.tag} {"\u00b7"} {bot.tight}</div>}
      <div style={{ display: "flex", gap: 3, marginTop: 5, alignItems: "center" }}>
        <Card c={p.hole[0]} hidden={!showHole} mucked={p.mucked} small />
        <Card c={p.hole[1]} hidden={!showHole} mucked={p.mucked} small />
        <div style={{ marginLeft: 3, flex: 1, minWidth: 0 }}>
          {p.bet > 0 && <div style={{ fontFamily: MONO, fontSize: 11, color: T.ice }}>{p.bet}</div>}
          {p.last && <div style={{ fontFamily: SANS, fontSize: 9.5, color: T.bone2 }}>{p.last}</div>}
          {p.mucked && <div style={{ fontFamily: SANS, fontSize: 9.5, color: T.bone2 }}>mucked</div>}
          {p.thinking && <div style={{ fontFamily: SANS, fontSize: 9.5, color: T.brass }}>thinking{"\u2026"}</div>}
        </div>
      </div>
      {p.say ? <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 11, color: T.bone2, marginTop: 4 }}>{"\u201C"}{p.say}{"\u201D"}</div> : null}
    </div>
  );
}
const VCOLOR = { good: T.sage, ok: T.bone2, thin: T.brass, bluff: T.ice, mistake: T.red };

/* ============================ APP ============================ */
export default function PokerCoach({ standalone = false }) {
  const G = useRef(newGame()).current;
  const [, force] = useReducer((x) => x + 1, 0);
  const busy = useRef(false);
  const [useAI, setUseAI] = useState(true);
  const [showEq, setShowEq] = useState(false);
  const [raiseTo, setRaiseTo] = useState(0);
  const [review, setReview] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [history, setHistory] = useState([]);
  const stats = useRef({ decisions: 0, folds: 0, raises: 0, pots: 0, voluntary: 0 }).current;

  const me = G.players[0];
  const toCall = Math.min(G.currentBet - me.bet, me.stack);
  const myTurn = G.phase === "betting" && G.turn === 0;
  const P = pot(G);
  const minTo = Math.min(G.currentBet + G.minRaise, me.bet + me.stack);
  const maxTo = me.bet + me.stack;
  const myEq = React.useMemo(() => (myTurn ? equity(me.hole, G.board, Math.max(1, inHand(G).length - 1), 300) : 0), [G.seq, myTurn]);
  const derived = {
    decisions: stats.decisions,
    foldRate: stats.decisions ? stats.folds / stats.decisions : 0,
    aggRate: stats.decisions ? stats.raises / stats.decisions : 0,
    vpip: stats.pots ? stats.voluntary / stats.pots : 0,
  };

  useEffect(() => { if (myTurn) setRaiseTo(Math.min(maxTo, Math.max(minTo, Math.round(G.currentBet + 0.7 * (P + toCall))))); }, [G.seq, myTurn]);

  useEffect(() => {
    if (G.phase !== "betting" || G.turn === null || G.turn === 0 || busy.current) return;
    let cancelled = false;
    busy.current = true;
    const seat = G.turn, seq = G.seq, p = G.players[seat];
    p.thinking = true; force();
    (async () => {
      const t0 = Date.now();
      const dec = await decide(G, seat, useAI, derived);
      await new Promise((r) => setTimeout(r, Math.max(0, 460 - (Date.now() - t0))));
      p.thinking = false;
      if (cancelled || G.seq !== seq) { busy.current = false; force(); return; }
      applyAction(G, seat, dec);
      busy.current = false; force();
    })();
    return () => { cancelled = true; };
  }, [G.seq, G.phase, G.turn, useAI]);

  useEffect(() => {
    if (G.phase !== "runout") return;
    const t = setTimeout(() => { advance(G); force(); }, 820);
    return () => clearTimeout(t);
  }, [G.seq, G.phase]);

  useEffect(() => {
    if (G.phase !== "handover" || reviewing || review) return;
    setReviewing(true);
    const ds = G.decisions.slice(), net = G.result.net, hand = G.hand;
    coachHand(G, ds, useAI).then((r) => {
      setReview(r); setReviewing(false);
      setHistory((h) => [...h, { hand, score: r.score, net }]);
    });
  }, [G.seq, G.phase]);

  function humanAct(action, amount) {
    const eq = equity(me.hole, G.board, Math.max(1, inHand(G).length - 1), 450);
    const tc = Math.min(G.currentBet - me.bet, me.stack);
    const odds = tc > 0 ? tc / (P + tc) : 0;
    const act = action === "call" && tc === 0 ? "check" : action;
    const lbl = action === "raise" ? (G.currentBet === 0 ? `bet ${amount}` : `raise to ${amount}`) : act === "call" ? `call ${tc}` : act;
    stats.decisions++;
    if (act === "fold") stats.folds++;
    if (act === "raise") stats.raises++;
    if (G.street === 0) { stats.pots++; if (act !== "fold") stats.voluntary++; }
    G.decisions.push({ street: STREETS[G.street], hole: cardsStr(me.hole), board: cardsStr(G.board),
      pot: P, toCall: tc, odds, eq, opp: inHand(G).length - 1, action: act, label: lbl });
    applyAction(G, 0, { action, amount });
    force();
  }
  const deal = () => { setReview(null); startHand(G); force(); };
  const restart = () => { Object.assign(G, newGame()); setReview(null); setHistory([]); Object.assign(stats, { decisions: 0, folds: 0, raises: 0, pots: 0, voluntary: 0 }); force(); };

  const avg = history.length ? Math.round(history.reduce((s, h) => s + h.score, 0) / history.length) : null;
  const grade = (s) => (s >= 93 ? "A" : s >= 85 ? "A\u2212" : s >= 78 ? "B+" : s >= 70 ? "B" : s >= 62 ? "C+" : s >= 52 ? "C" : s >= 42 ? "D" : "F");
  const btn = (bg, fg, extra) => ({ padding: "11px 14px", borderRadius: 6, border: `1px solid ${bg}`, background: bg, color: fg,
    fontFamily: SANS, fontSize: 13, fontWeight: 600, letterSpacing: ".03em", cursor: "pointer", ...extra });

  return (
    <div style={{ background: T.ink, minHeight: "100%", padding: 16, color: T.bone, fontFamily: SANS }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", justifyContent: "space-between", borderBottom: `1px solid ${T.line}`, paddingBottom: 10, marginBottom: 14 }}>
          <div>
            <div style={{ ...label, color: T.brass }}>The Table &amp; The Margin</div>
            <div style={{ fontFamily: SERIF, fontSize: 24 }}>No-Limit Hold{"\u2019"}em, six-handed</div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div><div style={label}>Your stack</div><div style={{ fontFamily: MONO, fontSize: 20, color: T.brass }}>{me.stack}</div></div>
            <div><div style={label}>Session grade</div><div style={{ fontFamily: MONO, fontSize: 20, color: avg == null ? T.bone2 : T.ice }}>{avg == null ? "\u2014" : `${grade(avg)} \u00b7 ${avg}`}</div></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ ...label, cursor: "pointer", color: useAI ? T.ice : T.bone2 }}>
                <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} style={{ marginRight: 5 }} />Claude opponents
              </label>
              <label style={{ ...label, cursor: "pointer", color: showEq ? T.ice : T.bone2 }}>
                <input type="checkbox" checked={showEq} onChange={(e) => setShowEq(e.target.checked)} style={{ marginRight: 5 }} />Show my equity
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 560px", minWidth: 300 }}>
            <div style={{ background: `radial-gradient(ellipse at center, ${T.felt2} 0%, ${T.felt} 72%)`, border: `2px solid ${T.brass}44`, borderRadius: 18, padding: 14 }}>
              <div style={{ display: "flex", gap: 7, justifyContent: "center", flexWrap: "wrap" }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Seat key={i} p={G.players[i]} bot={BOTS[i - 1]} isTurn={G.turn === i} isButton={G.button === i} showHole={G.players[i].shown} />
                ))}
              </div>
              <div style={{ textAlign: "center", margin: "16px 0" }}>
                <div style={label}>Pot</div>
                <div style={{ fontFamily: MONO, fontSize: 26, color: T.brass, marginBottom: 10 }}>{P}</div>
                <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                  {[0, 1, 2, 3, 4].map((k) => <Card key={k} c={G.board[k]} />)}
                </div>
                <div style={{ ...label, marginTop: 8 }}>{G.phase === "idle" ? "Press deal to begin" : STREETS[G.street]}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Seat p={me} isTurn={myTurn} isButton={G.button === 0} showHole={true} />
              </div>
            </div>

            <div style={{ marginTop: 12, background: T.ink2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 12 }}>
              {G.over ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: SERIF, fontSize: 18, marginBottom: 8 }}>{me.out ? "You're out of chips." : `You finished with ${me.stack}.`}</div>
                  <button onClick={restart} style={btn(T.brass, T.ink)}>New session {"\u00b7"} 500 each</button>
                </div>
              ) : G.phase === "idle" || G.phase === "handover" ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={deal} style={btn(T.brass, T.ink)}>{G.phase === "idle" ? "Deal first hand" : "Deal next hand"}</button>
                  {G.result && <div style={{ fontFamily: MONO, fontSize: 13, color: G.result.net >= 0 ? T.sage : T.red }}>{G.result.net >= 0 ? "+" : ""}{G.result.net} this hand</div>}
                  {G.result && <div style={{ fontFamily: SANS, fontSize: 12, color: T.bone2 }}>{G.result.lines.join(" \u00b7 ")}</div>}
                </div>
              ) : myTurn ? (
                <div>
                  {showEq && <div style={{ ...label, color: T.ice, marginBottom: 8 }}>Your equity {"\u2248"} {(myEq * 100).toFixed(0)}% {"\u00b7"} price to call {toCall > 0 ? `${((toCall / (P + toCall)) * 100).toFixed(0)}%` : "free"}</div>}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    <button onClick={() => humanAct("fold")} style={btn("transparent", T.red, { borderColor: T.red })}>Fold</button>
                    <button onClick={() => humanAct("call")} style={btn("transparent", T.bone, { borderColor: T.bone2 })}>{toCall > 0 ? `Call ${toCall}` : "Check"}</button>
                    <button onClick={() => humanAct("raise", raiseTo)} disabled={maxTo <= G.currentBet} style={btn(T.brass, T.ink, { opacity: maxTo <= G.currentBet ? 0.4 : 1 })}>
                      {G.currentBet === 0 ? `Bet ${raiseTo}` : `Raise to ${raiseTo}`}
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="range" min={minTo} max={maxTo} value={Math.min(Math.max(raiseTo, minTo), maxTo)} onChange={(e) => setRaiseTo(+e.target.value)} style={{ flex: "1 1 150px", accentColor: T.brass }} />
                    {[["\u00bd", 0.5], ["\u00be", 0.75], ["pot", 1]].map(([t, f]) => (
                      <button key={t} onClick={() => setRaiseTo(Math.min(maxTo, Math.max(minTo, Math.round(G.currentBet + f * (P + toCall)))))} style={btn("transparent", T.bone2, { padding: "6px 9px", fontSize: 11, borderColor: T.line })}>{t}</button>
                    ))}
                    <button onClick={() => setRaiseTo(maxTo)} style={btn("transparent", T.brass, { padding: "6px 9px", fontSize: 11, borderColor: T.line })}>all in</button>
                  </div>
                </div>
              ) : (
                <div style={{ ...label, padding: "8px 2px" }}>{G.phase === "runout" ? "Running out the board\u2026" : `${G.players[G.turn ?? 0].name} is acting\u2026`}</div>
              )}
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap" }}>
              {[["VPIP", derived.vpip], ["Fold rate", derived.foldRate], ["Raise rate", derived.aggRate]].map(([k, v]) => (
                <div key={k}><div style={{ ...label, fontSize: 9 }}>{k}</div>
                  <div style={{ fontFamily: MONO, fontSize: 13, color: stats.decisions ? T.bone : T.bone2 }}>{stats.decisions ? `${Math.round(v * 100)}%` : "\u2014"}</div></div>
              ))}
              <div style={{ flex: 1, minWidth: 180, fontFamily: SERIF, fontSize: 11.5, color: T.bone2, lineHeight: 1.4 }}>
                Ruby watches these numbers and adjusts. Everyone else plays their own style regardless.
              </div>
            </div>

            <div style={{ marginTop: 10, maxHeight: 140, overflowY: "auto", fontSize: 12 }}>
              {G.log.map((l, i) => (
                <div key={i} style={{ padding: "3px 0", borderBottom: `1px solid ${T.line}55`,
                  color: l.t === "street" ? T.brass : l.t === "result" ? T.ice : T.bone2, fontFamily: l.t === "act" ? MONO : SANS }}>
                  {l.t === "act" ? `${l.who} \u2014 ${l.text}` : l.text}
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: "1 1 290px", minWidth: 270, borderLeft: `1px solid ${T.line}`, paddingLeft: 16 }}>
            <div style={{ ...label, color: T.ice }}>The Margin</div>
            <div style={{ fontFamily: SERIF, fontSize: 15, color: T.bone2, marginBottom: 12 }}>Notes on how you played it</div>
            {reviewing && <div style={label}>Reading the hand back{"\u2026"}</div>}
            {!reviewing && !review && (
              <div style={{ fontFamily: SERIF, fontSize: 14, color: T.bone2, lineHeight: 1.6 }}>
                Play a hand. When it{"\u2019"}s over every decision gets marked up here {"\u2014"} the price you were offered, the equity you actually held, and the better line.
              </div>
            )}
            {review && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${T.brass}`, borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 38, color: T.brass, lineHeight: 1 }}>{grade(review.score)}</div>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 12, color: T.bone2 }}>{review.score}/100 {"\u00b7"} hand {G.hand}</div>
                    <div style={{ fontFamily: SERIF, fontSize: 14, marginTop: 3 }}>{review.headline}</div>
                  </div>
                </div>
                {review.notes.map((n, i) => (
                  <div key={i} style={{ borderLeft: `2px solid ${VCOLOR[n.verdict] || T.bone2}`, paddingLeft: 10, marginBottom: 12 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span style={{ ...label, color: VCOLOR[n.verdict] || T.bone2 }}>{n.verdict}</span>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: T.bone2 }}>{n.street} {"\u00b7"} {n.played}</span>
                    </div>
                    <div style={{ fontFamily: SERIF, fontSize: 13.5, lineHeight: 1.55, marginTop: 3 }}>{n.better}</div>
                  </div>
                ))}
                {review.leak && (
                  <div style={{ marginTop: 14, borderTop: `1px solid ${T.line}`, paddingTop: 10 }}>
                    <div style={{ ...label, color: T.ice }}>Fix next hand</div>
                    <div style={{ fontFamily: SERIF, fontSize: 14, marginTop: 4 }}>{review.leak}</div>
                  </div>
                )}
              </div>
            )}
            {history.length > 0 && (
              <div style={{ marginTop: 18, borderTop: `1px solid ${T.line}`, paddingTop: 10 }}>
                <div style={label}>Session</div>
                {history.slice().reverse().map((h) => (
                  <div key={h.hand} style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 12, padding: "3px 0", color: T.bone2 }}>
                    <span>hand {h.hand}</span><span style={{ color: T.ice }}>{grade(h.score)}</span>
                    <span style={{ color: h.net >= 0 ? T.sage : T.red }}>{h.net >= 0 ? "+" : ""}{h.net}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 20, borderTop: `1px solid ${T.line}`, paddingTop: 10, fontFamily: SERIF, fontSize: 11.5, color: T.bone2, lineHeight: 1.5 }}>
              Opponents are sent only their own two cards, the board and the public betting. Your hole cards never leave your seat, and at showdown you only turn them over when you have to.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
