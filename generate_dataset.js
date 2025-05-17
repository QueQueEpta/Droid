const fs = require('fs');
const path = require('path');
// Импортируем все устройства и функцию обновления из папки devices
const { devices: allDevices, updateDeviceState } = require('./devices');
// Импортируем генератор сценариев
const scenarioGenerator = require('./scenario_generator');
// Импортируем утилиту для записи CSV
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

console.log("--- Запуск генератора датасетов (с доп. логами и ожиданием записи) ---");
console.log(`Используется конфиг: ${configPath}`);
console.log(`Выходной файл: ${outputFile}`);


// --- Вспомогательная функция для очистки имени для использования в заголовке CSV ---
function sanitizeNameForHeader(name) {
    if (!name) return 'unknown_device';
    const sanitized = name
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '');
    return sanitized.length > 0 ? sanitized : 'device';
}

// --- Вспомогательная функция для округления до 2 знаков после запятой ---
function roundToTwoDecimals(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
}


// --- 1. Загрузка конфигурации (из указанного файла) ---
let config;
try {
    console.log(`Загрузка конфигурации из ${configPath}...`);
    if (!fs.existsSync(configPath)) {
        throw new Error(`Файл конфигурации не найден: ${configPath}`);
    }
    const configFileContent = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(configFileContent);
    console.log("Конфигурация успешно загружена.");
    console.log(`Прочитанное значение simulationDurationHours: ${config.simulationDurationHours} (тип: ${typeof config.simulationDurationHours})`);
} catch (error) {
    console.error(`Ошибка чтения или парсинга файла конфигурации ${configPath}:`, error);
    process.exit(1);
}

// --- 2. Инициализация параметров симуляции ---
const durationHours = Number(config.simulationDurationHours);
if (isNaN(durationHours) || durationHours <= 0) {
    console.error(`Ошибка: Некорректное значение simulationDurationHours (${config.simulationDurationHours}) в файле конфигурации. Должно быть положительное число.`);
    process.exit(1);
}

const simulationDurationMs = durationHours * 60 * 60 * 1000;
const timeStepMs = Number(config.timeStepMs);
if (isNaN(timeStepMs) || timeStepMs <= 0) {
    console.error(`Ошибка: Некорректное значение timeStepMs (${config.timeStepMs}) в файле конфигурации. Должно быть положительное число.`);
    process.exit(1);
}

const startTimeMs = Date.now();
const endTimeMs = startTimeMs + simulationDurationMs;
const noiseLevelWatts = Number(config.noiseLevelWatts) || 0;

console.log(`Длительность симуляции: ${durationHours} ч (${simulationDurationMs} мс)`);
console.log(`Шаг времени: ${timeStepMs} мс`);
console.log(`Время начала (мс): ${startTimeMs} (${new Date(startTimeMs).toISOString()})`);
console.log(`Расчетное время окончания (мс): ${endTimeMs} (${new Date(endTimeMs).toISOString()})`);
console.log(`Фоновый шум: ${noiseLevelWatts} Вт`);

// --- Фильтрация устройств ---
const devicesToIncludeConfig = config.devicesToInclude || Object.keys(allDevices);
if (!Array.isArray(devicesToIncludeConfig)) {
    console.error("Ошибка: 'devicesToInclude' в файле конфигурации должен быть массивом строк.");
    process.exit(1);
}
const activeDeviceIds = devicesToIncludeConfig;
const activeDevices = {};
activeDeviceIds.forEach(id => {
    if (allDevices[id]) {
        activeDevices[id] = allDevices[id];
    } else {
        console.warn(`Устройство с ID '${id}', указанное в конфиге, не найдено в папке 'devices/' и будет проигнорировано.`);
    }
});
const finalDeviceIds = Object.keys(activeDevices);
console.log(`Активные устройства (${finalDeviceIds.length}): ${finalDeviceIds.map(id => `${id} (${activeDevices[id].name})`).join(', ')}`);

if (finalDeviceIds.length === 0) {
    console.error("Нет активных устройств для симуляции. Проверьте 'devicesToInclude' в config.json.");
    process.exit(1);
}


// --- Инициализация генератора сценариев ---
if (!config.scenarioParams) {
     console.error("Ошибка: Отсутствует секция 'scenarioParams' в файле конфигурации.");
     process.exit(1);
}
scenarioGenerator.initialize(finalDeviceIds, config.scenarioParams);


// --- Начальное состояние устройств ---
let currentDeviceStates = {};
finalDeviceIds.forEach(id => {
    currentDeviceStates[id] = false;
    updateDeviceState(id, false);
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

// *** Получаем ОБА потока из createCSVWriter ***
const { csvStream, writableStream: fileStream } = createCSVWriter(outputFile, headers);


// --- 4. Основной цикл симуляции ---
let currentTimeMs = startTimeMs;
let iteration = 0;
const totalIterations = Math.ceil(simulationDurationMs / timeStepMs);
console.log(`Расчетное кол-во итераций: ${totalIterations}`);
console.log(`Начало симуляции... Проверка условия: currentTimeMs (${currentTimeMs}) < endTimeMs (${endTimeMs}) -> ${currentTimeMs < endTimeMs}`);

const logIntervalIterations = Math.max(1000, Math.floor(totalIterations / 100));
let lastLoggedIteration = -logIntervalIterations;

while (currentTimeMs < endTimeMs) {

    // Логгирование внутри цикла
    if (iteration >= lastLoggedIteration + logIntervalIterations || iteration === 0) {
        const progressPercent = ((iteration / totalIterations) * 100).toFixed(3);
        console.log(`[Итерация ${iteration}/${totalIterations} (${progressPercent}%)] currentTimeMs: ${currentTimeMs} (${new Date(currentTimeMs).toISOString()}), endTimeMs: ${endTimeMs}, Условие (${currentTimeMs < endTimeMs})`);
        lastLoggedIteration = iteration;
    }

    // 4.1 Сценарии
    const nextStates = scenarioGenerator.getNextStates(currentTimeMs, currentDeviceStates, timeStepMs);
    // 4.2 Обновление состояний
    for (const deviceId of finalDeviceIds) { if (nextStates[deviceId] !== currentDeviceStates[deviceId]) { updateDeviceState(deviceId, nextStates[deviceId]); currentDeviceStates[deviceId] = nextStates[deviceId]; } }
    // 4.3 Генерация данных
    let aggregatedPower = 0, aggregatedCurrent = 0;
    const individualDeviceReadings = {};
    for (const deviceId of finalDeviceIds) { const deviceData = activeDevices[deviceId].generateData(timeStepMs); individualDeviceReadings[deviceId] = deviceData; aggregatedPower += deviceData.power; aggregatedCurrent += deviceData.current; }
    // 4.4 Шум
    const currentNoise = Math.max(0, noiseLevelWatts + (Math.random() - 0.5) * (noiseLevelWatts * 0.5));
    aggregatedPower += currentNoise; aggregatedCurrent += Math.max(0, currentNoise / 220);
    // 4.5 Формирование строки с округлением
    const rowData = { timestamp: currentTimeMs, aggregated_power: roundToTwoDecimals(aggregatedPower), aggregated_current: roundToTwoDecimals(aggregatedCurrent) };
    finalDeviceIds.forEach(id => { const deviceName = activeDevices[id]?.name; const sanitizedName = sanitizeNameForHeader(deviceName || id); const devicePower = individualDeviceReadings[id]?.power ?? 0; rowData[`${sanitizedName}_power`] = roundToTwoDecimals(devicePower); });

    // 4.6 Запись в CSV поток (fast-csv)
    try {
        // fast-csv сам обрабатывает backpressure (давление) от нижележащего потока
        csvStream.write(rowData);
    } catch (error) {
         console.error(`Ошибка записи строки ${iteration + 1} в CSV (fast-csv):`, error);
    }

    // 4.7 Продвигаем время и итерацию
    currentTimeMs += timeStepMs;
    iteration++;

    // Проверка на зависание
    if (iteration > totalIterations + 100) {
        console.error(`!!! Аварийный выход: Количество итераций (${iteration}) значительно превысило расчетное (${totalIterations}).`);
        break; // Прерываем цикл
    }

} // Конец while

// *** Логгирование ПОСЛЕ цикла ***
console.log(`--- Цикл while завершен ---`);
console.log(`Финальная итерация: ${iteration}`);
console.log(`Финальное currentTimeMs: ${currentTimeMs} (${new Date(currentTimeMs).toISOString()})`);
console.log(`Ожидаемое endTimeMs: ${endTimeMs}`);
console.log(`Разница (endTimeMs - currentTimeMs): ${endTimeMs - currentTimeMs} мс`);

// --- 5. Завершение записи ---
console.log("Симуляция завершена (логика скрипта). Завершение записи CSV потока...");

// Закрываем CSV поток (fast-csv). Это должно вызвать событие 'finish' на нижележащем потоке fileStream,
// когда все данные из буфера csvStream будут переданы в fileStream.
csvStream.end();

// --- Слушаем событие 'finish' на ОСНОВНОМ файловом потоке (fs.WriteStream) ---
// Это событие срабатывает, когда все данные записаны ИЗ БУФЕРОВ Node.js В ОПЕРАЦИОННУЮ СИСТЕМУ.
fileStream.on('finish', () => {
    console.log(`--- Событие 'finish' на основном файловом потоке (fs.WriteStream) ---`);
    console.log(`--- Генерация датасета и запись в файл УСПЕШНО ЗАВЕРШЕНЫ ---`);
    console.log(`Данные сохранены в файл: ${outputFile}`);
    process.exit(0); // Успешное завершение ТОЛЬКО после finish основного потока
});

// Обработчик ошибок на основном потоке записи файла
fileStream.on('error', (error) => {
     console.error("--- Ошибка основного файлового потока (fs.WriteStream) ---", error);
     process.exit(1); // Завершение с ошибкой
});

// Оставляем обработчик ошибок и на csvStream на случай ошибок форматирования
csvStream.on('error', (error) => {
     console.error("--- Ошибка потока CSV (fast-csv) ---", error);
     // Можно добавить process.exit(1) и здесь, если ошибка форматирования критична
});


// Увеличиваем таймаут, т.к. запись большого файла может занять время
console.log("Ожидание завершения записи файла (до 5 минут)...");
setTimeout(() => {
    console.warn("Таймаут ожидания завершения записи CSV (5 минут). Процесс завершается принудительно.");
    process.exit(1); // Выход с ошибкой по таймауту
}, 300000); // 5 минут = 300 * 1000 мс