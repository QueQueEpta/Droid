// devices/device4.js (WashingMachine)
const Device = require('./Device');

class WashingMachine extends Device {
    constructor() {
        // Базовая мощность - средняя. Пики будут в фазах.
        // initialPeakCurrent - может быть ток мотора при старте отжима.
        super('WashingMachine', 800, 10, 'constant'); // 'constant' как заглушка, т.к. ток будет управляться циклом
        this.resetScenarioState(); // Инициализация состояния цикла
    }

    resetScenarioState() {
        this.cycle = {
            active: false,
            phase: null, // 'heating', 'washing', 'rinsing', 'spinning'
            phaseTimeMs: 0,
            totalCycleTimeMs: 0,
            currentPhaseDurationMs: 0,
        };
        this.scenarioData.cyclePhases = [ // Примерная структура фаз
            { name: 'heating', durationMs: 10 * 60 * 1000, powerFactor: 2.5 }, // 10 мин, 2000 Вт (800 * 2.5)
            { name: 'washing', durationMs: 30 * 60 * 1000, powerFactor: 0.5, variation: 0.4 }, // 30 мин, 400 Вт, с вариациями
            { name: 'rinsing1', durationMs: 5 * 60 * 1000, powerFactor: 0.4, variation: 0.3 },
            { name: 'spinning_short1', durationMs: 2 * 60 * 1000, powerFactor: 1.5 },
            { name: 'rinsing2', durationMs: 5 * 60 * 1000, powerFactor: 0.4, variation: 0.3 },
            { name: 'spinning_final', durationMs: 5 * 60 * 1000, powerFactor: 2.0 }, // 5 мин, 1600 Вт
        ];
        this.scenarioData.currentPhaseIndex = -1;
    }

    startDeviceCycle(totalDurationMinutesRange = [60, 90]) {
        if (this.cycle.active) return; // Уже работает

        this.resetScenarioState(); // Сброс на случай, если что-то осталось от прошлого цикла
        this.cycle.active = true;
        this.cycle.totalCycleTimeMs = (Math.random() * (totalDurationMinutesRange[1] - totalDurationMinutesRange[0]) + totalDurationMinutesRange[0]) * 60 * 1000;
        
        // Можно усложнить, подгоняя длительности фаз под totalCycleTimeMs
        // Пока просто берем предопределенные
        this.scenarioData.currentPhaseIndex = 0;
        this._startNextPhase();
        console.log(`${this.name}: Начало цикла стирки (общая длительность ~${(this.cycle.totalCycleTimeMs / (60*1000)).toFixed(0)} мин). Фаза: ${this.cycle.phase}`);
    }

    _startNextPhase() {
        if (this.scenarioData.currentPhaseIndex >= this.scenarioData.cyclePhases.length) {
            this.finishDeviceCycle();
            return;
        }
        const phaseConfig = this.scenarioData.cyclePhases[this.scenarioData.currentPhaseIndex];
        this.cycle.phase = phaseConfig.name;
        this.cycle.currentPhaseDurationMs = phaseConfig.durationMs;
        this.cycle.phaseTimeMs = 0;
        // Сохраняем доп. параметры фазы для generateData
        this.cycle.currentPhasePowerFactor = phaseConfig.powerFactor;
        this.cycle.currentPhaseVariation = phaseConfig.variation || 0.1; // Вариация по умолчанию
    }

    finishDeviceCycle() {
        console.log(`${this.name}: Цикл стирки завершен.`);
        this.cycle.active = false;
        this.cycle.phase = null;
        this.scenarioData.currentPhaseIndex = -1;
        // Устройство должно быть выключено сценарием после этого
    }

    // Вызывается сценарием типа 'complex_cycle_device'
    advance(timeStepMs, currentTimeMs) {
        if (!this.isOn || !this.cycle.active) return;

        this.cycle.phaseTimeMs += timeStepMs;
        this.cycle.totalCycleTimeMs -= timeStepMs; // Обратный отсчет общей длительности (пример)

        if (this.cycle.phaseTimeMs >= this.cycle.currentPhaseDurationMs) {
            this.scenarioData.currentPhaseIndex++;
            this._startNextPhase();
            if (this.cycle.active) { // Если цикл еще не завершен
                 console.log(`${this.name}: Переход на фазу ${this.cycle.phase}`);
            }
        }
        
        if (this.cycle.totalCycleTimeMs <= 0 && this.cycle.active) {
             // Если общее время вышло, а фазы еще есть - форсируем завершение
             // (или можно было бы просто продолжать фазы)
             console.log(`${this.name}: Общее время цикла вышло, форсированное завершение.`);
             this.finishDeviceCycle();
        }
    }

    // Переопределяем для управления током на основе фазы
    getInternalCycleCurrent(baseCurrent, timeStepMs) {
        let current = 0;
        if (this.cycle.active && this.cycle.phase) {
            const targetPower = this.basePower * this.cycle.currentPhasePowerFactor;
            let phaseBaseCurrent = targetPower / this.voltage;

            // Добавляем вариативность, если она есть для фазы
            if (this.cycle.phase.includes('washing') || this.cycle.phase.includes('rinsing')) {
                // Имитация вращения барабана с небольшими колебаниями
                 const motorFrequency = 2 * Math.PI / ((Math.random() * 10 + 5) * 1000); // 5-15 сек цикл
                 phaseBaseCurrent += (Math.sin(this.timeSinceOnMs * motorFrequency) * this.cycle.currentPhaseVariation * phaseBaseCurrent);
            }
            current = this.getRandomVariation(phaseBaseCurrent, 5); // Общий небольшой шум
        } else {
            // Если цикл не активен, но устройство включено (не должно быть при правильном сценарии)
            current = this.getRandomVariation(baseCurrent * 0.1, 5); // Малая мощность ожидания
        }
        return Math.max(0, current);
    }
}

module.exports = new WashingMachine();