const Device = require('./Device');

// Устройство с асинхронным двигателем, генерирующим небольшие случайные отклонения
module.exports = new Device('AsyncEngine', 3000, 5, 'motor');
