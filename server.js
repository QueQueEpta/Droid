const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const csv = require('fast-csv');

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIGS_DIR = path.join(__dirname, 'configs');
const DATASETS_DIR = path.join(__dirname, 'datasets');
const GENERATE_SCRIPT = path.join(__dirname, 'generate_dataset.js');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '5mb' }));

function sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') return '';
    return filename
        .replace(/(\.\.[/\\]|[/\\])/g, '')
        .replace(/[^a-zA-Z0-9_.-]/g, '_')
        .substring(0, 100);
}

// --- API Эндпоинты для Конфигураций ---
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

app.get('/api/configs/:filename', async (req, res) => {
    const unsafeFilename = req.params.filename;
    const safeFilename = sanitizeFilename(unsafeFilename);

    if (!safeFilename || safeFilename !== unsafeFilename) {
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
    } catch (error) {
        console.error(`Ошибка чтения файла конфигурации ${safeFilename}:`, error);
        res.status(404).json({ status: 'error', message: `Файл конфигурации ${safeFilename} не найден или ошибка чтения.` });
    }
});

app.post('/api/configs', async (req, res) => {
    const { originalFilename, newContent, comment } = req.body;
    const safeOriginalFilename = sanitizeFilename(originalFilename);

    if (!safeOriginalFilename || !newContent) {
        return res.status(400).json({ status: 'error', message: 'Отсутствуют или некорректны необходимые данные (originalFilename, newContent).' });
    }

    let configData;
    try {
        configData = JSON.parse(newContent);
    } catch (e) {
        console.error('Ошибка парсинга JSON при сохранении конфига:', e);
        return res.status(400).json({ status: 'error', message: 'Некорректный JSON в содержимом конфигурации.' });
    }

     configData._metadata = {
         ...(configData._metadata || {}),
         comment: comment || undefined,
         savedAt: new Date().toISOString(),
         basedOn: safeOriginalFilename
     };
     if (!configData._metadata.comment) delete configData._metadata.comment;

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
    } catch (error) {
        console.error('Ошибка записи файла конфигурации:', error);
        res.status(500).json({ status: 'error', message: 'Не удалось сохранить файл конфигурации.' });
    }
});

// --- API Эндпоинт для Запуска Генерации ---
app.post('/api/generate', async (req, res) => {
    const { configFile } = req.body;
    const safeConfigFile = sanitizeFilename(configFile);
    if (!safeConfigFile) {
        return res.status(400).json({ status: 'error', message: 'Не указано или некорректно имя файла конфигурации.' });
    }

    const configFilePath = path.join(CONFIGS_DIR, safeConfigFile);
    try { await fs.access(configFilePath); } catch (error) {
        console.error(`Файл конфигурации не найден при запуске генерации: ${configFilePath}`);
        return res.status(404).json({ status: 'error', message: `Файл конфигурации '${safeConfigFile}' не найден.` });
     }

    const configNameWithoutExt = path.parse(safeConfigFile).name;
    let scenarioType = 'unknownScenario';
     try {
        const configContent = JSON.parse(await fs.readFile(configFilePath, 'utf-8'));
        if (configContent?.deviceScenarioConfigs) {
            const firstDeviceKey = Object.keys(configContent.deviceScenarioConfigs)[0];
            if (firstDeviceKey && configContent.deviceScenarioConfigs[firstDeviceKey]?.type) {
                scenarioType = sanitizeFilename(configContent.deviceScenarioConfigs[firstDeviceKey].type);
            } else {
                scenarioType = 'mixedOrCustom';
            }
        }
     } catch (e) { console.warn(`Не удалось прочитать тип сценария из ${safeConfigFile}:`, e.message); }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFileName = `dataset_${configNameWithoutExt}_${scenarioType}_${timestamp}.csv`;
    const outputFilePath = path.join(DATASETS_DIR, outputFileName);

    try {
        await fs.mkdir(DATASETS_DIR, { recursive: true });
        console.log(`Запуск скрипта: node ${GENERATE_SCRIPT} --config "${configFilePath}" --output "${outputFilePath}"`);

        const child = spawn('node', [
            GENERATE_SCRIPT, '--config', configFilePath, '--output', outputFilePath
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

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

// --- API Эндпоинты для Датасетов (Визуализация) ---
app.get('/api/datasets', async (req, res) => {
    try {
        console.log(`Поиск датасетов в: ${DATASETS_DIR}`);
        try { await fs.access(DATASETS_DIR); } catch (e) {
            console.log(`Директория датасетов не найдена, создаю: ${DATASETS_DIR}`);
            await fs.mkdir(DATASETS_DIR, { recursive: true });
            return res.json({ datasets: [] });
        }
        const files = await fs.readdir(DATASETS_DIR);
        const csvDatasets = files
            .filter(file => file.toLowerCase().endsWith('.csv'))
            .sort((a, b) => b.localeCompare(a));
        console.log(`Найдены датасеты: ${csvDatasets.join(', ') || 'Нет CSV файлов'}`);
        res.json({ datasets: csvDatasets });
    } catch (error) {
        console.error('Ошибка получения списка датасетов:', error);
        res.status(500).json({ status: 'error', message: 'Не удалось прочитать список датасетов.' });
    }
});

app.get('/api/datasets/:filename', async (req, res) => {
    const unsafeFilename = req.params.filename;
    const safeFilename = sanitizeFilename(unsafeFilename);

    const requestedLimitQuery = req.query.limit;
    let rowLimitToApply = 5000; // Дефолтный лимит, если параметр не передан или некорректен

    if (requestedLimitQuery) {
        const parsedLimit = parseInt(requestedLimitQuery, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
            rowLimitToApply = parsedLimit;
        } else {
            console.warn(`Некорректное значение query-параметра limit: '${requestedLimitQuery}'. Используется дефолтный лимит ${rowLimitToApply}.`);
        }
    }

    if (!safeFilename || safeFilename !== unsafeFilename) {
         console.warn(`Попытка доступа к датасету с небезопасным или пустым именем: '${unsafeFilename}'`);
         return res.status(400).json({ status: 'error', message: 'Недопустимое имя файла датасета.' });
    }
    if (!safeFilename.toLowerCase().endsWith('.csv')) {
         return res.status(400).json({ status: 'error', message: 'Запрашиваемый файл не является CSV.' });
    }

    const filePath = path.join(DATASETS_DIR, safeFilename);
    console.log(`Запрос данных из файла: ${filePath}, запрошенный лимит (из query): '${requestedLimitQuery}', применяемый лимит: ${rowLimitToApply}`);

    try {
        await fs.access(filePath);
        const dataRows = [];
        let rowCount = 0; 
        let actualTotalRowsInFile = 0; 

        const stream = require('fs').createReadStream(filePath)
            .pipe(csv.parse({ headers: true }))
            .on('error', error => {
                console.error(`Ошибка парсинга CSV ${safeFilename}:`, error);
                if (!res.headersSent) {
                    res.status(500).json({ status: 'error', message: `Ошибка парсинга файла ${safeFilename}.` });
                }
                stream.destroy();
            })
            .on('data', row => {
                actualTotalRowsInFile++;
                if (rowCount < rowLimitToApply) {
                    for (const key in row) {
                        if (key === 'timestamp') {
                            row[key] = parseInt(row[key], 10);
                        } else if (!isNaN(parseFloat(row[key]))) {
                            row[key] = parseFloat(row[key]);
                        }
                    }
                    dataRows.push(row);
                    rowCount++;
                }
            })
            .on('end', () => {
                console.log(`Обработано для ${safeFilename}: прочитано ${rowCount} строк (из ${actualTotalRowsInFile} всего в файле), примененный лимит ${rowLimitToApply}.`);
                if (!res.headersSent) {
                    res.json({
                        filename: safeFilename,
                        data: dataRows,
                        rowCount: rowCount,
                        totalRowsInFile: actualTotalRowsInFile,
                        maxRowsLimitHit: actualTotalRowsInFile > rowCount && rowCount === rowLimitToApply
                    });
                }
            });

    } catch (error) {
        console.error(`Ошибка чтения файла датасета ${safeFilename}:`, error);
        if (!res.headersSent) {
             res.status(404).json({ status: 'error', message: `Файл датасета ${safeFilename} не найден или ошибка чтения.` });
        }
    }
});

// --- Запуск Сервера ---
app.listen(PORT, () => {
    console.log(`Сервер управления генератором запущен на http://localhost:${PORT}`);
    fs.mkdir(CONFIGS_DIR, { recursive: true }).catch(err => console.error("Не удалось создать папку configs:", err));
    fs.mkdir(DATASETS_DIR, { recursive: true }).catch(err => console.error("Не удалось создать папку datasets:", err));
});