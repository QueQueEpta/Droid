// generate_dataset.js
const fs = require('fs');
const path = require('path');
const { devices: allDevices, updateDeviceState } = require('./devices');
const scenarioGenerator = require('./scenario_generator');
const { createCSVWriter } = require('./data_writer');

// --- Парсинг аргументов командной строки ---
const args = process.argv.slice(2);
let configPathArg = null;
let outputPathArg = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && i + 1 < args.length) {
        configPathArg = args[i + 1];
        i++;
    } else if (args[i] === '--output' && i + 1 < args.length) {
        outputPathArg = args[i + 1];
        i++;
    }
}

if (!configPathArg || !outputPathArg) {
    console.error("Ошибка: Необходимо указать путь к файлу конфигурации (--config) и путь к выходному файлу (--output).");
    console.error("Пример: node generate_dataset.js --config ./configs/my_config.json --output ./datasets/my_dataset.csv");
    process.exit(1);
}

const configPath = path.resolve(configPathArg);
const outputFile = path.resolve(outputPathArg);

console.log("--- Запуск генератора датасетов (с реалистичными профилями) ---");
console.log(`Используется конфиг: ${configPath}`);
console.log(`Выходной файл: ${outputFile}`);


// --- Вспомогательные функции ---
function sanitizeNameForHeader(name) {
    if (!name) return 'unknown_device';
    const sanitized = name
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '');
    return sanitized.length > 0 ? sanitized : 'device';
}
function roundToTwoDecimals(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

// --- 1. Загрузка конфигурации ---
let config;
try {
    console.log(`Загрузка конфигурации из ${configPath}...`);
    if (!fs.existsSync(configPath)) {
        throw new Error(`Файл конфигурации не найден: ${configPath}`);
    }
    const configFileContent = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(configFileContent);
    console.log("Конфигурация успешно загружена.");
} catch (error) {
    console.error(`Ошибка чтения или парсинга файла конфигурации ${configPath}:`, error);
    process.exit(1);
}

// --- 2. Инициализация параметров симуляции ---
const durationHours = Number(config.simulationDurationHours);
if (isNaN(durationHours) || durationHours <= 0) {
    console.error(`Ошибка: Некорректное значение simulationDurationHours (${config.simulationDurationHours}) в файле конфигурации.`);
    process.exit(1);
}

const simulationDurationMs = durationHours * 60 * 60 * 1000;
const timeStepMs = Number(config.timeStepMs);
if (isNaN(timeStepMs) || timeStepMs <= 0) {
    console.error(`Ошибка: Некорректное значение timeStepMs (${config.timeStepMs}) в файле конфигурации.`);
    process.exit(1);
}

const startTimeMs = Date.now(); // Текущее время как Unix timestamp (UTC)
const endTimeMs = startTimeMs + simulationDurationMs;
const noiseLevelWatts = Number(config.noiseLevelWatts) || 0;

console.log(`Длительность симуляции: ${durationHours} ч (${simulationDurationMs} мс)`);
console.log(`Шаг времени: ${timeStepMs} мс`);
const startLogTime = new Date(startTimeMs).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', hour12: false });
const endLogTime = new Date(endTimeMs).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', hour12: false });
console.log(`Время начала (UTC): ${startTimeMs} (${new Date(startTimeMs).toISOString()})`);
console.log(`Лог. время начала (МСК): ${startLogTime}`);
console.log(`Расчетное лог. время окончания (МСК): ${endLogTime}`);
console.log(`Фоновый шум: ${noiseLevelWatts} Вт`);

// --- Фильтрация устройств ---
const devicesToIncludeConfig = config.devicesToInclude || Object.keys(allDevices);
const activeDevices = {}; // { deviceId: instance }
devicesToIncludeConfig.forEach(id => {
    if (allDevices[id]) {
        activeDevices[id] = allDevices[id];
    } else {
        console.warn(`Устройство с ID '${id}', указанное в конфиге, не найдено в папке 'devices/' и будет проигнорировано.`);
    }
});
const finalDeviceIds = Object.keys(activeDevices);

if (finalDeviceIds.length === 0) {
    console.error("Нет активных устройств для симуляции. Проверьте 'devicesToInclude' в config.json.");
    process.exit(1);
}
console.log(`Активные устройства (${finalDeviceIds.length}): ${finalDeviceIds.map(id => `${id} (${activeDevices[id].name})`).join(', ')}`);


// --- Инициализация генератора сценариев ---
if (!config.deviceScenarioConfigs) {
     console.error("Ошибка: Отсутствует секция 'deviceScenarioConfigs' в файле конфигурации.");
     process.exit(1);
}
scenarioGenerator.initialize(activeDevices, config.deviceScenarioConfigs);


// --- Начальное состояние устройств ---
let currentDeviceStates = {};
finalDeviceIds.forEach(id => {
    currentDeviceStates[id] = false; // Начинаем все выключенными
    updateDeviceState(id, false);    // Устанавливаем начальное состояние в экземплярах устройств
});


// --- 3. Подготовка к записи данных ---
const devicePowerHeaders = finalDeviceIds.map(id => {
    const deviceName = activeDevices[id]?.name;
    const sanitizedName = sanitizeNameForHeader(deviceName || id);
    return `${sanitizedName}_power`;
});
const headers = [
    'timestamp',
    'aggregated_power',
    'aggregated_current',
    ...devicePowerHeaders
];

const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
    console.log(`Создание директории для датасетов: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
}
const { csvStream, writableStream: fileStream } = createCSVWriter(outputFile, headers);


// --- 4. Основной цикл симуляции ---
let currentTimeMs = startTimeMs;
let iteration = 0;
const totalIterations = Math.ceil(simulationDurationMs / timeStepMs);
console.log(`Расчетное кол-во итераций: ${totalIterations}`);

const logIntervalIterations = Math.max(1000, Math.floor(totalIterations / 50)); // Логгируем чаще или каждые 1000 итераций
let lastLoggedIteration = -logIntervalIterations; // Чтобы первый лог точно произошел

while (currentTimeMs < endTimeMs) {

    if (iteration >= lastLoggedIteration + logIntervalIterations || iteration === 0) {
        const progressPercent = ((iteration / totalIterations) * 100).toFixed(1);
        const displayTime = new Date(currentTimeMs).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', hour12: false });
        console.log(`[Итерация ${iteration}/${totalIterations} (${progressPercent}%)] Время: ${displayTime} (МСК)`);
        lastLoggedIteration = iteration;
    }

    // 4.1 Сценарии
    const nextStatesFromScenario = scenarioGenerator.getNextStates(currentTimeMs, currentDeviceStates, timeStepMs);
    
    // 4.2 Обновление состояний
    for (const deviceId of finalDeviceIds) {
        if (nextStatesFromScenario[deviceId] !== currentDeviceStates[deviceId]) {
            updateDeviceState(deviceId, nextStatesFromScenario[deviceId]);
            currentDeviceStates[deviceId] = nextStatesFromScenario[deviceId];
        }
    }
    
    // 4.3 Генерация данных
    let aggregatedPower = 0, aggregatedCurrent = 0;
    const individualDeviceReadings = {};
    for (const deviceId of finalDeviceIds) {
        const deviceData = activeDevices[deviceId].generateData(timeStepMs);
        individualDeviceReadings[deviceId] = deviceData;
        aggregatedPower += deviceData.power;
        aggregatedCurrent += deviceData.current;
    }
    
    // 4.4 Шум
    const currentNoise = Math.max(0, noiseLevelWatts + (Math.random() - 0.5) * (noiseLevelWatts * 0.5));
    aggregatedPower += currentNoise;
    // Используем напряжение первого активного устройства для расчета тока шума, или 220В по умолчанию
    const noiseVoltage = activeDevices[finalDeviceIds[0]]?.voltage || 220;
    aggregatedCurrent += Math.max(0, currentNoise / noiseVoltage);
    
    // 4.5 Формирование строки с округлением
    const rowData = { timestamp: currentTimeMs, aggregated_power: roundToTwoDecimals(aggregatedPower), aggregated_current: roundToTwoDecimals(aggregatedCurrent) };
    finalDeviceIds.forEach(id => {
        const deviceName = activeDevices[id]?.name;
        const sanitizedName = sanitizeNameForHeader(deviceName || id);
        const devicePower = individualDeviceReadings[id]?.power ?? 0;
        rowData[`${sanitizedName}_power`] = roundToTwoDecimals(devicePower);
    });

    // 4.6 Запись в CSV поток
    csvStream.write(rowData);

    // 4.7 Продвигаем время и итерацию
    currentTimeMs += timeStepMs;
    iteration++;

    if (iteration > totalIterations + 1000) { // Допуск на случай неточного расчета totalIterations
        console.error(`!!! Аварийный выход: Количество итераций (${iteration}) значительно превысило расчетное (${totalIterations}).`);
        break;
    }
}

// --- 5. Завершение записи ---
console.log(`--- Цикл симуляции завершен (Итераций: ${iteration}) ---`);
const finalLogTime = new Date(currentTimeMs).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', hour12: false });
console.log(`Финальное currentTimeMs (UTC): ${currentTimeMs} (${new Date(currentTimeMs).toISOString()})`);
console.log(`Финальное лог. время (МСК): ${finalLogTime}`);

csvStream.end();

fileStream.on('finish', () => {
    console.log(`--- Генерация датасета и запись в файл УСПЕШНО ЗАВЕРШЕНЫ ---`);
    console.log(`Данные сохранены в файл: ${outputFile}`);
    process.exit(0);
});

fileStream.on('error', (error) => {
     console.error("--- Ошибка основного файлового потока (fs.WriteStream) ---", error);
     process.exit(1);
});

// Таймаут на случай зависания записи
setTimeout(() => {
    console.warn("Таймаут ожидания завершения записи CSV (5 минут). Процесс завершается принудительно.");
    process.exit(1);
}, 300000); // 5 минут