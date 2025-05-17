// devices/device6.js
const Device = require('./Device');

// Электрический чайник
// Сценарий: MANUAL_SHORT_USAGE (несколько коротких включений в день)
// waveform: 'constant' (нагревательный элемент)
// initialPeakCurrent: нет значительного пика
module.exports = new Device('ElectricKettle', 2000, 9, 'constant'); // Мощность 2кВт