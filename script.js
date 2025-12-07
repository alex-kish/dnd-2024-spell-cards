// Глобальные переменные
let allSpells = [];
let classesMap = {};
let schoolsMap = {};
let spellBook = [];

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
    return fontSizes[spellId] ? parseFloat(fontSizes[spellId]) : 7;
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

    card.innerHTML = `
        <div class="spell-card-header">
            <div class="spell-name">${nameHtml}</div>
            <div class="spell-level-school">
                <span>${levelText}</span>
                <span>${schoolName}</span>
            </div>
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
        <div class="spell-description" data-spell-id="${spell.Id}" data-font-size="${isBookView ? getFontSize(spell.Id) : 7}" style="${isBookView ? `font-size: ${getFontSize(spell.Id)}pt;` : ''}">
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
            <button class="font-size-btn font-size-decrease" onclick="decreaseFontSize('${spell.Id}')" title="Уменьшить шрифт">−</button>
            <button class="font-size-btn font-size-increase" onclick="increaseFontSize('${spell.Id}')" title="Увеличить шрифт">+</button>
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
        bookCount.textContent = `Заклинаний в книге: ${bookSpells.length}`;
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
}

// Сохранение фильтров в localStorage
function saveFilters() {
    const filters = {
        name: document.getElementById('searchName').value,
        level: document.getElementById('filterLevel').value,
        class: document.getElementById('filterClass').value
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

    // Сохраняем фильтры
    saveFilters();

    let filtered = allSpells.filter(spell => {
        const nameMatch = !nameFilter || spell.Name.toLowerCase().includes(nameFilter);
        const levelMatch = !levelFilter || spell.Level.toString() === levelFilter;
        const classMatch = !classFilter || spell.Classes.split('|').includes(classFilter);
        
        return nameMatch && levelMatch && classMatch;
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
    }
}

// Печать
function printSpellBook() {
    // Переключаемся на книгу заклинаний перед печатью
    switchView('book');
    // Небольшая задержка для обновления DOM перед печатью
    setTimeout(() => {
        window.print();
    }, 100);
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Обработчики фильтров
    document.getElementById('searchName').addEventListener('input', filterSpells);
    document.getElementById('filterLevel').addEventListener('change', filterSpells);
    document.getElementById('filterClass').addEventListener('change', filterSpells);

    // Обработчики навигации
    document.getElementById('viewAllBtn').addEventListener('click', () => switchView('all'));
    document.getElementById('viewBookBtn').addEventListener('click', () => switchView('book'));
    document.getElementById('clearBookBtn').addEventListener('click', clearSpellBook);

    // Обработчик печати
    document.getElementById('printBtn').addEventListener('click', printSpellBook);

    // Загрузка данных
    loadData();
});

// Изменение размера шрифта для карточки в книге
function increaseFontSize(spellId) {
    // Работает только в книге заклинаний
    const bookView = document.getElementById('spellBookView');
    if (bookView.classList.contains('hidden')) return;
    
    const description = document.querySelector(`#spellBookGrid .spell-description[data-spell-id="${spellId}"]`);
    if (!description) return;
    
    const currentSize = parseFloat(description.dataset.fontSize) || getFontSize(spellId);
    if (currentSize < 12) { // максимум +5 от базового 7pt
        const newSize = currentSize + 0.5;
        description.dataset.fontSize = newSize;
        description.style.fontSize = newSize + 'pt';
        setFontSize(spellId, newSize);
    }
}

function decreaseFontSize(spellId) {
    // Работает только в книге заклинаний
    const bookView = document.getElementById('spellBookView');
    if (bookView.classList.contains('hidden')) return;
    
    const description = document.querySelector(`#spellBookGrid .spell-description[data-spell-id="${spellId}"]`);
    if (!description) return;
    
    const currentSize = parseFloat(description.dataset.fontSize) || getFontSize(spellId);
    if (currentSize > 2) { // минимум -5 от базового 7pt
        const newSize = currentSize - 0.5;
        description.dataset.fontSize = newSize;
        description.style.fontSize = newSize + 'pt';
        setFontSize(spellId, newSize);
    }
}

// Экспорт функций для использования в onclick
window.addToSpellBook = addToSpellBook;
window.removeFromSpellBook = removeFromSpellBook;
window.clearSpellBook = clearSpellBook;
window.increaseFontSize = increaseFontSize;
window.decreaseFontSize = decreaseFontSize;

