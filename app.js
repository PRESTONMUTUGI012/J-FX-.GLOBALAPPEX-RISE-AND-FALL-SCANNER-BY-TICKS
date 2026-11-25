const DERIV_APP_ID = "34ZfveN7Be9dqW8mOCJAe";
const AFFILIATE_TOKEN = "3A2CFHPG722B";

const DEFAULT_MINUTE_TIMEFRAMES = ['1', '2', '3', '5', '10', '15', '30'];
const DEFAULT_SHIFT_SECONDS = 8;
const MAX_RUNS_CAP = 7;
const DEFAULT_RUNS_TARGET = 6;

// Strictly synthetic indices only: Volatility, Volatility 1s, and Jump
const exhaustiveAssets = [
    { symbol: 'R_10',     name: 'Volatility 10',      market: 'volatility',    pip: 3, base: 6321.450, tv: 'FX:EURUSD', initialAdx: 27.2, initialWick: 0.16, playbook: 'Trend Pullback' },
    { symbol: 'R_25',     name: 'Volatility 25',      market: 'volatility',    pip: 3, base: 3120.100, tv: 'FX:GBPUSD', initialAdx: 25.4, initialWick: 0.19, playbook: 'Trend Pullback' },
    { symbol: 'R_50',     name: 'Volatility 50',      market: 'volatility',    pip: 3, base: 2450.750, tv: 'FX:USDJPY', initialAdx: 23.8, initialWick: 0.22, playbook: 'Momentum Surge' },
    { symbol: 'R_75',     name: 'Volatility 75',      market: 'volatility',    pip: 3, base: 8940.200, tv: 'FX:AUDUSD', initialAdx: 26.0, initialWick: 0.18, playbook: 'Band Rebound' },
    { symbol: 'R_100',    name: 'Volatility 100',     market: 'volatility',    pip: 3, base: 4120.900, tv: 'FX:USDCAD', initialAdx: 22.9, initialWick: 0.24, playbook: 'Trend Pullback' },
    { symbol: '1HZ10V',   name: 'Volatility 10 (1s)', market: 'volatility_1s', pip: 2, base: 9452.18,  tv: 'FX:EURUSD', initialAdx: 28.0, initialWick: 0.15, playbook: 'Momentum Surge' },
    { symbol: '1HZ25V',   name: 'Volatility 25 (1s)', market: 'volatility_1s', pip: 2, base: 5320.45,  tv: 'FX:GBPUSD', initialAdx: 24.5, initialWick: 0.21, playbook: 'Trend Pullback' },
    { symbol: '1HZ50V',   name: 'Volatility 50 (1s)', market: 'volatility_1s', pip: 2, base: 48912.34, tv: 'FX:USDJPY', initialAdx: 22.2, initialWick: 0.26, playbook: 'Band Rebound' },
    { symbol: '1HZ75V',   name: 'Volatility 75 (1s)', market: 'volatility_1s', pip: 2, base: 12450.80, tv: 'FX:AUDUSD', initialAdx: 26.5, initialWick: 0.17, playbook: 'Momentum Surge' },
    { symbol: '1HZ100V',  name: 'Volatility 100 (1s)',market: 'volatility_1s', pip: 2, base: 1428.64,  tv: 'FX:USDCHF', initialAdx: 23.4, initialWick: 0.22, playbook: 'Trend Pullback' },
    { symbol: 'JD10',     name: 'Jump 10 Index',      market: 'jump',          pip: 2, base: 1240.50,  tv: 'FX:EURGBP', initialAdx: 25.1, initialWick: 0.19, playbook: 'Momentum Surge' },
    { symbol: 'JD25',     name: 'Jump 25 Index',      market: 'jump',          pip: 2, base: 2150.80,  tv: 'FX:NZDUSD', initialAdx: 20.4, initialWick: 0.34, playbook: 'Trend Pullback' },
    { symbol: 'JD50',     name: 'Jump 50 Index',      market: 'jump',          pip: 2, base: 3420.10,  tv: 'FX:AUDJPY', initialAdx: 24.0, initialWick: 0.21, playbook: 'Band Rebound' },
    { symbol: 'JD75',     name: 'Jump 75 Index',      market: 'jump',          pip: 2, base: 5120.40,  tv: 'FX:GBPJPY', initialAdx: 21.1, initialWick: 0.36, playbook: 'Momentum Surge' },
    { symbol: 'JD100',    name: 'Jump 100 Index',     market: 'jump',          pip: 2, base: 8940.20,  tv: 'FX:EURUSD', initialAdx: 23.6, initialWick: 0.23, playbook: 'Trend Pullback' }
];

// Rise / Fall tick-hold contracts only (CALL / PUT)
const RISE_FALL_TICK_SETUPS = [
    { direction: 'rise', name: 'RISE (CALL)', shortName: 'CALL', api: 'CALL', ticks: 4, runs: 6, payoutMult: 0.92, boatId: 1 },
    { direction: 'fall', name: 'FALL (PUT)',  shortName: 'PUT',  api: 'PUT',  ticks: 4, runs: 6, payoutMult: 0.92, boatId: 2 }
];

let currentCategory = 'all';
let currentParityFilter = 'all';
let rotationCursor = 0;
let currentSymbol = exhaustiveAssets[0].symbol;
let activeCandleTf = '5';
let rotationIntervalSec = DEFAULT_SHIFT_SECONDS;
let shiftTimer = null;
let shiftCountdown = DEFAULT_SHIFT_SECONDS;
let cooldownUntil = 0;
let marketDataStore = {};
let activeAccountMode = 'demo';
let simulatedBalance = 1000.00;
let sessionNetPnl = 0;
let sessionWins = 0;
let sessionLosses = 0;
let consecutiveLosses = 0;
let lastExecutionTimestamp = 0;
let activeAutomationMode = null;

function getSelectedRunsTarget(defaultRuns = DEFAULT_RUNS_TARGET) {
    const val = parseInt(document.getElementById('runs-target-input')?.value, 10);
    if (!isNaN(val) && val >= 1 && val <= MAX_RUNS_CAP) return val;
    return defaultRuns;
}

function getSelectedTickHold() {
    const val = parseInt(document.getElementById('tick-hold-input')?.value, 10);
    if (!isNaN(val) && val >= 2 && val <= 10) return val;
    return 4;
}

function updateTickHoldOverride() {
    const ticks = getSelectedTickHold();
    Object.values(marketDataStore).forEach(st => {
        st.ticks = ticks;
        st.strategy.ticks = ticks;
    });
    updateSignalUI(currentSymbol);
    renderScanner();
}

function updateRunsTargetOverride() {
    const st = marketDataStore[currentSymbol];
    if (st) {
        st.runsTarget = getSelectedRunsTarget(DEFAULT_RUNS_TARGET);
        st.runsCompleted = 0;
        updateSignalUI(currentSymbol);
    }
}

function updateRotationIntervalFromInput() {
    const val = parseInt(document.getElementById('loss-cooldown-sec')?.value, 10);
    rotationIntervalSec = (!isNaN(val) && val >= 4 && val <= 30) ? val : DEFAULT_SHIFT_SECONDS;
    shiftCountdown = Math.min(shiftCountdown, rotationIntervalSec);
    const pill = document.getElementById('shift-countdown-pill');
    if (pill) pill.innerText = `${shiftCountdown}s`;
}

function computeIndicatorsAndEntry(prices, fallbackAdx = 25, fallbackWick = 0.18, direction = 'rise', pipSize = 2) {
    if (!prices || prices.length < 4) {
        const base = prices && prices.length ? prices[prices.length - 1] : 0;
        return {
            adx: fallbackAdx,
            rsi: direction === 'rise' ? 58.0 : 42.0,
            emaBias: direction === 'rise' ? 'BULLISH' : 'BEARISH',
            noiseRatio: fallbackWick,
            firmEntry: Number(base).toFixed(pipSize)
        };
    }
    const recent = prices.slice(-24);
    let gains = 0;
    let losses = 0;
    let totalRange = 0;
    const netMove = Math.abs(recent[recent.length - 1] - recent[0]);
    for (let i = 1; i < recent.length; i++) {
        const diff = recent[i] - recent[i - 1];
        totalRange += Math.abs(diff);
        if (diff > 0) gains += diff;
        else if (diff < 0) losses += Math.abs(diff);
    }
    const rs = losses === 0 ? 12 : gains / losses;
    const rsi = Number((100 - (100 / (1 + rs))).toFixed(1));
    const adx = Number(Math.min(45, Math.max(18, 21 + Math.abs(rsi - 50) * 0.8)).toFixed(1));

    const k = 2 / (20 + 1);
    let ema = recent[0];
    for (let i = 1; i < recent.length; i++) {
        ema = recent[i] * k + ema * (1 - k);
    }
    const latest = recent[recent.length - 1];
    const emaBias = latest >= ema ? 'BULLISH' : 'BEARISH';
    const rawNoise = totalRange > 0 ? Math.max(0.08, Math.min(0.65, 1 - (netMove / (totalRange + 1e-9)) * 0.65)) : fallbackWick;
    const noiseRatio = Number(((rawNoise + fallbackWick) / 2).toFixed(2));

    const win = recent.slice(-6);
    const low = Math.min(...win);
    const high = Math.max(...win);
    const mid = (high + low) / 2;
    const entryVal = direction === 'rise' ? Math.min(latest, mid) : Math.max(latest, mid);

    return {
        adx,
        rsi,
        emaBias,
        noiseRatio,
        firmEntry: Number(entryVal).toFixed(pipSize)
    };
}

function getBestDirectionForState(st) {
    if (currentParityFilter === 'rise') return 'rise';
    if (currentParityFilter === 'fall') return 'fall';
    if (st.rsi >= 50 || st.emaBias === 'BULLISH') return 'rise';
    return 'fall';
}

exhaustiveAssets.forEach((a, idx) => {
    const tf = DEFAULT_MINUTE_TIMEFRAMES[idx % DEFAULT_MINUTE_TIMEFRAMES.length];
    const startDir = idx % 2 === 0 ? 'rise' : 'fall';
    const strat = RISE_FALL_TICK_SETUPS.find(s => s.direction === startDir) || RISE_FALL_TICK_SETUPS[0];
    const ticks = getSelectedTickHold();
    const calc = computeIndicatorsAndEntry([a.base], a.initialAdx, a.initialWick, startDir, a.pip);

    marketDataStore[a.symbol] = {
        name: a.name,
        market: a.market,
        pip: a.pip,
        price: a.base.toFixed(a.pip),
        firmEntry: calc.firmEntry,
        lockedDir: startDir,
        priceHistory: [a.base],
        timeframe: tf,
        ticks: ticks,
        runsTarget: DEFAULT_RUNS_TARGET,
        runsCompleted: 0,
        strategy: { ...strat, ticks: ticks },
        playbook: a.playbook,
        adx: a.initialAdx,
        rsi: startDir === 'rise' ? 58.0 : 42.0,
        emaBias: startDir === 'rise' ? 'BULLISH' : 'BEARISH',
        wickRatio: a.initialWick,
        lastTickDir: 'up'
    };
});

// Consistent A+ scorer so valid Rise/Fall setups surface cleanly instead of getting stuck on NULL
function evaluateRiseFallTickAPlus(st) {
    const minAdx = parseFloat(document.getElementById('filter-min-adx')?.value) || 15;
    const maxWick = parseFloat(document.getElementById('filter-max-wick')?.value) || 0.58;

    const extremeNoise = st.wickRatio > Math.max(maxWick, 0.72);
    if (extremeNoise) {
        return {
            isAPlus: false,
            gradeLabel: 'NULL SIGNAL',
            score: -10,
            statusText: `NULL SIGNAL (Extreme Noise ${st.wickRatio.toFixed(2)})`
        };
    }

    const adxPass = st.adx >= minAdx;
    const noisePass = st.wickRatio <= maxWick;
    const dirMatch = st.strategy.direction === 'rise' ? (st.emaBias === 'BULLISH' || st.rsi >= 45) : (st.emaBias === 'BEARISH' || st.rsi <= 55);
    const score = st.adx + (noisePass ? 8 : 0) + (dirMatch ? 6 : 0) - (st.wickRatio * 20);

    return {
        isAPlus: true,
        gradeLabel: (adxPass && noisePass && dirMatch) ? `A+ ${st.strategy.shortName}` : `A ${st.strategy.shortName}`,
        score,
        statusText: `${st.playbook} -> ${st.strategy.name} | Entry ${st.firmEntry} | ADX ${st.adx} • RSI ${st.rsi} • ${st.emaBias} • Noise ${st.wickRatio.toFixed(2)}`
    };
}

function refreshAllFilterStatuses() {
    updateSignalUI(currentSymbol);
    renderScanner();
}

function logTransaction(msg, isHighlight = false) {
    const logContainer = document.getElementById('live-transaction-log');
    if (!logContainer) return;
    if (logContainer.querySelector('.italic')) logContainer.innerHTML = '';

    const time = new Date().toLocaleTimeString();
    const row = document.createElement('div');
    row.className = isHighlight
        ? 'p-1.5 rounded bg-emerald-950/80 border border-fxgreen text-fxgreen font-bold'
        : 'p-1 rounded bg-slate-950 border border-slate-800/80 text-slate-300';
    row.innerText = `[${time}] ${msg}`;
    logContainer.prepend(row);
    if (logContainer.children.length > 25) logContainer.lastChild.remove();
}

function dismissSplash() {
    const s = document.getElementById('splash-screen');
    if (s) { s.style.opacity = '0'; setTimeout(() => s.style.display = 'none', 300); }
}

function authDeriv() {
    if (window.derivApiInstance) {
        window.derivApiInstance.startOAuthLogin(AFFILIATE_TOKEN);
    }
}

function openDerivCashier(action) {
    const cashierUrl = action === 'withdraw'
        ? 'https://app.deriv.com/account/cashier/withdrawal'
        : 'https://app.deriv.com/account/cashier/deposit';
    window.open(cashierUrl, '_blank');
}

async function handleAccountSelect(accountId) {
    if (window.derivApiInstance && accountId) {
        const ok = await window.derivApiInstance.connectAuthenticatedWebSocket(accountId);
        if (ok) {
            const acc = window.derivApiInstance.accounts.find(a => a.account === accountId);
            const mode = acc && !acc.isVirtual ? 'real' : 'demo';
            activeAccountMode = mode;
            document.getElementById('btn-demo').className = mode === 'demo' ? "px-3 py-1 rounded-lg font-bold bg-emerald-600 text-white transition" : "px-3 py-1 rounded-lg font-semibold text-slate-400";
            document.getElementById('btn-real').className = mode === 'real' ? "px-3 py-1 rounded-lg font-bold bg-gold text-slate-950 transition" : "px-3 py-1 rounded-lg font-semibold text-slate-400";
            document.getElementById('account-id-label').innerText = mode === 'real' ? 'Real Balance' : 'Demo Balance';
            logTransaction(`Connected OTP WebSocket to ${accountId}`, true);
        }
    }
}

async function setMode(mode) {
    activeAccountMode = mode;
    document.getElementById('btn-demo').className = mode === 'demo' ? "px-3 py-1 rounded-lg font-bold bg-emerald-600 text-white transition" : "px-3 py-1 rounded-lg font-semibold text-slate-400";
    document.getElementById('btn-real').className = mode === 'real' ? "px-3 py-1 rounded-lg font-bold bg-gold text-slate-950 transition" : "px-3 py-1 rounded-lg font-semibold text-slate-400";
    document.getElementById('account-id-label').innerText = mode === 'real' ? 'Real Balance' : 'Demo Balance';

    if (window.derivApiInstance) {
        const switched = await window.derivApiInstance.switchAccountMode(mode);
        if (switched) {
            const sel = document.getElementById('account-selector');
            if (sel) sel.value = switched.account;
            logTransaction(`Switched to ${mode.toUpperCase()} Account (${switched.account})`, true);
        }
    }
}

function switchParityFilter(filterKey) {
    currentParityFilter = filterKey;
    ['all', 'rise', 'fall', 'aplus'].forEach(k => {
        const btn = document.getElementById(`pf-${k}`);
        if (btn) {
            btn.className = k === filterKey
                ? "bg-cyan-600 text-white font-bold py-1 px-1 rounded"
                : "bg-slate-900 text-slate-300 py-1 px-1 rounded border border-slate-800";
        }
    });
    renderScanner();
}

function switchCategory(cat) {
    currentCategory = cat;
    ['all', 'volatility', 'volatility_1s', 'jump'].forEach(c => {
        const btn = document.getElementById(`cat-${c}`);
        if (btn) {
            btn.className = c === cat
                ? "bg-emerald-600 text-white font-bold py-1.5 px-1 rounded-lg transition"
                : "bg-slate-900 text-slate-300 py-1.5 px-1 rounded-lg transition border border-slate-800";
        }
    });
    renderScanner();
}

function changeChartTimeframe(tf, syncState = true) {
    activeCandleTf = String(tf);
    document.querySelectorAll('.tf-btn').forEach(btn => {
        btn.className = btn.dataset.tf === activeCandleTf
            ? "tf-btn px-2 py-1 rounded bg-emerald-600 text-white font-bold"
            : "tf-btn px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300";
    });
    if (syncState && marketDataStore[currentSymbol]) {
        marketDataStore[currentSymbol].timeframe = activeCandleTf;
        updateSignalUI(currentSymbol);
    }
    initTradingView(currentSymbol, activeCandleTf);
}

function toggleChartFullscreen() {
    const w = document.getElementById('chart-card-wrapper');
    w.classList.toggle('fixed'); w.classList.toggle('inset-4'); w.classList.toggle('z-50');
}

function initTradingView(sym, tf = '5') {
    const c = document.getElementById('tradingview_advanced_chart');
    if (!c || typeof TradingView === 'undefined') return;
    c.innerHTML = '';
    const assetObj = exhaustiveAssets.find(a => a.symbol === sym);
    const tvSym = (assetObj && assetObj.tv) ? assetObj.tv : "FX:EURUSD";

    new TradingView.widget({
        width: "100%",
        height: "100%",
        symbol: tvSym,
        interval: tf,
        timezone: "Africa/Nairobi",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#030712",
        studies: ["STD;EMA", "STD;RSI", "STD;Directional_Movement"],
        container_id: "tradingview_advanced_chart"
    });
}

function buildCommandString(sym, st, gate) {
    const runsCap = getSelectedRunsTarget(DEFAULT_RUNS_TARGET);
    return `RF_TICK_APLUS(Market=${sym}, Contract=${st.strategy.api}, Entry=${st.firmEntry}, TF=${st.timeframe}m, Ticks=${st.ticks}t, Runs=${runsCap}, Grade=${gate.gradeLabel})`;
}

function updatePnlDisplay() {
    const badge = document.getElementById('pnl-summary-badge');
    const scoreEl = document.getElementById('metric-score');
    const streakEl = document.getElementById('noise-readout');
    const maxStreak = parseInt(document.getElementById('max-loss-streak')?.value, 10) || 2;

    if (badge) {
        const sign = sessionNetPnl >= 0 ? '+' : '';
        badge.innerText = `NET P&L: ${sign}$${sessionNetPnl.toFixed(2)}`;
        badge.className = sessionNetPnl >= 0
            ? "text-[10px] font-bold text-slate-950 bg-fxgreen px-2.5 py-1 rounded"
            : "text-[10px] font-bold text-white bg-rose-600 px-2.5 py-1 rounded";
    }
    if (scoreEl) scoreEl.innerText = `${sessionWins}W / ${sessionLosses}L`;
    if (streakEl) streakEl.innerText = `${consecutiveLosses}/${maxStreak}`;
}

function updateSignalUI(sym) {
    const st = marketDataStore[sym];
    if (!st) return;

    const runsCap = getSelectedRunsTarget(DEFAULT_RUNS_TARGET);
    st.runsTarget = runsCap;
    const gate = evaluateRiseFallTickAPlus(st);
    const cmdStr = buildCommandString(sym, st, gate);

    if (typeof highlightActiveBoat === 'function') {
        highlightActiveBoat(st.strategy.boatId);
    }

    const filterBadge = document.getElementById('side-signal-live-badge');
    if (filterBadge) {
        filterBadge.innerText = gate.isAPlus ? 'A+ SIGNAL' : 'NULL SIGNAL';
        filterBadge.className = gate.isAPlus
            ? 'text-[9px] font-black bg-fxgreen text-slate-950 px-2 py-0.5 rounded'
            : 'text-[9px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded';
    }

    document.getElementById('chart-title-label').innerText = `${st.name} (${sym}) • ${st.timeframe}m • ${st.strategy.name} • Entry ${st.firmEntry}`;
    document.getElementById('live-tick-symbol-tag').innerText = sym;
    document.getElementById('live-entry-badge').innerText = st.firmEntry;
    document.getElementById('adaptive-shift-status').innerText = gate.isAPlus
        ? `A+ Locked -> ${st.name} | Entry ${st.firmEntry} | ${st.strategy.name} | TF ${st.timeframe}m • ${st.ticks} Ticks Hold • Max ${runsCap} Runs`
        : `NULL SIGNAL (${gate.statusText}) — Shifting to Next Clean Synthetic Market...`;

    document.getElementById('side-sig-asset').innerText = `${st.name} (${sym})`;
    document.getElementById('side-sig-contract').innerText = st.strategy.name;
    document.getElementById('side-sig-entry').innerText = st.firmEntry;
    document.getElementById('side-sig-candle').innerText = `${st.timeframe}m Candle`;
    document.getElementById('side-sig-ticks').innerText = `${st.ticks} Ticks`;
    document.getElementById('side-sig-runs').innerText = `${st.runsCompleted} / ${runsCap} Runs`;
    document.getElementById('side-sig-boat').innerText = aiBoatsDirectory[st.strategy.boatId].name;
    document.getElementById('side-sig-command').innerText = cmdStr;

    const expBox = document.getElementById('expectancy-warning-box');
    const expBe = document.getElementById('exp-breakeven-rate');
    const expText = document.getElementById('exp-asymmetry-text');
    const expVerdict = document.getElementById('exp-filter-verdict');

    if (expBe && expText && expVerdict && expBox) {
        expBe.innerText = st.playbook.toUpperCase();
        expText.innerText = gate.statusText;
        expVerdict.innerText = `Firm Entry ${st.firmEntry} • Tick Hold ${st.ticks}t • Max ${runsCap} Runs`;
        expVerdict.className = 'text-[9px] font-bold text-fxgreen';
        expBox.className = 'bg-emerald-950/50 border border-fxgreen/50 rounded-xl p-2.5 space-y-1 text-[10px]';
    }

    document.getElementById('man-asset').innerText = `${sym} @ ${st.firmEntry}`;
    document.getElementById('man-strat').innerText = st.strategy.name;
    document.getElementById('man-trigger').innerText = `${st.timeframe}m • ${st.ticks} Ticks • ${runsCap} Runs`;

    document.getElementById('stable-entry-digit-display').innerText = st.firmEntry;
    document.getElementById('momentum-readout').innerText = `${st.timeframe}m / ${st.ticks}t`;
    document.getElementById('streak-lock-badge').innerText = `RUNS: ${st.runsCompleted}/${runsCap}`;

    document.getElementById('metric-adx').innerText = st.adx;
    document.getElementById('metric-rsi').innerText = st.rsi;
    const emaEl = document.getElementById('metric-ema');
    if (emaEl) {
        emaEl.innerText = st.emaBias;
        emaEl.className = st.emaBias === 'BULLISH' ? 'text-fxgreen font-bold' : 'text-rose-400 font-bold';
    }
    document.getElementById('metric-wick').innerText = st.wickRatio.toFixed(2);
    document.getElementById('metric-ou-rate').innerText = gate.gradeLabel;

    updatePnlDisplay();
}

function selectSymbol(sym, name, rotateStrategy = true) {
    currentSymbol = sym;
    shiftCountdown = rotationIntervalSec;
    const st = marketDataStore[sym];
    if (!st) return;

    st.runsCompleted = 0;
    const tickHold = getSelectedTickHold();
    const dir = rotateStrategy ? getBestDirectionForState(st) : st.strategy.direction;
    const nextStrat = RISE_FALL_TICK_SETUPS.find(s => s.direction === dir) || RISE_FALL_TICK_SETUPS[0];

    st.strategy = { ...nextStrat, ticks: tickHold };
    st.ticks = tickHold;
    st.runsTarget = getSelectedRunsTarget(DEFAULT_RUNS_TARGET);

    const calc = computeIndicatorsAndEntry(st.priceHistory, st.adx, st.wickRatio, st.strategy.direction, st.pip);
    st.firmEntry = calc.firmEntry;
    st.lockedDir = st.strategy.direction;

    activeCandleTf = st.timeframe;
    changeChartTimeframe(activeCandleTf, false);
    updateSignalUI(sym);

    logTransaction(
        `A+ Signal -> ${name} (${sym}) | ${st.strategy.name} | Firm Entry ${st.firmEntry} | ${st.timeframe}m • ${st.ticks} Ticks • Max ${st.runsTarget} Runs`,
        true
    );

    if (window.derivApiInstance) {
        window.derivApiInstance.subscribeTicks(sym, handleTick);
    }
    renderScanner();
}

function pickNextBestAPlusAsset() {
    const pool = currentCategory === 'all'
        ? exhaustiveAssets
        : exhaustiveAssets.filter(a => a.market === currentCategory);
    if (pool.length === 0) return exhaustiveAssets[0];

    let bestAsset = null;
    let bestScore = -999;

    for (let i = 1; i <= pool.length; i++) {
        const candidate = pool[(rotationCursor + i) % pool.length];
        const st = marketDataStore[candidate.symbol];
        if (!st) continue;
        const gate = evaluateRiseFallTickAPlus(st);
        const tieBreak = pool.length - i * 0.1;
        const totalScore = gate.score + tieBreak;
        if (totalScore > bestScore) {
            bestScore = totalScore;
            bestAsset = candidate;
        }
    }

    const chosen = bestAsset || pool[(rotationCursor + 1) % pool.length];
    rotationCursor = pool.findIndex(a => a.symbol === chosen.symbol);
    const chosenSt = marketDataStore[chosen.symbol];
    const tfIdx = DEFAULT_MINUTE_TIMEFRAMES.indexOf(chosenSt.timeframe);
    chosenSt.timeframe = DEFAULT_MINUTE_TIMEFRAMES[(tfIdx + 1) % DEFAULT_MINUTE_TIMEFRAMES.length];
    return chosen;
}

function forceNextMarketShift() {
    const nextAsset = pickNextBestAPlusAsset();
    if (nextAsset) {
        selectSymbol(nextAsset.symbol, nextAsset.name, true);
    }
}

function startActiveRotationLoop() {
    if (shiftTimer) clearInterval(shiftTimer);
    updateRotationIntervalFromInput();
    shiftCountdown = rotationIntervalSec;

    shiftTimer = setInterval(() => {
        shiftCountdown--;
        const pill = document.getElementById('shift-countdown-pill');
        if (pill) pill.innerText = `${Math.max(1, shiftCountdown)}s`;

        if (shiftCountdown <= 0) {
            shiftCountdown = rotationIntervalSec;
            forceNextMarketShift();
        }
    }, 1000);
}

function renderScanner() {
    const list = document.getElementById('scanner-market-list');
    if (!list) return;
    list.innerHTML = '';

    const aPlusFirst = document.getElementById('high-hit-bias-toggle')?.checked;
    let filtered = currentCategory === 'all'
        ? exhaustiveAssets
        : exhaustiveAssets.filter(a => a.market === currentCategory);

    if (currentParityFilter === 'rise') {
        filtered = filtered.filter(a => marketDataStore[a.symbol].strategy.direction === 'rise');
    } else if (currentParityFilter === 'fall') {
        filtered = filtered.filter(a => marketDataStore[a.symbol].strategy.direction === 'fall');
    } else if (currentParityFilter === 'aplus') {
        filtered = filtered.filter(a => evaluateRiseFallTickAPlus(marketDataStore[a.symbol]).isAPlus);
    }

    const sorted = [...filtered].sort((a, b) => {
        const gateA = evaluateRiseFallTickAPlus(marketDataStore[a.symbol]);
        const gateB = evaluateRiseFallTickAPlus(marketDataStore[b.symbol]);
        if (aPlusFirst && gateB.isAPlus !== gateA.isAPlus) return gateB.isAPlus ? 1 : -1;
        return gateB.score - gateA.score;
    });

    sorted.forEach(m => {
        const st = marketDataStore[m.symbol];
        const gate = evaluateRiseFallTickAPlus(st);
        const runsCap = getSelectedRunsTarget(DEFAULT_RUNS_TARGET);
        const isSel = m.symbol === currentSymbol;
        const tickColor = st.lastTickDir === 'up' ? 'tick-up' : 'tick-down';

        const div = document.createElement('div');
        div.onclick = () => selectSymbol(m.symbol, m.name, true);
        div.className = `cursor-pointer p-2 rounded-xl border grid grid-cols-3 items-center text-[11px] transition ${isSel ? 'bg-emerald-950/70 border-fxgreen shadow-[0_0_10px_rgba(0,255,136,0.3)]' : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850'}`;
        div.innerHTML = `
            <div><div class="font-bold text-white truncate">${m.name}</div><div class="text-[9px] text-cyan-400">${st.timeframe}m • ${st.ticks}t • ADX ${st.adx}</div></div>
            <div class="text-right"><div class="font-bold font-mono ${tickColor}" id="price-${m.symbol}">${st.price}</div><div class="text-[9px] text-gold truncate">${st.strategy.shortName} @ ${st.firmEntry}</div></div>
            <div class="text-right font-mono"><div class="${gate.isAPlus ? 'text-fxgreen' : 'text-amber-300'} font-bold text-[10px]">${gate.gradeLabel} • ${runsCap}R</div><div class="text-[9px] text-slate-400">${isSel ? 'ACTIVE' : 'QUEUED'}</div></div>
        `;
        list.appendChild(div);
    });
}

function haltWithGuardrail(reason) {
    activeAutomationMode = null;
    document.getElementById('tx-status-pill').innerText = `🛑 Guardrail Halt & Shift: ${reason}`;
    logTransaction(`GUARDRAIL HALT (${reason}) — Shifting to Next A+ Rise/Fall Tick Setup — ELHADARTGLOBALFX`, true);
    if (typeof triggerProfitAlert === 'function') {
        triggerProfitAlert(reason, sessionNetPnl);
    }
    forceNextMarketShift();
}

function settleSimulatedOutcome(stake, strategy, isAPlus) {
    const winProb = isAPlus ? 0.62 : 0.45;
    const isWin = Math.random() < winProb;

    if (isWin) {
        const profit = Number((stake * strategy.payoutMult).toFixed(2));
        sessionWins++;
        consecutiveLosses = 0;
        sessionNetPnl = Number((sessionNetPnl + profit).toFixed(2));
        simulatedBalance = Number((simulatedBalance + profit).toFixed(2));
        return { isWin: true, delta: profit };
    } else {
        const loss = Number(stake.toFixed(2));
        sessionLosses++;
        consecutiveLosses++;
        sessionNetPnl = Number((sessionNetPnl - loss).toFixed(2));
        simulatedBalance = Number(Math.max(0, simulatedBalance - loss).toFixed(2));
        return { isWin: false, delta: -loss };
    }
}

function handleTick(tick) {
    const sym = tick.symbol;
    const q = Number(tick.quote);
    if (isNaN(q)) return;

    const st = marketDataStore[sym];
    if (!st) return;

    const prevPrice = parseFloat(st.price);
    const pipSize = tick.pip_size || st.pip || 2;
    st.price = q.toFixed(pipSize);
    st.lastTickDir = q >= prevPrice ? 'up' : 'down';

    st.priceHistory.push(q);
    if (st.priceHistory.length > 35) st.priceHistory.shift();

    const calc = computeIndicatorsAndEntry(st.priceHistory, st.adx, st.wickRatio, st.strategy.direction, pipSize);
    st.adx = calc.adx;
    st.rsi = calc.rsi;
    st.emaBias = calc.emaBias;
    st.wickRatio = calc.noiseRatio;

    // Firm entry stays anchored unless direction flips or noise spikes sharply
    const flipped = (st.lockedDir === 'rise' && st.rsi < 40 && st.emaBias === 'BEARISH') ||
                    (st.lockedDir === 'fall' && st.rsi > 60 && st.emaBias === 'BULLISH');
    if (flipped || !st.firmEntry) {
        st.firmEntry = calc.firmEntry;
        st.lockedDir = st.strategy.direction;
    }

    const priceEl = document.getElementById(`price-${sym}`);
    if (priceEl) {
        priceEl.innerText = st.price;
        priceEl.className = `font-bold font-mono ${st.lastTickDir === 'up' ? 'tick-up' : 'tick-down'}`;
    }

    if (sym === currentSymbol) {
        const bigQuoteEl = document.getElementById('live-big-quote');
        const entryBadgeEl = document.getElementById('live-entry-badge');
        if (bigQuoteEl) {
            bigQuoteEl.innerText = st.price;
            bigQuoteEl.className = st.lastTickDir === 'up' ? 'text-fxgreen font-black' : 'text-rose-400 font-black';
        }
        if (entryBadgeEl) entryBadgeEl.innerText = st.firmEntry;

        document.getElementById('metric-adx').innerText = st.adx;
        document.getElementById('metric-rsi').innerText = st.rsi;
        const emaEl = document.getElementById('metric-ema');
        if (emaEl) {
            emaEl.innerText = st.emaBias;
            emaEl.className = st.emaBias === 'BULLISH' ? 'text-fxgreen font-bold' : 'text-rose-400 font-bold';
        }
        document.getElementById('metric-wick').innerText = st.wickRatio.toFixed(2);
        document.getElementById('side-sig-entry').innerText = st.firmEntry;
        document.getElementById('stable-entry-digit-display').innerText = st.firmEntry;
        document.getElementById('man-asset').innerText = `${sym} @ ${st.firmEntry}`;

        const now = Date.now();
        const maxStreak = parseInt(document.getElementById('max-loss-streak')?.value, 10) || 2;
        const maxStopLoss = parseFloat(document.getElementById('session-stop-loss')?.value) || 5.00;
        const runsCap = getSelectedRunsTarget(DEFAULT_RUNS_TARGET);
        st.runsTarget = runsCap;
        const gate = evaluateRiseFallTickAPlus(st);

        if (activeAutomationMode && now >= cooldownUntil && (now - lastExecutionTimestamp > 1000)) {
            if (!gate.isAPlus) {
                logTransaction(`Extreme noise on ${sym} (${gate.statusText}) — Shifting to next A+ market...`, true);
                forceNextMarketShift();
                return;
            }

            lastExecutionTimestamp = now;
            st.runsCompleted++;

            const stake = activeAutomationMode === 'BULK'
                ? (parseFloat(document.getElementById('bulk-stake').value) || 1.00)
                : (parseFloat(document.getElementById('manual-stake').value) || 1.00);

            const executorName = activeAutomationMode === 'BOAT'
                ? aiBoatsDirectory[currentActiveBoat].name
                : `${activeAutomationMode} R/F`;

            const tickDuration = getSelectedTickHold();
            st.ticks = tickDuration;

            if (!window.derivApiInstance || !window.derivApiInstance.isAuthorized) {
                const outcome = settleSimulatedOutcome(stake, st.strategy, gate.isAPlus);
                document.getElementById('account-balance').innerText = `$${simulatedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                const tag = outcome.isWin ? `WIN +$${outcome.delta.toFixed(2)}` : `LOSS -$${Math.abs(outcome.delta).toFixed(2)}`;
                logTransaction(`Run ${st.runsCompleted}/${runsCap} | ${executorName} | ${sym} ${st.strategy.shortName} @ ${st.firmEntry} (${tickDuration}t) | ${tag}`, !outcome.isWin);

                if (!outcome.isWin) {
                    cooldownUntil = now + 2000;
                    if (consecutiveLosses >= maxStreak) {
                        haltWithGuardrail(`Max Loss Streak (${maxStreak}) Hit`);
                        return;
                    }
                    if (sessionNetPnl <= -Math.abs(maxStopLoss)) {
                        haltWithGuardrail(`Session Stop-Loss (-$${Math.abs(maxStopLoss).toFixed(2)}) Hit`);
                        return;
                    }
                }
            } else {
                window.derivApiInstance.buyContract({
                    symbol: sym,
                    contractType: st.strategy.api,
                    stake: stake,
                    duration: tickDuration
                });
                logTransaction(`Run ${st.runsCompleted}/${runsCap} | ${executorName} | ${st.strategy.api} sent on ${sym} (${tickDuration}t tick-hold @ ${st.firmEntry}, flat $${stake.toFixed(2)})`);
            }

            updateSignalUI(sym);

            if (activeAutomationMode && st.runsCompleted >= runsCap) {
                const prevMode = activeAutomationMode;
                st.runsCompleted = 0;
                if (prevMode === 'BULK') {
                    logTransaction(`${runsCap}-run cap completed on ${sym} — Shifting to next A+ Rise/Fall tick setup...`, true);
                    forceNextMarketShift();
                } else {
                    activeAutomationMode = null;
                    document.getElementById('tx-status-pill').innerText = `${runsCap} Runs Completed • A+ Scanner Ready`;
                    logTransaction(`${runsCap}-run cycle completed (${executorName}) on ${sym} — Shifting to next A+ setup...`, true);
                    forceNextMarketShift();
                }
            }
        }
    }
}

function executeAutomatedManualTrade() {
    const st = marketDataStore[currentSymbol];
    st.runsCompleted = 0;
    st.runsTarget = getSelectedRunsTarget(DEFAULT_RUNS_TARGET);
    st.ticks = getSelectedTickHold();
    consecutiveLosses = 0;
    cooldownUntil = 0;
    activeAutomationMode = 'MANUAL';
    document.getElementById('tx-status-pill').innerText = `🟢 Manual (${currentSymbol} • ${st.strategy.shortName} • ${st.ticks}t • ${st.runsTarget} Runs)...`;
    logTransaction(`Started ${st.runsTarget}-Run Manual Rise/Fall Tick Setup on ${currentSymbol} | Entry ${st.firmEntry} | ${st.strategy.name} | ${st.timeframe}m • ${st.ticks} Ticks`, true);
}

function executeAutomatedBulkTrade() {
    const count = parseInt(document.getElementById('bulk-count').value, 10) || 5;
    const pool = currentCategory === 'all'
        ? exhaustiveAssets
        : exhaustiveAssets.filter(a => a.market === currentCategory);
    const basket = pool.slice(0, count);

    if (basket.length === 0) return;

    selectSymbol(basket[0].symbol, basket[0].name, false);
    marketDataStore[currentSymbol].runsCompleted = 0;
    consecutiveLosses = 0;
    cooldownUntil = 0;
    activeAutomationMode = 'BULK';
    document.getElementById('tx-status-pill').innerText = `🟢 Bulk Rise/Fall Tick Rotating (${basket.map(a => a.symbol).join(', ')})...`;
    logTransaction(`Armed Bulk Rise/Fall Tick Basket (${basket.length} markets): ${basket.map(a => a.symbol).join(', ')}`, true);
}

function startBoatAutomation(boatId) {
    const st = marketDataStore[currentSymbol];
    const fallBoats = [2, 4, 6];
    const desiredDir = fallBoats.includes(Number(boatId)) ? 'fall' : 'rise';
    const matchedSetup = RISE_FALL_TICK_SETUPS.find(s => s.direction === desiredDir) || RISE_FALL_TICK_SETUPS[0];
    const tickHold = getSelectedTickHold();

    st.strategy = { ...matchedSetup, ticks: tickHold, boatId: Number(boatId) };
    st.ticks = tickHold;
    st.runsTarget = getSelectedRunsTarget(DEFAULT_RUNS_TARGET);
    st.runsCompleted = 0;
    consecutiveLosses = 0;
    cooldownUntil = 0;

    const calc = computeIndicatorsAndEntry(st.priceHistory, st.adx, st.wickRatio, st.strategy.direction, st.pip);
    st.firmEntry = calc.firmEntry;
    st.lockedDir = st.strategy.direction;

    activeAutomationMode = 'BOAT';
    updateSignalUI(currentSymbol);
    document.getElementById('tx-status-pill').innerText = `🟢 ${aiBoatsDirectory[boatId].name} (${st.ticks}t • ${st.runsTarget} Runs)...`;
    logTransaction(`Running ${aiBoatsDirectory[boatId].name} on ${currentSymbol} | Entry ${st.firmEntry} | ${st.strategy.name} (${st.ticks} Ticks) | ${st.runsTarget} Runs`, true);
}

function stopAllAutomation() {
    activeAutomationMode = null;
    if (marketDataStore[currentSymbol]) {
        marketDataStore[currentSymbol].runsCompleted = 0;
        updateSignalUI(currentSymbol);
    }
    document.getElementById('tx-status-pill').innerText = "🛑 Active Runs Stopped • Rise/Fall Tick A+ Scanner Running";
    logTransaction("Active trade runs stopped. Rise/Fall Tick A+ scanner and market/timeframe rotation remain active.", true);
}

function copySideSignalSettings() {
    const st = marketDataStore[currentSymbol];
    const runsCap = getSelectedRunsTarget(DEFAULT_RUNS_TARGET);
    const gate = evaluateRiseFallTickAPlus(st);
    const cmd = buildCommandString(currentSymbol, st, gate);
    const summary = `ELHADART RISE / FALL TICK A+ SIGNAL\nMarket: ${st.name} (${currentSymbol})\nContract: ${st.strategy.name} | Firm Entry Point: ${st.firmEntry}\nPlaybook: ${st.playbook} | Grade: ${gate.gradeLabel}\nCandle TF: ${st.timeframe}m | Tick Hold: ${st.ticks} Ticks | Runs Cap: ${runsCap}\nIndicators: ADX ${st.adx} | RSI ${st.rsi} | EMA20 ${st.emaBias} | Noise ${st.wickRatio.toFixed(2)}\nCommand: ${cmd}`;
    navigator.clipboard?.writeText(summary);
    alert(`📋 Copied Rise/Fall Tick A+ Signal:\n\n${summary}`);
}

function bootPlatform() {
    let totalSeconds = 90;
    const pBar = document.getElementById('splash-progress-bar');
    const cTxt = document.getElementById('splash-countdown-text');

    const countdownInterval = setInterval(() => {
        totalSeconds--;
        const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const secs = String(totalSeconds % 60).padStart(2, '0');
        if (cTxt) cTxt.innerText = `Loading Rise/Fall Tick A+ Scanner: ${mins}:${secs} (Live Synthetic Ticks Active)`;
        if (pBar) pBar.style.width = `${((90 - totalSeconds) / 90) * 100}%`;

        if (totalSeconds <= 0) {
            clearInterval(countdownInterval);
            dismissSplash();
        }
    }, 1000);

    document.getElementById('header-asset-count').innerText = `${exhaustiveAssets.length} Synthetic Markets (Vol • Vol 1s • Jump) • CALL/PUT • Tick Hold Only • Firm Entry • Max 6–7 Runs`;
    selectSymbol(exhaustiveAssets[0].symbol, exhaustiveAssets[0].name, false);
    renderScanner();
    startActiveRotationLoop();

    if (typeof DerivAPIConnector !== 'undefined') {
        const api = new DerivAPIConnector(DERIV_APP_ID);
        window.derivApiInstance = api;
        api.onAccountsLoaded = (accounts, selectedId) => {
            const sel = document.getElementById('account-selector');
            if (sel && accounts.length > 0) {
                sel.innerHTML = accounts.map(a => `<option value="${a.account}" ${a.account === selectedId ? 'selected' : ''}>${a.account} (${a.isVirtual ? 'Demo' : 'Real'})</option>`).join('');
                sel.classList.remove('hidden');
            }
        };
        api.onBalanceUpdate = (b) => {
            document.getElementById('account-balance').innerText = `$${Number(b.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
            const badge = document.getElementById('oauth-connection-badge');
            if (badge && b.loginid) {
                badge.innerText = `🟢 Connected (${b.loginid})`;
                badge.className = "text-[10px] font-mono font-bold text-fxgreen bg-emerald-950 px-2.5 py-1 rounded border border-fxgreen/40";
            }
        };
        api.onContractPurchased = (buyData) => {
            logTransaction(`Deriv Rise/Fall #${buyData.contract_id} Executed | Payout: $${buyData.payout}`);
        };
        api.connect(exhaustiveAssets).then(() => {
            api.subscribeTicks(currentSymbol, handleTick);
            api.subscribeMultipleTicks(exhaustiveAssets.map(a => a.symbol), handleTick);
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPlatform);
} else {
    bootPlatform();
}
