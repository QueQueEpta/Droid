// devices/device5.js
const Device = require('./Device');

// ASIC майнер S19
// Сценарий: ALWAYS_ON (работает почти всегда)
// waveform: 'constant' (очень стабильное потребление)
// initialPeakCurrent: может быть небольшим при включении блоков питания
module.exports = new Device('ASIC_S19', 3250, 16, 'constant');