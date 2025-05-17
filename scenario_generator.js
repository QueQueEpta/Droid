/**
 * Генератор Сценариев Использования Устройств
 * Отвечает за автоматическое включение/выключение устройств во время симуляции.
 */
class ScenarioGenerator {
    constructor() {
        this.deviceTimers = {}; // Отслеживает время с последнего изменения состояния для каждого устройства
        this.params = null;     // Параметры сценария из config.json
        this.activeDeviceIds = []; // Список ID активных устройств
    }

    /**
     * Инициализирует генератор сценариев.
     * @param {string[]} activeDeviceIds - Массив ID устройств, участвующих в симуляции.
     * @param {object} scenarioParams - Параметры сценария из config.json.
     */
    initialize(activeDeviceIds, scenarioParams) {
        this.params = scenarioParams;
        this.activeDeviceIds = activeDeviceIds;
        console.log("Инициализация генератора сценариев с параметрами:", scenarioParams);

        // Инициализируем таймеры для активных устройств
        this.activeDeviceIds.forEach(deviceId => {
            this.deviceTimers[deviceId] = {
                timeSinceLastChangeMs: 0, // Время с последнего изменения состояния
                // Можно добавить начальное случайное состояние, но проще начать с выключенных
            };
        });
    }

    /**
     * Определяет следующие состояния устройств на основе текущего времени и состояний.
     * @param {number} currentTimeMs - Текущее время симуляции (Unix timestamp ms).
     * @param {object} currentStates - Текущие состояния устройств { deviceId: boolean }.
     * @param {number} timeStepMs - Шаг времени симуляции в мс.
     * @returns {object} - Новый объект состояний устройств { deviceId: boolean }.
     */
    getNextStates(currentTimeMs, currentStates, timeStepMs) {
        const nextStates = { ...currentStates }; // Копируем текущие состояния

        if (!this.params || this.params.type !== 'simple_random') {
            console.warn("Генератор сценариев не инициализирован или тип не 'simple_random'. Состояния не изменятся.");
            return nextStates;
        }

        // Проходим по каждому активному устройству
        this.activeDeviceIds.forEach(deviceId => {
            const currentState = currentStates[deviceId];
            const timer = this.deviceTimers[deviceId];

            // Увеличиваем время с последнего изменения
            timer.timeSinceLastChangeMs += timeStepMs;

            // Определяем среднее время работы/простоя для текущего устройства
            const avgOnTimeMs = (this.params.avgOnTimeMinutes[deviceId] || 30) * 60 * 1000; // Значение по умолчанию 30 мин
            const avgOffTimeMs = (this.params.avgOffTimeMinutes[deviceId] || 60) * 60 * 1000; // Значение по умолчанию 60 мин

            // Вычисляем вероятность изменения состояния на этом шаге
            // Вероятность растет по мере приближения к среднему времени
            let probability = this.params.changeProbability || 0.01;
            if (currentState && timer.timeSinceLastChangeMs > avgOnTimeMs / 2) { // Если включено и прошло пол-срока
                probability *= (timer.timeSinceLastChangeMs / avgOnTimeMs); // Увеличиваем шанс выключения
            } else if (!currentState && timer.timeSinceLastChangeMs > avgOffTimeMs / 2) { // Если выключено и прошло пол-срока
                 probability *= (timer.timeSinceLastChangeMs / avgOffTimeMs); // Увеличиваем шанс включения
            }

             // Ограничиваем максимальную вероятность, чтобы избежать слишком частых переключений
             probability = Math.min(probability, 0.5);


            // Случайное решение об изменении состояния
            if (Math.random() < probability) {
                nextStates[deviceId] = !currentState; // Инвертируем состояние
                timer.timeSinceLastChangeMs = 0; // Сбрасываем таймер после изменения
                // console.log(`[${new Date(currentTimeMs).toISOString()}] Сценарий: Устройство ${deviceId} ${nextStates[deviceId] ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`);
            }
        });

        return nextStates;
    }
}

// Экспортируем единственный экземпляр генератора
module.exports = new ScenarioGenerator();