(function () {
    'use strict';

    /*
     * GALOWIE – RAPORTY WALKI
     *
     * - ATAK / OBRONA
     * - 4 człony Galów
     * - tylko dane przeciwnika
     * - bez łupu
     * - zachowuje starą notatkę
     * - usuwa przypadkowo wklejony JS ze starej notatki
     * - zapisuje report_export tylko raz dla danego raportu
     * - automatyczny zapis do wioski przeciwnika
     * - krótkie powiadomienie po zapisie
     */

    const GALOWIE = [':G:', ';G;', '~G~', '-G-'];

    const UNITS = [
        { key: 'spear',    name: 'Pikinier',            aliases: ['spear', 'pikinier'] },
        { key: 'sword',    name: 'Miecznik',            aliases: ['sword', 'miecznik'] },
        { key: 'axe',      name: 'Topornik',            aliases: ['axe', 'topornik'] },
        { key: 'spy',      name: 'Zwiadowca',           aliases: ['spy', 'zwiadowca'] },
        { key: 'light',    name: 'Lekki kawalerzysta',  aliases: ['light', 'lekki', 'light_cavalry'] },
        { key: 'heavy',    name: 'Ciężki kawalerzysta', aliases: ['heavy', 'ciężki', 'heavy_cavalry'] },
        { key: 'ram',      name: 'Taran',               aliases: ['ram', 'taran'] },
        { key: 'catapult', name: 'Katapulta',           aliases: ['catapult', 'katapulta'] },
        { key: 'snob',     name: 'Szlachcic',           aliases: ['snob', 'szlachcic', 'noble'] }
    ];

    function cleanText(text) {
        return String(text || '').replace(/\s+/g, ' ').trim();
    }

    function normalize(text) {
        return cleanText(text)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function numberFromText(text) {
        const m = String(text || '')
            .replace(/\s/g, '')
            .match(/-?\d[\d.]*/);

        return m
            ? (parseInt(m[0].replace(/\./g, ''), 10) || 0)
            : 0;
    }

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function gameData() {
        return window.game_data || {};
    }

    function isGal(tribe) {
        const t = cleanText(tribe);
        return !!t && GALOWIE.some(tag => t.includes(tag));
    }

    function findSide(label) {
        const elements = Array.from(document.querySelectorAll('*'));

        for (const el of elements) {
            const text = cleanText(el.textContent);

            if (text === label || text.startsWith(label)) {
                return el;
            }
        }

        return null;
    }

    function findPlayerLink(container) {
        if (!container) return null;

        return Array.from(
            container.querySelectorAll('a')
        ).find(a => {
            const href = a.getAttribute('href') || '';

            return href.includes('screen=info_player') &&
                   href.includes('id=');
        }) || null;
    }

    function extractPlayer(side) {
        const link = findPlayerLink(side);

        if (!link) {
            return {
                name: '',
                id: null
            };
        }

        const href = link.getAttribute('href') || '';
        const m = href.match(/[?&]id=(\d+)/);

        return {
            name: cleanText(link.textContent),
            id: m ? m[1] : null
        };
    }

    function extractVillage(side) {
        const result = {
            id: null,
            name: '',
            coords: '',
            continent: ''
        };

        if (!side) return result;

        const links = Array.from(
            side.querySelectorAll('a[href*="screen=info_village"]')
        );

        for (const link of links) {
            const href = link.getAttribute('href') || '';
            const text = cleanText(link.textContent);

            const id = href.match(/[?&]id=(\d+)/);
            const coords = text.match(/(\d{1,3}\|\d{1,3})/);
            const k = text.match(/K\d+/i);

            if (id) result.id = id[1];
            if (text) result.name = text;
            if (coords) result.coords = coords[1];
            if (k) result.continent = k[0];

            if (result.id) break;
        }

        if (!result.id) {
            for (const link of document.querySelectorAll(
                'a[href*="screen=info_village"]'
            )) {
                const href = link.getAttribute('href') || '';
                const text = cleanText(link.textContent);

                const id = href.match(/[?&]id=(\d+)/);
                const coords = text.match(/(\d{1,3}\|\d{1,3})/);

                if (id && coords) {
                    result.id = id[1];
                    result.name = text;
                    result.coords = coords[1];

                    const k = text.match(/K\d+/i);
                    if (k) result.continent = k[0];

                    break;
                }
            }
        }

        if (!result.coords) {
            const m = cleanText(side.textContent)
                .match(/(\d{1,3}\|\d{1,3})/);

            if (m) result.coords = m[1];
        }

        return result;
    }

    function getAttackDate() {
        for (const row of document.querySelectorAll('tr')) {
            const cells = Array.from(
                row.querySelectorAll('td, th')
            );

            if (cells.length < 2) continue;

            if (normalize(cells[0].textContent) === 'czas bitwy') {
                return cleanText(cells[1].textContent)
                    .replace(
                        /(\d{2}:\d{2}:\d{2}):\d+$/,
                        '$1'
                    );
            }
        }

        for (const el of document.querySelectorAll('*')) {
            if (cleanText(el.textContent) !== 'Czas bitwy') {
                continue;
            }

            const next = el.nextElementSibling;

            if (next) {
                return cleanText(next.textContent)
                    .replace(
                        /(\d{2}:\d{2}:\d{2}):\d+$/,
                        '$1'
                    );
            }
        }

        return 'brak danych';
    }

    function unitFromImage(img) {
        if (!img) return null;

        const text = normalize([
            img.getAttribute('src') || '',
            img.getAttribute('title') || '',
            img.getAttribute('alt') || '',
            img.getAttribute('data-unit') || '',
            img.getAttribute('class') || ''
        ].join(' '));

        return UNITS.find(unit =>
            unit.aliases.some(alias =>
                text.includes(normalize(alias))
            )
        ) || null;
    }

    function getRowNumbers(row) {
        if (!row) return [];

        const values = [];

        for (const cell of row.querySelectorAll('td, th')) {
            const text = cleanText(cell.textContent);

            if (/^\d[\d\s.]*$/.test(text)) {
                values.push(numberFromText(text));
            }
        }

        if (values.length) return values;

        return (
            cleanText(row.textContent)
                .match(/\d[\d\s.]*/g) || []
        ).map(numberFromText);
    }

    function emptyTroops() {
        const result = {};

        UNITS.forEach(unit => {
            result[unit.key] = {
                name: unit.name,
                amount: 0,
                losses: 0,
                remaining: 0
            };
        });

        return result;
    }

    function readTroops(container) {
        const result = emptyTroops();

        if (!container) return result;

        for (const table of container.querySelectorAll('table')) {
            const detected = [];

            for (const img of table.querySelectorAll('img')) {
                const unit = unitFromImage(img);

                if (
                    unit &&
                    !detected.some(x => x.key === unit.key)
                ) {
                    detected.push(unit);
                }
            }

            if (!detected.length) continue;

            let amountRow = null;
            let lossesRow = null;

            for (const row of table.querySelectorAll('tr')) {
                const text = normalize(row.textContent);

                if (text.includes('ilosc')) {
                    amountRow = row;
                }

                if (text.includes('straty')) {
                    lossesRow = row;
                }
            }

            if (!amountRow || !lossesRow) continue;

            const amounts = getRowNumbers(amountRow);
            const losses = getRowNumbers(lossesRow);

            detected.forEach((unit, i) => {
                const amount = amounts[i] || 0;
                const loss = losses[i] || 0;

                result[unit.key].amount = amount;
                result[unit.key].losses = loss;
                result[unit.key].remaining =
                    Math.max(0, amount - loss);
            });
        }

        return result;
    }

    async function getPlayerTribe(playerId) {
        if (!playerId) {
            return 'bez plemienia';
        }

        try {
            const response = await fetch(
                '/game.php?screen=info_player&id=' +
                encodeURIComponent(playerId),
                {
                    credentials: 'same-origin'
                }
            );

            if (!response.ok) {
                return 'bez plemienia';
            }

            const html = await response.text();

            const doc = new DOMParser()
                .parseFromString(html, 'text/html');

            const allyLink = doc.querySelector(
                'a[href*="screen=info_ally"]'
            );

            if (allyLink) {
                const tribe = cleanText(
                    allyLink.textContent
                );

                if (tribe) return tribe;
            }

            const body = cleanText(
                doc.body ? doc.body.textContent : ''
            );

            const m = body.match(
                /Plemię:\s*([^\n]+)/i
            );

            if (
                m &&
                cleanText(m[1]) &&
                cleanText(m[1]) !== '-'
            ) {
                return cleanText(m[1]);
            }

        } catch (e) {
            console.warn(
                'Nie udało się pobrać plemienia:',
                e
            );
        }

        return 'bez plemienia';
    }

    function getDamage() {
        const result = [];
        const text = document.body.innerText || '';

        const wall = text.match(
            /Mur\s+(\d+)\s*[→>-]\s*(\d+)/i
        );

        if (wall) {
            result.push(
                `Mur ${wall[1]} → ${wall[2]}`
            );
        }

        const place = text.match(
            /Plac\s+(\d+)\s*[→>-]\s*(\d+)/i
        );

        if (place) {
            result.push(
                `Plac ${place[1]} → ${place[2]}`
            );
        }

        return result;
    }

    function getReportExport() {

        for (const el of document.querySelectorAll(
            '[name="report_export"], #report_export'
        )) {
            const value =
                el.value ||
                el.textContent ||
                '';

            if (value.trim()) {
                return value.trim();
            }
        }

        const html =
            document.documentElement.innerHTML;

        const tagged = html.match(
            /\[report_export\]([\s\S]*?)\[\/report_export\]/i
        );

        if (tagged) {
            return tagged[1].trim();
        }

        const encoded =
            html.match(/def502[a-zA-Z0-9]+/);

        return encoded
            ? encoded[0]
            : '';
    }

    function makeNote(
        opponent,
        tribe,
        village,
        troops,
        attackType
    ) {
        let note = '';

        note +=
            `[b]⚔️ RAPORT WALKI – ${attackType}[/b]\n\n`;

        note += `[b]📅 DATA ATAKU[/b]\n`;
        note += `${getAttackDate()}\n\n`;

        note += `[b]♟️ PRZECIWNIK[/b]\n`;

        note +=
            `Gracz: [player]${opponent.name}[/player]\n`;

        if (
            tribe &&
            tribe !== 'bez plemienia'
        ) {
            note +=
                `Plemię: [ally]${tribe}[/ally]\n`;
        } else {
            note +=
                `Plemię: bez plemienia\n`;
        }

        note += '\n';

        note += `[b]🏰 WIOSKA[/b]\n`;

        note +=
            `Wioska ${village.name || opponent.name} (${village.coords})`;

        if (village.continent) {
            note += ` ${village.continent}`;
        }

        note += '\n';

        note +=
            `Współrzędne: ${village.coords}`;

        if (village.continent) {
            note += ` ${village.continent}`;
        }

        note += '\n\n';

        note += `[b]⚔️ WOJSKO[/b]\n`;

        let any = false;

        UNITS.forEach(unit => {
            const d = troops[unit.key];

            if (d && d.amount > 0) {
                any = true;

                note +=
                    `[unit]${unit.key}[/unit] ` +
                    `${unit.name}: ${d.amount}\n`;
            }
        });

        if (!any) {
            note += 'brak danych\n';
        }

        note += '\n[b]💀 STRATY[/b]\n';

        any = false;

        UNITS.forEach(unit => {
            const d = troops[unit.key];

            if (d && d.losses > 0) {
                any = true;

                note +=
                    `[unit]${unit.key}[/unit] ` +
                    `${unit.name}: ${d.losses}\n`;
            }
        });

        if (!any) {
            note += 'brak strat\n';
        }

        note += '\n[b]🛡️ POZOSTAŁO[/b]\n';

        any = false;

        UNITS.forEach(unit => {
            const d = troops[unit.key];

            if (d && d.remaining > 0) {
                any = true;

                note +=
                    `[unit]${unit.key}[/unit] ` +
                    `${unit.name}: ${d.remaining}\n`;
            }
        });

        if (!any) {
            note +=
                'brak pozostałych wojsk\n';
        }

        const damage = getDamage();

        if (damage.length) {
            note +=
                '\n[b]💥 USZKODZENIA[/b]\n';

            damage.forEach(item => {
                note += item + '\n';
            });
        }

        /*
         * ŁUP CELOWO NIE JEST TUTAJ DODAWANY.
         */

        const reportExport =
            getReportExport();

        if (reportExport) {
            note +=
                '\n[spoiler][report_export]' +
                reportExport +
                '[/report_export][/spoiler]';
        }

        return note.trim();
    }

    /*
     * Usuwanie przypadkowo wklejonego kodu JavaScript
     * ze starej notatki.
     *
     * Normalna treść notatki pozostaje.
     */
    function cleanOldNote(text) {
        let result =
            String(text || '');

        /*
         * Usuwamy kompletne tagi script.
         */
        result = result.replace(
            /<script\b[^>]*>[\s\S]*?<\/script>/gi,
            ''
        );

        /*
         * Usuwamy javascript:
         */
        result = result.replace(
            /javascript\s*:/gi,
            ''
        );

        /*
         * Usuwamy przypadkowo wklejony blok:
         *
         * $(function(){
         * ...
         * CosmeticNameExecutor.start();
         * });
         */
        result = result.replace(
            /\$\s*\(\s*function\s*\(\s*\)\s*\{[\s\S]*?CosmeticNameExecutor\.start\(\)\s*;\s*\}\s*\)\s*;?/gi,
            ''
        );

        /*
         * Drugi wariant jQuery.
         */
        result = result.replace(
            /\$\s*\(\s*document\s*\)\s*\.ready\s*\(\s*function\s*\(\s*\)\s*\{[\s\S]*?\}\s*\)\s*;?/gi,
            ''
        );

        /*
         * Charakterystyczne fragmenty kodu Plemion.
         */
        const suspicious = [
            /^\s*Timing\.init\b.*$/gim,
            /^\s*WorldSwitch\.init\b.*$/gim,
            /^\s*WorldSwitch\.worldsURL\b.*$/gim,
            /^\s*HotKeys\.init\b.*$/gim,
            /^\s*Connection\.connect\b.*$/gim,
            /^\s*DialogQueue\.consume\b.*$/gim,
            /^\s*GiftCalendar\.setNewLabel\b.*$/gim,
            /^\s*CosmeticNameExecutor\.start\b.*$/gim
        ];

        suspicious.forEach(re => {
            result = result.replace(re, '');
        });

        return result
            .replace(/\n{4,}/g, '\n\n')
            .trim();
    }

    function showToast(
        message,
        success = true
    ) {
        const old =
            document.getElementById(
                'galowie_report_toast'
            );

        if (old) {
            old.remove();
        }

        const toast =
            document.createElement('div');

        toast.id =
            'galowie_report_toast';

        toast.style.cssText = `
            position:fixed;
            top:20px;
            right:20px;
            z-index:999999;
            max-width:420px;
            padding:14px 18px;
            border-radius:8px;
            font-family:Arial,sans-serif;
            font-size:15px;
            font-weight:bold;
            box-shadow:0 4px 18px rgba(0,0,0,.35);
            ${
                success
                ? 'background:#d9f2d9;border:1px solid #65a765;color:#205520;'
                : 'background:#f4dcdc;border:1px solid #d77;color:#7a2222;'
            }
        `;

        toast.innerHTML =
            message;

        document.body.appendChild(
            toast
        );

        setTimeout(() => {
            toast.style.transition =
                'opacity .4s';

            toast.style.opacity =
                '0';

            setTimeout(
                () => toast.remove(),
                450
            );

        }, 4000);
    }

    async function saveNoteToEnemyVillage(
        villageId,
        note
    ) {
        if (!villageId) {
            return {
                saved: false,
                error:
                    'Brak ID wioski przeciwnika.'
            };
        }

        const currentVillageId =
            gameData().village
                ? gameData().village.id
                : '';

        let url =
            '/game.php?screen=info_village&id=' +
            encodeURIComponent(villageId);

        if (currentVillageId) {
            url +=
                '&village=' +
                encodeURIComponent(
                    currentVillageId
                );
        }

        const win =
            window.open(
                url,
                '_blank'
            );

        if (!win) {
            return {
                saved: false,
                error:
                    'Przeglądarka zablokowała nową kartę. Zezwól na wyskakujące okna dla Plemion.'
            };
        }

        return new Promise(resolve => {

            let attempts = 0;
            let finished = false;

            function finish(
                saved,
                error = ''
            ) {
                if (finished) return;

                finished = true;

                setTimeout(() => {
                    try {
                        win.close();
                    } catch (e) {}
                }, 1200);

                resolve({
                    saved,
                    error
                });
            }

            function trySave() {
                if (finished) return;

                attempts++;

                try {

                    if (win.closed) {
                        finish(
                            false,
                            'Karta wioski została zamknięta.'
                        );
                        return;
                    }

                    const doc =
                        win.document;

                    if (
                        !doc ||
                        !doc.body
                    ) {
                        if (
                            attempts >= 50
                        ) {
                            finish(
                                false,
                                'Nie udało się załadować wioski.'
                            );
                            return;
                        }

                        setTimeout(
                            trySave,
                            300
                        );

                        return;
                    }

                    const textarea =
                        doc.querySelector(
                            'textarea[name="note"]'
                        );

                    if (!textarea) {

                        if (
                            attempts >= 50
                        ) {
                            finish(
                                false,
                                'Nie znaleziono pola notatki.'
                            );
                            return;
                        }

                        setTimeout(
                            trySave,
                            300
                        );

                        return;
                    }

                    /*
                     * Pobieramy starą notatkę.
                     */
                    const oldNote =
                        cleanOldNote(
                            textarea.value || ''
                        );

                    /*
                     * Stara notatka zostaje,
                     * nowy raport jest dopisywany.
                     */
                    let finalNote =
                        note;

                    if (oldNote) {
                        finalNote =
                            oldNote +
                            '\n\n' +
                            note;
                    }

                    /*
                     * Ostateczne zabezpieczenie.
                     */
                    finalNote =
                        finalNote
                            .replace(
                                /<script\b[^>]*>[\s\S]*?<\/script>/gi,
                                ''
                            )
                            .replace(
                                /javascript\s*:/gi,
                                ''
                            )
                            .trim();

                    textarea.focus();

                    textarea.value =
                        finalNote;

                    textarea.dispatchEvent(
                        new Event(
                            'input',
                            {
                                bubbles: true
                            }
                        )
                    );

                    textarea.dispatchEvent(
                        new Event(
                            'change',
                            {
                                bubbles: true
                            }
                        )
                    );

                    const saveButton =
                        doc.querySelector(
                            '#note_submit_button'
                        );

                    if (!saveButton) {

                        if (
                            attempts >= 50
                        ) {
                            finish(
                                false,
                                'Nie znaleziono przycisku zapisu notatki.'
                            );
                            return;
                        }

                        setTimeout(
                            trySave,
                            300
                        );

                        return;
                    }

                    /*
                     * Prawdziwy przycisk zapisu
                     * notatki Plemion.
                     */
                    saveButton.click();

                    /*
                     * Dajemy AJAX-owi czas
                     * na zapisanie notatki.
                     */
                    setTimeout(
                        () => finish(
                            true,
                            ''
                        ),
                        1600
                    );

                } catch (error) {

                    if (
                        attempts >= 50
                    ) {
                        finish(
                            false,
                            'Błąd automatycznego zapisu: ' +
                            error.message
                        );

                        return;
                    }

                    setTimeout(
                        trySave,
                        300
                    );
                }
            }

            setTimeout(
                trySave,
                600
            );

            setTimeout(() => {

                if (!finished) {
                    finish(
                        false,
                        'Przekroczono czas oczekiwania na zapis.'
                    );
                }

            }, 18000);
        });
    }

    async function analyze() {

        const attackerSide =
            findSide('Agresor:');

        const defenderSide =
            findSide('Obrońca:');

        if (
            !attackerSide ||
            !defenderSide
        ) {
            showToast(
                '❌ Nie znaleziono danych raportu. Uruchom skrypt na stronie raportu.',
                false
            );

            return;
        }

        const attacker =
            extractPlayer(
                attackerSide
            );

        const defender =
            extractPlayer(
                defenderSide
            );

        const attackerVillage =
            extractVillage(
                attackerSide
            );

        const defenderVillage =
            extractVillage(
                defenderSide
            );

        const attackerTribe =
            await getPlayerTribe(
                attacker.id
            );

        const defenderTribe =
            await getPlayerTribe(
                defender.id
            );

        let opponent;
        let opponentTribe;
        let opponentVillage;
        let opponentSide;
        let attackType;

        /*
         * Galowie atakują przeciwnika.
         * Dla przeciwnika zapisujemy OBRONĘ.
         */
        if (
            isGal(attackerTribe) &&
            !isGal(defenderTribe)
        ) {

            opponent =
                defender;

            opponentTribe =
                defenderTribe;

            opponentVillage =
                defenderVillage;

            opponentSide =
                defenderSide;

            attackType =
                'OBRONA';

        /*
         * Przeciwnik atakuje Galów.
         * Dla przeciwnika zapisujemy ATAK.
         */
        } else if (
            !isGal(attackerTribe) &&
            isGal(defenderTribe)
        ) {

            opponent =
                attacker;

            opponentTribe =
                attackerTribe;

            opponentVillage =
                attackerVillage;

            opponentSide =
                attackerSide;

            attackType =
                'ATAK';

        /*
         * Galowie kontra Galowie.
         */
        } else if (
            isGal(attackerTribe) &&
            isGal(defenderTribe)
        ) {

            showToast(
                '⛔ Gal → Gal — notatka nie została utworzona.',
                false
            );

            return;

        /*
         * Obcy kontra obcy.
         */
        } else {

            showToast(
                '⛔ Żadna ze stron nie należy do Galów — pominięto raport.',
                false
            );

            return;
        }

        /*
         * Czytamy wyłącznie wojsko przeciwnika.
         */
        const troops =
            readTroops(
                opponentSide
            );

        const note =
            makeNote(
                opponent,
                opponentTribe,
                opponentVillage,
                troops,
                attackType
            );

        /*
         * Automatyczny zapis.
         */
        const saveResult =
            await saveNoteToEnemyVillage(
                opponentVillage.id,
                note
            );

        if (
            saveResult.saved
        ) {

            showToast(
                '🟢 <b>Notatka dodana do wioski.</b><br>' +
                escapeHtml(
                    opponent.name
                ) +
                ' — ' +
                attackType
            );

        } else {

            showToast(
                '⚠️ <b>Notatka nie została zapisana.</b><br>' +
                escapeHtml(
                    saveResult.error
                ),
                false
            );
        }
    }

    /*
     * START
     */
    analyze();

})();
