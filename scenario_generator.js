// scenario_generator.js
const SCENARIO_TYPES = {
    ALWAYS_ON: 'always_on',
    CYCLIC: 'cyclic',
    SCHEDULED_USAGE: 'scheduled_usage',
    MANUAL_SHORT_USAGE: 'manual_short_usage',
    COMPLEX_CYCLE_DEVICE: 'complex_cycle_device',
    // Можно добавить SIMPLE_RANDOM для обратной совместимости или простых случаев
};

class ScenarioGenerator {
    constructor() {
        this.deviceScenarios = {}; // { deviceId: { type, config, state, instance: device } }
        this.activeDeviceIds = [];
        this.initialized = false;
    }

    /**
     * Инициализирует генератор сценариев.
     * @param {Object<string, Device>} activeDevices - Объект с экземплярами активных устройств.
     * @param {object} scenarioConfigPerDevice - Конфигурация сценариев для каждого устройства из config.json.
     *                                            Пример: { device1: { type: 'always_on', params: {} }, device2: { type: 'cyclic', params: {...} } }
     */
    initialize(activeDevices, scenarioConfigPerDevice) {
        this.activeDeviceIds = Object.keys(activeDevices);
        this.deviceScenarios = {}; // Сброс
        console.log("Инициализация ScenarioGenerator с новыми параметрами...");

        this.activeDeviceIds.forEach(deviceId => {
            const deviceInstance = activeDevices[deviceId];
            const config = scenarioConfigPerDevice[deviceId];

            if (!config || !config.type) {
                console.warn(`Для устройства ${deviceId} не задан тип сценария или конфигурация. Будет выключено.`);
                this.deviceScenarios[deviceId] = { type: 'manual_off', config: {}, state: {}, instance: deviceInstance }; // Заглушка
                return;
            }

            this.deviceScenarios[deviceId] = {
                type: config.type,
                config: config.params || {},
                state: {}, // Внутреннее состояние для каждого сценария
                instance: deviceInstance
            };

            // Инициализация состояния для конкретного типа сценария
            this._initializeScenarioState(deviceId, this.deviceScenarios[deviceId].type, this.deviceScenarios[deviceId].config);
        });
        this.initialized = true;
        console.log("ScenarioGenerator инициализирован. Конфигурации сценариев:", this.deviceScenarios);
    }

    _initializeScenarioState(deviceId, type, config) {
        const scenario = this.deviceScenarios[deviceId];
        switch (type) {
            case SCENARIO_TYPES.ALWAYS_ON:
                scenario.state.hasBeenTurnedOn = false;
                break;
            case SCENARIO_TYPES.CYCLIC:
                scenario.state.isCurrentlyOn = false; // Начнем с выключенного
                scenario.state.timeInCurrentStateMs = 0;
                scenario.state.currentCycleDurationMs = this._getRandomDuration(config.offDurationRangeMs || [60000, 300000]); // Начнем с off
                break;
            case SCENARIO_TYPES.SCHEDULED_USAGE:
                scenario.state.isActiveCycle = false;
                scenario.state.timeSinceLastUsageMs = Math.random() * (config.avgIntervalMinutes || 1440) * 60000; // Случайное начальное время с последнего использования
                scenario.state.currentCycleDurationMs = 0;
                scenario.state.nextScheduledUsageTime = 0; // Будет установлено при первом вызове
                this._scheduleNextUsage(deviceId, 0, config); // Первоначальное планирование
                break;
            case SCENARIO_TYPES.MANUAL_SHORT_USAGE:
                 scenario.state.isCurrentlyOn = false;
                 scenario.state.timeSinceLastEventMs = Math.random() * (config.avgIntervalMinutes || 60) * 60000;
                 scenario.state.currentOnOffDurationMs = 0;
                 break;
            case SCENARIO_TYPES.COMPLEX_CYCLE_DEVICE:
                // Состояние управляется самим устройством через его методы
                // Сценарий только решает, когда запустить startDeviceCycle()
                scenario.state.timeSinceLastCycleCompletionMs = Math.random() * (config.avgIntervalBetweenCyclesMinutes || 1440) * 60000;
                scenario.state.isDeviceCycleManagedByScenario = false; // Флаг, что сценарий управляет вызовом startDeviceCycle
                break;
            default:
                console.warn(`Неизвестный тип сценария "${type}" для устройства ${deviceId}.`);
        }
    }
    
    _getRandomDuration(rangeMs) { // rangeMs: [min, max]
        if (!rangeMs || rangeMs.length < 2) return 60000; // 1 минута по умолчанию
        return Math.random() * (rangeMs[1] - rangeMs[0]) + rangeMs[0];
    }

    _scheduleNextUsage(deviceId, currentTimeMs, config) {
        const scenario = this.deviceScenarios[deviceId];
        if (!scenario || scenario.type !== SCENARIO_TYPES.SCHEDULED_USAGE) return;

        const { avgIntervalMinutes = 720, intervalRandomnessMinutes = 120, preferredTimeWindows = [] } = config;
        let nextUsageDelayMs = (avgIntervalMinutes + (Math.random() - 0.5) * 2 * intervalRandomnessMinutes) * 60000;

        // Логика выбора времени с учетом preferredTimeWindows (упрощенная)
        // TODO: Реализовать более сложный выбор, учитывающий веса и текущее время суток
        if (preferredTimeWindows.length > 0) {
            const today = new Date(currentTimeMs);
            const startOfDayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
            
            let potentialTimes = [];
            for (const window of preferredTimeWindows) {
                const windowStartMs = startOfDayMs + window.startHour * 3600000;
                const windowEndMs = startOfDayMs + window.endHour * 3600000;
                if (currentTimeMs < windowEndMs) { // Если окно еще не прошло или в будущем
                    let scheduledTime = windowStartMs + Math.random() * (windowEndMs - windowStartMs);
                    if (scheduledTime < currentTimeMs + 30 * 60000) { // Если планируется слишком скоро, берем из следующего доступного окна или просто задержку
                        scheduledTime = currentTimeMs + nextUsageDelayMs; // Fallback
                    }
                    potentialTimes.push(scheduledTime);
                }
            }
            if(potentialTimes.length > 0){
                // Выбираем случайное из подходящих времен, или ближайшее будущее, если все уже прошли
                potentialTimes.sort((a,b) => a - b);
                const futureTimes = potentialTimes.filter(t => t > currentTimeMs);
                if(futureTimes.length > 0){
                    scenario.state.nextScheduledUsageTime = futureTimes[Math.floor(Math.random() * futureTimes.length)];
                } else {
                     scenario.state.nextScheduledUsageTime = currentTimeMs + nextUsageDelayMs; // На следующий день с обычной задержкой
                }
            } else {
                 scenario.state.nextScheduledUsageTime = currentTimeMs + nextUsageDelayMs;
            }

        } else {
             scenario.state.nextScheduledUsageTime = currentTimeMs + nextUsageDelayMs;
        }
        // console.log(`${deviceId}: Следующее использование запланировано на ${new Date(scenario.state.nextScheduledUsageTime).toLocaleString()}`);
    }


    /**
     * Определяет следующие состояния устройств.
     * @param {number} currentTimeMs - Текущее время симуляции (Unix timestamp ms).
     * @param {object} currentStates - Текущие состояния устройств { deviceId: boolean }.
     * @param {number} timeStepMs - Шаг времени симуляции в мс.
     * @returns {object} - Новый объект состояний устройств { deviceId: boolean }.
     */
    getNextStates(currentTimeMs, currentStates, timeStepMs) {
        if (!this.initialized) {
            console.warn("ScenarioGenerator не инициализирован. Состояния не изменятся.");
            return { ...currentStates };
        }

        const nextDeviceStates = { ...currentStates };

        this.activeDeviceIds.forEach(deviceId => {
            const scenario = this.deviceScenarios[deviceId];
            const device = scenario.instance;
            let newState = currentStates[deviceId]; // По умолчанию состояние не меняется

            switch (scenario.type) {
                case SCENARIO_TYPES.ALWAYS_ON:
                    if (!scenario.state.hasBeenTurnedOn) {
                        newState = true;
                        scenario.state.hasBeenTurnedOn = true;
                    }
                    break;

                case SCENARIO_TYPES.CYCLIC:
                    scenario.state.timeInCurrentStateMs += timeStepMs;
                    if (scenario.state.timeInCurrentStateMs >= scenario.state.currentCycleDurationMs) {
                        newState = !currentStates[deviceId]; // Инвертируем состояние
                        scenario.state.isCurrentlyOn = newState;
                        scenario.state.timeInCurrentStateMs = 0;
                        scenario.state.currentCycleDurationMs = newState
                            ? this._getRandomDuration(scenario.config.onDurationRangeMs || [30000, 180000])
                            : this._getRandomDuration(scenario.config.offDurationRangeMs || [60000, 300000]);
                        // console.log(`${deviceId} (${scenario.type}): ${newState ? 'ON' : 'OFF'} for ~${(scenario.state.currentCycleDurationMs/1000/60).toFixed(1)} min`);
                    }
                    break;

                case SCENARIO_TYPES.SCHEDULED_USAGE:
                    if (scenario.state.isActiveCycle) {
                        scenario.state.currentCycleDurationMs -= timeStepMs;
                        if (scenario.state.currentCycleDurationMs <= 0) {
                            newState = false; // Завершаем цикл
                            scenario.state.isActiveCycle = false;
                            this._scheduleNextUsage(deviceId, currentTimeMs, scenario.config);
                            // console.log(`${deviceId} (${scenario.type}): Cycle finished. Next usage at ${new Date(scenario.state.nextScheduledUsageTime).toLocaleString()}`);
                        }
                        // состояние newState уже true, если isActiveCycle
                    } else {
                        // Проверяем, не наступило ли время для следующего использования
                        if (currentTimeMs >= scenario.state.nextScheduledUsageTime) {
                            newState = true; // Начинаем цикл
                            scenario.state.isActiveCycle = true;
                            scenario.state.currentCycleDurationMs = this._getRandomDuration(scenario.config.cycleDurationRangeMs || [30*60000, 90*60000]);
                            // console.log(`${deviceId} (${scenario.type}): Cycle started for ~${(scenario.state.currentCycleDurationMs/1000/60).toFixed(1)} min`);
                        } else {
                            newState = false; // Остается выключенным
                        }
                    }
                    break;

                case SCENARIO_TYPES.MANUAL_SHORT_USAGE:
                    const { usagesPerDayRange = [2,5], usageDurationMsRange = [30000, 300000], probabilityOfUsage = 0.1 } = scenario.config;
                    scenario.state.timeSinceLastEventMs += timeStepMs;

                    if (scenario.state.isCurrentlyOn) { // Если сейчас включено
                        if (scenario.state.timeSinceLastEventMs >= scenario.state.currentOnOffDurationMs) {
                            newState = false; // Выключаем
                            scenario.state.isCurrentlyOn = false;
                            scenario.state.timeSinceLastEventMs = 0;
                            // console.log(`${deviceId} (${scenario.type}): Turned OFF`);
                        }
                    } else { // Если сейчас выключено
                        // Проверяем, не пора ли включиться (упрощенная логика)
                        // Более сложная была бы основана на вероятности в единицу времени, вычисленной из usagesPerDayRange
                        const avgIntervalMs = (24 * 3600000) / ((usagesPerDayRange[0] + usagesPerDayRange[1]) / 2);
                        if (scenario.state.timeSinceLastEventMs > avgIntervalMs * 0.5 && Math.random() < probabilityOfUsage * (timeStepMs / (10*60000)) ) { // Шанс в 10 минут
                             newState = true; // Включаем
                             scenario.state.isCurrentlyOn = true;
                             scenario.state.timeSinceLastEventMs = 0;
                             scenario.state.currentOnOffDurationMs = this._getRandomDuration(usageDurationMsRange);
                            //  console.log(`${deviceId} (${scenario.type}): Turned ON for ~${(scenario.state.currentOnOffDurationMs/1000/60).toFixed(1)} min`);
                        }
                    }
                    break;
                
                case SCENARIO_TYPES.COMPLEX_CYCLE_DEVICE:
                    // Этот сценарий управляет запуском сложного цикла на самом устройстве
                    if (typeof device.startDeviceCycle !== 'function' || typeof device.advance !== 'function' || typeof device.cycle?.active === 'undefined') {
                        console.warn(`Устройство ${deviceId} сконфигурировано как COMPLEX_CYCLE_DEVICE, но не реализует необходимые методы/свойства (startDeviceCycle, advance, cycle.active).`);
                        newState = false; // Безопасное состояние - выключено
                        break;
                    }

                    if (currentStates[deviceId] && device.cycle.active) {
                        // Если устройство включено и его внутренний цикл активен, даем ему обработать шаг
                        device.advance(timeStepMs, currentTimeMs);
                        if (!device.cycle.active) { // Если внутренний цикл устройства завершился
                            newState = false; // Сценарий выключает устройство
                            scenario.state.isDeviceCycleManagedByScenario = false;
                            scenario.state.timeSinceLastCycleCompletionMs = 0;
                            // console.log(`${deviceId} (${scenario.type}): Device cycle completed. Turning OFF.`);
                        } else {
                            newState = true; // Остается включенным, пока цикл идет
                        }
                    } else { // Устройство выключено или его цикл не активен
                        newState = false; // По умолчанию выключено
                        scenario.state.timeSinceLastCycleCompletionMs += timeStepMs;
                        const avgIntervalMs = (scenario.config.avgIntervalBetweenCyclesMinutes || 1440) * 60000;
                        // Проверяем, не пора ли запустить новый цикл
                        // Условие: прошло достаточно времени И случайный шанс (чтобы не все стартовали одновременно)
                        if (scenario.state.timeSinceLastCycleCompletionMs >= avgIntervalMs * 0.75 && Math.random() < (scenario.config.startProbability || 0.05)) {
                            newState = true; // Включаем устройство
                            device.startDeviceCycle(scenario.config.cycleDurationMinutesRange); // Запускаем внутренний цикл устройства
                            scenario.state.isDeviceCycleManagedByScenario = true;
                            scenario.state.timeSinceLastCycleCompletionMs = 0; // Сбрасываем таймер
                            // console.log(`${deviceId} (${scenario.type}): Starting device's internal cycle.`);
                        }
                    }
                    break;

                case 'manual_off': // Заглушка
                     newState = false;
                     break;
                default:
                    newState = currentStates[deviceId]; // Не меняем, если тип неизвестен
            }
            nextDeviceStates[deviceId] = newState;
        });
        return nextDeviceStates;
    }
}

module.exports = new ScenarioGenerator();
module.exports.SCENARIO_TYPES = SCENARIO_TYPES; // Экспортируем типы для использования в конфиге