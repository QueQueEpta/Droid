// devices/device1.js
const Device = require('./Device');

// Мощный насос или система вентиляции
// Сценарий: CYCLIC (длительные периоды работы и простоя)
// waveform: 'motor' для имитации работы двигателя с вариациями
module.exports = new Device('AsyncEngine', 3000, 7, 'motor'); // Базовая мощность 3кВт, пиковый ток 7А