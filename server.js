const express = require('express');
const fs = require('fs').promises; // Используем промисы
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIGS_DIR = path.join(__dirname, 'configs');
const DATASETS_DIR = path.join(__dirname, 'datasets');
const GENERATE_SCRIPT = path.join(__dirname, 'generate_dataset.js');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '5mb' }));

// Вспомогательная функция для безопасной работы с именами файлов
function sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') return ''; // Возвращаем пустую строку если имя невалидно
    return filename
        .replace(/(\.\.[/\\]|[/\\])/g, '')
        .replace(/[^a-zA-Z0-9_.-]/g, '_')
        .substring(0, 100);
}


// --- API Эндпоинты ---

// Получение списка конфигов
app.get('/api/configs', async (req, res) => {
    try {
        console.log(`Поиск конфигураций в: ${CONFIGS_DIR}`);
        try { await fs.access(CONFIGS_DIR); } catch (e) {
            console.log(`Создание директории: ${CONFIGS_DIR}`);
            await fs.mkdir(CONFIGS_DIR, { recursive: true });
            return res.json({ configs: [] });
        }
        const files = await fs.readdir(CONFIGS_DIR);
        const jsonConfigs = files
            .filter(file => file.toLowerCase().endsWith('.json'))
            .sort();
        console.log(`Найдены конфигурации: ${jsonConfigs.join(', ')}`);
        res.json({ configs: jsonConfigs });
    } catch (error) {
         console.error('Ошибка получения списка конфигураций:', error);
         res.status(500).json({ status: 'error', message: 'Не удалось прочитать список конфигураций.' });
     }
});

// Получение содержимого конкретного конфига
app.get('/api/configs/:filename', async (req, res) => {
    const unsafeFilename = req.params.filename;
    const safeFilename = sanitizeFilename(unsafeFilename);

    if (!safeFilename || safeFilename !== unsafeFilename) { // Проверяем, что имя валидно и не изменилось
         console.warn(`Попытка доступа к файлу с небезопасным или пустым именем: '${unsafeFilename}'`);
         return res.status(400).json({ status: 'error', message: 'Недопустимое имя файла.' });
    }
    if (!safeFilename.toLowerCase().endsWith('.json')) {
         return res.status(400).json({ status: 'error', message: 'Запрашиваемый файл не является JSON.' });
    }

    const filePath = path.join(CONFIGS_DIR, safeFilename);
    console.log(`Запрос содержимого файла: ${filePath}`);

    try {
        await fs.access(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        res.json({ content: content });
    } catch (error) { /* ... (обработка ошибок как раньше) ... */ }
});

// Сохранение нового конфига
app.post('/api/configs', async (req, res) => {
    const { originalFilename, newContent, comment } = req.body;
    const safeOriginalFilename = sanitizeFilename(originalFilename); // Очищаем и оригинальное имя

    if (!safeOriginalFilename || !newContent) {
        return res.status(400).json({ status: 'error', message: 'Отсутствуют или некорректны необходимые данные (originalFilename, newContent).' });
    }

    let configData;
    try {
        configData = JSON.parse(newContent);
    } catch (e) { /* ... (обработка ошибок JSON) ... */ }

    // Добавляем метаданные
     configData._metadata = {
         ...(configData._metadata || {}), // Сохраняем старые метаданные, если были
         comment: comment || undefined, // Добавляем комментарий, если он есть
         savedAt: new Date().toISOString(),
         basedOn: safeOriginalFilename
     };
     // Удаляем комментарий, если он пустой
     if (!configData._metadata.comment) delete configData._metadata.comment;


    // Генерация нового имени файла
    const baseName = path.parse(safeOriginalFilename).name;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const cleanBaseName = baseName.replace(/_edited_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/, '');
    const newFilename = `${cleanBaseName}_edited_${timestamp}.json`;
    const newFilePath = path.join(CONFIGS_DIR, newFilename);

    try {
        const contentToSave = JSON.stringify(configData, null, 2);
        await fs.writeFile(newFilePath, contentToSave, 'utf-8');
        console.log(`Конфигурация сохранена как: ${newFilePath}`);
        res.json({ status: 'success', message: 'Конфигурация успешно сохранена.', newFilename: newFilename });
    } catch (error) { /* ... (обработка ошибок записи) ... */ }
});


// Запуск процесса генерации
app.post('/api/generate', async (req, res) => {
    const { configFile } = req.body;
    console.log(`Получен запрос /api/generate с configFile: ${configFile}`); // Логгируем полученное имя

    const safeConfigFile = sanitizeFilename(configFile);
    if (!safeConfigFile) {
        return res.status(400).json({ status: 'error', message: 'Не указано или некорректно имя файла конфигурации.' });
    }

    const configFilePath = path.join(CONFIGS_DIR, safeConfigFile);
    console.log(`Используемый путь к конфигу: ${configFilePath}`); // Логгируем путь

    try { await fs.access(configFilePath); } catch (error) {
        console.error(`Файл конфигурации не найден при запуске генерации: ${configFilePath}`);
        return res.status(404).json({ status: 'error', message: `Файл конфигурации '${safeConfigFile}' не найден.` });
     }

    // Формирование имени выходного файла
    const configNameWithoutExt = path.parse(safeConfigFile).name;
    let scenarioType = 'unknownScenario';
     try {
        const configContent = JSON.parse(await fs.readFile(configFilePath, 'utf-8'));
        // Используем sanitizeFilename и для типа сценария
        scenarioType = configContent?.scenarioParams?.type ? sanitizeFilename(configContent.scenarioParams.type) : 'unknownScenario';
     } catch (e) { console.warn(`Не удалось прочитать тип сценария из ${safeConfigFile}:`, e.message); }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFileName = `dataset_${configNameWithoutExt}_${scenarioType}_${timestamp}.csv`;
    const outputFilePath = path.join(DATASETS_DIR, outputFileName);

    console.log(`Выходной файл будет: ${outputFilePath}`);

    // Запуск дочернего процесса
    try {
        await fs.mkdir(DATASETS_DIR, { recursive: true });
        console.log(`Запуск скрипта: node ${GENERATE_SCRIPT} --config "${configFilePath}" --output "${outputFilePath}"`); // Логгируем команду запуска

        const child = spawn('node', [
            GENERATE_SCRIPT,
            '--config', configFilePath,
            '--output', outputFilePath
        ], {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        // Обработка вывода (для логов на сервере)
        child.stdout.on('data', (data) => { console.log(`[Генератор] stdout: ${data.toString().trim()}`); });
        child.stderr.on('data', (data) => { console.error(`[Генератор] stderr: ${data.toString().trim()}`); });
        child.on('close', (code) => { console.log(`Процесс генерации (${outputFileName}) завершен с кодом: ${code}`); });
        child.on('error', (error) => { console.error(`Ошибка запуска процесса генерации (${outputFileName}):`, error); });

        res.status(202).json({ status: 'success', message: 'Генерация запущена.', outputFile: outputFileName });

    } catch (error) {
        console.error('Критическая ошибка при попытке запуска генерации:', error);
        res.status(500).json({ status: 'error', message: 'Внутренняя ошибка сервера при запуске генерации.' });
    }
});


// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер управления генератором запущен на http://localhost:${PORT}`);
    fs.mkdir(CONFIGS_DIR, { recursive: true }).catch(console.error);
    fs.mkdir(DATASETS_DIR, { recursive: true }).catch(console.error);
});