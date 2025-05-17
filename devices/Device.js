class Device {
    constructor(name, basePower, initialPeakCurrent, waveform = 'constant') {
        this.name = name;
        this.basePower = basePower;
        this.initialPeakCurrent = initialPeakCurrent;
        this.waveform = waveform;
        this.voltage = 220;
        this.timeSinceOnMs = 0;
        this.isOn = false;
        this.scenarioData = {}; // Для хранения данных, специфичных для сценария
    }

    getRandomVariation(value, percent = 3) {
        if (value === 0) return 0;
        const variation = value * (percent / 100);
        return value + (Math.random() * 2 - 1) * variation;
    }

    generateData(timeStepMs) {
        if (!this.isOn) {
            if (this.timeSinceOnMs !== 0) this.timeSinceOnMs = 0;
            return { current: 0, voltage: this.voltage, power: 0 };
        }

        this.timeSinceOnMs += timeStepMs;
        let current;
        const baseCurrent = this.basePower / this.voltage;

        if (this.timeSinceOnMs <= 1000) {
             const decayFactor = (1000 - this.timeSinceOnMs) / 1000;
             current = baseCurrent + (this.initialPeakCurrent - baseCurrent) * Math.max(0, decayFactor);
             current = this.getRandomVariation(current, 10);
        } else {
            // Если устройство имеет свой метод для управления внутренним циклом, он может переопределить ток
            if (typeof this.getInternalCycleCurrent === 'function') {
                current = this.getInternalCycleCurrent(baseCurrent, timeStepMs);
            } else {
                // Стандартное поведение на основе waveform
                switch (this.waveform) {
                    case 'sinusoidal': {
                        const frequency = 2 * Math.PI / (5 * 60 * 1000);
                        const amplitude = baseCurrent * 0.3;
                        current = baseCurrent + amplitude * Math.sin(this.timeSinceOnMs * frequency);
                        current = this.getRandomVariation(current, 5);
                        break;
                    }
                    case 'random': {
                        current = this.getRandomVariation(baseCurrent, 20);
                        break;
                    }
                    case 'motor': {
                        const motorFrequency = 2 * Math.PI / (15 * 1000);
                        current = baseCurrent + (Math.sin(this.timeSinceOnMs * motorFrequency) * 0.05 * baseCurrent);
                        current = this.getRandomVariation(current, 5);
                        break;
                    }
                    case 'constant':
                    default: {
                        current = this.getRandomVariation(baseCurrent, 5);
                        break;
                    }
                }
            }
        }

        current = Math.max(0, current);
        const power = current * this.voltage;
        return { current: current, voltage: this.voltage, power: power };
    }

    reset() {
        this.timeSinceOnMs = 0;
        // Сброс специфичных для сценария данных, если нужно
        if (typeof this.resetScenarioState === 'function') {
            this.resetScenarioState();
        }
    }

    setPowerState(state) {
        const changed = this.isOn !== state;
        this.isOn = state;
        if (!state) {
            this.reset();
        } else {
            // При включении можно инициировать состояние для сценария
            if (typeof this.initiateOnState === 'function') {
                this.initiateOnState();
            }
        }
        return changed;
    }

    // Методы, которые могут быть переопределены для сложных устройств
    // initiateOnState() { /* Вызывается при включении */ }
    // resetScenarioState() { /* Вызывается при выключении или сбросе */ }
    // advance(timeStepMs, currentTimeMs) { /* Вызывается на каждом шаге, если устройство управляется сложным сценарием */ }
}

module.exports = Device;