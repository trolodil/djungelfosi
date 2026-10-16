// ==UserScript==
// @name         Die Stämme - Premium-Depot Rohstoffe verkaufen
// @namespace    staemme-exchange-helper
// @version      1.6
// @description  Berechnet pro Rohstoff die Verkaufsmenge, trägt sie ein, berechnet das beste Angebot und bestätigt.
// @match        https://*.die-staemme.de/game.php*
// @updateURL    https://github.com/trolodil/djungelfosi/raw/refs/heads/main/staemme-rohstoffe-verkaufen.user.js
// @downloadURL  https://github.com/trolodil/djungelfosi/raw/refs/heads/main/staemme-rohstoffe-verkaufen.user.js
// @grant        none
// ==/UserScript==

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
    const VERSION = '1.6';

    // ---------- Helfer ----------
    const sleep = ms => new Promise(r => setTimeout(r, ms));
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
    box.innerHTML = `
        <div style="font-weight:bold;margin-bottom:6px;">Depot-Verkauf <span style="font-weight:normal;color:#7d510f;">v${VERSION}</span></div>
        <label style="display:block;margin-bottom:3px;"><input type="checkbox" id="dv_wood" checked> Holz</label>
        <label style="display:block;margin-bottom:3px;"><input type="checkbox" id="dv_stone" checked> Lehm</label>
        <label style="display:block;margin-bottom:6px;"><input type="checkbox" id="dv_iron" checked> Eisen</label>
        <label style="display:block;margin-bottom:3px;">Aufschlag Kurs: <input type="number" id="dv_factor" value="${DEFAULT_FACTOR}" step="0.1" style="width:55px"></label>
        <label style="display:block;margin-bottom:6px;">Pause (Sek.): <input type="number" id="dv_delay" value="${DEFAULT_DELAY}" style="width:55px"></label>
        <button id="dv_start" class="btn" style="width:100%;margin-bottom:6px;">Alle starten</button>
        <div id="dv_single" style="display:flex;gap:4px;margin-bottom:6px;"></div>
        <div id="dv_log" style="max-height:140px;overflow:auto;background:#fff8e1;border:1px solid #c1a264;padding:4px;"></div>`;
    document.body.appendChild(box);

    const logEl = box.querySelector('#dv_log');
    const log = msg => {
        const d = document.createElement('div');
        d.textContent = new Date().toLocaleTimeString() + '  ' + msg;
        logEl.appendChild(d);
        logEl.scrollTop = logEl.scrollHeight;
    };

    let running = false;

    async function sellOne(r, remainingCap, factor) {
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
            log('Fehler: ' + e.message);
            console.error(e);
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
            running = true;
            try {
                const factor = parseFloat(box.querySelector('#dv_factor').value) || DEFAULT_FACTOR;
                await sellOne(r, getMerchantCapacity(), factor);
            } catch (e) { log('Fehler: ' + e.message); }
            running = false;
        };
        single.appendChild(b);
    });

    box.querySelector('#dv_start').addEventListener('click', runAll);
})();
