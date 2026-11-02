// ==UserScript==
// @name         Die Stämme Tools (Depot-Verkauf + Raubzug)
// @namespace    staemme-exchange-helper
// @version      3.0
// @description  Premium-Depot: Rohstoffe verkaufen (Marktplatz, stoppt bei Botschutz). Raubzug: Auto-Start mit Log, Freischalten und Botschutz-Stopp. Hauptgebäude: Auto-Beenden. Läuft je nach Seite.
// @match        https://*.die-staemme.de/game.php*
// @match        https://*.staemme.ch/game.php*
// @updateURL    https://github.com/trolodil/djungelfosi/raw/refs/heads/main/staemme-rohstoffe-verkaufen.user.js
// @downloadURL  https://github.com/trolodil/djungelfosi/raw/refs/heads/main/staemme-rohstoffe-verkaufen.user.js
// @grant        none
// ==/UserScript==

// =====================================================================
// Gemeinsam: Schnellleiste (Links zu den Seiten)
// =====================================================================
const STM_VERSION = '3.0';

const NAV_LINKS = [
    { short: 'HG',      title: 'Hauptgebäude',  query: 'screen=main',                 screen: 'main' },
    { short: 'Raubzug', title: 'Raubzug',       query: 'screen=place&mode=scavenge',  screen: 'place',  mode: 'scavenge' },
    { short: 'Depot',   title: 'Premium-Depot', query: 'screen=market&mode=exchange', screen: 'market', mode: 'exchange' },
    { short: 'Rekr.',   title: 'Rekrutieren',   query: 'screen=train',                screen: 'train' },
];

// Entspricht {game} aus den Schnellleisten: game.php?village=ID (und ggf. t=...)
function gameUrl(query) {
    const cur = new URLSearchParams(location.search);
    const keep = [];
    ['village', 't'].forEach(k => { if (cur.get(k)) keep.push(k + '=' + encodeURIComponent(cur.get(k))); });
    keep.push(query);
    return location.origin + '/game.php?' + keep.join('&');
}

// ---------- Gemeinsames Aussehen ----------
// Schwebend: kompakte Box. Angedockt (.stm-docked): volle Inhaltsbreite, Bereiche nebeneinander.
const STM_CSS = `
.stm-box{box-sizing:border-box;}
.stm-box .stm-sec{margin-bottom:6px;}
.stm-box .stm-title{font-weight:bold;}
.stm-box .stm-ver{font-weight:normal;color:#7d510f;}
.stm-box label{cursor:pointer;}
.stm-box .stm-stack label{display:block;margin-bottom:3px;}
.stm-box .stm-inline label{display:inline-block;margin:0 10px 0 0;}
.stm-box button{cursor:pointer;}
.stm-box button.btn,.stm-box #rz_btn{min-height:36px;padding:6px 14px;font-size:14px;font-weight:bold;}
.stm-box .stm-nav{display:flex;flex-wrap:wrap;gap:6px;}
.stm-box .stm-nav a{flex:1 1 40%;box-sizing:border-box;text-align:center;padding:10px 6px;border:1px solid #7d510f;border-radius:5px;color:#3a2800;text-decoration:none;font:15px Arial,sans-serif;background:#f9ecc8;}
.stm-box .stm-nav a.stm-cur{background:#c9a96a;font-weight:bold;}
.stm-box .stm-nav a.stm-tg{flex:1 1 100%;border:0;background:none;padding:2px 0;font-size:12px;color:#7d510f;text-decoration:underline;}
.stm-box #dv_start{width:100%;margin-bottom:6px;}
.stm-box #dv_single{display:flex;gap:4px;}
.stm-box #dv_single button{flex:1;}
.stm-box #dv_log{max-height:140px;overflow:auto;background:#fff8e1;border:1px solid #c1a264;padding:4px;}
.stm-box #rz_info{margin-top:4px;font-size:11px;font-weight:bold;}
.stm-box #rz_log{margin-top:4px;background:#fffbe8;border:1px solid #c9a96a;height:95px;overflow-y:auto;font:10px/1.35 monospace;padding:2px 3px;}
.stm-box .stm-auto{margin-top:8px;padding-top:8px;border-top:1px solid #c1a264;text-align:center;}
.stm-box .stm-atitle{font-weight:bold;margin-bottom:6px;}
.stm-box .stm-btn{width:100%;border:1px solid #333;border-radius:5px;padding:10px 14px;font:bold 15px Arial,sans-serif;color:#fff;cursor:pointer;}
.stm-box .stm-status{margin-top:6px;font-size:12px;}
.stm-box.stm-docked{display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px 18px;}
.stm-box.stm-docked .stm-sec{margin:0;}
.stm-box.stm-docked .stm-title{align-self:center;}
.stm-box.stm-docked .stm-nav{flex:1 1 100%;}
.stm-box.stm-docked .stm-nav a{flex:1 1 0;min-width:64px;}
.stm-box.stm-docked .stm-nav a.stm-tg{flex:1 1 100%;}
.stm-box.stm-docked .stm-stack label{display:inline-block;margin:0 14px 0 0;white-space:nowrap;}
.stm-box.stm-docked .stm-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.stm-box.stm-docked #dv_start{width:auto;margin:0;}
.stm-box.stm-docked .stm-log{flex:1 1 100%;}
.stm-box.stm-docked #dv_log{max-height:90px;}
.stm-box.stm-docked #rz_log{height:80px;font-size:11px;}
.stm-box.stm-docked .stm-auto{display:flex;align-items:center;gap:10px;border-top:0;padding-top:0;text-align:left;}
.stm-box.stm-docked .stm-atitle,.stm-box.stm-docked .stm-status{margin:0;}
.stm-box.stm-docked .stm-btn{width:auto;min-width:90px;}
.stm-box .stm-foot{font-size:10px;color:#7d510f;text-align:right;margin:2px 0 0;}
.stm-box.stm-docked .stm-foot{flex:1 1 100%;margin:-4px 0 0;}
`;
function ensureStyle() {
    if (document.getElementById('stm-style')) return;
    const st = document.createElement('style');
    st.id = 'stm-style';
    st.textContent = STM_CSS;
    (document.head || document.documentElement).appendChild(st);
}

// ---------- Platzierung der GUI-Boxen ----------
// Standard: angedockt zwischen Schnellleiste (#quickbar_outer) und Rohstoffleiste.
// Alternativ frei schwebend rechts oben. Umschalter in der Schnellleiste, wird gemerkt.
const DOCK_KEY = 'staemmeTools_dock';
function dockPref() { try { return localStorage.getItem(DOCK_KEY) !== '0'; } catch (e) { return true; } }
function setDockPref(v) { try { localStorage.setItem(DOCK_KEY, v ? '1' : '0'); } catch (e) {} }

const TABLE_PARTS = /^(TABLE|TBODY|THEAD|TFOOT|TR)$/;
function spotAt(node, after) {
    // Nicht mitten in eine Tabelle einfügen, sondern davor/dahinter
    let n = node;
    while (n.parentNode && TABLE_PARTS.test(n.parentNode.nodeName)) n = n.parentNode;
    return n.parentNode ? { parent: n.parentNode, before: after ? n.nextSibling : n } : null;
}
function dockSpot() {
    const wood = document.getElementById('wood');
    const quick = document.getElementById('quickbar_outer');
    // 1) direkt unter der Schnellleiste (wenn sie über den Rohstoffen liegt)
    if (quick && (!wood || (quick.compareDocumentPosition(wood) & Node.DOCUMENT_POSITION_FOLLOWING))) {
        return spotAt(quick, true);
    }
    // 2) sonst direkt über der Rohstoffleiste
    const content = document.getElementById('content_value');
    if (wood && content) {
        let n = wood;
        while (n.parentElement && n.parentElement !== document.body && !n.parentElement.contains(content)) n = n.parentElement;
        return spotAt(n, false);
    }
    return null;
}
function applyPlacement(el) {
    ensureStyle();
    const disp = el.style.display;
    const spot = dockPref() ? dockSpot() : null;
    const wide = el.classList.contains('stm-box'); // Boxen werden breit, der Alarm-Marker bleibt klein
    el.classList.toggle('stm-docked', !!spot);
    if (spot) {
        el.style.cssText = el.dataset.floatCss + ';position:relative;top:auto;right:auto;left:auto;' +
            (wide ? 'width:auto;margin:4px 0;' : 'margin:4px 8px;');
        spot.parent.insertBefore(el, spot.before);
    } else {
        el.style.cssText = el.dataset.floatCss;
        document.body.appendChild(el);
    }
    el.style.display = disp;
}
function placeBox(el) {
    el.dataset.staemmeBox = '1';
    el.dataset.floatCss = el.style.cssText; // Layout im schwebenden Zustand merken
    applyPlacement(el);
}

function makeNav() {
    const cur = new URLSearchParams(location.search);
    const wrap = document.createElement('div');
    wrap.className = 'stm-sec stm-nav';
    NAV_LINKS.forEach(l => {
        const isHere = cur.get('screen') === l.screen && (!l.mode || cur.get('mode') === l.mode);
        const a = document.createElement('a');
        a.href = gameUrl(l.query);
        a.textContent = l.short;
        a.title = l.title;
        if (isHere) a.className = 'stm-cur';
        wrap.appendChild(a);
    });
    const tg = document.createElement('a');
    tg.href = '#';
    tg.className = 'stm-tg';
    const refresh = () => { tg.textContent = dockPref() ? '↗ frei schweben' : '↙ oben andocken'; };
    refresh();
    tg.addEventListener('click', e => {
        e.preventDefault();
        setDockPref(!dockPref());
        document.querySelectorAll('[data-staemme-box]').forEach(applyPlacement);
        refresh();
    });
    wrap.appendChild(tg);
    return wrap;
}

// Kleine Fußzeile unten rechts: Name + Versionsnummer
function makeFoot(name) {
    const d = document.createElement('div');
    d.className = 'stm-sec stm-foot';
    d.textContent = name + ' v' + STM_VERSION;
    return d;
}

// Botschutz-Erkennung (für Depot-Verkauf und Raubzug gemeinsam)
const BOT_SELECTORS = [
    '#bot_check', '#botprotection_quest', '.bot-protection-row',
    '#bot_protection', '.botprotection', 'iframe[src*="captcha"]',
    'iframe[src*="recaptcha"]', '.h-captcha', '.g-recaptcha', '#captcha'
];
function botProtectionVisible() {
    for (const sel of BOT_SELECTORS) {
        const el = document.querySelector(sel);
        if (el && (el.offsetParent !== null || getComputedStyle(el).position === 'fixed')) return true;
    }
    return false;
}

// =====================================================================
// Teil 1: Premium-Depot Rohstoffe verkaufen (screen=market&mode=exchange)
// =====================================================================
(function () {
    'use strict';

    // Nur auf Marktplatz -> Premium-Depot aktiv
    const params = new URLSearchParams(location.search);
    if (params.get('screen') !== 'market' || params.get('mode') !== 'exchange') return;

    // ---------- Einstellungen ----------
    const RES = [
        { key: 'wood',  name: 'Holz',  col: 1 },
        { key: 'stone', name: 'Lehm',  col: 2 },
        { key: 'iron',  name: 'Eisen', col: 3 },
    ];
    const DEFAULT_DELAY = 7;      // Sekunden zwischen den Rohstoffen
    const DEFAULT_FACTOR = 1.5;   // Kurs + 50 %
    const STEP = 1000;            // volle Tausender
    const VERSION = STM_VERSION;

    // ---------- Helfer ----------
    const rawSleep = ms => new Promise(r => setTimeout(r, ms));
    // Wartet in kleinen Schritten und bricht sofort ab, sobald der Botschutz erkannt wurde
    const sleep = async ms => {
        const end = Date.now() + ms;
        guard();
        while (Date.now() < end) {
            await rawSleep(Math.min(100, Math.max(0, end - Date.now())));
            guard();
        }
    };
    const num = s => parseInt(String(s).replace(/[^\d]/g, ''), 10) || 0;

    function rowByLabel(label) {
        return [...document.querySelectorAll('table tr')].find(tr =>
            tr.cells && tr.cells[0] && tr.cells[0].textContent.trim().toLowerCase().startsWith(label.toLowerCase())
        );
    }

    function getStock(key) {
        const el = document.getElementById(key);
        return el ? num(el.textContent) : 0;
    }

    function getRate(col) {
        const row = rowByLabel('Verhältnis');
        if (!row || !row.cells[col]) return 0;
        const m = row.cells[col].textContent.match(/\d+/);
        return m ? parseInt(m[0], 10) : 0;
    }

    function getDepotRoom(col) {
        const vorrat = rowByLabel('Vorrat');
        const kap = rowByLabel('Kapazität');
        if (!vorrat || !kap) return Infinity;
        return Math.max(0, num(kap.cells[col].textContent) - num(vorrat.cells[col].textContent));
    }

    function getMerchantCapacity() {
        const t = document.body.innerText;
        const m = t.match(/Händler:\s*(\d+)\s*\/\s*(\d+)/);
        const c = t.match(/Maximale Transportmenge:\s*(\d+)/);
        if (!m) return 0;
        // "Maximale Transportmenge" ist bereits die Kapazität der FREIEN Händler
        if (c) return parseInt(c[1], 10);
        return parseInt(m[1], 10) * STEP;
    }

    function sellInput(col) {
        const row = rowByLabel('Rohstoffe verkaufen');
        if (!row) return null;
        return row.cells[col].querySelector('input[type="text"], input:not([type])');
    }

    function setValue(input, value) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, String(value));
        ['input', 'keyup', 'change'].forEach(ev => input.dispatchEvent(new Event(ev, { bubbles: true })));
    }

    function clearSellInputs() {
        RES.forEach(r => { const i = sellInput(r.col); if (i) setValue(i, ''); });
    }

    function calcAmount(r, remainingCap, factor) {
        const stock = getStock(r.key);
        const rate = getRate(r.col);
        if (!rate) return { amt: 0, rate, stock };
        // Reicht die Transportmenge für den ganzen Vorrat, wird nicht auf Tausender
        // abgerundet, sondern der Vorrat selbst minus Kurs * Faktor verkauft.
        const exactAmt = stock - Math.round(rate * factor);
        if (exactAmt >= rate && Math.ceil(exactAmt / STEP) * STEP <= remainingCap && exactAmt <= getDepotRoom(r.col)) {
            return { amt: exactAmt, rate, stock };
        }
        // Erst die Obergrenzen auf volle Tausender anwenden (Vorrat, freie Händler, Depot-Platz),
        // danach erst den Kurs-Abzug (Kurs * Faktor) - so passt die Menge immer in die Händler.
        let base = Math.floor(stock / STEP) * STEP;
        base = Math.min(base, Math.floor(remainingCap / STEP) * STEP, Math.floor(getDepotRoom(r.col) / STEP) * STEP);
        let amt = base - Math.round(rate * factor);
        if (amt < rate) amt = 0; // würde keinen Premiumpunkt ergeben
        return { amt, rate, stock };
    }

    // Verteilt die freie Transportmenge (in Tausendern) so, dass die Vorräte
    // am Ende möglichst gleich hoch sind: immer vom aktuell größten Vorrat 1000 abziehen.
    function planSlots(list, capacity) {
        const slots = {};
        const info = list.map(r => {
            slots[r.key] = 0;
            return {
                key: r.key,
                stock: getStock(r.key),
                max: Math.min(Math.floor(getStock(r.key) / STEP), Math.floor(getDepotRoom(r.col) / STEP)),
            };
        });
        let k = Math.floor(capacity / STEP);
        while (k > 0) {
            let best = null;
            info.forEach(o => {
                if (slots[o.key] >= o.max) return;
                const left = o.stock - slots[o.key] * STEP;
                if (!best || left > best.left) best = { key: o.key, left };
            });
            if (!best) break;
            slots[best.key]++;
            k--;
        }
        return slots;
    }

    async function waitFor(fn, timeout = 8000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            guard();
            const v = fn();
            if (v) return v;
            await sleep(100);
        }
        return null;
    }

    function findConfirmButton() {
        const byClass = document.querySelector('.popup_box .btn-confirm-yes, .btn-confirm-yes');
        if (byClass) return byClass;
        return [...document.querySelectorAll('.popup_box button, .popup_box input[type="button"], .popup_box input[type="submit"]')]
            .find(b => /bestätigen/i.test(b.textContent || b.value || ''));
    }

    function findCalcButton() {
        return [...document.querySelectorAll('input[type="submit"], button')]
            .find(b => /bestes angebot berechnen/i.test(b.value || b.textContent || ''));
    }

    // ---------- GUI ----------
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;top:80px;right:20px;z-index:99999;width:250px;background:#f4e4bc;border:2px solid #7d510f;border-radius:6px;padding:8px;font:12px Verdana,sans-serif;color:#000;box-shadow:0 2px 8px rgba(0,0,0,.4)';
    box.className = 'stm-box';
    box.innerHTML = `
        <div class="stm-sec stm-stack">
            <label><input type="checkbox" id="dv_wood" checked> Holz</label>
            <label><input type="checkbox" id="dv_stone" checked> Lehm</label>
            <label><input type="checkbox" id="dv_iron" checked> Eisen</label>
        </div>
        <div class="stm-sec stm-stack">
            <label>Aufschlag Kurs: <input type="number" id="dv_factor" value="${DEFAULT_FACTOR}" step="0.1" style="width:55px"></label>
            <label>Pause (Sek.): <input type="number" id="dv_delay" value="${DEFAULT_DELAY}" style="width:55px"></label>
        </div>
        <div class="stm-sec stm-actions">
            <button id="dv_start" class="btn">Alle starten</button>
            <div id="dv_single"></div>
        </div>
        <div class="stm-sec stm-log"><div id="dv_log"></div></div>
        <div class="stm-sec stm-foot">Depot-Verkauf v${VERSION}</div>`;
    placeBox(box);
    box.insertBefore(makeNav(), box.firstChild);

    const logEl = box.querySelector('#dv_log');
    const log = (msg, warn) => {
        const d = document.createElement('div');
        d.textContent = new Date().toLocaleTimeString() + '  ' + msg;
        if (warn) d.style.cssText = 'color:#c00;font-weight:bold;';
        logEl.appendChild(d);
        logEl.scrollTop = logEl.scrollHeight;
    };

    let running = false;

    // ---------- Botschutz ----------
    let botStop = false;
    class BotStop extends Error {}
    function guard() { if (botStop) throw new BotStop('Botschutz'); }

    function botAlarm() {
        if (botStop) return;
        botStop = true;
        log('BOTSCHUTZ - alles gestoppt', true);
        box.style.display = 'none';
        const red = document.createElement('div');
        red.textContent = '!';
        red.style.cssText = 'position:fixed;top:80px;right:20px;width:60px;height:60px;z-index:2147483647;background:#d00;color:#fff;font:bold 40px/60px Arial;text-align:center;border:3px solid #fff;box-shadow:0 0 12px #000;cursor:pointer;';
        red.title = 'Botschutz erkannt – Verkauf gestoppt. Klicken zum Ausblenden.';
        red.onclick = () => { red.remove(); box.style.display = ''; };
        placeBox(red);
        document.title = '⚠ BOTSCHUTZ – ' + document.title;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const o = ctx.createOscillator();
            o.connect(ctx.destination);
            o.frequency.value = 880;
            o.start();
            setTimeout(() => o.stop(), 800);
        } catch (e) {}
    }
    // Vor jedem neuen Lauf: Botschutz sichtbar -> nicht starten
    function canStart() {
        if (botProtectionVisible()) { botAlarm(); return false; }
        botStop = false;
        return true;
    }
    setInterval(() => { if (!botStop && botProtectionVisible()) botAlarm(); }, 300);
    new MutationObserver(() => { if (!botStop && botProtectionVisible()) botAlarm(); })
        .observe(document.documentElement, { childList: true, subtree: true });

    async function sellOne(r, remainingCap, factor) {
        guard();
        const { amt, rate, stock } = calcAmount(r, remainingCap, factor);
        log(`${r.name}: Vorrat ${stock}, Kurs ${rate} -> Menge ${amt}`);
        if (amt <= 0) { log(`${r.name}: übersprungen`); return 0; }

        clearSellInputs();
        const input = sellInput(r.col);
        if (!input) { log('Eingabefeld nicht gefunden'); return 0; }
        setValue(input, amt);
        await sleep(300);

        const calc = findCalcButton();
        if (!calc) { log('Button "Bestes Angebot berechnen" nicht gefunden'); return 0; }
        calc.click();
        await sleep(500); // kurz warten, bis das Prüf-Fenster aufgebaut ist

        const confirm = await waitFor(findConfirmButton, 10000);
        if (!confirm) { log(`${r.name}: Bestätigungsfenster nicht erschienen (Fehler/Abbruch?)`); return 0; }
        await sleep(300);
        confirm.click();

        // Kurs hat sich geändert? Dann zeigt das Fenster eine rote Meldung und
        // muss erneut bestätigt werden (kann mehrfach passieren).
        const MAX_TRIES = 8;
        let tries = 1;
        while (true) {
            const closed = await waitFor(() => !findConfirmButton(), 3000);
            if (closed) break;
            const popup = document.querySelector('.popup_box');
            const text = popup ? popup.innerText : '';
            const btn = findConfirmButton();
            if (btn && /Wechselkurs hat sich ge(ä|ae)ndert/i.test(text)) {
                if (tries >= MAX_TRIES) { log(`${r.name}: Kurs ändert sich ständig, Abbruch nach ${tries} Versuchen`); return 0; }
                tries++;
                log(`${r.name}: Kurs geändert, bestätige erneut (Versuch ${tries})`);
                await sleep(500);
                const b2 = findConfirmButton();
                if (b2) b2.click();
            } else if (!btn) {
                break;
            } else {
                log(`${r.name}: Fenster bleibt offen, unbekannter Grund`);
                return 0;
            }
        }
        log(`${r.name}: bestätigt`);
        return Math.ceil(amt / STEP) * STEP; // belegte Transportkapazität
    }

    async function runAll() {
        if (running) return;
        if (!canStart()) return;
        running = true;
        const btn = box.querySelector('#dv_start');
        btn.disabled = true;
        try {
            const factor = parseFloat(box.querySelector('#dv_factor').value) || DEFAULT_FACTOR;
            const delay = (parseFloat(box.querySelector('#dv_delay').value) || DEFAULT_DELAY) * 1000;
            let remaining = getMerchantCapacity();
            log(`Freie Transportmenge: ${remaining}`);
            const active = RES.filter(r => box.querySelector('#dv_' + r.key).checked);
            // Reichen die Händler für alle gewählten Rohstoffe komplett? Dann alles verkaufen (ohne Abrunden).
            const needAll = active.reduce((sum, r) => {
                const exact = getStock(r.key) - Math.round(getRate(r.col) * factor);
                return sum + (exact > 0 ? Math.ceil(exact / STEP) * STEP : 0);
            }, 0);
            const sellAll = needAll <= remaining;
            const plan = sellAll ? null : planSlots(active, remaining);
            log(sellAll
                ? 'Händler reichen für alles: verkaufe Vorrat minus Kurs-Abzug'
                : 'Plan (Tausender): ' + active.map(r => `${r.name} ${plan[r.key]}`).join(', '));
            for (let i = 0; i < active.length; i++) {
                if (remaining <= 0) { log('Keine Händler mehr frei'); break; }
                const cap = sellAll ? remaining : Math.min(remaining, plan[active[i].key] * STEP);
                const used = cap > 0 ? await sellOne(active[i], cap, factor) : 0;
                remaining -= used;
                if (i < active.length - 1) {
                    log(`Warte ${delay / 1000} Sek. ...`);
                    await sleep(delay);
                }
            }
            log('Fertig');
        } catch (e) {
            if (e instanceof BotStop) log('Abgebrochen wegen Botschutz', true);
            else { log('Fehler: ' + e.message); console.error(e); }
        } finally {
            running = false;
            btn.disabled = false;
        }
    }

    // Einzel-Buttons (je Klick genau ein Rohstoff)
    const single = box.querySelector('#dv_single');
    RES.forEach(r => {
        const b = document.createElement('button');
        b.className = 'btn';
        b.textContent = r.name;
        b.style.flex = '1';
        b.onclick = async () => {
            if (running) return;
            if (!canStart()) return;
            running = true;
            try {
                const factor = parseFloat(box.querySelector('#dv_factor').value) || DEFAULT_FACTOR;
                await sellOne(r, getMerchantCapacity(), factor);
            } catch (e) {
                if (e instanceof BotStop) log('Abgebrochen wegen Botschutz', true);
                else log('Fehler: ' + e.message);
            }
            running = false;
        };
        single.appendChild(b);
    });

    box.querySelector('#dv_start').addEventListener('click', runAll);
})();

// =====================================================================
// Teil 2: Raubzug Auto-Start (screen=place&mode=scavenge)
// =====================================================================
(function () {
    'use strict';

    // Nur auf Plündern -> Raubzüge aktiv
    const pageParams = new URLSearchParams(location.search);
    if (pageParams.get('screen') !== 'place' || pageParams.get('mode') !== 'scavenge') return;

    const KEY = 'raubzug_bot_running';
    const KEY_SEL = 'raubzug_bot_selected';
    const KEY_UNLOCK = 'raubzug_bot_unlock';
    const KEY_OPT = 'raubzug_bot_optimized';
    const KEY_LOG = 'raubzug_bot_log';
    const LOG_MAX = 60;
    const rnd = (a, b) => Math.floor(a + Math.random() * (b - a));
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // Beuteanteil der 4 Raubzüge (faul, bescheiden, klug, großartig)
    const RATIO = [0.10, 0.25, 0.50, 0.75];
    // Beutekapazität pro Einheit
    const CARRY = { spear: 25, sword: 15, axe: 10, archer: 10, light: 80, marcher: 50, heavy: 50 };

    let timer = null;
    let stopped = false;
    let busy = false;

    // ---------- GUI ----------
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;top:80px;right:20px;z-index:99999;width:190px;background:#f4e4bc;border:2px solid #7d510f;border-radius:6px;padding:8px;font:12px Verdana,sans-serif;color:#000;box-shadow:0 2px 8px rgba(0,0,0,.4)';
    box.className = 'stm-box';
    box.innerHTML =
        '<div class="stm-sec stm-actions"><button id="rz_btn"></button></div>' +
        '<div class="stm-sec stm-inline">' +
        [1, 2, 3, 4].map(n => '<label><input type="checkbox" class="rz_cb" data-i="' + (n - 1) + '"> ' + n + '</label>').join('') +
        '</div>' +
        '<div class="stm-sec stm-stack">' +
        '<label><input type="checkbox" id="rz_opt"> Optimiert (Auto-Auswahl)</label>' +
        '<label><input type="checkbox" id="rz_unlock"> Neue Stufe freischalten</label>' +
        '</div>' +
        '<div class="stm-sec"><div id="rz_info">Bereit</div></div>' +
        '<div class="stm-sec stm-log"><div id="rz_log"></div>' +
        '<a href="#" id="rz_clear" style="font-size:10px;color:#7d510f;">Log leeren</a></div>' +
        '<div class="stm-sec stm-foot">Raubzug v' + STM_VERSION + '</div>';
    placeBox(box);
    box.insertBefore(makeNav(), box.firstChild);
    const btn = box.querySelector('#rz_btn');
    const info = box.querySelector('#rz_info');
    const logBox = box.querySelector('#rz_log');

    function setInfo(t) { info.textContent = t; }
    function isRunning() { return localStorage.getItem(KEY) === '1'; }
    function renderBtn() { btn.textContent = isRunning() ? '■ Stop' : '▶ Start'; }

    // ---------- Log ----------
    function getLog() {
        try { const l = JSON.parse(localStorage.getItem(KEY_LOG)); if (Array.isArray(l)) return l; } catch (e) {}
        return [];
    }
    function renderLog() {
        logBox.innerHTML = '';
        getLog().forEach(e => {
            const d = document.createElement('div');
            d.textContent = e.t + ' ' + e.m;
            if (e.warn) d.style.cssText = 'color:#c00;font-weight:bold;';
            logBox.appendChild(d);
        });
        logBox.scrollTop = logBox.scrollHeight;
    }
    function addLog(msg, warn) {
        const n = new Date();
        const t = [n.getHours(), n.getMinutes(), n.getSeconds()].map(v => String(v).padStart(2, '0')).join(':');
        const l = getLog();
        l.push({ t: t, m: msg, warn: !!warn });
        while (l.length > LOG_MAX) l.shift();
        localStorage.setItem(KEY_LOG, JSON.stringify(l));
        renderLog();
    }
    box.querySelector('#rz_clear').addEventListener('click', e => {
        e.preventDefault();
        localStorage.setItem(KEY_LOG, '[]');
        renderLog();
    });

    // ---------- Einstellungen ----------
    function loadSel() {
        try {
            const s = JSON.parse(localStorage.getItem(KEY_SEL));
            if (Array.isArray(s) && s.length === 4) return s;
        } catch (e) {}
        return [true, true, true, true];
    }
    function saveSel() {
        const s = [...box.querySelectorAll('.rz_cb')].map(c => c.checked);
        localStorage.setItem(KEY_SEL, JSON.stringify(s));
    }
    const sel0 = loadSel();
    box.querySelectorAll('.rz_cb').forEach(c => {
        c.checked = !!sel0[+c.dataset.i];
        c.addEventListener('change', saveSel);
    });
    function selectedIdx() {
        return [...box.querySelectorAll('.rz_cb')].filter(c => c.checked).map(c => +c.dataset.i);
    }
    const unlockCb = box.querySelector('#rz_unlock');
    unlockCb.checked = localStorage.getItem(KEY_UNLOCK) === '1';
    unlockCb.addEventListener('change', () => localStorage.setItem(KEY_UNLOCK, unlockCb.checked ? '1' : '0'));

    const optCb = box.querySelector('#rz_opt');
    function applyOptUi() {
        box.querySelectorAll('.rz_cb').forEach(c => {
            c.disabled = optCb.checked;
            c.parentElement.style.opacity = optCb.checked ? '0.4' : '1';
        });
    }
    optCb.checked = localStorage.getItem(KEY_OPT) === '1';
    optCb.addEventListener('change', () => {
        localStorage.setItem(KEY_OPT, optCb.checked ? '1' : '0');
        applyOptUi();
    });
    applyOptUi();

    renderLog();

    btn.addEventListener('click', () => {
        if (isRunning()) {
            stopBot('Manuell gestoppt');
        } else {
            localStorage.setItem(KEY, '1');
            stopped = false;
            renderBtn();
            addLog('Start');
            cycle();
        }
    });

    // ---------- Botschutz ----------
    // botProtectionVisible() kommt aus dem gemeinsamen Teil oben.

    function botAlarm() {
        if (stopped) return;
        stopBot('BOTSCHUTZ!');
        addLog('BOTSCHUTZ - pausiert', true);
        box.style.display = 'none';
        const red = document.createElement('div');
        red.textContent = '!';
        red.style.cssText = 'position:fixed;top:5px;left:5px;width:60px;height:60px;z-index:2147483647;background:#d00;color:#fff;font:bold 40px/60px Arial;text-align:center;border:3px solid #fff;box-shadow:0 0 12px #000;cursor:pointer;';
        red.title = 'Botschutz erkannt – Bot gestoppt. Klicken zum Ausblenden.';
        red.onclick = () => { red.remove(); box.style.display = ''; };
        placeBox(red);
        document.title = '⚠ BOTSCHUTZ – ' + document.title;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const o = ctx.createOscillator();
            o.connect(ctx.destination);
            o.frequency.value = 880;
            o.start();
            setTimeout(() => o.stop(), 800);
        } catch (e) {}
    }

    setInterval(() => { if (!stopped && botProtectionVisible()) botAlarm(); }, 300);
    new MutationObserver(() => { if (!stopped && botProtectionVisible()) botAlarm(); })
        .observe(document.documentElement, { childList: true, subtree: true });

    function stopBot(msg) {
        const wasRunning = isRunning();
        stopped = true;
        localStorage.setItem(KEY, '0');
        clearTimeout(timer);
        renderBtn();
        setInfo(msg);
        if (wasRunning && msg === 'Manuell gestoppt') addLog('Stop (manuell)');
    }

    // ---------- Hilfsfunktionen ----------
    function parseTime(s) {
        const m = (s || '').trim().match(/(\d+):(\d+):(\d+)/);
        return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : null;
    }

    function maxRemainingSeconds() {
        const list = [...document.querySelectorAll('.scavenge-option .return-countdown')];
        const secs = list.map(e => parseTime(e.textContent)).filter(v => v !== null && v >= 0);
        return secs.length ? Math.max(...secs) : null;
    }

    const options = () => [...document.querySelectorAll('.scavenge-option')];

    function isFree(i) {
        const o = options()[i];
        if (!o) return false;
        const b = o.querySelector('a.free_send_button');
        return !!(b && b.offsetParent !== null);
    }

    function getAvailable() {
        const a = {};
        document.querySelectorAll('input.unitsInput').forEach(inp => {
            const name = inp.name;
            if (name === 'knight' || !CARRY[name]) return;
            const link = document.querySelector('a.units-entry-all[data-unit="' + name + '"]');
            const n = link ? (parseInt(link.textContent.replace(/\D/g, ''), 10) || 0) : 0;
            if (n > 0) a[name] = n;
        });
        return a;
    }

    /*
     * Dauer: t = ((Kapazität * Beuteanteil)^2 * 100)^0.45 + 1800
     * Gleiche Dauer <=> Kapazität * Beuteanteil gleich <=> Anteil ~ 1 / Beuteanteil
     */
    function plan(avail, idxs) {
        const inv = idxs.map(i => 1 / RATIO[i]);
        const sum = inv.reduce((a, b) => a + b, 0);
        const w = inv.map(v => v / sum);

        const types = Object.keys(avail).sort((a, b) => CARRY[b] - CARRY[a]);
        const totalCap = types.reduce((s, u) => s + avail[u] * CARRY[u], 0);
        const alloc = idxs.map(() => ({}));
        const cap = idxs.map(() => 0);

        types.forEach(u => {
            let given = 0;
            idxs.forEach((_, k) => {
                const c = Math.floor(avail[u] * w[k]);
                alloc[k][u] = c;
                cap[k] += c * CARRY[u];
                given += c;
            });
            for (let left = avail[u] - given; left > 0; left--) {
                let best = 0, bestDef = -Infinity;
                idxs.forEach((_, k) => {
                    const def = totalCap * w[k] - cap[k];
                    if (def > bestDef) { bestDef = def; best = k; }
                });
                alloc[best][u] = (alloc[best][u] || 0) + 1;
                cap[best] += CARRY[u];
            }
        });
        return alloc;
    }

    /*
     * Optimierung: Bei gleicher Laufzeit hat jeder gewählte Raubzug dieselbe Beute H.
     *   H = Gesamtkapazität / Summe(1/Beuteanteil der gewählten Raubzüge)
     *   Beute gesamt = k * H   (k = Anzahl gewählter Raubzüge)
     *   Dauer ~ 100^0.45 * H^0.9 + 1800  (Weltgeschwindigkeit kürzt sich beim Vergleich raus)
     * Gewählt wird die Kombination mit der höchsten Beute pro Zeit.
     */
    const MIN_UNITS = 10; // pro Raubzug müssen mindestens 10 Einheiten gesendet werden
    const unitCount = a => Object.keys(a).reduce((s, u) => s + (a[u] || 0), 0);

    function bestSubset(avail, freeIdxs) {
        const C = Object.keys(avail).reduce((s, u) => s + avail[u] * CARRY[u], 0);
        let best = null, bestRate = -1;
        for (let mask = 1; mask < (1 << freeIdxs.length); mask++) {
            const sub = freeIdxs.filter((_, b) => mask & (1 << b));
            // Kombination verwerfen, wenn ein Raubzug unter 10 Einheiten bekäme
            if (plan(avail, sub).some(a => unitCount(a) < MIN_UNITS)) continue;
            const invSum = sub.reduce((s, i) => s + 1 / RATIO[i], 0);
            const H = C / invSum;
            const dur = Math.pow(100, 0.45) * Math.pow(H, 0.9) + 1800;
            const rate = sub.length * H / dur;
            if (rate > bestRate) { bestRate = rate; best = sub; }
        }
        return best || [];
    }

    function setInputs(units) {
        document.querySelectorAll('input.unitsInput').forEach(inp => {
            if (inp.name === 'knight') return;
            const v = units[inp.name] || 0;
            inp.value = v > 0 ? String(v) : '';
            ['input', 'keyup', 'change'].forEach(ev => inp.dispatchEvent(new Event(ev, { bubbles: true })));
        });
    }

    // Freischalt-Kosten je Raubzug (Index 0-basiert: 1 = Stufe 2, 2 = Stufe 3, 3 = Stufe 4)
    const UNLOCK_COST = {
        1: { wood: 200,   stone: 250,   iron: 200 },
        2: { wood: 1000,  stone: 1200,  iron: 1000 },
        3: { wood: 10000, stone: 12000, iron: 10000 }
    };
    const RES_NAMES = { wood: 'Holz', stone: 'Lehm', iron: 'Eisen' };
    const resNow = k => {
        const el = document.getElementById(k);
        return el ? (parseInt(el.textContent.replace(/\D/g, ''), 10) || 0) : 0;
    };
    // Liefert die fehlenden Rohstoffe (leer = genug da oder Kosten unbekannt)
    function missingForUnlock(idx, have) {
        const cost = UNLOCK_COST[idx];
        if (!cost) return [];
        return Object.keys(cost)
            .filter(k => have[k] < cost[k])
            .map(k => RES_NAMES[k] + ' ' + have[k] + '/' + cost[k]);
    }

    // Nächste Raubzug-Stufe freischalten, wenn möglich (Rohstoffe reichen)
    async function tryUnlock() {
        if (!unlockCb.checked) return;
        const ub = [...document.querySelectorAll('.scavenge-option a.unlock-button, .scavenge-option .unlock-button')]
            .find(b => b.offsetParent !== null && !b.classList.contains('btn-disabled'));
        if (!ub) return;
        // Vorher prüfen, ob die Rohstoffe für diese Stufe reichen
        const idx = options().indexOf(ub.closest('.scavenge-option'));
        const missing = missingForUnlock(idx, { wood: resNow('wood'), stone: resNow('stone'), iron: resNow('iron') });
        if (missing.length) {
            addLog('Stufe ' + (idx + 1) + ' freischalten: zu wenig ' + missing.join(', '));
            return;
        }
        ub.click();
        await sleep(rnd(900, 1500));
        const pop = document.querySelector('.popup_box, .popup_box_container, #popup_box_scavenge_unlock');
        if (!pop) { addLog('Freischalten angeklickt'); return; }
        const yes = [...pop.querySelectorAll('a.btn, button, input[type=button], input[type=submit]')]
            .find(b => /freischalten|^\s*ja\s*$|best.tigen|^\s*ok\s*$/i.test((b.textContent || b.value || '')) && !b.classList.contains('btn-disabled') && !b.disabled);
        if (yes) {
            yes.click();
            await sleep(rnd(1200, 2000));
            addLog('Raubzug freigeschaltet');
        } else {
            const close = pop.querySelector('.popup_box_close, a.popup_box_close');
            if (close) close.click();
            addLog('Freischalten: zu wenig Rohstoffe');
        }
    }

    function scheduleReload(seconds, label) {
        const wait = (seconds + rnd(4, 12)) * 1000;
        const end = Date.now() + wait;
        const mm = Math.floor(wait / 60000), ss = Math.round((wait % 60000) / 1000);
        addLog('Warte ' + mm + ':' + String(ss).padStart(2, '0') + ' min');
        clearTimeout(timer);
        (function tick() {
            if (stopped || !isRunning()) return;
            const left = Math.max(0, Math.round((end - Date.now()) / 1000));
            setInfo(label + ' ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'));
            if (Date.now() >= end) { location.reload(); return; }
            timer = setTimeout(tick, 1000);
        })();
    }

    // ---------- Hauptlogik ----------
    async function cycle() {
        if (busy || stopped || !isRunning()) return;
        busy = true;
        try {
            if (botProtectionVisible()) return botAlarm();
            setInfo('Prüfe…');
            await sleep(rnd(800, 1800));
            if (botProtectionVisible()) return botAlarm();

            const avail = getAvailable();
            const freeAll = [0, 1, 2, 3].filter(isFree);
            let idxs;
            if (optCb.checked) {
                idxs = Object.keys(avail).length ? bestSubset(avail, freeAll) : [];
                if (idxs.length) addLog('Optimiert: RZ ' + idxs.map(i => i + 1).join(','));
            } else {
                idxs = selectedIdx().filter(isFree);
                // Raubzüge mit weniger als 10 Einheiten weglassen und neu verteilen
                while (idxs.length > 1) {
                    const al = plan(avail, idxs);
                    const counts = al.map(unitCount);
                    const minC = Math.min(...counts);
                    if (minC >= MIN_UNITS) break;
                    const drop = counts.indexOf(minC);
                    addLog('RZ ' + (idxs[drop] + 1) + ' übersprungen (<' + MIN_UNITS + ' Einh.)');
                    idxs.splice(drop, 1);
                }
                if (idxs.length === 1 && Object.keys(avail).reduce((s, u) => s + avail[u], 0) < MIN_UNITS) idxs = [];
            }
            const sent = [];

            if (idxs.length && Object.keys(avail).length) {
                const alloc = plan(avail, idxs);
                for (let k = 0; k < idxs.length; k++) {
                    if (stopped) return;
                    const i = idxs[k];
                    setInfo('Sende Raubzug ' + (i + 1) + '…');
                    setInputs(alloc[k]);
                    await sleep(rnd(500, 1000));
                    const o = options()[i];
                    const b = o && o.querySelector('a.free_send_button');
                    if (!b || b.classList.contains('btn-disabled')) continue;
                    if (botProtectionVisible()) return botAlarm();
                    b.click();
                    sent.push(i + 1);
                    await sleep(rnd(1800, 3000));
                    if (botProtectionVisible()) return botAlarm();
                }
                addLog(sent.length ? 'Gesendet: RZ ' + sent.join(',') : 'Zu wenig Truppen');
                setInfo('Gestartet');
                await sleep(1000);
            } else {
                addLog(Object.keys(avail).length ? 'Zu wenig Truppen (<' + MIN_UNITS + ')' : 'Nichts zu senden');
                setInfo('Nichts zu senden');
            }

            if (stopped) return;
            await tryUnlock();
            if (botProtectionVisible()) return botAlarm();

            const rem = maxRemainingSeconds();
            scheduleReload(rem !== null ? rem : 60, rem !== null ? 'Nächster Lauf in' : 'Neuprüfung in');
        } finally {
            busy = false;
        }
    }

    renderBtn();
    if (isRunning()) {
        stopped = false;
        addLog('Seite geladen, läuft weiter');
        cycle();
    }
})();

// =====================================================================
// Teil 3: Schnellleiste im Hauptgebäude (screen=main, mit Auto-Beenden) und beim Rekrutieren (screen=train)
// =====================================================================
(function () {
    'use strict';
    if (!['main', 'train'].includes(new URLSearchParams(location.search).get('screen'))) return;

    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;top:80px;right:20px;z-index:99999;width:190px;background:#f4e4bc;border:2px solid #7d510f;border-radius:6px;padding:8px;font:12px Verdana,sans-serif;color:#000;box-shadow:0 2px 8px rgba(0,0,0,.4)';
    box.className = 'stm-box';
    box.appendChild(makeNav());
    box.appendChild(makeFoot('Schnellzugriff'));
    placeBox(box);

    if (new URLSearchParams(location.search).get('screen') === 'main') initAutoBeenden(box);

    // ----- Auto-Beenden (nur Hauptgebäude) -----
    // Klickt den grünen "Beenden"-Button, sobald ein Bauauftrag unter 3 Minuten fällt.
    // Wird IMMER manuell gestartet. Nur wenn die Seite nach einem eigenen Klick neu lädt,
    // läuft es automatisch weiter (kurzes Zeitfenster) - beim späteren erneuten Öffnen ist es aus.
    function initAutoBeenden(parent) {
        const RESUME_KEY = 'autoBeendenResume';
        const RESUME_MS = 20000;
        let running = false;
        try {
            const t = parseInt(sessionStorage.getItem(RESUME_KEY), 10);
            running = !!t && Date.now() - t < RESUME_MS;
            sessionStorage.removeItem(RESUME_KEY);
        } catch (e) {}

        let lastClick = 0;
        let emptyTicks = 0;

        const sec = document.createElement('div');
        sec.className = 'stm-sec stm-auto';
        const title = document.createElement('div');
        title.textContent = 'Auto-Beenden';
        title.className = 'stm-atitle';
        const btn = document.createElement('button');
        btn.className = 'stm-btn';
        const status = document.createElement('div');
        status.className = 'stm-status';
        sec.append(title, btn, status);
        parent.insertBefore(sec, parent.querySelector('.stm-foot')); // Fußzeile bleibt ganz unten

        function render(msg) {
            btn.textContent = running ? 'Stop' : 'Start';
            btn.style.background = running ? '#2e9e2e' : '#b03030';
            status.textContent = msg || (running ? 'Läuft …' : 'Aus');
        }
        function setRunning(val, msg) {
            running = val;
            emptyTicks = 0;
            if (!val) { try { sessionStorage.removeItem(RESUME_KEY); } catch (e) {} }
            render(msg);
        }
        btn.addEventListener('click', () => setRunning(!running));
        render();

        const queueRows = () => document.querySelectorAll('#buildqueue tr[class*="buildorder_"]');
        const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

        function tick() {
            // Kein Neuladen nach dem letzten Klick -> Merker für die Fortsetzung wieder löschen
            if (lastClick && Date.now() - lastClick > 5000) {
                try { sessionStorage.removeItem(RESUME_KEY); } catch (e) {}
            }
            if (!running) return;

            if (queueRows().length === 0) {
                emptyTicks++;
                if (emptyTicks >= 3) setRunning(false, 'Fertig – nichts mehr in der Bauschleife');
                return;
            }
            emptyTicks = 0;

            // Nur der grüne Gratis-Button (unter 3 Minuten)
            const free = document.querySelector('#buildqueue a.btn-instant-free');
            if (free && visible(free) && Date.now() - lastClick > 3000) {
                lastClick = Date.now();
                render('Beende Bauauftrag …');
                setTimeout(() => {
                    try { sessionStorage.setItem(RESUME_KEY, String(Date.now())); } catch (e) {}
                    free.click();
                }, 200 + Math.random() * 400);
            } else if (Date.now() - lastClick > 3000) {
                render('Läuft – warte auf < 3 Min …');
            }
        }
        setInterval(tick, 1000);
    }
})();
