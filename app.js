/* Road Trip Spotter — standalone two-player spotting game.
 * Vanilla JS, no dependencies. All state persists in localStorage. */
'use strict';

(function () {
  const STORAGE_KEY = 'roadTripSpotter.v1';
  const DATA_FILE = 'road_trip_spotting_game.json';
  const PAIRS_PER_ROUND = 3;
  const WIN_TARGET = 2; // points a player must earn to win the round
  const RECENT_PAIR_CAP = 150;
  const HISTORY_CAP = 200;

  const SEASON_OPTIONS = [
    { id: 'spring', label: 'Spring' },
    { id: 'summer', label: 'Summer' },
    { id: 'fall', label: 'Fall' },
    { id: 'winter', label: 'Winter' },
    { id: 'any', label: 'Year-round / Any Season' }
  ];
  const DIFFICULTY_OPTIONS = [
    { id: 'easy', label: 'Easy' },
    { id: 'medium', label: 'Medium' },
    { id: 'hard', label: 'Hard' },
    { id: 'any', label: 'Any Difficulty (mix)' }
  ];
  const LIKELIHOOD_LABELS = {
    very_common: 'Very common', common: 'Common', moderate: 'Moderate',
    uncommon: 'Uncommon', rare: 'Rare'
  };

  // ---------- Data ----------
  let DB = null; // indexed, validated game data
  let validation = { errors: [], warnings: [] };

  function validateData(raw) {
    const errors = [];
    const warnings = [];
    const c = (raw && raw.collections) || {};
    const opts = c.attribute_options || {};
    const likelihoods = new Set(opts.likelihood || Object.keys(LIKELIHOOD_LABELS));
    const seasons = new Set(opts.seasonality || ['year_round', 'spring', 'summer', 'fall', 'winter']);
    const difficulties = new Set(opts.difficulty || ['easy', 'medium', 'hard']);
    const itemIds = new Set((c.items || []).map(i => i.id));
    const catIds = new Set((c.categories || []).map(x => x.id));
    const subIds = new Set((c.subcategories || []).map(x => x.id));
    const regionIds = new Set((c.regions || []).map(x => x.id));
    const envIds = new Set((c.environments || []).map(x => x.id));
    const seenPairIds = new Set();
    const invalidPairIds = new Set();

    if (!Array.isArray(c.pairs) || !c.pairs.length) errors.push('No pairs found in collections.pairs.');
    if (!Array.isArray(c.items) || !c.items.length) errors.push('No items found in collections.items.');

    (c.pairs || []).forEach((p, idx) => {
      const pid = p.id || `(pair #${idx + 1})`;
      const bad = msg => { errors.push(`${pid}: ${msg}`); invalidPairIds.add(pid); };
      if (!p.id) bad('missing id');
      else if (seenPairIds.has(p.id)) bad('duplicate pair id');
      seenPairIds.add(p.id);
      if (!Array.isArray(p.item_ids) || p.item_ids.length !== 2) bad('must reference exactly two items');
      else {
        p.item_ids.forEach(id => { if (!itemIds.has(id)) bad(`unknown item "${id}"`); });
        if (p.item_ids[0] === p.item_ids[1]) bad('contains the same item twice');
      }
      if (!catIds.has(p.category_id)) bad(`unknown category "${p.category_id}"`);
      if (!likelihoods.has(p.likelihood)) bad(`invalid likelihood "${p.likelihood}"`);
      if (!Array.isArray(p.seasonality) || !p.seasonality.length) bad('seasonality must be a non-empty list');
      else p.seasonality.forEach(s => { if (!seasons.has(s)) bad(`invalid season "${s}"`); });
      if (!difficulties.has(p.difficulty)) bad(`invalid difficulty "${p.difficulty}"`);
      if (p.subcategory_id && !subIds.has(p.subcategory_id)) warnings.push(`${pid}: unknown subcategory "${p.subcategory_id}"`);
      (p.region_ids || []).forEach(r => { if (!regionIds.has(r)) warnings.push(`${pid}: unknown region "${r}"`); });
      (p.environment_ids || []).forEach(e => { if (!envIds.has(e)) warnings.push(`${pid}: unknown environment "${e}"`); });
    });
    return { errors, warnings, invalidPairIds };
  }

  function indexData(raw) {
    const c = raw.collections;
    const byId = arr => Object.fromEntries((arr || []).map(x => [x.id, x]));
    const result = validateData(raw);
    validation = result;
    const likelihoodOrder = (c.attribute_options && c.attribute_options.likelihood) || Object.keys(LIKELIHOOD_LABELS);
    DB = {
      items: byId(c.items),
      categories: byId(c.categories),
      subcategories: byId(c.subcategories),
      regions: c.regions || [],
      environments: c.environments || [],
      likelihoodRank: Object.fromEntries(likelihoodOrder.map((l, i) => [l, i])),
      pairs: (c.pairs || []).filter(p => p.active !== false && !result.invalidPairIds.has(p.id)),
      pairsById: byId(c.pairs),
      totalPairs: (c.pairs || []).length
    };
  }

  async function loadData() {
    let raw = null;
    try {
      const res = await fetch(DATA_FILE, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch (e) { /* file:// or offline — fall back to embedded copy */ }
    if (!raw) {
      const el = document.getElementById('embedded-game-data');
      if (el) raw = JSON.parse(el.textContent);
    }
    if (!raw) throw new Error('Game data could not be loaded.');
    indexData(raw);
  }

  const itemName = id => (DB.items[id] && DB.items[id].name) || id;
  const categoryLabel = id => (DB.categories[id] && DB.categories[id].label) || id;
  const subcategoryLabel = id => (DB.subcategories[id] && DB.subcategories[id].label) || '';
  const getPair = id => DB.pairsById[id];

  // ---------- Storage ----------
  function currentSeason() {
    const m = new Date().getMonth();
    if (m >= 2 && m <= 4) return 'spring';
    if (m >= 5 && m <= 7) return 'summer';
    if (m >= 8 && m <= 10) return 'fall';
    return 'winter';
  }

  function defaultStore() {
    return {
      settings: {
        p1: 'Player 1', p2: 'Player 2',
        regions: ['michigan', 'midwest', 'great_lakes', 'universal'],
        environments: [],
        season: currentSeason(),
        difficulty: 'any',
        sound: false,
        excludeRecent: true,
        recentRounds: 5
      },
      stats: { played: 0, p1Wins: 0, p2Wins: 0, ties: 0, abandoned: 0 },
      history: [],
      recentPairs: [],
      current: null,
      lastResult: null
    };
  }

  function loadStore() {
    const base = defaultStore();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved) return base;
      return {
        ...base, ...saved,
        settings: { ...base.settings, ...(saved.settings || {}) },
        stats: { ...base.stats, ...(saved.stats || {}) }
      };
    } catch (e) {
      return base;
    }
  }

  let store = loadStore();
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch (e) { /* storage full or blocked */ }
  }

  // ---------- Pair generation ----------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pairMatches(p, s, use) {
    if (use.region && s.regions.length) {
      // 'universal' is an ordinary tag: those pairs are included only when Universal is selected.
      if (!(p.region_ids || []).some(x => s.regions.includes(x))) return false;
    }
    if (use.env && s.environments.length) {
      if (!(p.environment_ids || []).some(x => s.environments.includes(x))) return false;
    }
    if (use.season && s.season !== 'any') {
      if (!p.seasonality.includes('year_round') && !p.seasonality.includes(s.season)) return false;
    }
    if (use.difficulty && s.difficulty !== 'any' && p.difficulty !== s.difficulty) return false;
    return true;
  }

  function recentPairIds() {
    return store.recentPairs.slice(-store.settings.recentRounds * PAIRS_PER_ROUND);
  }

  function countEligible(s) {
    const all = { region: true, env: true, season: true, difficulty: true };
    const list = DB.pairs.filter(p => pairMatches(p, s, all));
    return { pairs: list.length, categories: new Set(list.map(p => p.category_id)).size };
  }

  // Picks 3 pairs from distinct categories, preferring similar likelihood and less-recent pairs.
  function pickThree(cands) {
    const byCat = {};
    cands.forEach(p => { (byCat[p.category_id] = byCat[p.category_id] || []).push(p); });
    const cats = Object.keys(byCat);
    const recent = store.recentPairs;
    const recency = id => {
      const i = recent.lastIndexOf(id);
      return i < 0 ? 0 : (i + 1) / recent.length; // 0 = never played, ~1 = just played
    };
    let best = null;
    let bestScore = Infinity;
    for (let t = 0; t < 60; t++) {
      const chosen = shuffle(cats).slice(0, PAIRS_PER_ROUND).map(c => byCat[c][Math.floor(Math.random() * byCat[c].length)]);
      const ranks = chosen.map(p => DB.likelihoodRank[p.likelihood] || 0);
      const spread = Math.max(...ranks) - Math.min(...ranks);
      const score = spread + chosen.reduce((sum, p) => sum + recency(p.id) * 2, 0) + Math.random() * 1.2;
      if (score < bestScore) { bestScore = score; best = chosen; }
    }
    return best;
  }

  function generatePairs(s, avoidIds) {
    const recent = new Set(recentPairIds());
    const avoid = new Set(avoidIds || []);
    const stages = [
      { relaxed: [], use: { region: true, env: true, season: true, difficulty: true }, hardRecent: s.excludeRecent, hardAvoid: true },
      { relaxed: ['showing pairs from recent rounds'], use: { region: true, env: true, season: true, difficulty: true }, hardRecent: false, hardAvoid: false },
      { relaxed: ['difficulty'], use: { region: true, env: true, season: true, difficulty: false } },
      { relaxed: ['difficulty', 'driving environment'], use: { region: true, env: false, season: true, difficulty: false } },
      { relaxed: ['difficulty', 'driving environment', 'season'], use: { region: true, env: false, season: false, difficulty: false } },
      { relaxed: ['all filters'], use: { region: false, env: false, season: false, difficulty: false } }
    ];
    for (const st of stages) {
      const cands = DB.pairs.filter(p =>
        pairMatches(p, s, st.use) &&
        !(st.hardRecent && recent.has(p.id)) &&
        !(st.hardAvoid && avoid.has(p.id)));
      if (new Set(cands.map(p => p.category_id)).size >= PAIRS_PER_ROUND) {
        return { pairs: pickThree(cands), relaxed: st.relaxed };
      }
    }
    return null;
  }

  // ---------- Round lifecycle ----------
  const ui = { screen: 'home', modal: null };

  function newRoundFromSettings(avoidIds) {
    const gen = generatePairs(store.settings, avoidIds);
    if (!gen) {
      ui.modal = { type: 'info', title: 'No pairs available', body: 'The game data does not contain enough valid pairs from three different categories.' };
      render();
      return;
    }
    store.current = {
      id: 'r' + Date.now(),
      createdAt: new Date().toISOString(),
      status: 'selecting',
      p1: store.settings.p1 || 'Player 1',
      p2: store.settings.p2 || 'Player 2',
      relaxed: gen.relaxed,
      pairs: gen.pairs.map(p => ({ pairId: p.id, p1Item: null, p2Item: null })),
      found: { p1: [false, false, false], p2: [false, false, false] },
      order: { p1: [null, null, null], p2: [null, null, null] },
      seq: 0,
      lastToggle: null,
      pending: null
    };
    save();
    show('select');
  }

  function chooseItem(pairIdx, itemId) {
    const r = store.current;
    if (!r || r.status !== 'selecting') return;
    const pair = getPair(r.pairs[pairIdx].pairId);
    r.pairs[pairIdx].p1Item = itemId;
    r.pairs[pairIdx].p2Item = pair.item_ids.find(x => x !== itemId);
    save();
    render();
  }

  function randomizePicks() {
    const r = store.current;
    r.pairs.forEach((rp, i) => {
      const ids = getPair(rp.pairId).item_ids;
      chooseItem(i, ids[Math.floor(Math.random() * 2)]);
    });
  }

  function startRound() {
    const r = store.current;
    if (!r || r.pairs.some(p => !p.p1Item)) return;
    r.status = 'playing';
    r.startedAt = new Date().toISOString();
    store.recentPairs = store.recentPairs.concat(r.pairs.map(p => p.pairId)).slice(-RECENT_PAIR_CAP);
    save();
    show('play');
  }

  const progress = (r, who) => r.found[who].filter(Boolean).length;

  // Each pair's point goes to whoever currently has the earliest mark on it.
  function ensureOrder(r) {
    if (r.order) return;
    r.seq = 0;
    r.order = { p1: [null, null, null], p2: [null, null, null] };
    ['p1', 'p2'].forEach(w => r.found[w].forEach((f, i) => { if (f) r.order[w][i] = ++r.seq; }));
  }

  function pointOwner(r, i) {
    ensureOrder(r);
    const a = r.found.p1[i] ? r.order.p1[i] : null;
    const b = r.found.p2[i] ? r.order.p2[i] : null;
    if (a == null && b == null) return null;
    if (b == null || (a != null && a < b)) return 'p1';
    return 'p2';
  }

  const pointOwners = r => r.pairs.map((_, i) => pointOwner(r, i));
  const points = (r, who) => pointOwners(r).filter(o => o === who).length;
  const leader = r => ['p1', 'p2'].find(w => points(r, w) >= WIN_TARGET) || null;

  function setMark(r, who, idx, on) {
    ensureOrder(r);
    r.found[who][idx] = on;
    r.order[who][idx] = on ? ++r.seq : null;
  }

  function snapshot(r) {
    return { found: { p1: r.found.p1.slice(), p2: r.found.p2.slice() }, points: pointOwners(r) };
  }

  // Undoing marks after a confirmed win can take the winner below two points.
  function revokeWin(r) {
    const idx = store.history.findIndex(h => h.id === r.id);
    if (idx >= 0) {
      const h = store.history[idx];
      store.history.splice(idx, 1);
      store.stats.played = Math.max(0, store.stats.played - 1);
      if (h.result === 'p1') store.stats.p1Wins = Math.max(0, store.stats.p1Wins - 1);
      if (h.result === 'p2') store.stats.p2Wins = Math.max(0, store.stats.p2Wins - 1);
    }
    if (store.lastResult && store.lastResult.id === r.id) store.lastResult = null;
    r.status = 'playing';
    r.winner = null;
  }

  function toggleFound(who, idx) {
    const r = store.current;
    if (!r || (r.status !== 'playing' && r.status !== 'won') || r.pending) return;
    setMark(r, who, idx, !r.found[who][idx]);
    r.lastToggle = { who, idx };
    if (r.status === 'won' && r.winner !== 'tie' && points(r, r.winner) < WIN_TARGET) revokeWin(r);
    if (r.status === 'playing') {
      r.pending = leader(r);
    } else {
      // Continued play after the win: keep the history entry's board in sync.
      const entry = store.history.find(h => h.id === r.id);
      if (entry) Object.assign(entry, snapshot(r));
    }
    if (r.found[who][idx]) beep(r.pending ? 880 : 660);
    save();
    render();
  }

  function undoLastToggle() {
    const r = store.current;
    if (r && r.lastToggle) {
      const { who, idx } = r.lastToggle;
      setMark(r, who, idx, !r.found[who][idx]);
      r.lastToggle = null;
    }
    if (r) r.pending = null;
    ui.modal = null;
    save();
    show(r && r.status === 'playing' ? 'play' : ui.screen);
  }

  function finishRound(result) {
    const r = store.current;
    if (!r) return;
    ui.modal = null;
    const entry = {
      id: r.id,
      date: new Date().toISOString(),
      p1: r.p1, p2: r.p2,
      result,
      pairs: r.pairs.map(p => ({ ...p })),
      ...snapshot(r)
    };
    if (result === 'abandoned') store.stats.abandoned++;
    else {
      store.stats.played++;
      if (result === 'p1') store.stats.p1Wins++;
      else if (result === 'p2') store.stats.p2Wins++;
      beep(990, 0.35);
    }
    store.history.unshift(entry);
    store.history = store.history.slice(0, HISTORY_CAP);
    if (result === 'abandoned') {
      store.current = null;
    } else {
      // Keep the board so players can continue looking after the winner is decided.
      r.status = 'won';
      r.winner = result;
      r.pending = null;
      r.lastToggle = null;
      store.lastResult = entry;
    }
    save();
    show(result === 'abandoned' ? 'home' : 'results');
  }

  function endBoard() {
    store.current = null;
    save();
  }

  // ---------- Sound (off by default) ----------
  let audioCtx = null;
  function beep(freq, dur) {
    if (!store.settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.15, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (dur || 0.18));
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + (dur || 0.18));
    } catch (e) { /* audio unavailable */ }
  }

  // ---------- Rendering ----------
  const app = document.getElementById('app');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

  function show(screen) {
    ui.screen = screen;
    render();
    window.scrollTo(0, 0);
  }

  function header(title, backTo) {
    return `<header class="topbar">
      ${backTo ? `<button class="btn btn-ghost" data-action="nav" data-to="${backTo}">&larr; Back</button>` : '<span></span>'}
      <h1>${esc(title)}</h1><span></span></header>`;
  }

  function chip(group, id, label, pressed) {
    return `<button class="chip" data-action="chip" data-group="${group}" data-id="${esc(id)}" aria-pressed="${pressed}">${esc(label)}</button>`;
  }

  function renderHome() {
    const r = store.current;
    let resume = '';
    if (r) {
      const score = `${esc(r.p1)} ${points(r, 'p1')} pts &middot; ${esc(r.p2)} ${points(r, 'p2')} pts`;
      const status = r.status === 'playing' ? score
        : r.status === 'won' ? `${esc(winnerText(r))} &mdash; still looking (${score})`
        : 'Choosing items';
      resume = `<section class="card resume">
        <h2>Unfinished game</h2>
        <p>${esc(r.p1)} vs ${esc(r.p2)} &mdash; ${status}</p>
        <div class="btn-row">
          <button class="btn btn-primary btn-lg" data-action="resume">Resume game</button>
          ${r.status === 'won'
            ? '<button class="btn btn-secondary" data-action="end-board">Finish board</button>'
            : '<button class="btn btn-secondary" data-action="confirm-abandon">Abandon</button>'}
        </div></section>`;
    }
    return `<div class="home">
      <div class="hero">
        <div class="logo" aria-hidden="true"><span class="dot dot-p1"></span><span class="dot dot-p2"></span></div>
        <h1>Road Trip Spotter</h1>
        <p class="tagline">Two players. Three pairs. First to two points wins.</p>
      </div>
      ${resume}
      <nav class="menu">
        <button class="btn btn-primary btn-xl" data-action="nav" data-to="setup">New Game</button>
        <button class="btn btn-secondary btn-lg" data-action="nav" data-to="stats">Statistics &amp; History</button>
        <button class="btn btn-secondary btn-lg" data-action="nav" data-to="settings">Settings</button>
      </nav>
      <section class="card howto">
        <h2>How to play</h2>
        <ol>
          <li>Get three pairs of similar things, like <b>Cow</b> vs <b>Horse</b>.</li>
          <li>Player 1 picks one item from each pair. Player 2 gets the other.</li>
          <li>Watch for all three of your items at once, in any order.</li>
          <li>Tap <b>Mark found</b> when you spot one. The first of you to spot your item in a pair wins that pair's point.</li>
          <li>First to two points wins.</li>
          <li>Want to keep going? Continue the board after the winner is declared.</li>
        </ol>
      </section></div>`;
  }

  function renderSetup() {
    const s = store.settings;
    const elig = countEligible(s);
    return `${header('New Game', 'home')}
    <main class="container">
      <section class="card">
        <h2>Players</h2>
        <div class="names">
          <label class="field p1"><span>Player 1</span>
            <input type="text" maxlength="20" data-input="p1" value="${esc(s.p1)}" autocomplete="off"></label>
          <label class="field p2"><span>Player 2</span>
            <input type="text" maxlength="20" data-input="p2" value="${esc(s.p2)}" autocomplete="off"></label>
        </div>
      </section>
      <section class="card">
        <h2>Region <small>choose any</small></h2>
        <div class="chips">${DB.regions.map(r => chip('regions', r.id, r.id === 'universal' ? 'Universal (found anywhere)' : r.label, s.regions.includes(r.id))).join('')}</div>
        <p class="hint">Universal adds pairs that can be spotted in any region. Nothing selected means any region.</p>
      </section>
      <section class="card">
        <h2>Driving environment <small>choose any</small></h2>
        <div class="chips">${DB.environments.map(e => chip('environments', e.id, e.label, s.environments.includes(e.id))).join('')}</div>
        <p class="hint">Nothing selected means any environment.</p>
      </section>
      <section class="card">
        <h2>Season</h2>
        <div class="chips">${SEASON_OPTIONS.map(o => chip('season', o.id, o.label, s.season === o.id)).join('')}</div>
      </section>
      <section class="card">
        <h2>Difficulty</h2>
        <div class="chips">${DIFFICULTY_OPTIONS.map(o => chip('difficulty', o.id, o.label, s.difficulty === o.id)).join('')}</div>
      </section>
      <p class="eligible ${elig.categories < 3 ? 'warn' : ''}">${elig.pairs} pairs in ${elig.categories} categories match these filters${elig.categories < 3 ? ' &mdash; filters will be relaxed automatically' : ''}.</p>
      <div class="sticky-actions">
        <button class="btn btn-primary btn-xl" data-action="generate">Start Game &rarr; Choose items</button>
      </div>
    </main>`;
  }

  function pairMeta(p) {
    const sub = subcategoryLabel(p.subcategory_id);
    return `${sub ? esc(sub) + ' &middot; ' : ''}${esc(LIKELIHOOD_LABELS[p.likelihood] || p.likelihood)} &middot; ${esc(p.difficulty)}`;
  }

  function renderSelect() {
    const r = store.current;
    const ready = r.pairs.every(p => p.p1Item);
    const cards = r.pairs.map((rp, i) => {
      const p = getPair(rp.pairId);
      const btns = p.item_ids.map(id => {
        const owner = rp.p1Item ? (rp.p1Item === id ? 'p1' : 'p2') : '';
        const ownerName = owner === 'p1' ? r.p1 : owner === 'p2' ? r.p2 : '';
        return `<button class="pick ${owner ? 'pick-' + owner : ''}" data-action="choose" data-idx="${i}" data-item="${esc(id)}" aria-pressed="${owner === 'p1'}">
          <span class="pick-name">${esc(itemName(id))}</span>
          <span class="pick-owner">${owner ? esc(ownerName) : '&nbsp;'}</span></button>`;
      }).join('<span class="vs">vs</span>');
      return `<section class="card pair-card"><h2 class="cat">${esc(categoryLabel(p.category_id))}</h2>
        <p class="meta">${pairMeta(p)}</p><div class="picks">${btns}</div></section>`;
    }).join('');
    const relaxed = r.relaxed && r.relaxed.length
      ? `<p class="notice">Not enough pairs matched every filter, so these were relaxed: ${esc(r.relaxed.join(', '))}.</p>` : '';
    return `${header('Choose Items', 'home')}
    <main class="container">
      <p class="lead"><b class="c-p1">${esc(r.p1)}</b>, tap the item you want to look for in each pair.
        <b class="c-p2">${esc(r.p2)}</b> gets the other one. You can change picks until the round starts.</p>
      ${relaxed}
      <div class="pairs-grid">${cards}</div>
      <div class="btn-row center">
        <button class="btn btn-secondary" data-action="regenerate">New pairs</button>
        <button class="btn btn-secondary" data-action="randomize">Random picks</button>
      </div>
      <div class="sticky-actions">
        <button class="btn btn-primary btn-xl" data-action="start" ${ready ? '' : 'disabled'}>${ready ? 'Start Round' : 'Pick an item in every pair'}</button>
      </div>
    </main>`;
  }

  function scoreChip(r, who) {
    const owners = pointOwners(r);
    const dots = owners.map(o => `<span class="pdot ${o === who ? 'on' : ''}"></span>`).join('');
    return `<div class="score score-${who}"><span class="score-name">${esc(r[who])}</span>
      <span class="pdots" aria-hidden="true">${dots}</span>
      <span class="score-num">${points(r, who)} of ${WIN_TARGET} pts</span>
      <span class="score-sub">Found ${progress(r, who)} of 3</span></div>`;
  }

  function winnerText(r) {
    return r.winner === 'tie' ? 'Tie game' : `${r[r.winner]} won`; // ties only exist in older saves
  }

  function renderPlay() {
    const r = store.current;
    const banner = r.status === 'won'
      ? `<div class="won-banner win-${r.winner}"><div><b>${esc(winnerText(r))}!</b>
          <span class="hint">Keep looking for the rest, or start a new round.</span></div>
          <div class="btn-row"><button class="btn btn-primary" data-action="new-round">New Round</button>
          <button class="btn btn-secondary" data-action="nav" data-to="results">Results</button></div></div>`
      : '';
    const cards = r.pairs.map((rp, i) => {
      const p = getPair(rp.pairId);
      const owner = pointOwner(r, i);
      const side = who => {
        const done = r.found[who][i];
        const badge = owner === who ? '<span class="point-badge">&#9733; Point</span>'
          : done ? '<span class="point-badge none">Found 2nd &middot; no point</span>' : '';
        return `<div class="target target-${who} ${done ? 'done' : ''}">
          <span class="target-player">${esc(r[who])}</span>
          <span class="target-item">${esc(itemName(rp[who + 'Item']))}</span>
          ${badge}
          <button class="btn found-btn" data-action="toggle" data-who="${who}" data-idx="${i}" aria-pressed="${done}">
            ${done ? '&#10003; Found &middot; tap to undo' : 'Mark found'}</button></div>`;
      };
      return `<section class="card play-card"><h2 class="cat">${esc(categoryLabel(p.category_id))}</h2>
        <div class="targets">${side('p1')}${side('p2')}</div></section>`;
    }).join('');
    return `<div class="play">
      <div class="scorebar">${scoreChip(r, 'p1')}${scoreChip(r, 'p2')}</div>
      ${banner}
      <main class="play-grid">${cards}</main>
      <div class="btn-row center play-footer">
        <button class="btn btn-ghost" data-action="nav" data-to="home">Menu</button>
        ${r.status === 'won'
          ? '<button class="btn btn-ghost" data-action="end-board" data-then="home">Finish board</button>'
          : '<button class="btn btn-ghost danger" data-action="confirm-abandon">Abandon round</button>'}
      </div></div>`;
  }

  function resultTable(entry) {
    const owners = entry.points || [];
    const rows = entry.pairs.map((rp, i) => {
      const p = getPair(rp.pairId);
      const cell = who => `<td class="${entry.found[who][i] ? 'yes' : 'no'}">${esc(itemName(rp[who + 'Item']))} ${entry.found[who][i] ? '&#10003;' : '&ndash;'}${owners[i] === who ? ' <b class="c-' + who + '">&#9733;</b>' : ''}</td>`;
      return `<tr><th scope="row">${esc(p ? categoryLabel(p.category_id) : rp.pairId)}</th>${cell('p1')}${cell('p2')}</tr>`;
    }).join('');
    const tot = who => entry.found[who].filter(Boolean).length;
    const pts = who => owners.filter(o => o === who).length;
    return `<div class="table-wrap"><table class="results">
      <thead><tr><th>Category</th><th class="c-p1">${esc(entry.p1)}</th><th class="c-p2">${esc(entry.p2)}</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th>Points</th><td>${pts('p1')}</td><td>${pts('p2')}</td></tr>
      <tr><th>Found</th><td>${tot('p1')} of 3</td><td>${tot('p2')} of 3</td></tr></tfoot></table></div>
      <p class="hint">&#9733; = point for spotting that pair first.</p>`;
  }

  function renderResults() {
    // Prefer the history entry: it keeps receiving finds made while continuing the board.
    const e = store.lastResult && (store.history.find(h => h.id === store.lastResult.id) || store.lastResult);
    if (!e) return renderHome();
    // Older saved rounds may predate the point rules (e.g. recorded ties).
    const msg = e.result === 'tie'
      ? `<h1 class="win-title">It's a tie!</h1>`
      : `<h1 class="win-title c-${e.result}">${esc(e[e.result])} wins!</h1><p>First to two points.</p>`;
    const r = store.current;
    const canContinue = r && r.status === 'won' && r.id === e.id;
    return `<main class="container results-screen">
      <section class="card win-card win-${e.result}">${msg}</section>
      ${resultTable(e)}
      <p class="hint center">Series: ${esc(store.settings.p1)} ${store.stats.p1Wins} &middot; ${esc(store.settings.p2)} ${store.stats.p2Wins}</p>
      <div class="menu">
        <button class="btn btn-primary btn-xl" data-action="new-round">New Round</button>
        ${canContinue ? '<button class="btn btn-secondary btn-lg" data-action="nav" data-to="play">Keep playing this board</button>' : ''}
        <button class="btn btn-secondary btn-lg" data-action="nav" data-to="setup">Change settings</button>
        <button class="btn btn-secondary btn-lg" data-action="nav" data-to="home">Main Menu</button>
      </div></main>`;
  }

  function resultLabel(h) {
    if (h.result === 'tie') return 'Tie';
    if (h.result === 'abandoned') return 'Abandoned';
    return `${h[h.result]} won`;
  }

  function renderStats() {
    const st = store.stats;
    const counts = {};
    store.history.forEach(h => h.pairs.forEach(rp => { counts[rp.pairId] = (counts[rp.pairId] || 0) + 1; }));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const pairText = id => {
      const p = getPair(id);
      return p ? `${itemName(p.item_ids[0])} vs ${itemName(p.item_ids[1])}` : id;
    };
    const tiles = [
      ['Games played', st.played, ''], [`${store.settings.p1} wins`, st.p1Wins, 'c-p1'],
      [`${store.settings.p2} wins`, st.p2Wins, 'c-p2'], ['Abandoned', st.abandoned, '']
    ].map(([l, v, cls]) => `<div class="tile"><span class="tile-v ${cls}">${v}</span><span class="tile-l">${esc(l)}</span></div>`).join('');
    const histScore = (h, who) => h.points
      ? `${h.points.filter(o => o === who).length} pts`
      : `${h.found[who].filter(Boolean).length}/3`;
    const hist = store.history.slice(0, 15).map(h => `<li>
      <div class="h-top"><b>${esc(resultLabel(h))}</b><span>${esc(new Date(h.date).toLocaleString())}</span></div>
      <div class="h-sub">${esc(h.p1)} ${histScore(h, 'p1')} vs ${esc(h.p2)} ${histScore(h, 'p2')}</div>
      <div class="h-sub">${h.pairs.map(rp => esc(pairText(rp.pairId))).join(' &middot; ')}</div></li>`).join('');
    return `${header('Statistics', 'home')}
    <main class="container">
      <p class="hint">Win totals are for the Player 1 and Player 2 seats. The current names are shown.</p>
      <div class="tiles">${tiles}</div>
      <section class="card"><h2>Most played pairs</h2>
        ${top.length ? `<ol class="toplist">${top.map(([id, n]) => `<li>${esc(pairText(id))} <span class="muted">&times;${n}</span></li>`).join('')}</ol>` : '<p class="muted">No games yet.</p>'}
      </section>
      <section class="card"><h2>Recent games</h2>
        ${hist ? `<ul class="history">${hist}</ul>` : '<p class="muted">No games yet.</p>'}
      </section>
      <div class="btn-row center"><button class="btn btn-secondary danger" data-action="confirm-reset-stats">Reset statistics &amp; history</button></div>
    </main>`;
  }

  function toggleRow(key, label, desc) {
    const on = !!store.settings[key];
    return `<div class="setting"><div><b>${label}</b><p class="hint">${desc}</p></div>
      <button class="switch" data-action="setting-toggle" data-key="${key}" role="switch" aria-checked="${on}">${on ? 'On' : 'Off'}</button></div>`;
  }

  function renderSettings() {
    const s = store.settings;
    const v = validation;
    const issues = v.errors.concat(v.warnings);
    return `${header('Settings', 'home')}
    <main class="container">
      <section class="card">
        ${toggleRow('sound', 'Sound effects', 'Short beep when an item is marked found.')}
        ${toggleRow('excludeRecent', 'Exclude recently played pairs', 'Skip pairs used in recent rounds when enough others are available.')}
        <div class="setting"><div><b>Recent rounds to exclude</b><p class="hint">How far back counts as recent.</p></div>
          <div class="chips">${[3, 5, 10].map(n => `<button class="chip" data-action="recent-rounds" data-n="${n}" aria-pressed="${s.recentRounds === n}">${n}</button>`).join('')}</div></div>
      </section>
      <section class="card">
        <h2>Game data</h2>
        <p>${DB.pairs.length} playable pairs of ${DB.totalPairs} &middot; ${Object.keys(DB.items).length} items &middot; ${Object.keys(DB.categories).length} categories</p>
        <p class="${v.errors.length ? 'warn' : 'ok'}">Validation: ${v.errors.length} errors, ${v.warnings.length} warnings${v.errors.length ? '. Invalid pairs are skipped.' : ''}</p>
        ${issues.length ? `<details><summary>Show details</summary><ul class="issues">${issues.slice(0, 100).map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
      </section>
      <section class="card">
        <h2>Reset</h2>
        <div class="btn-row">
          <button class="btn btn-secondary danger" data-action="confirm-reset-stats">Reset statistics &amp; history</button>
          <button class="btn btn-secondary danger" data-action="confirm-reset-all">Reset everything</button>
        </div>
      </section>
    </main>`;
  }

  function renderModal() {
    const m = ui.modal;
    const r = store.current;
    let title = '', body = '', buttons = '';
    if (r && r.status === 'playing' && r.pending) {
      const w = r.pending;
      // Rounds restored from older saves have no last tap to undo; let players review the board instead.
      const canUndo = !!r.lastToggle;
      title = `${esc(r[w])} has two points!`;
      body = canUndo ? 'Confirm the win, or undo the last tap if it was a mistake.'
        : 'Confirm the win, or go back to the board to fix any mistaken marks.';
      buttons = `<button class="btn btn-primary btn-lg btn-${w}" data-action="finish" data-result="${w}">${esc(r[w])} wins</button>
        <button class="btn btn-secondary" data-action="undo-last">${canUndo ? 'Undo last tap' : 'Back to board'}</button>`;
    } else if (m) {
      title = esc(m.title);
      body = esc(m.body);
      if (m.type === 'confirm') {
        buttons = `<button class="btn btn-primary btn-lg ${m.danger ? 'btn-danger' : ''}" data-action="modal-ok">${esc(m.ok)}</button>
          <button class="btn btn-secondary" data-action="modal-cancel">${esc(m.cancel || 'Cancel')}</button>`;
      } else {
        buttons = '<button class="btn btn-primary btn-lg" data-action="modal-cancel">OK</button>';
      }
    } else return '';
    return `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title">${title}</h2><p>${body}</p><div class="modal-actions">${buttons}</div></div></div>`;
  }

  function render() {
    // Guard against screens that need a round when none exists.
    if ((ui.screen === 'select' && !(store.current && store.current.status === 'selecting')) ||
        (ui.screen === 'play' && !(store.current && (store.current.status === 'playing' || store.current.status === 'won')))) {
      ui.screen = 'home';
    }
    const screens = {
      home: renderHome, setup: renderSetup, select: renderSelect, play: renderPlay,
      results: renderResults, stats: renderStats, settings: renderSettings
    };
    app.className = 'screen-' + ui.screen;
    app.innerHTML = (screens[ui.screen] || renderHome)() + renderModal();
  }

  function confirmModal(title, body, ok, onOk, danger) {
    ui.modal = { type: 'confirm', title, body, ok, onOk, danger };
    render();
  }

  // ---------- Actions ----------
  const actions = {
    nav: d => show(d.to),
    resume: () => {
      ui.modal = null;
      show(store.current.status === 'selecting' ? 'select' : 'play');
    },
    chip: d => {
      const s = store.settings;
      if (d.group === 'regions' || d.group === 'environments') {
        const list = s[d.group];
        const i = list.indexOf(d.id);
        if (i >= 0) list.splice(i, 1); else list.push(d.id);
      } else {
        s[d.group] = d.id;
      }
      save();
      render();
    },
    generate: () => {
      store.settings.p1 = store.settings.p1.trim() || 'Player 1';
      store.settings.p2 = store.settings.p2.trim() || 'Player 2';
      save();
      const startNew = () => newRoundFromSettings();
      const r = store.current;
      if (r && r.status === 'playing') {
        confirmModal('Abandon the current game?', 'A game is still in progress. Starting a new one marks it as abandoned.', 'Abandon & start new', () => {
          finishRound('abandoned');
          startNew();
        }, true);
      } else startNew();
    },
    'new-round': () => newRoundFromSettings(),
    'end-board': () => { endBoard(); show('home'); },
    regenerate: () => newRoundFromSettings(store.current ? store.current.pairs.map(p => p.pairId) : []),
    choose: d => chooseItem(Number(d.idx), d.item),
    randomize: () => randomizePicks(),
    start: () => startRound(),
    toggle: d => toggleFound(d.who, Number(d.idx)),
    'undo-last': () => undoLastToggle(),
    finish: d => finishRound(d.result),
    'confirm-abandon': () => confirmModal('Abandon this round?', 'It will be recorded in history as abandoned and will not count as a win or loss.', 'Abandon round', () => {
      const r = store.current;
      if (r && r.status === 'playing') finishRound('abandoned');
      else { store.current = null; save(); show('home'); }
    }, true),
    'confirm-reset-stats': () => confirmModal('Reset statistics & history?', 'This clears all win totals, game history and recently played pairs. Player names and settings are kept.', 'Reset statistics', () => {
      store.stats = defaultStore().stats;
      store.history = [];
      store.recentPairs = [];
      store.lastResult = null;
      save();
      render();
    }, true),
    'confirm-reset-all': () => confirmModal('Reset everything?', 'This clears statistics, history, settings, player names and any unfinished game.', 'Reset everything', () => {
      store = defaultStore();
      save();
      show('home');
    }, true),
    'setting-toggle': d => { store.settings[d.key] = !store.settings[d.key]; save(); render(); },
    'recent-rounds': d => { store.settings.recentRounds = Number(d.n); save(); render(); },
    'modal-ok': () => {
      const m = ui.modal;
      ui.modal = null;
      if (m && m.onOk) m.onOk(); else render();
    },
    'modal-cancel': () => { ui.modal = null; render(); }
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (fn) fn(el.dataset, el);
  });

  document.addEventListener('input', e => {
    const key = e.target.dataset && e.target.dataset.input;
    if (key === 'p1' || key === 'p2') {
      store.settings[key] = e.target.value;
      save();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && ui.modal) { ui.modal = null; render(); }
  });

  // Keep multiple tabs consistent.
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) { store = loadStore(); render(); }
  });

  // ---------- Boot ----------
  loadData().then(() => {
    const r = store.current;
    if (r && r.pairs.some(p => !getPair(p.pairId))) store.current = null; // data changed under a saved round
    const cur = store.current;
    if (cur && cur.status === 'playing') {
      // Re-derive the pending win from points (saved rounds may predate the point rules).
      cur.pending = leader(cur);
      save();
    }
    if (store.current) {
      ui.modal = {
        type: 'confirm', title: 'Resume unfinished game?',
        body: `${store.current.p1} vs ${store.current.p2} was still in progress.`,
        ok: 'Resume', cancel: 'Not now',
        onOk: () => actions.resume()
      };
    }
    render();
  }).catch(err => {
    app.innerHTML = `<main class="container"><section class="card"><h1>Could not load game data</h1><p>${esc(err.message)}</p></section></main>`;
  });

  // Offline support: only available over http(s), e.g. when hosted on GitHub Pages.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline caching unavailable */ });
  }

  // Exposed for console debugging/tests.
  window.RoadTripSpotter = { validateData, generatePairs: s => generatePairs(s || store.settings), getStore: () => store };
})();
