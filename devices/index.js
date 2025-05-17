// devices/index.js
const device1 = require('./device1');
const device2 = require('./device2');
const device3 = require('./device3');
const device4 = require('./device4'); // Стиральная машина
const device5 = require('./device5');
const device6 = require('./device6'); // Электрочайник

const devices = {
  device1, // AsyncEngine
  device2, // Conditioneer
  device3, // Freezebox
  device4, // WashingMachine
  device5, // ASIC_S19
  device6  // ElectricKettle
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

// Экспортируем объект с устройствами и функцию обновления состояния
module.exports = {
  devices,          // Объект со всеми экземплярами устройств
  updateDeviceState // Функция для изменения состояния устройства
};