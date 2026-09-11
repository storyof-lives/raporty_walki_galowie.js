(function () {
    'use strict';

    /* =========================================================
       GALOWIE – RAPORTY WALKI
       ATAK / OBRONA
       AUTOMATYCZNY ZAPIS NOTATKI
       ========================================================= */


    /* =========================================================
       CZŁONY GALÓW
       ========================================================= */

    const GALOWIE = [
        ':G:',
        ';G;',
        '~G~',
        '-G-'
    ];


    /* =========================================================
       JEDNOSTKI
       ========================================================= */

    const UNITS = [
        {
            key: 'spear',
            name: 'Pikinier',
            aliases: ['spear', 'pikinier']
        },
        {
            key: 'sword',
            name: 'Miecznik',
            aliases: ['sword', 'miecznik']
        },
        {
            key: 'axe',
            name: 'Topornik',
            aliases: ['axe', 'topornik']
        },
        {
            key: 'spy',
            name: 'Zwiadowca',
            aliases: ['spy', 'zwiadowca']
        },
        {
            key: 'light',
            name: 'Lekki kawalerzysta',
            aliases: [
                'light',
                'lekki',
                'light_cavalry'
            ]
        },
        {
            key: 'heavy',
            name: 'Ciężki kawalerzysta',
            aliases: [
                'heavy',
                'ciężki',
                'heavy_cavalry'
            ]
        },
        {
            key: 'ram',
            name: 'Taran',
            aliases: [
                'ram',
                'taran'
            ]
        },
        {
            key: 'catapult',
            name: 'Katapulta',
            aliases: [
                'catapult',
                'katapulta'
            ]
        },
        {
            key: 'snob',
            name: 'Szlachcic',
            aliases: [
                'snob',
                'szlachcic',
                'noble'
            ]
        }
    ];


    /* =========================================================
       FUNKCJE POMOCNICZE
       ========================================================= */

    function cleanText(text) {
        return (text || '')
            .replace(/\s+/g, ' ')
            .trim();
    }


    function normalize(text) {
        return cleanText(text)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }


    function numberFromText(text) {

        if (!text) {
            return 0;
        }

        const match =
            String(text)
                .replace(/\s/g, '')
                .match(/-?\d[\d.]*/);

        if (!match) {
            return 0;
        }

        return parseInt(
            match[0].replace(/\./g, ''),
            10
        ) || 0;
    }


    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }


    function getGameData() {
        return window.game_data || {};
    }


    /* =========================================================
       CZY PLEMIĘ NALEŻY DO GALÓW
       ========================================================= */

    function isGal(tribe) {

        if (!tribe) {
            return false;
        }

        const text =
            cleanText(tribe);

        return GALOWIE.some(
            tag => text.includes(tag)
        );
    }


    /* =========================================================
       SZUKANIE AGRESORA / OBROŃCY
       ========================================================= */

    function findSide(label) {

        const elements =
            Array.from(
                document.querySelectorAll('*')
            );

        for (const element of elements) {

            const text =
                cleanText(
                    element.textContent
                );

            if (
                text === label ||
                text.startsWith(label)
            ) {
                return element;
            }
        }

        return null;
    }


    /* =========================================================
       GRACZ
       ========================================================= */

    function findPlayerLink(container) {

        if (!container) {
            return null;
        }

        const links =
            Array.from(
                container.querySelectorAll('a')
            );

        for (const link of links) {

            const href =
                link.getAttribute('href') || '';

            if (
                href.includes(
                    'screen=info_player'
                ) &&
                href.includes('id=')
            ) {
                return link;
            }
        }

        return null;
    }


    function extractPlayer(side) {

        if (!side) {
            return {
                name: '',
                id: null
            };
        }

        const link =
            findPlayerLink(side);

        if (!link) {
            return {
                name: '',
                id: null
            };
        }

        const href =
            link.getAttribute('href') || '';

        const match =
            href.match(
                /[?&]id=(\d+)/
            );

        return {
            name:
                cleanText(
                    link.textContent
                ),

            id:
                match
                    ? match[1]
                    : null
        };
    }


    /* =========================================================
       WIOSKA
       ========================================================= */

    function extractVillage(side) {

        const result = {
            id: null,
            name: '',
            coords: '',
            continent: ''
        };

        if (!side) {
            return result;
        }


        const links =
            Array.from(
                side.querySelectorAll(
                    'a[href*="screen=info_village"]'
                )
            );


        for (const link of links) {

            const href =
                link.getAttribute('href') || '';

            const text =
                cleanText(
                    link.textContent
                );


            const idMatch =
                href.match(
                    /[?&]id=(\d+)/
                );


            const coordMatch =
                text.match(
                    /(\d{1,3}\|\d{1,3})/
                );


            if (idMatch) {
                result.id =
                    idMatch[1];
            }


            if (text) {
                result.name =
                    text;
            }


            if (coordMatch) {
                result.coords =
                    coordMatch[1];
            }


            const continent =
                text.match(
                    /K\d+/i
                );


            if (continent) {
                result.continent =
                    continent[0];
            }


            if (result.id) {
                break;
            }
        }


        /*
         * Fallback – wszystkie linki do wiosek
         */

        if (!result.id) {

            const links =
                Array.from(
                    document.querySelectorAll(
                        'a[href*="screen=info_village"]'
                    )
                );


            for (const link of links) {

                const href =
                    link.getAttribute('href') || '';

                const text =
                    cleanText(
                        link.textContent
                    );


                const idMatch =
                    href.match(
                        /[?&]id=(\d+)/
                    );


                const coordMatch =
                    text.match(
                        /(\d{1,3}\|\d{1,3})/
                    );


                if (
                    idMatch &&
                    coordMatch
                ) {

                    result.id =
                        idMatch[1];

                    result.name =
                        text;

                    result.coords =
                        coordMatch[1];


                    const continent =
                        text.match(
                            /K\d+/i
                        );


                    if (continent) {
                        result.continent =
                            continent[0];
                    }


                    break;
                }
            }
        }


        /*
         * Ostateczny fallback – współrzędne
         */

        if (!result.coords) {

            const text =
                cleanText(
                    side.textContent
                );


            const match =
                text.match(
                    /(\d{1,3}\|\d{1,3})/
                );


            if (match) {
                result.coords =
                    match[1];
            }
        }


        return result;
    }


    /* =========================================================
       DATA ATAKU
       CZYLI CZAS BITWY
       ========================================================= */

    function getAttackDate() {

        /*
         * Szukamy konkretnego wiersza:
         *
         * Czas bitwy | 10.09.26 19:29:44:340
         */

        const rows =
            Array.from(
                document.querySelectorAll('tr')
            );


        for (const row of rows) {

            const cells =
                Array.from(
                    row.querySelectorAll(
                        'td, th'
                    )
                );


            if (cells.length < 2) {
                continue;
            }


            const label =
                normalize(
                    cells[0].textContent
                );


            if (
                label === 'czas bitwy'
            ) {

                let value =
                    cleanText(
                        cells[1].textContent
                    );


                /*
                 * Usuwamy milisekundy:
                 *
                 * 10.09.26 19:29:44:340
                 *
                 * →
                 *
                 * 10.09.26 19:29:44
                 */

                value =
                    value.replace(
                        /(\d{2}:\d{2}:\d{2}):\d+$/,
                        '$1'
                    );


                return value;
            }
        }


        /*
         * Drugi sposób – wyszukanie elementu
         * "Czas bitwy" i jego sąsiada.
         */

        const elements =
            Array.from(
                document.querySelectorAll('*')
            );


        for (const element of elements) {

            if (
                cleanText(
                    element.textContent
                ) !== 'Czas bitwy'
            ) {
                continue;
            }


            const next =
                element.nextElementSibling;


            if (!next) {
                continue;
            }


            let value =
                cleanText(
                    next.textContent
                );


            value =
                value.replace(
                    /(\d{2}:\d{2}:\d{2}):\d+$/,
                    '$1'
                );


            if (value) {
                return value;
            }
        }


        return 'brak danych';
    }


    /* =========================================================
       JEDNOSTKA Z IKONY
       ========================================================= */

    function unitFromImage(img) {

        if (!img) {
            return null;
        }


        const values = [

            img.getAttribute('src') || '',

            img.getAttribute('title') || '',

            img.getAttribute('alt') || '',

            img.getAttribute('data-unit') || '',

            img.getAttribute('class') || ''

        ];


        const text =
            normalize(
                values.join(' ')
            );


        for (const unit of UNITS) {

            for (const alias of unit.aliases) {

                if (
                    text.includes(
                        normalize(alias)
                    )
                ) {
                    return unit;
                }
            }
        }


        return null;
    }


    /* =========================================================
       LICZBY Z WIERSZA
       ========================================================= */

    function getRowNumbers(row) {

        if (!row) {
            return [];
        }


        const cells =
            Array.from(
                row.querySelectorAll(
                    'td, th'
                )
            );


        const values = [];


        for (const cell of cells) {

            const text =
                cleanText(
                    cell.textContent
                );


            if (
                /^\d[\d\s.]*$/.test(text)
            ) {

                values.push(
                    numberFromText(text)
                );
            }
        }


        if (values.length) {
            return values;
        }


        const text =
            cleanText(
                row.textContent
            );


        const matches =
            text.match(
                /\d[\d\s.]*/g
            ) || [];


        return matches.map(
            numberFromText
        );
    }


    /* =========================================================
       PUSTA TABELA WOJSKA
       ========================================================= */

    function createEmptyTroops() {

        const result = {};


        UNITS.forEach(unit => {

            result[unit.key] = {

                name:
                    unit.name,

                amount:
                    0,

                losses:
                    0,

                remaining:
                    0
            };
        });


        return result;
    }


    /* =========================================================
       ODCZYT WOJSKA
       ========================================================= */

    function readTroops(container) {

        const result =
            createEmptyTroops();


        if (!container) {
            return result;
        }


        const tables =
            Array.from(
                container.querySelectorAll(
                    'table'
                )
            );


        for (const table of tables) {

            const images =
                Array.from(
                    table.querySelectorAll(
                        'img'
                    )
                );


            const detectedUnits = [];


            for (const img of images) {

                const unit =
                    unitFromImage(img);


                if (
                    unit &&
                    !detectedUnits.some(
                        x =>
                            x.key ===
                            unit.key
                    )
                ) {

                    detectedUnits.push(
                        unit
                    );
                }
            }


            if (
                !detectedUnits.length
            ) {
                continue;
            }


            const rows =
                Array.from(
                    table.querySelectorAll(
                        'tr'
                    )
                );


            let amountRow =
                null;

            let lossesRow =
                null;


            for (const row of rows) {

                const text =
                    normalize(
                        row.textContent
                    );


                if (
                    text.includes('ilosc')
                ) {

                    amountRow =
                        row;
                }


                if (
                    text.includes('straty')
                ) {

                    lossesRow =
                        row;
                }
            }


            if (
                !amountRow ||
                !lossesRow
            ) {
                continue;
            }


            const amounts =
                getRowNumbers(
                    amountRow
                );


            const losses =
                getRowNumbers(
                    lossesRow
                );


            detectedUnits.forEach(
                (unit, index) => {

                    const amount =
                        amounts[index] || 0;

                    const loss =
                        losses[index] || 0;


                    result[
                        unit.key
                    ].amount =
                        amount;


                    result[
                        unit.key
                    ].losses =
                        loss;


                    result[
                        unit.key
                    ].remaining =
                        Math.max(
                            0,
                            amount - loss
                        );
                }
            );
        }


        return result;
    }


    /* =========================================================
       PLEMIĘ GRACZA
       ========================================================= */

    async function getPlayerTribe(playerId) {

        if (!playerId) {
            return 'bez plemienia';
        }


        try {

            const url =
                '/game.php?screen=info_player&id=' +
                encodeURIComponent(
                    playerId
                );


            const response =
                await fetch(
                    url,
                    {
                        credentials:
                            'same-origin'
                    }
                );


            if (!response.ok) {
                return 'bez plemienia';
            }


            const html =
                await response.text();


            const parser =
                new DOMParser();


            const doc =
                parser.parseFromString(
                    html,
                    'text/html'
                );


            /*
             * Szukamy prawdziwego linku plemienia.
             */

            const allyLink =
                doc.querySelector(
                    'a[href*="screen=info_ally"]'
                );


            if (allyLink) {

                const tribe =
                    cleanText(
                        allyLink.textContent
                    );


                if (tribe) {
                    return tribe;
                }
            }


            /*
             * Fallback tekstowy.
             */

            const bodyText =
                cleanText(
                    doc.body
                        ? doc.body.textContent
                        : ''
                );


            const match =
                bodyText.match(
                    /Plemię:\s*([^\n]+)/i
                );


            if (match) {

                const tribe =
                    cleanText(
                        match[1]
                    );


                if (
                    tribe &&
                    tribe !== '-'
                ) {
                    return tribe;
                }
            }


            return 'bez plemienia';

        } catch (error) {

            console.warn(
                'Nie udało się pobrać plemienia:',
                error
            );


            return 'bez plemienia';
        }
    }


    /* =========================================================
       ŁUP
       ========================================================= */

    function getLoot() {

        /*
         * Najpierw próbujemy znaleźć dokładny
         * wiersz z "Łup".
         *
         * Dzięki temu nie będzie już:
         *
         * 657657
         */

        const rows =
            Array.from(
                document.querySelectorAll('tr')
            );


        for (const row of rows) {

            const cells =
                Array.from(
                    row.querySelectorAll(
                        'td, th'
                    )
                );


            if (cells.length < 2) {
                continue;
            }


            const label =
                normalize(
                    cells[0].textContent
                );


            if (
                label === 'łup' ||
                label === 'lup' ||
                label === 'zdobycz'
            ) {

                const value =
                    cleanText(
                        cells[1].textContent
                    );


                const number =
                    numberFromText(
                        value
                    );


                if (number > 0) {
                    return number;
                }
            }
        }


        /*
         * Drugi sposób – szukanie elementu
         * z tekstem "Łup:".
         */

        const elements =
            Array.from(
                document.querySelectorAll('*')
            );


        for (const element of elements) {

            const text =
                cleanText(
                    element.textContent
                );


            if (
                !/^Łup:?$/i.test(text) &&
                !/^Lup:?$/i.test(text)
            ) {
                continue;
            }


            const next =
                element.nextElementSibling;


            if (next) {

                const number =
                    numberFromText(
                        next.textContent
                    );


                if (number > 0) {
                    return number;
                }
            }
        }


        /*
         * Ostateczny fallback.
         *
         * Ważne:
         * bierzemy pierwszą liczbę po słowie Łup,
         * a nie wszystkie liczby z tekstu.
         */

        const bodyText =
            document.body.innerText || '';


        const match =
            bodyText.match(
                /(?:Łup|Lup)\s*:?\s*(\d[\d\s.]*)/i
            );


        if (match) {

            return numberFromText(
                match[1]
            );
        }


        return 0;
    }


    /* =========================================================
       USZKODZENIA
       ========================================================= */

    function getDamage() {

        const result = [];


        const text =
            document.body.innerText || '';


        const wall =
            text.match(
                /Mur\s+(\d+)\s*[→>-]\s*(\d+)/i
            );


        if (wall) {

            result.push(
                `Mur ${wall[1]} → ${wall[2]}`
            );
        }


        const place =
            text.match(
                /Plac\s+(\d+)\s*[→>-]\s*(\d+)/i
            );


        if (place) {

            result.push(
                `Plac ${place[1]} → ${place[2]}`
            );
        }


        return result;
    }


    /* =========================================================
       REPORT EXPORT
       ========================================================= */

    function getReportExport() {

        /*
         * Gotowy element exportu.
         */

        const elements =
            Array.from(
                document.querySelectorAll(
                    '[name="report_export"], #report_export'
                )
            );


        for (const element of elements) {

            const value =
                element.value ||
                element.textContent ||
                '';


            if (value.trim()) {
                return value.trim();
            }
        }


        /*
         * Szukamy [report_export]
         * w HTML strony.
         */

        const html =
            document.documentElement.innerHTML;


        const match =
            html.match(
                /\[report_export\]([\s\S]*?)\[\/report_export\]/i
            );


        if (match) {
            return match[1].trim();
        }


        /*
         * Zakodowany eksport.
         */

        const exportMatch =
            html.match(
                /def502[a-zA-Z0-9]+/
            );


        if (exportMatch) {
            return exportMatch[0];
        }


        return '';
    }


    /* =========================================================
       TWORZENIE NOTATKI
       ========================================================= */

    function makeNote(
        opponent,
        opponentTribe,
        village,
        troops,
        attackType
    ) {

        let note = '';


        /* Nagłówek */

        note +=
            '[b]⚔️ RAPORT WALKI – ' +
            attackType +
            '[/b]\n\n';


        /* Data */

        note +=
            '[b]📅 DATA ATAKU[/b]\n';


        note +=
            getAttackDate() +
            '\n\n';


        /* Przeciwnik */

        note +=
            '[b]♟️ PRZECIWNIK[/b]\n';


        note +=
            'Gracz: [player]' +
            opponent.name +
            '[/player]\n';


        if (
            opponentTribe &&
            opponentTribe !==
                'bez plemienia'
        ) {

            note +=
                'Plemię: [ally]' +
                opponentTribe +
                '[/ally]\n';

        } else {

            note +=
                'Plemię: bez plemienia\n';
        }


        note += '\n';


        /* Wioska */

        note +=
            '[b]🏰 WIOSKA[/b]\n';


        note +=
            'Wioska ' +
            (
                village.name ||
                opponent.name
            ) +
            ' (' +
            village.coords +
            ')' +
            (
                village.continent
                    ? ' ' +
                      village.continent
                    : ''
            ) +
            '\n';


        note +=
            'Współrzędne: ' +
            village.coords +
            (
                village.continent
                    ? ' ' +
                      village.continent
                    : ''
            ) +
            '\n\n';


        /* Wojsko */

        note +=
            '[b]⚔️ WOJSKO[/b]\n';


        let anyTroops =
            false;


        UNITS.forEach(unit => {

            const data =
                troops[unit.key];


            if (!data) {
                return;
            }


            if (
                data.amount > 0
            ) {

                anyTroops =
                    true;


                note +=
                    '[unit]' +
                    unit.key +
                    '[/unit] ' +
                    unit.name +
                    ': ' +
                    data.amount +
                    '\n';
            }
        });


        if (!anyTroops) {

            note +=
                'brak danych\n';
        }


        /* Straty */

        note +=
            '\n[b]💀 STRATY[/b]\n';


        let anyLosses =
            false;


        UNITS.forEach(unit => {

            const data =
                troops[unit.key];


            if (!data) {
                return;
            }


            if (
                data.losses > 0
            ) {

                anyLosses =
                    true;


                note +=
                    '[unit]' +
                    unit.key +
                    '[/unit] ' +
                    unit.name +
                    ': ' +
                    data.losses +
                    '\n';
            }
        });


        if (!anyLosses) {

            note +=
                'brak strat\n';
        }


        /* Pozostało */

        note +=
            '\n[b]🛡️ POZOSTAŁO[/b]\n';


        let anyRemaining =
            false;


        UNITS.forEach(unit => {

            const data =
                troops[unit.key];


            if (!data) {
                return;
            }


            if (
                data.remaining > 0
            ) {

                anyRemaining =
                    true;


                note +=
                    '[unit]' +
                    unit.key +
                    '[/unit] ' +
                    unit.name +
                    ': ' +
                    data.remaining +
                    '\n';
            }
        });


        if (!anyRemaining) {

            note +=
                'brak pozostałych wojsk\n';
        }


        /* Łup */

        const loot =
            getLoot();


        if (loot > 0) {

            note +=
                '\n[b]💰 ŁUP[/b]\n';


            note +=
                loot +
                '\n';
        }


        /* Uszkodzenia */

        const damage =
            getDamage();


        if (damage.length) {

            note +=
                '\n[b]💥 USZKODZENIA[/b]\n';


            damage.forEach(item => {

                note +=
                    item +
                    '\n';
            });
        }


        /* Report export */

        const reportExport =
            getReportExport();


        if (reportExport) {

            note += '\n';


            note +=
                '[spoiler][report_export]';


            note +=
                reportExport;


            note +=
                '[/report_export][/spoiler]';
        }


        return note.trim();
    }


    /* =========================================================
       MAŁY KOMUNIKAT
       ========================================================= */

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
            document.createElement(
                'div'
            );


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

            box-shadow:
                0 4px 18px
                rgba(0,0,0,.35);

            ${
                success
                    ? `
                        background:#d9f2d9;
                        border:1px solid #65a765;
                        color:#205520;
                      `
                    : `
                        background:#f4dcdc;
                        border:1px solid #d77;
                        color:#7a2222;
                      `
            }

        `;


        toast.innerHTML =
            message;


        document.body.appendChild(
            toast
        );


        setTimeout(() => {

            toast.style.opacity =
                '0';

            toast.style.transition =
                'opacity .4s';


            setTimeout(() => {

                toast.remove();

            }, 450);

        }, 4000);
    }


    /* =========================================================
       AUTOMATYCZNY ZAPIS
       ========================================================= */

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


        const gameData =
            getGameData();


        const currentVillageId =
            gameData.village
                ? gameData.village.id
                : '';


        let url =
            '/game.php?screen=info_village&id=' +
            encodeURIComponent(
                villageId
            );


        if (currentVillageId) {

            url +=
                '&village=' +
                encodeURIComponent(
                    currentVillageId
                );
        }


        /*
         * Otwieramy prawdziwą stronę wioski
         * w nowej karcie.
         */

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

            let attempts =
                0;

            let finished =
                false;


            function finish(
                saved,
                error
            ) {

                if (finished) {
                    return;
                }


                finished =
                    true;


                /*
                 * Zamykamy kartę pomocniczą.
                 */

                setTimeout(() => {

                    try {
                        win.close();
                    } catch (e) {}

                }, 1200);


                resolve({

                    saved:
                        saved,

                    error:
                        error || ''

                });
            }


            function trySave() {

                attempts++;


                if (finished) {
                    return;
                }


                try {

                    if (
                        win.closed
                    ) {

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
                            attempts >=
                            50
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


                    /*
                     * PRAWDZIWE POLE PLEMION
                     */

                    const textarea =
                        doc.querySelector(
                            'textarea[name="note"]'
                        );


                    if (!textarea) {

                        if (
                            attempts >=
                            50
                        ) {

                            finish(
                                false,
                                'Nie znaleziono pola textarea[name="note"].'
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
                     * Istniejąca notatka.
                     */

                    const oldNote =
                        textarea.value ||
                        '';


                    let finalNote =
                        note;


                    /*
                     * Dopisujemy raport,
                     * nie usuwamy starej notatki.
                     */

                    if (
                        oldNote.trim()
                    ) {

                        finalNote =
                            oldNote.trim() +
                            '\n\n' +
                            note;
                    }


                    /*
                     * Wstawiamy treść.
                     */

                    textarea.focus();


                    textarea.value =
                        finalNote;


                    /*
                     * Informujemy Plemiona,
                     * że wartość pola się zmieniła.
                     */

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


                    /*
                     * PRAWDZIWY PRZYCISK ZAPISU
                     */

                    const saveButton =
                        doc.querySelector(
                            '#note_submit_button'
                        );


                    if (!saveButton) {

                        if (
                            attempts >=
                            50
                        ) {

                            finish(
                                false,
                                'Nie znaleziono przycisku #note_submit_button.'
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
                     * Klikamy natywny zapis Plemion.
                     */

                    saveButton.click();


                    /*
                     * Czekamy na AJAX.
                     */

                    setTimeout(() => {

                        finish(
                            true,
                            ''
                        );

                    }, 1600);

                } catch (error) {

                    if (
                        attempts >=
                        50
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


            /*
             * Pierwsza próba.
             */

            setTimeout(
                trySave,
                600
            );


            /*
             * Maksymalny czas.
             */

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


    /* =========================================================
       GŁÓWNA ANALIZA
       ========================================================= */

    async function analyze() {

        /*
         * Raport musi być stroną raportu.
         */

        const attackerSide =
            findSide(
                'Agresor:'
            );


        const defenderSide =
            findSide(
                'Obrońca:'
            );


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


        /* Gracze */

        const attacker =
            extractPlayer(
                attackerSide
            );


        const defender =
            extractPlayer(
                defenderSide
            );


        /* Wioski */

        const attackerVillage =
            extractVillage(
                attackerSide
            );


        const defenderVillage =
            extractVillage(
                defenderSide
            );


        /* Plemiona */

        const attackerTribe =
            await getPlayerTribe(
                attacker.id
            );


        const defenderTribe =
            await getPlayerTribe(
                defender.id
            );


        /* Zmienne przeciwnika */

        let opponent;

        let opponentTribe;

        let opponentVillage;

        let opponentSide;

        let attackType;


        /* =====================================================
           GAL → PRZECIWNIK
           OBRONA
           ===================================================== */

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
        }


        /* =====================================================
           PRZECIWNIK → GAL
           ATAK
           ===================================================== */

        else if (
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
        }


        /* =====================================================
           GAL → GAL
           ===================================================== */

        else if (
            isGal(attackerTribe) &&
            isGal(defenderTribe)
        ) {

            showToast(
                '⛔ Gal → Gal — notatka nie została utworzona.',
                false
            );

            return;
        }


        /* =====================================================
           OBI → OBI
           ===================================================== */

        else {

            showToast(
                '⛔ Żadna ze stron nie należy do Galów — pominięto raport.',
                false
            );

            return;
        }


        /*
         * Pobieramy wojsko WYŁĄCZNIE przeciwnika.
         */

        const troops =
            readTroops(
                opponentSide
            );


        /*
         * Tworzymy notatkę.
         */

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


        /*
         * Komunikat.
         */

        if (
            saveResult.saved
        ) {

            showToast(
                '🟢 <b>Notatka zapisana automatycznie.</b><br>' +
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


    /* =========================================================
       START
       ========================================================= */

    analyze();

})();
