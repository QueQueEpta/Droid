// devices/device2.js
const Device = require('./Device');

// Кондиционер
// Сценарий: CYCLIC (короткие/средние циклы работы и простоя)
// waveform: 'constant' (компрессор работает на почти постоянной мощности, возможен 'motor' для детализации)
// initialPeakCurrent: заметный при старте компрессора
module.exports = new Device('Conditioneer', 1800, 15, 'constant');