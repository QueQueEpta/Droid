// devices/device3.js
const Device = require('./Device');

// Холодильник
// Сценарий: CYCLIC (короткие, частые циклы)
// waveform: 'motor' (компрессор - это двигатель)
// initialPeakCurrent: умеренный пик при старте компрессора
module.exports = new Device('Freezebox', 150, 5, 'motor'); // Мощность ~150Вт в активной фазе