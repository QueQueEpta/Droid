const fs = require('fs');
const path = require('path');
const csv = require('fast-csv'); // Используем fast-csv для записи

/**
 * Создает поток для записи CSV файла.
 * @param {string} filePath - Полный путь к выходному файлу.
 * @param {string[]} headers - Массив строк с заголовками колонок.
 * @returns {{csvStream: object, writableStream: object}} - Объект, содержащий поток fast-csv (`csvStream`) и основной поток записи файла (`writableStream`).
 */
function createCSVWriter(filePath, headers) {
    console.log(`Создание CSV файла: ${filePath}`);
    console.log(`Заголовки: ${headers.join(', ')}`);

    // Создаем основной поток записи в файл
    const writableStream = fs.createWriteStream(filePath);

    // Создаем CSV поток с опцией записи заголовков
    const csvStream = csv.format({ headers: true, writeHeaders: true });

    // Обработчик ошибок записи на основном потоке
    writableStream.on('error', (error) => {
        console.error(`Ошибка записи в файл ${filePath} (fs.WriteStream):`, error);
        // Можно перебросить ошибку на csvStream, если нужно централизовать обработку
        // csvStream.emit('error', error);
    });
    // Обработчик ошибок на CSV потоке (например, ошибки форматирования)
    csvStream.on('error', (error) => {
        console.error(`Ошибка CSV потока (fast-csv) для файла ${filePath}:`, error);
    });

    // Связываем CSV поток с потоком записи в файл
    // Данные, отформатированные csvStream, будут передаваться в writableStream
    csvStream.pipe(writableStream);

    console.log("CSV Writer готов к записи.");
    // Возвращаем ОБА потока, чтобы можно было слушать события на каждом
    return { csvStream, writableStream };
}

// Экспортируем функцию
module.exports = {
    createCSVWriter
};