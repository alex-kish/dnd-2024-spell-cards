// Глобальные переменные
let allSpells = [];
let classesMap = {};
let schoolsMap = {};
let spellBook = [];

// Константы
const DEFAULT_FONT_SIZE = 7;
const DEFAULT_CARD_SETTINGS = { cardsPerRow: 3, rowsPerPage: 3, fontSize: 7, cardColor: '#8b4513' };
const FONT_SIZE_LIMITS = { min: 2, max: 12 };
const DEFAULT_HEADER_LINE_COLOR = '#8b4513';
const BOOK_CARD_HEADER_LINE_COLOR = 'orange';

// Вспомогательная функция для определения цвета полоски header
function getHeaderLineColor(card, cardSettings) {
    return card.classList.contains('spell-card-in-book') 
        ? BOOK_CARD_HEADER_LINE_COLOR 
        : (cardSettings?.cardColor || DEFAULT_HEADER_LINE_COLOR);
}

// Загрузка данных из встроенных скриптов
function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const spellsGrid = document.getElementById('spellsGrid');
    
    loadingIndicator.style.display = 'block';
    spellsGrid.innerHTML = '';

    try {
        // Загрузка маппингов из встроенных script тегов
        const classesScript = document.getElementById('classes-data');
        const schoolsScript = document.getElementById('schools-data');
        
        if (!classesScript || !schoolsScript) {
            throw new Error('Не найдены данные классов или школ');
        }

        const classesData = JSON.parse(classesScript.textContent);
        classesData.forEach(c => {
            classesMap[c.id] = c.name;
        });

        const schoolsData = JSON.parse(schoolsScript.textContent);
        schoolsData.forEach(s => {
            schoolsMap[s.id] = s.name;
        });

        // Загрузка заклинаний из глобальной переменной
        if (typeof ALL_SPELLS_DATA === 'undefined') {
            throw new Error('Не найдены данные заклинаний');
        }

        allSpells = ALL_SPELLS_DATA;

        // Загрузка книги заклинаний из localStorage
        loadSpellBook();

        // Инициализация интерфейса
        populateClassFilter();
        loadFilters(); // Загружаем сохраненные фильтры
        filterSpells(); // Применяем фильтры
        updateSpellBookDisplay();
        // Применяем размеры карточек при загрузке
        setTimeout(() => applyCardSizes(), 100);

        loadingIndicator.style.display = 'none';
        console.log(`Загружено ${allSpells.length} заклинаний`);
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        loadingIndicator.style.display = 'none';
        spellsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 20px; color: red;">Ошибка загрузки данных: ' + error.message + '</p>';
    }
}

// Загрузка книги заклинаний из localStorage
function loadSpellBook() {
    const saved = localStorage.getItem('spellBook');
    if (saved) {
        spellBook = JSON.parse(saved);
    }
}

// Загрузка настроек карточек из localStorage
function loadCardSettings() {
    const saved = localStorage.getItem('cardSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            return {
                cardsPerRow: Math.max(1, Math.min(4, parseInt(settings.cardsPerRow) || DEFAULT_CARD_SETTINGS.cardsPerRow)),
                rowsPerPage: Math.max(1, Math.min(4, parseInt(settings.rowsPerPage) || DEFAULT_CARD_SETTINGS.rowsPerPage)),
                fontSize: Math.max(5, Math.min(10, parseFloat(settings.fontSize) || DEFAULT_CARD_SETTINGS.fontSize)),
                cardColor: settings.cardColor || DEFAULT_CARD_SETTINGS.cardColor
            };
        } catch (e) {
            console.warn('Ошибка загрузки настроек карточек:', e);
        }
    }
    return { ...DEFAULT_CARD_SETTINGS };
}

// Сохранение настроек карточек в localStorage
function saveCardSettings(cardsPerRow, rowsPerPage, fontSize, cardColor) {
    localStorage.setItem('cardSettings', JSON.stringify({ cardsPerRow, rowsPerPage, fontSize, cardColor }));
}

// Применение размеров карточек
function applyCardSizes() {
    const settings = loadCardSettings();
    const grid = document.getElementById('spellBookGrid');
    const cards = grid.querySelectorAll('.spell-card');
    
    // Устанавливаем CSS переменные для количества карточек
    grid.style.setProperty('--cards-per-row', settings.cardsPerRow);
    grid.style.setProperty('--rows-per-page', settings.rowsPerPage);
    
    // Применяем количество колонок через CSS Grid с относительными единицами
    grid.style.gridTemplateColumns = `repeat(${settings.cardsPerRow}, 1fr)`;
    
    // Загружаем индивидуальные размеры шрифтов один раз
    const fontSizes = loadFontSizes();
    
        // Применяем размер шрифта и цвет к карточкам (размеры карточек теперь управляются CSS)
        cards.forEach(card => {
            const description = card.querySelector('.spell-description');
            if (description) {
                const spellId = description.dataset.spellId;
                const fontSize = getCardFontSize(spellId, settings.fontSize);
                
                description.style.fontSize = fontSize + 'pt';
                description.dataset.fontSize = fontSize;
                
                // Применяем цвет к полосе прокрутки через CSS переменную
                description.style.setProperty('--scrollbar-color', settings.cardColor);
                description.style.scrollbarColor = `${settings.cardColor} #f0f0f0`;
            }
            
        // Применяем цвет к карточке через CSS переменную
        card.style.setProperty('--card-border-color', settings.cardColor);
        card.style.borderColor = settings.cardColor;
            
            // Применяем цвет к названию заклинания
            const spellName = card.querySelector('.spell-name');
            if (spellName) {
                spellName.style.color = settings.cardColor;
            }
            
            // Обновляем цвет SVG полоски в header
            const headerLine = card.querySelector('.spell-card-header .header-line line');
            if (headerLine) {
                headerLine.setAttribute('stroke', getHeaderLineColor(card, settings));
            }
        });
    
    // Обновляем выпадающие списки
    const cardsPerRowSelect = document.getElementById('cardsPerRow');
    const rowsPerPageSelect = document.getElementById('rowsPerPage');
    const fontSizeSelect = document.getElementById('fontSize');
    const cardColorSelect = document.getElementById('cardColor');
    if (cardsPerRowSelect) cardsPerRowSelect.value = settings.cardsPerRow;
    if (rowsPerPageSelect) rowsPerPageSelect.value = settings.rowsPerPage;
    if (fontSizeSelect) fontSizeSelect.value = settings.fontSize;
    if (cardColorSelect) cardColorSelect.value = settings.cardColor;
}

// Сохранение книги заклинаний в localStorage
function saveSpellBook() {
    localStorage.setItem('spellBook', JSON.stringify(spellBook));
}

// Добавление заклинания в книгу
function addToSpellBook(spellId) {
    if (!spellBook.includes(spellId)) {
        spellBook.push(spellId);
        saveSpellBook();
        updateSpellBookDisplay();
        updateSpellCardButtons();
    }
}

// Удаление заклинания из книги
function removeFromSpellBook(spellId) {
    spellBook = spellBook.filter(id => id !== spellId);
    saveSpellBook();
    updateSpellBookDisplay();
    updateSpellCardButtons();
}

// Сброс настроек карточек и индивидуальных размеров шрифта
function resetCardSettings() {
    if (confirm('Вы уверены, что хотите сбросить все настройки карточек и размеры шрифта?')) {
        // Удаляем настройки карточек из localStorage
        localStorage.removeItem('cardSettings');
        
        // Удаляем все индивидуальные размеры шрифта
        localStorage.removeItem('spellFontSizes');
        
        // Сбрасываем значения в выпадающих списках на значения по умолчанию
        const cardsPerRowSelect = document.getElementById('cardsPerRow');
        const rowsPerPageSelect = document.getElementById('rowsPerPage');
        const fontSizeSelect = document.getElementById('fontSize');
        const cardColorSelect = document.getElementById('cardColor');
        
        if (cardsPerRowSelect) cardsPerRowSelect.value = DEFAULT_CARD_SETTINGS.cardsPerRow;
        if (rowsPerPageSelect) rowsPerPageSelect.value = DEFAULT_CARD_SETTINGS.rowsPerPage;
        if (fontSizeSelect) fontSizeSelect.value = DEFAULT_CARD_SETTINGS.fontSize;
        if (cardColorSelect) cardColorSelect.value = DEFAULT_CARD_SETTINGS.cardColor;
        
        // Применяем настройки по умолчанию
        applyCardSizes();
        
        // Обновляем отображение книги заклинаний
        updateSpellBookDisplay();
    }
}

// Очистка всей книги заклинаний
function clearSpellBook() {
    if (confirm('Вы уверены, что хотите очистить всю книгу заклинаний?')) {
        spellBook = [];
        saveSpellBook();
        // Очищаем размеры шрифтов для удаленных заклинаний
        const fontSizes = loadFontSizes();
        const remainingFontSizes = {};
        // Сохраняем размеры только для заклинаний, которые остались в книге (в данном случае никого)
        saveFontSizes(remainingFontSizes);
        // Очищаем настройки карточек
        localStorage.removeItem('cardSettings');
        // Сбрасываем значения в выпадающих списках на значения по умолчанию
        const cardsPerRowSelect = document.getElementById('cardsPerRow');
        const rowsPerPageSelect = document.getElementById('rowsPerPage');
        const fontSizeSelect = document.getElementById('fontSize');
        if (cardsPerRowSelect) cardsPerRowSelect.value = DEFAULT_CARD_SETTINGS.cardsPerRow;
        if (rowsPerPageSelect) rowsPerPageSelect.value = DEFAULT_CARD_SETTINGS.rowsPerPage;
        if (fontSizeSelect) fontSizeSelect.value = DEFAULT_CARD_SETTINGS.fontSize;
        updateSpellBookDisplay();
        updateSpellCardButtons();
    }
}

// Проверка, есть ли заклинание в книге
function isInSpellBook(spellId) {
    return spellBook.includes(spellId);
}

// Заполнение фильтра классов
function populateClassFilter() {
    const filterClass = document.getElementById('filterClass');
    Object.entries(classesMap).forEach(([id, name]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        filterClass.appendChild(option);
    });
}

// Сортировка заклинаний: сначала по уровню, затем по алфавиту
function sortSpells(spells) {
    return [...spells].sort((a, b) => {
        // Сначала по уровню
        if (a.Level !== b.Level) {
            return a.Level - b.Level;
        }
        // Затем по алфавиту (по названию)
        return a.Name.localeCompare(b.Name, 'ru');
    });
}

// Загрузка размеров шрифтов из localStorage
function loadFontSizes() {
    const saved = localStorage.getItem('spellFontSizes');
    return saved ? JSON.parse(saved) : {};
}

// Сохранение размеров шрифтов в localStorage
function saveFontSizes(fontSizes) {
    localStorage.setItem('spellFontSizes', JSON.stringify(fontSizes));
}

// Получение размера шрифта для заклинания
function getFontSize(spellId) {
    const fontSizes = loadFontSizes();
    return fontSizes[spellId] ? parseFloat(fontSizes[spellId]) : DEFAULT_FONT_SIZE;
}

// Получение размера шрифта для карточки (индивидуальный или общий)
function getCardFontSize(spellId, defaultFontSize) {
    const fontSizes = loadFontSizes();
    const hasIndividualSize = fontSizes.hasOwnProperty(spellId);
    return hasIndividualSize ? parseFloat(fontSizes[spellId]) : defaultFontSize;
}

// Установка размера шрифта для заклинания
function setFontSize(spellId, size) {
    const fontSizes = loadFontSizes();
    fontSizes[spellId] = size;
    saveFontSizes(fontSizes);
}

// Отображение заклинаний
function displaySpells(spells) {
    const grid = document.getElementById('spellsGrid');
    const countElement = document.getElementById('spellsCount');
    grid.innerHTML = '';
    
    const sortedSpells = sortSpells(spells);
    sortedSpells.forEach(spell => {
        const card = createSpellCard(spell, false);
        grid.appendChild(card);
    });
    
    // Обновляем счетчик
    if (countElement) {
        const totalCount = allSpells.length;
        const displayedCount = sortedSpells.length;
        countElement.innerHTML = `Показано <span class="serch-result-count">${displayedCount}</span> из <span class="serch-result-count">${totalCount}</span> заклинаний`;
    }
    
    updateSpellCardButtons();
}

// Создание карточки заклинания
function createSpellCard(spell, isBookView = false) {
    const card = document.createElement('div');
    card.className = 'spell-card';
    if (!isBookView && isInSpellBook(spell.Id)) {
        card.classList.add('spell-card-in-book');
    }
    card.dataset.spellId = spell.Id;
    
    // Определяем цвет карточки для книги заклинаний
    if (isBookView) {
        const cardSettings = loadCardSettings();
        card.style.setProperty('--card-border-color', cardSettings.cardColor);
        // Для Firefox используем прямое присваивание
        card.style.borderColor = cardSettings.cardColor;
    }

    const levelText = spell.Level === 0 ? '<strong>Заговор</strong>' : `<strong>${spell.Level}</strong> уровень`;
    const schoolName = schoolsMap[spell.School] || `Школа ${spell.School}`;
    const classesList = spell.Classes.split('|')
        .map(id => classesMap[id] || `Класс ${id}`)
        .join(', ');

    const components = [];
    if (spell.V) components.push('В');
    if (spell.S) components.push('С');
    if (spell.M) components.push('М');
    const componentsText = components.join(', ') + (spell.ComponentText ? ` (${spell.ComponentText})` : '');

    // Разделяем название на русскую и английскую части
    const nameMatch = spell.Name.match(/^(.+?)\s*\[(.+?)\]$/);
    const russianName = nameMatch ? nameMatch[1] : spell.Name;
    const englishName = nameMatch ? nameMatch[2] : null;
    const nameHtml = englishName 
        ? `${escapeHtml(russianName)} <span class="spell-name-english">[${escapeHtml(englishName)}]</span>`
        : escapeHtml(spell.Name);

    // Определяем размер шрифта для описания и цвет для названия
    let descriptionFontSize = DEFAULT_FONT_SIZE;
    let descriptionStyle = '';
    let spellNameStyle = '';
    let cardSettings = null;
    
    if (isBookView) {
        cardSettings = loadCardSettings();
        descriptionFontSize = getCardFontSize(spell.Id, cardSettings.fontSize);
        descriptionStyle = `style="font-size: ${descriptionFontSize}pt; --scrollbar-color: ${cardSettings.cardColor}; scrollbar-color: ${cardSettings.cardColor} #f0f0f0;"`;
        spellNameStyle = `style="color: ${cardSettings.cardColor};"`;
    }

    const headerLineColor = getHeaderLineColor(card, cardSettings);

    card.innerHTML = `
        <div class="spell-card-header">
            <div class="spell-name" ${spellNameStyle}>${nameHtml}</div>
            <div class="spell-level-school">
                <span>${levelText}</span>
                <span>${schoolName}</span>
            </div>
            <svg class="header-line" xmlns="http://www.w3.org/2000/svg" width="100%" height="2" preserveAspectRatio="none">
                <line x1="0" y1="0" x2="100%" y2="0" stroke="${headerLineColor}" stroke-width="2"/>
            </svg>
        </div>
        <div class="spell-info">
            <div class="spell-info-row">
                <span><strong>Время:</strong></span>
                <span>${escapeHtml(spell.Time)}</span>
            </div>
            <div class="spell-info-row">
                <span><strong>Дистанция:</strong></span>
                <span>${escapeHtml(spell.Range)}</span>
            </div>
            <div class="spell-info-row">
                <span><strong>Длительность:</strong></span>
                <span>${escapeHtml(spell.Duration)}</span>
            </div>
            <div class="spell-components">
                <strong>Компоненты:</strong> ${escapeHtml(componentsText)}
            </div>
            <div class="spell-info-row" style="display: none;">
                <span><strong>Классы:</strong></span>
                <span style="font-size: 6pt;">${escapeHtml(classesList)}</span>
            </div>
        </div>
        <div class="spell-description" data-spell-id="${spell.Id}" data-font-size="${descriptionFontSize}" ${descriptionStyle}>
            ${processHtmlText(spell.HtmlText || '')}
        </div>
        ${!isBookView ? `
        <div class="spell-actions">
            <button class="btn-add" onclick="addToSpellBook('${spell.Id}')" 
                    ${isInSpellBook(spell.Id) ? 'style="display:none"' : ''}>Добавить в книгу</button>
            <button class="btn-remove" onclick="removeFromSpellBook('${spell.Id}')" 
                    ${!isInSpellBook(spell.Id) ? 'style="display:none"' : ''}>Удалить из книги</button>
        </div>
        ` : ''}
        ${isBookView ? `
        <div class="font-size-controls">
            <button class="font-size-btn font-size-decrease" onclick="decreaseFontSize('${spell.Id}')" title="Уменьшить шрифт">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M1 6h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
            <button class="font-size-btn font-size-increase" onclick="increaseFontSize('${spell.Id}')" title="Увеличить шрифт">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
            <button class="font-size-btn font-size-delete" onclick="removeFromSpellBook('${spell.Id}')" title="Удалить из книги">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        </div>
        ` : ''}
    `;


    return card;
}

// Обновление кнопок на карточках
function updateSpellCardButtons() {
    document.querySelectorAll('.spell-card').forEach(card => {
        const spellId = card.dataset.spellId;
        const addBtn = card.querySelector('.btn-add');
        const removeBtn = card.querySelector('.btn-remove');
        
        if (addBtn && removeBtn) {
            const inBook = isInSpellBook(spellId);
            addBtn.style.display = inBook ? 'none' : 'block';
            removeBtn.style.display = inBook ? 'block' : 'none';
            
            // Обновляем класс для визуального отображения
            if (inBook) {
                card.classList.add('spell-card-in-book');
            } else {
                card.classList.remove('spell-card-in-book');
            }
        }
    });
}

// Обновление отображения книги заклинаний
function updateSpellBookDisplay() {
    const grid = document.getElementById('spellBookGrid');
    const bookCount = document.getElementById('bookCount');
    grid.innerHTML = '';
    
    const bookSpells = allSpells.filter(spell => spellBook.includes(spell.Id));
    
    if (bookCount) {
        bookCount.innerHTML = `Заклинаний в книге: <span class="serch-result-count">${bookSpells.length}</span>`;
    }
    
    if (bookSpells.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 20px;">Книга заклинаний пуста. Добавьте заклинания из списка всех заклинаний.</p>';
        return;
    }
    
    const sortedBookSpells = sortSpells(bookSpells);
    sortedBookSpells.forEach(spell => {
        const card = createSpellCard(spell, true);
        grid.appendChild(card);
    });
    
    // Применяем размеры карточек после создания
    applyCardSizes();
}

// Сохранение фильтров в localStorage
function saveFilters() {
    const filters = {
        name: document.getElementById('searchName').value,
        level: document.getElementById('filterLevel').value,
        class: document.getElementById('filterClass').value,
        source: document.getElementById('filterSource').value
    };
    localStorage.setItem('spellFilters', JSON.stringify(filters));
}

// Загрузка фильтров из localStorage
function loadFilters() {
    const saved = localStorage.getItem('spellFilters');
    if (saved) {
        try {
            const filters = JSON.parse(saved);
            if (filters.name) {
                document.getElementById('searchName').value = filters.name;
            }
            if (filters.level) {
                document.getElementById('filterLevel').value = filters.level;
            }
            if (filters.class) {
                document.getElementById('filterClass').value = filters.class;
            }
            if (filters.source) {
                document.getElementById('filterSource').value = filters.source;
            }
        } catch (e) {
            console.warn('Ошибка загрузки фильтров:', e);
        }
    }
}

// Фильтрация заклинаний
function filterSpells() {
    const nameFilter = document.getElementById('searchName').value.toLowerCase();
    const levelFilter = document.getElementById('filterLevel').value;
    const classFilter = document.getElementById('filterClass').value;
    const sourceFilter = document.getElementById('filterSource').value;

    // Сохраняем фильтры
    saveFilters();

    let filtered = allSpells.filter(spell => {
        const nameMatch = !nameFilter || spell.Name.toLowerCase().includes(nameFilter);
        const levelMatch = !levelFilter || spell.Level.toString() === levelFilter;
        const classMatch = !classFilter || spell.Classes.split('|').includes(classFilter);
        const sourceMatch = !sourceFilter || spell.Source === sourceFilter;
        
        return nameMatch && levelMatch && classMatch && sourceMatch;
    });

    displaySpells(filtered);
}

// Экранирование HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Обработка HTML текста заклинания
function processHtmlText(htmlText) {
    if (!htmlText) return '';
    
    // Удаляем таблицу с кратким описанием
    let processed = htmlText
        .replace(/<table[^>]*name=["']Таблица["'][^>]*>[\s\S]*?<\/table>/gi, '')
        // Обрабатываем baselink - извлекаем название из атрибута name, если содержимое пустое
        .replace(/<baselink[^>]*name=["']([^"']+)["'][^>]*>([^<]*)<\/baselink>/gi, function(match, nameAttr, content) {
            // Используем атрибут name, если содержимое пустое или только пробелы
            return content.trim() ? `<span class="baselink">${content}</span>` : `<span class="baselink">${nameAttr}</span>`;
        })
        // Обрабатываем самозакрывающиеся baselink теги
        .replace(/<baselink[^>]*name=["']([^"']+)["'][^>]*\/>/gi, '<span class="baselink">$1</span>')
        // Заменяем специальные теги на более читаемые версии
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
    
    return processed;
}

// Переключение представлений
function switchView(view) {
    const allView = document.getElementById('allSpellsView');
    const bookView = document.getElementById('spellBookView');
    const allBtn = document.getElementById('viewAllBtn');
    const bookBtn = document.getElementById('viewBookBtn');

    if (view === 'all') {
        allView.classList.remove('hidden');
        bookView.classList.add('hidden');
        allBtn.classList.add('active');
        bookBtn.classList.remove('active');
    } else {
        allView.classList.add('hidden');
        bookView.classList.remove('hidden');
        allBtn.classList.remove('active');
        bookBtn.classList.add('active');
        updateSpellBookDisplay();
        // Применяем размеры при переключении на книгу
        setTimeout(() => applyCardSizes(), 100);
    }
}

// Печать
function printSpellBook() {
    // Переключаемся на книгу заклинаний перед печатью
    switchView('book');
    // Небольшая задержка для обновления DOM перед печатью
    setTimeout(() => {
        // Применяем размеры перед печатью (использует ту же логику расчета)
        // Но сохраняем индивидуальные размеры шрифта перед применением
        const grid = document.getElementById('spellBookGrid');
        const cards = grid.querySelectorAll('.spell-card');
        
        // Сохраняем текущие индивидуальные размеры из DOM перед применением общих настроек
        const settings = loadCardSettings();
        cards.forEach(card => {
            const description = card.querySelector('.spell-description');
            if (description) {
                const spellId = description.dataset.spellId;
                const currentSize = parseFloat(description.dataset.fontSize) || parseFloat(description.style.fontSize);
                // Если размер отличается от общего, сохраняем его как индивидуальный
                if (currentSize && currentSize !== settings.fontSize) {
                    setFontSize(spellId, currentSize);
                }
            }
        });
        
        // Применяем размеры (теперь индивидуальные размеры сохранены в localStorage)
        applyCardSizes();
        window.print();
    }, 200);
}

// Обработчик изменения настроек карточек
function handleCardSettingsChange() {
    const cardsPerRowSelect = document.getElementById('cardsPerRow');
    const rowsPerPageSelect = document.getElementById('rowsPerPage');
    const fontSizeSelect = document.getElementById('fontSize');
    const cardColorSelect = document.getElementById('cardColor');
    
    if (!cardsPerRowSelect || !rowsPerPageSelect || !fontSizeSelect || !cardColorSelect) return;
    
    const cardsPerRow = parseInt(cardsPerRowSelect.value);
    const rowsPerPage = parseInt(rowsPerPageSelect.value);
    const fontSize = parseFloat(fontSizeSelect.value);
    const cardColor = cardColorSelect.value;
    
    // Сохраняем и применяем размеры сразу
    saveCardSettings(cardsPerRow, rowsPerPage, fontSize, cardColor);
    applyCardSizes();
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Обработчики фильтров
    document.getElementById('searchName').addEventListener('input', filterSpells);
    document.getElementById('filterLevel').addEventListener('change', filterSpells);
    document.getElementById('filterClass').addEventListener('change', filterSpells);
    document.getElementById('filterSource').addEventListener('change', filterSpells);

    // Обработчики навигации
    document.getElementById('viewAllBtn').addEventListener('click', () => switchView('all'));
    document.getElementById('viewBookBtn').addEventListener('click', () => switchView('book'));
    document.getElementById('clearBookBtn').addEventListener('click', clearSpellBook);

    // Обработчик печати
    document.getElementById('printBtn').addEventListener('click', printSpellBook);
    
    // Обработчик сброса настроек
    const resetSettingsBtn = document.getElementById('resetSettingsBtn');
    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', resetCardSettings);
    }

    // Обработчики настроек карточек
    const cardsPerRowSelect = document.getElementById('cardsPerRow');
    const rowsPerPageSelect = document.getElementById('rowsPerPage');
    const fontSizeSelect = document.getElementById('fontSize');
    const cardColorSelect = document.getElementById('cardColor');
    
    if (cardsPerRowSelect) {
        cardsPerRowSelect.addEventListener('change', handleCardSettingsChange);
    }
    if (rowsPerPageSelect) {
        rowsPerPageSelect.addEventListener('change', handleCardSettingsChange);
    }
    if (fontSizeSelect) {
        fontSizeSelect.addEventListener('change', handleCardSettingsChange);
    }
    if (cardColorSelect) {
        cardColorSelect.addEventListener('change', handleCardSettingsChange);
    }

    // Загрузка данных
    loadData();
});

// Изменение размера шрифта для карточки в книге
function changeFontSize(spellId, delta) {
    // Работает только в книге заклинаний
    const bookView = document.getElementById('spellBookView');
    if (bookView.classList.contains('hidden')) return;
    
    const description = document.querySelector(`#spellBookGrid .spell-description[data-spell-id="${spellId}"]`);
    if (!description) return;
    
    const currentSize = parseFloat(description.dataset.fontSize) || getFontSize(spellId);
    const newSize = currentSize + delta;
    
    // Проверяем границы
    if (newSize < FONT_SIZE_LIMITS.min || newSize > FONT_SIZE_LIMITS.max) return;
    
    description.dataset.fontSize = newSize;
    description.style.fontSize = newSize + 'pt';
    setFontSize(spellId, newSize);
}

function increaseFontSize(spellId) {
    changeFontSize(spellId, 0.5);
}

function decreaseFontSize(spellId) {
    changeFontSize(spellId, -0.5);
}

// Экспорт функций для использования в onclick
window.addToSpellBook = addToSpellBook;
window.removeFromSpellBook = removeFromSpellBook;
window.clearSpellBook = clearSpellBook;
window.increaseFontSize = increaseFontSize;
window.decreaseFontSize = decreaseFontSize;

