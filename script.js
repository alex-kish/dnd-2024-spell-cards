let allSpells = [];
let classesMap = {};
let schoolsMap = {};
let spellBook = [];
let spellsById = new Map();

let openSpellId = null;
let selectedSpellId = null;

const DEFAULT_CARD_SETTINGS = {
    cardsPerRow: 3,
    rowsPerPage: 3,
    fontSize: 7,
    minFontSize: 5,
    headerFontSize: 10,
    subheaderFontSize: 8,
    infoFontSize: 7,
    cardColor: '#3446A6',
    borderRadius: '8px'
};
const FONT_SIZE_LIMITS = { min: 3, max: 12 };
const FONT_STEP = 0.5;
const MAX_SPLIT_PARTS = 20;

const PAGE_CONTENT_WIDTH_MM = 190;
const PAGE_CONTENT_HEIGHT_MM = 276;
const CARD_GAP_MM = 2;

function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');

    try {
        const classesScript = document.getElementById('classes-data');
        const schoolsScript = document.getElementById('schools-data');
        if (!classesScript || !schoolsScript) {
            throw new Error('Не найдены данные классов или школ');
        }

        JSON.parse(classesScript.textContent).forEach(c => { classesMap[c.id] = c.name; });
        JSON.parse(schoolsScript.textContent).forEach(s => { schoolsMap[s.id] = s.name; });

        if (typeof ALL_SPELLS_DATA === 'undefined') {
            throw new Error('Не найдены данные заклинаний');
        }
        allSpells = sortSpells(ALL_SPELLS_DATA);
        spellsById = new Map(allSpells.map(spell => [spell.Id, spell]));

        loadSpellBook();
        populateClassFilter();
        loadFilters();
        applySettingsToControls();

        loadingIndicator.hidden = true;
        renderCatalog();
        renderSelection();
        renderPrint();
        switchView(location.hash === '#print' ? 'print' : 'catalog');
        whenFontsReady(() => {
            layoutCache.clear();
            renderPrint();
        });
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        loadingIndicator.textContent = 'Ошибка загрузки данных: ' + error.message;
    }
}

function whenFontsReady(callback) {
    if (!document.fonts) return;
    Promise.all([
        document.fonts.load('700 10pt "Cormorant Garamond"'),
        document.fonts.load('400 7pt "Golos Text"'),
        document.fonts.load('700 7pt "Golos Text"')
    ]).then(() => document.fonts.ready).then(callback, () => {});
}

function loadSpellBook() {
    try {
        const saved = JSON.parse(localStorage.getItem('spellBook') || '[]');
        spellBook = Array.isArray(saved) ? saved.filter(id => spellsById.has(id)) : [];
    } catch (e) {
        spellBook = [];
    }
}

function saveSpellBook() {
    localStorage.setItem('spellBook', JSON.stringify(spellBook));
}

function normalizeCardSettings(settings) {
    const num = (value, fallback, min, max) => {
        const n = parseFloat(value);
        return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
    };
    const d = DEFAULT_CARD_SETTINGS;
    return {
        cardsPerRow: Math.round(num(settings.cardsPerRow, d.cardsPerRow, 1, 4)),
        rowsPerPage: Math.round(num(settings.rowsPerPage, d.rowsPerPage, 1, 4)),
        fontSize: num(settings.fontSize, d.fontSize, 5, 10),
        minFontSize: num(settings.minFontSize, d.minFontSize, 4, 6.5),
        headerFontSize: num(settings.headerFontSize, d.headerFontSize, 8, 13),
        subheaderFontSize: num(settings.subheaderFontSize, d.subheaderFontSize, 5, 10),
        infoFontSize: num(settings.infoFontSize, d.infoFontSize, 5, 10),
        cardColor: settings.cardColor || d.cardColor,
        borderRadius: settings.borderRadius || d.borderRadius
    };
}

function loadCardSettings() {
    try {
        const saved = localStorage.getItem('cardSettings');
        if (saved) return normalizeCardSettings(JSON.parse(saved));
    } catch (e) {
        console.warn('Ошибка загрузки настроек карточек:', e);
    }
    return { ...DEFAULT_CARD_SETTINGS };
}

function saveCardSettings(settings) {
    localStorage.setItem('cardSettings', JSON.stringify(settings));
}

function loadFontSizes() {
    try {
        return JSON.parse(localStorage.getItem('spellFontSizes') || '{}') || {};
    } catch (e) {
        return {};
    }
}

function saveFontSizes(fontSizes) {
    localStorage.setItem('spellFontSizes', JSON.stringify(fontSizes));
}

function getSpellFontSize(spellId, settings) {
    const individual = parseFloat(loadFontSizes()[spellId]);
    return Number.isFinite(individual) ? clampFontSize(individual) : settings.fontSize;
}

function setSpellFontSize(spellId, size) {
    const fontSizes = loadFontSizes();
    fontSizes[spellId] = clampFontSize(size);
    saveFontSizes(fontSizes);
}

function clampFontSize(size) {
    return Math.max(FONT_SIZE_LIMITS.min, Math.min(FONT_SIZE_LIMITS.max, size));
}

function saveFilters() {
    localStorage.setItem('spellFilters', JSON.stringify(getFilters()));
}

function loadFilters() {
    try {
        const filters = JSON.parse(localStorage.getItem('spellFilters') || '{}');
        document.getElementById('searchName').value = filters.name || '';
        document.getElementById('filterLevel').value = filters.level || '';
        document.getElementById('filterClass').value = filters.class || '';
        document.getElementById('filterSource').value = filters.source || '';
        document.getElementById('filterConcentration').checked = !!filters.concentration;
        document.getElementById('filterRitual').checked = !!filters.ritual;
    } catch (e) {
        console.warn('Ошибка загрузки фильтров:', e);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
}

function formatPt(size) {
    return String(size).replace('.', ',') + 'pt';
}

function sortSpells(spells) {
    return [...spells].sort((a, b) => a.Level - b.Level || a.Name.localeCompare(b.Name, 'ru'));
}

function splitSpellName(spell) {
    const match = spell.Name.match(/^(.+?)\s*\[(.+?)\]$/);
    return {
        ru: match ? match[1] : spell.Name,
        en: match ? match[2] : (spell.OrigName || '')
    };
}

function levelLabel(level) {
    return level === 0 ? 'Заговор' : `${level} уровень`;
}

function componentsText(spell) {
    const components = [];
    if (spell.V) components.push('В');
    if (spell.S) components.push('С');
    if (spell.M) components.push('М');
    return components.join(', ') + (spell.ComponentText ? ` (${spell.ComponentText})` : '');
}

function isConcentration(spell) {
    return /^концентрация/i.test(spell.Duration || '');
}

function isRitual(spell) {
    return /ритуал/i.test(spell.Time || '');
}

function populateClassFilter() {
    const filterClass = document.getElementById('filterClass');
    Object.entries(classesMap)
        .sort((a, b) => a[1].localeCompare(b[1], 'ru'))
        .forEach(([id, name]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            filterClass.appendChild(option);
        });
}

function processHtmlText(htmlText) {
    if (!htmlText) return '';

    return htmlText
        .replace(/<table[^>]*name=["']Таблица["'][^>]*>[\s\S]*?<\/table>/gi, '')
        .replace(/<baselink[^>]*name=["']([^"']+)["'][^>]*>([^<]*)<\/baselink>/gi, function(match, nameAttr, content) {
            return content.trim() ? `<span class="baselink">${content}</span>` : `<span class="baselink">${nameAttr}</span>`;
        })
        .replace(/<baselink[^>]*name=["']([^"']+)["'][^>]*\/>/gi, '<span class="baselink">$1</span>')
        .replace(/<zag[^>]*>/gi, '<strong>')
        .replace(/<\/zag>/gi, '</strong>')
        .replace(/<dice[^>]*>([^<]*)<\/dice>/gi, '<span class="dice">$1</span>')
        .replace(/<ft[^>]*>([^<]*)<\/ft>/gi, '<span class="ft">$1</span>')
        .replace(/<ch[^>]*>([^<]*)<\/ch>/gi, '<span class="ch">$1</span>')
        .replace(/<attack[^>]*>([^<]*)<\/attack>/gi, '<span class="attack">$1</span>')
        .replace(/<baselink[^>]*>([^<]*)<\/baselink>/gi, '<span class="baselink">$1</span>')
        .replace(/<st[^>]*>([^<]*)<\/st>/gi, '<span class="st">$1</span>')
        .replace(/\r\n/g, '<br>')
        .replace(/\n/g, '<br>');
}

function isInSpellBook(spellId) {
    return spellBook.includes(spellId);
}

function setInSpellBook(spellId, inBook) {
    if (inBook && !isInSpellBook(spellId)) {
        spellBook.push(spellId);
    } else if (!inBook) {
        spellBook = spellBook.filter(id => id !== spellId);
    }
    saveSpellBook();
    onSpellBookChanged();
}

function onSpellBookChanged() {
    updateCatalogChecks();
    renderSelection();
    renderPrint();
}

function clearSpellBook() {
    if (spellBook.length === 0) return;
    if (!confirm('Убрать все заклинания из выбранных?')) return;
    spellBook = [];
    saveSpellBook();
    onSpellBookChanged();
}

function getBookSpells() {
    return sortSpells(spellBook.map(id => spellsById.get(id)).filter(Boolean));
}

function getFilters() {
    return {
        name: document.getElementById('searchName').value,
        level: document.getElementById('filterLevel').value,
        class: document.getElementById('filterClass').value,
        source: document.getElementById('filterSource').value,
        concentration: document.getElementById('filterConcentration').checked,
        ritual: document.getElementById('filterRitual').checked
    };
}

function filterSpells() {
    const filters = getFilters();
    const query = filters.name.trim().toLowerCase();
    return allSpells.filter(spell =>
        (!query || spell.Name.toLowerCase().includes(query) || (spell.OrigName || '').toLowerCase().includes(query)) &&
        (!filters.level || String(spell.Level) === filters.level) &&
        (!filters.class || spell.Classes.split('|').includes(filters.class)) &&
        (!filters.source || spell.Source === filters.source) &&
        (!filters.concentration || isConcentration(spell)) &&
        (!filters.ritual || isRitual(spell))
    );
}

function updateSearchClear() {
    document.getElementById('clearSearchBtn').hidden = document.getElementById('searchName').value === '';
}

function clearSearch() {
    const input = document.getElementById('searchName');
    input.value = '';
    renderCatalog();
    input.focus();
}

function renderCatalog() {
    updateSearchClear();
    saveFilters();
    const spells = filterSpells();
    const list = document.getElementById('spellList');

    list.innerHTML = spells.map(renderSpellRow).join('') ||
        '<p class="table-message">Ничего не найдено. Попробуйте изменить фильтры.</p>';

    document.getElementById('spellsCount').innerHTML =
        `Показано <strong>${spells.length}</strong> из ${allSpells.length}`;
}

function renderSpellRow(spell) {
    const name = splitSpellName(spell);
    const inBook = isInSpellBook(spell.Id);
    const isOpen = openSpellId === spell.Id;
    const school = schoolsMap[spell.School] || '';
    const levelShort = spell.Level === 0 ? 'Заговор' : `${spell.Level} ур.`;
    const checkLabel = `${inBook ? 'Убрать из выбранных' : 'Выбрать'}: ${name.ru}`;

    return `
        <div class="spell-row${inBook ? ' in-book' : ''}" data-spell-id="${spell.Id}">
            <div class="spell-row-line">
                <label class="row-check">
                    <span class="sr-only">${escapeHtml(checkLabel)}</span>
                    <input type="checkbox" data-action="toggle-book" ${inBook ? 'checked' : ''}>
                </label>
                <button class="row-main" data-action="toggle-open" aria-expanded="${isOpen}">
                    <span class="col-name">
                        <span class="row-name">${escapeHtml(name.ru)}</span>
                        <span class="row-en">${escapeHtml(name.en)}</span>
                        ${isConcentration(spell) ? '<span class="tag tag-conc">концентрация</span>' : ''}
                        ${isRitual(spell) ? '<span class="tag tag-ritual">ритуал</span>' : ''}
                        <span class="row-meta-mobile">${escapeHtml(levelShort)} · ${escapeHtml(school)}</span>
                    </span>
                    <span class="col-level">${escapeHtml(levelShort)}</span>
                    <span class="col-school">${escapeHtml(school)}</span>
                    <span class="col-time">${escapeHtml(spell.Time)}</span>
                    <span class="col-chevron" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6l4 4 4-4"/></svg>
                    </span>
                </button>
            </div>
            ${isOpen ? renderSpellDetails(spell) : ''}
        </div>
    `;
}

function renderSpellDetails(spell) {
    const classes = spell.Classes.split('|').map(id => classesMap[id]).filter(Boolean).join(', ');
    return `
        <div class="spell-details">
            <dl class="spell-facts">
                <dt>Время</dt><dd>${escapeHtml(spell.Time)}</dd>
                <dt>Дистанция</dt><dd>${escapeHtml(spell.Range)}</dd>
                <dt>Длительность</dt><dd>${escapeHtml(spell.Duration)}</dd>
                <dt>Компоненты</dt><dd>${escapeHtml(componentsText(spell))}</dd>
                <dt>Классы</dt><dd>${escapeHtml(classes)}</dd>
                <dt>Источник</dt><dd>${escapeHtml(spell.Source)}</dd>
            </dl>
            <div class="spell-text">${processHtmlText(spell.HtmlText)}</div>
        </div>
    `;
}

function updateCatalogChecks() {
    document.querySelectorAll('#spellList .spell-row').forEach(row => {
        const inBook = isInSpellBook(row.dataset.spellId);
        row.classList.toggle('in-book', inBook);
        const checkbox = row.querySelector('[data-action="toggle-book"]');
        if (checkbox) checkbox.checked = inBook;
    });
}

function handleCatalogClick(event) {
    const button = event.target.closest('[data-action="toggle-open"]');
    if (!button) return;
    const row = button.closest('.spell-row');
    const spellId = row.dataset.spellId;
    openSpellId = openSpellId === spellId ? null : spellId;

    document.querySelectorAll('#spellList .spell-row').forEach(other => {
        const details = other.querySelector('.spell-details');
        const shouldOpen = other.dataset.spellId === openSpellId;
        other.querySelector('[data-action="toggle-open"]').setAttribute('aria-expanded', String(shouldOpen));
        if (details && !shouldOpen) details.remove();
        if (!details && shouldOpen) other.insertAdjacentHTML('beforeend', renderSpellDetails(spellsById.get(spellId)));
    });
}

function handleCatalogChange(event) {
    const checkbox = event.target.closest('[data-action="toggle-book"]');
    if (!checkbox) return;
    setInSpellBook(checkbox.closest('.spell-row').dataset.spellId, checkbox.checked);
}

function renderSelection() {
    const bookSpells = getBookSpells();
    const count = bookSpells.length;

    document.getElementById('tabBookCount').textContent = count;
    document.getElementById('selectionCount').textContent =
        `${count} ${plural(count, 'заклинание', 'заклинания', 'заклинаний')}`;
    document.getElementById('selectionEmpty').hidden = count > 0;
    document.getElementById('toggleSelectionBtn').hidden = count === 0;
    document.getElementById('goPrintBtn').disabled = count === 0;
    document.getElementById('clearBookBtn').disabled = count === 0;
    document.getElementById('exportBookBtn').disabled = count === 0;

    const groups = new Map();
    bookSpells.forEach(spell => {
        if (!groups.has(spell.Level)) groups.set(spell.Level, []);
        groups.get(spell.Level).push(spell);
    });

    document.getElementById('selectionGroups').innerHTML = Array.from(groups.entries()).map(([level, spells]) => `
        <div class="selection-group">
            <h3>${level === 0 ? 'Заговоры' : `${level} уровень`}</h3>
            ${spells.map(spell => {
                const name = splitSpellName(spell).ru;
                return `
                    <div class="selection-item" data-spell-id="${spell.Id}">
                        <span>${escapeHtml(name)}</span>
                        <button class="icon-btn flat" data-action="remove" aria-label="Убрать «${escapeHtml(name)}»">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8"/></svg>
                        </button>
                    </div>
                `;
            }).join('')}
        </div>
    `).join('');
}

function toggleSelectionList() {
    const panel = document.querySelector('.selection');
    const expanded = panel.classList.toggle('expanded');
    const button = document.getElementById('toggleSelectionBtn');
    button.setAttribute('aria-expanded', String(expanded));
    button.textContent = expanded ? 'Скрыть' : 'Показать';
}

function handleSelectionClick(event) {
    const button = event.target.closest('[data-action="remove"]');
    if (!button) return;
    setInSpellBook(button.closest('.selection-item').dataset.spellId, false);
}

function cardGeometry(settings) {
    const cols = settings.cardsPerRow;
    const rows = settings.rowsPerPage;
    return {
        cols,
        rows,
        width: (PAGE_CONTENT_WIDTH_MM - (cols - 1) * CARD_GAP_MM) / cols,
        height: (PAGE_CONTENT_HEIGHT_MM - (rows - 1) * CARD_GAP_MM) / rows
    };
}

function buildCard(spell, { variant, fontSize, html, partLabel }, settings) {
    const geometry = cardGeometry(settings);
    const name = splitSpellName(spell);
    const card = document.createElement('article');
    card.className = 'pcard';
    card.dataset.spellId = spell.Id;
    card.style.width = `${geometry.width}mm`;
    card.style.height = `${geometry.height}mm`;
    card.style.setProperty('--card-color', settings.cardColor);
    card.style.borderRadius = settings.borderRadius;

    const headerLine = `
        <svg class="pcard-line" xmlns="http://www.w3.org/2000/svg" width="100%" height="2" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="0" x2="100%" y2="0" stroke="${settings.cardColor}" stroke-width="2"/>
        </svg>`;

    const head = variant === 'first' ? `
        <header class="pcard-head">
            <div class="pcard-name" style="font-size: ${settings.headerFontSize}pt">${escapeHtml(name.ru)} <span class="pcard-en">[${escapeHtml(name.en)}]</span></div>
            <div class="pcard-sub" style="font-size: ${settings.subheaderFontSize}pt">
                <span>${spell.Level === 0 ? '<strong>Заговор</strong>' : `<strong>${spell.Level}</strong> уровень`}</span>
                <span>${escapeHtml(schoolsMap[spell.School] || '')}</span>
            </div>
            ${headerLine}
        </header>
        <div class="pcard-info" style="font-size: ${settings.infoFontSize}pt">
            <p><strong>Время:</strong> ${escapeHtml(spell.Time)}</p>
            <p><strong>Дистанция:</strong> ${escapeHtml(spell.Range)}</p>
            <p><strong>Длительность:</strong> ${escapeHtml(spell.Duration)}</p>
            <p><strong>Компоненты:</strong> ${escapeHtml(componentsText(spell))}</p>
        </div>` : `
        <header class="pcard-head">
            <div class="pcard-name" style="font-size: ${settings.headerFontSize}pt">${escapeHtml(name.ru)} <span class="pcard-en">продолжение</span></div>
            ${headerLine}
        </header>`;

    card.innerHTML = `
        ${head}
        <div class="pcard-text" style="font-size: ${fontSize}pt">${html ?? ''}</div>
        <div class="pcard-part">${escapeHtml(partLabel || '')}</div>
    `;
    return card;
}

let measureSandbox = null;
const layoutCache = new Map();

function getSandbox() {
    if (!measureSandbox) {
        measureSandbox = document.createElement('div');
        measureSandbox.className = 'measure-sandbox';
        measureSandbox.setAttribute('aria-hidden', 'true');
        document.body.appendChild(measureSandbox);
    }
    return measureSandbox;
}

function layoutKey(settings) {
    return [settings.cardsPerRow, settings.rowsPerPage, settings.headerFontSize,
        settings.subheaderFontSize, settings.infoFontSize, settings.borderRadius].join('|');
}

function tokenizeDescription(html) {
    const container = document.createElement('div');
    container.innerHTML = html;
    const tokens = [];
    container.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            tokens.push(...(node.textContent.match(/\s+|\S+\s*/g) || []));
        } else {
            tokens.push(node);
        }
    });
    return tokens;
}

function isBlankToken(token) {
    if (typeof token === 'string') return token.trim().length === 0;
    return token.nodeName === 'BR' || token.nodeType === Node.COMMENT_NODE;
}

function renderTokens(element, tokens, start, end) {
    element.replaceChildren(...tokens.slice(start, end).map(t => typeof t === 'string' ? t : t.cloneNode(true)));
}

function isOverflowing(element) {
    return element.scrollHeight > element.clientHeight + 1;
}

function findFittingEnd(element, tokens, start) {
    let lo = start + 1;
    let hi = tokens.length;
    renderTokens(element, tokens, start, hi);
    if (!isOverflowing(element)) return hi;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        renderTokens(element, tokens, start, mid);
        if (isOverflowing(element)) {
            hi = mid;
        } else {
            lo = mid;
        }
    }
    return lo;
}

function mountMeasureCard(spell, variant, fontSize, settings) {
    const card = buildCard(spell, { variant, fontSize, html: '', partLabel: ' ' }, settings);
    getSandbox().replaceChildren(card);
    return card.querySelector('.pcard-text');
}

function splitSpell(spell, fontSize, settings) {
    const key = `split|${spell.Id}|${fontSize}|${layoutKey(settings)}`;
    if (layoutCache.has(key)) return layoutCache.get(key);

    const tokens = tokenizeDescription(processHtmlText(spell.HtmlText));
    const parts = [];
    let start = 0;
    while (start < tokens.length) {
        const text = mountMeasureCard(spell, parts.length === 0 ? 'first' : 'cont', fontSize, settings);
        let end = parts.length === MAX_SPLIT_PARTS - 1 ? tokens.length : findFittingEnd(text, tokens, start);
        while (end > start + 1 && isBlankToken(tokens[end - 1])) end--;
        renderTokens(text, tokens, start, end);
        parts.push(text.innerHTML);
        start = end;
        while (start < tokens.length && isBlankToken(tokens[start])) start++;
    }
    if (parts.length === 0) parts.push('');

    layoutCache.set(key, parts);
    return parts;
}

function bestFitFontSize(spell, settings) {
    const key = `fit|${spell.Id}|${settings.minFontSize}|${layoutKey(settings)}`;
    if (layoutCache.has(key)) return layoutCache.get(key);

    const html = processHtmlText(spell.HtmlText);
    const fits = (size) => {
        const text = mountMeasureCard(spell, 'first', size, settings);
        text.innerHTML = html;
        return !isOverflowing(text);
    };

    const sizes = [];
    for (let size = settings.minFontSize; size <= FONT_SIZE_LIMITS.max + 1e-9; size += FONT_STEP) {
        sizes.push(Math.round(size * 10) / 10);
    }

    let result = null;
    if (fits(sizes[0])) {
        let lo = 0;
        let hi = sizes.length - 1;
        if (fits(sizes[hi])) {
            lo = hi;
        } else {
            while (hi - lo > 1) {
                const mid = (lo + hi) >> 1;
                if (fits(sizes[mid])) lo = mid; else hi = mid;
            }
        }
        result = sizes[lo];
    }

    layoutCache.set(key, result);
    return result;
}

function renderPrint() {
    const settings = loadCardSettings();
    const geometry = cardGeometry(settings);
    const bookSpells = getBookSpells();
    const { scrollX, scrollY } = window;

    const cards = [];
    const fitRows = [];
    bookSpells.forEach(spell => {
        const fontSize = getSpellFontSize(spell.Id, settings);
        const parts = splitSpell(spell, fontSize, settings);
        const fit = bestFitFontSize(spell, settings);
        parts.forEach((html, index) => {
            cards.push(buildCard(spell, {
                variant: index === 0 ? 'first' : 'cont',
                fontSize,
                html,
                partLabel: parts.length > 1 ? `(${index + 1}/${parts.length})` : ''
            }, settings));
        });
        fitRows.push(renderFitRow(spell, fontSize, parts.length, fit, settings));
    });
    getSandbox().replaceChildren();

    const perPage = geometry.cols * geometry.rows;
    const pageCount = Math.ceil(cards.length / perPage);
    const pagesContainer = document.getElementById('printPages');
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < pageCount; i++) {
        const figure = document.createElement('figure');
        figure.className = 'print-sheet';
        const page = document.createElement('div');
        page.className = 'print-page';
        page.style.gridTemplateColumns = `repeat(${geometry.cols}, ${geometry.width}mm)`;
        page.style.gridTemplateRows = `repeat(${geometry.rows}, ${geometry.height}mm)`;
        cards.slice(i * perPage, (i + 1) * perPage).forEach(card => page.appendChild(card));
        const caption = document.createElement('figcaption');
        caption.textContent = `Страница ${i + 1} из ${pageCount}`;
        figure.append(page, caption);
        fragment.appendChild(figure);
    }
    pagesContainer.replaceChildren(fragment);
    document.getElementById('fitRows').innerHTML = fitRows.join('');

    const spellCount = bookSpells.length;
    document.getElementById('printSummary').innerHTML = spellCount === 0 ? '' :
        `<strong>${pageCount}</strong> ${plural(pageCount, 'страница', 'страницы', 'страниц')}` +
        `<span class="muted"> · ${cards.length} ${plural(cards.length, 'карточка', 'карточки', 'карточек')}` +
        ` из ${spellCount} ${plural(spellCount, 'заклинания', 'заклинаний', 'заклинаний')}</span>`;
    document.getElementById('printEmpty').hidden = spellCount > 0;
    document.getElementById('fitPanel').hidden = spellCount === 0;
    document.getElementById('fitTitle').textContent = `Шрифт по заклинаниям · ${spellCount}`;
    document.getElementById('printBtn').disabled = spellCount === 0;
    document.getElementById('fitAllBtn').disabled = spellCount === 0;

    highlightSelected();
    window.scrollTo(scrollX, scrollY);
}

const A4_WIDTH_PX = 210 * 96 / 25.4;

function updatePageZoom() {
    const main = document.querySelector('.print-main');
    if (!main || main.clientWidth === 0) return;
    const zoom = Math.min(1, main.clientWidth / A4_WIDTH_PX);
    main.style.setProperty('--page-zoom', zoom.toFixed(3));
}

function renderFitRow(spell, fontSize, partCount, fit, settings) {
    const name = splitSpellName(spell).ru;
    let fitControl = '';
    if (partCount > 1 && fit !== null) {
        fitControl = `<button class="btn ghost small" data-action="fit" data-fit="${fit}">Уместить · ${formatPt(fit)}</button>`;
    } else if (partCount > 1) {
        fitControl = `<span class="fit-note">не влезет в одну даже при ${formatPt(settings.minFontSize)}</span>`;
    }

    return `
        <div class="fit-row" data-spell-id="${spell.Id}">
            <div class="fit-title">
                <button class="fit-name" data-action="select">${escapeHtml(name)}</button>
                <span class="fit-parts${partCount > 1 ? ' split' : ''}">${partCount} ${plural(partCount, 'карточка', 'карточки', 'карточек')}</span>
            </div>
            <div class="fit-controls">
                <button class="icon-btn small" data-action="font-dec" aria-label="Уменьшить шрифт «${escapeHtml(name)}»" ${fontSize <= FONT_SIZE_LIMITS.min ? 'disabled' : ''}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 7h10"/></svg>
                </button>
                <span class="fit-size" aria-live="polite">${formatPt(fontSize)}</span>
                <button class="icon-btn small" data-action="font-inc" aria-label="Увеличить шрифт «${escapeHtml(name)}»" ${fontSize >= FONT_SIZE_LIMITS.max ? 'disabled' : ''}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 7h10M7 2v10"/></svg>
                </button>
            </div>
            <button class="icon-btn small flat" data-action="remove" aria-label="Убрать «${escapeHtml(name)}» из выбранных">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8"/></svg>
            </button>
            ${fitControl ? `<div class="fit-extra">${fitControl}</div>` : ''}
        </div>
    `;
}

function highlightSelected() {
    document.querySelectorAll('#printPages .pcard').forEach(card => {
        card.classList.toggle('selected', card.dataset.spellId === selectedSpellId);
    });
    document.querySelectorAll('#fitRows .fit-row').forEach(row => {
        row.classList.toggle('selected', row.dataset.spellId === selectedSpellId);
    });
}

function selectSpell(spellId, scrollTarget) {
    selectedSpellId = spellId;
    highlightSelected();
    const target = scrollTarget === 'row'
        ? document.querySelector(`#fitRows .fit-row[data-spell-id="${spellId}"]`)
        : document.querySelector(`#printPages .pcard[data-spell-id="${spellId}"]`);
    if (target) target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function handleFitClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const spellId = button.closest('.fit-row').dataset.spellId;
    const settings = loadCardSettings();
    const fontSize = getSpellFontSize(spellId, settings);
    selectedSpellId = spellId;

    switch (button.dataset.action) {
        case 'select':
            selectSpell(spellId, 'card');
            return;
        case 'font-dec':
            setSpellFontSize(spellId, fontSize - FONT_STEP);
            break;
        case 'font-inc':
            setSpellFontSize(spellId, fontSize + FONT_STEP);
            break;
        case 'fit':
            if (button.dataset.fit) setSpellFontSize(spellId, parseFloat(button.dataset.fit));
            break;
        case 'remove':
            setInSpellBook(spellId, false);
            return;
        default:
            return;
    }
    renderPrint();
    const again = document.querySelector(`#fitRows .fit-row[data-spell-id="${spellId}"] [data-action="${button.dataset.action}"]`);
    if (again && !again.disabled) again.focus();
}

function handlePagesClick(event) {
    const card = event.target.closest('.pcard');
    if (card) selectSpell(card.dataset.spellId, 'row');
}

function fitAll() {
    const settings = loadCardSettings();
    const fontSizes = loadFontSizes();
    getBookSpells().forEach(spell => {
        const fit = bestFitFontSize(spell, settings);
        if (fit !== null) fontSizes[spell.Id] = Math.min(fit, settings.fontSize);
    });
    saveFontSizes(fontSizes);
    renderPrint();
}

const SETTINGS_CONTROLS = {
    cardsPerRow: 'cardsPerRow',
    rowsPerPage: 'rowsPerPage',
    fontSize: 'fontSize',
    minFontSize: 'minFontSize',
    headerFontSize: 'headerFontSize',
    subheaderFontSize: 'subheaderFontSize',
    infoFontSize: 'infoFontSize',
    cardColor: 'cardColor',
    borderRadius: 'borderRadius'
};

function applySettingsToControls() {
    const settings = loadCardSettings();
    Object.entries(SETTINGS_CONTROLS).forEach(([key, id]) => {
        document.getElementById(id).value = String(settings[key]);
    });
}

function handleCardSettingsChange() {
    const raw = {};
    Object.entries(SETTINGS_CONTROLS).forEach(([key, id]) => {
        raw[key] = document.getElementById(id).value;
    });
    const settings = normalizeCardSettings(raw);
    saveCardSettings(settings);
    renderPrint();
}

function resetCardSettings() {
    if (!confirm('Сбросить оформление карточек и подобранные размеры шрифта?')) return;
    localStorage.removeItem('cardSettings');
    localStorage.removeItem('spellFontSizes');
    applySettingsToControls();
    renderPrint();
}

function exportSpellBook() {
    if (spellBook.length === 0) return;

    const spellFontSizes = loadFontSizes();
    const bookFontSizes = {};
    spellBook.forEach(spellId => {
        if (spellFontSizes[spellId]) bookFontSizes[spellId] = spellFontSizes[spellId];
    });

    const exportData = {
        spellIds: spellBook,
        cardSettings: loadCardSettings(),
        spellFontSizes: bookFontSizes
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'spellbook.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function importSpellBook(event) {
    const input = event.target;
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.spellIds || !Array.isArray(data.spellIds)) {
                alert('Неверный формат файла. Ожидается объект с полем spellIds (массив ID заклинаний).');
                return;
            }
            if (!confirm('Загрузить заклинания из файла?\nТекущий выбор будет заменён.')) return;

            const validIds = data.spellIds.filter(id => spellsById.has(id));
            spellBook = validIds;
            saveSpellBook();

            if (data.cardSettings) {
                saveCardSettings(normalizeCardSettings({ ...loadCardSettings(), ...data.cardSettings }));
                applySettingsToControls();
            }

            if (data.spellFontSizes && typeof data.spellFontSizes === 'object') {
                const fontSizes = loadFontSizes();
                validIds.forEach(spellId => {
                    const size = parseFloat(data.spellFontSizes[spellId]);
                    if (Number.isFinite(size)) fontSizes[spellId] = clampFontSize(size);
                });
                saveFontSizes(fontSizes);
            }

            onSpellBookChanged();
            const skipped = data.spellIds.length - validIds.length;
            alert(`Загружено ${validIds.length} ${plural(validIds.length, 'заклинание', 'заклинания', 'заклинаний')}.` +
                (skipped ? ` ${skipped} не найдено и пропущено.` : ''));
        } catch (error) {
            console.error('Ошибка загрузки файла:', error);
            alert('Ошибка загрузки файла. Проверьте формат JSON.');
        } finally {
            input.value = '';
        }
    };
    reader.readAsText(file);
}

function switchView(view) {
    const isPrint = view === 'print';
    document.getElementById('catalogView').hidden = isPrint;
    document.getElementById('printView').hidden = !isPrint;
    if (isPrint) updatePageZoom();
    document.getElementById('viewCatalogBtn').setAttribute('aria-pressed', String(!isPrint));
    document.getElementById('viewPrintBtn').setAttribute('aria-pressed', String(isPrint));
    history.replaceState(null, '', isPrint ? '#print' : location.pathname + location.search);
}

function printSpellBook() {
    switchView('print');
    window.print();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchName').addEventListener('input', renderCatalog);
    document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
    ['filterLevel', 'filterClass', 'filterSource', 'filterConcentration', 'filterRitual'].forEach(id => {
        document.getElementById(id).addEventListener('change', renderCatalog);
    });

    const spellList = document.getElementById('spellList');
    spellList.addEventListener('click', handleCatalogClick);
    spellList.addEventListener('change', handleCatalogChange);

    document.getElementById('selectionGroups').addEventListener('click', handleSelectionClick);
    document.getElementById('toggleSelectionBtn').addEventListener('click', toggleSelectionList);
    document.getElementById('viewCatalogBtn').addEventListener('click', () => switchView('catalog'));
    document.getElementById('viewPrintBtn').addEventListener('click', () => switchView('print'));
    document.getElementById('goPrintBtn').addEventListener('click', () => switchView('print'));
    document.getElementById('printEmptyLink').addEventListener('click', (event) => {
        event.preventDefault();
        switchView('catalog');
    });
    document.getElementById('clearBookBtn').addEventListener('click', clearSpellBook);
    document.getElementById('exportBookBtn').addEventListener('click', exportSpellBook);
    document.getElementById('importBookInput').addEventListener('change', importSpellBook);

    document.getElementById('printBtn').addEventListener('click', printSpellBook);
    document.getElementById('fitAllBtn').addEventListener('click', fitAll);
    document.getElementById('resetSettingsBtn').addEventListener('click', resetCardSettings);
    Object.values(SETTINGS_CONTROLS).forEach(id => {
        document.getElementById(id).addEventListener('change', handleCardSettingsChange);
    });
    document.getElementById('fitRows').addEventListener('click', handleFitClick);
    document.getElementById('printPages').addEventListener('click', handlePagesClick);
    new ResizeObserver(updatePageZoom).observe(document.querySelector('.print-main'));

    loadData();
});
