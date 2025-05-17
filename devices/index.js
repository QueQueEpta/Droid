const device1 = require('./device1');
const device2 = require('./device2');
const device3 = require('./device3');
const device4 = require('./device4');
const device5 = require('./device5');
const device6 = require('./device6'); // Импортируем, даже если не всегда используется

// Собираем все устройства в один объект
const devices = {
  device1,
  device2,
  device3,
  device4,
  device5,
  device6
};

/**
 * Обновляет состояние конкретного устройства.
 * @param {string} deviceId - Идентификатор устройства (например, 'device1').
 * @param {boolean} state - Новое состояние (true - включено, false - выключено).
 * @returns {boolean} - True, если состояние изменилось, иначе false.
 */
function updateDeviceState(deviceId, state) {
  if (devices[deviceId]) {
    return devices[deviceId].setPowerState(state); // Возвращаем результат setPowerState
  }
  console.warn(`Попытка обновить состояние несуществующего устройства: ${deviceId}`);
  return false; // Состояние не изменилось
}

/**
 * Генерирует данные для всех известных устройств за один шаг времени.
 * (Эта функция может быть полезна, но в generate_dataset.js мы перебираем устройства вручную)
 * @param {number} timeStepMs - Шаг времени в миллисекундах.
 * @returns {object} - Объект, где ключи - deviceId, значения - данные {current, voltage, power}.
 */
function getDevicesData(timeStepMs) {
  const data = {};
  for (let deviceId in devices) {
    // Проверяем, существует ли метод generateData, на всякий случай
    if (typeof devices[deviceId].generateData === 'function') {
        data[deviceId] = devices[deviceId].generateData(timeStepMs);
    } else {
         console.warn(`У устройства ${deviceId} нет метода generateData.`);
         data[deviceId] = { current: 0, voltage: 220, power: 0 }; // Заглушка
    }
  }
  return data;
}

// Экспортируем объект с устройствами и функцию обновления состояния
module.exports = {
  devices,          // Объект со всеми экземплярами устройств
  updateDeviceState // Функция для изменения состояния устройства
  // getDevicesData // Экспортируем, если планируете использовать
};