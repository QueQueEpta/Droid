class Device {
    constructor(name, basePower, initialPeakCurrent, waveform = 'constant') {
        this.name = name;               // Название устройства
        this.basePower = basePower;     // Базовая мощность устройства (Вт)
        this.initialPeakCurrent = initialPeakCurrent; // Начальный пиковый ток (А)
        this.waveform = waveform;       // Тип волны (constant, sinusoidal, random, motor)
        this.voltage = 220;             // Условное постоянное напряжение (В)
        this.timeSinceOnMs = 0;         // Время с момента включения (в миллисекундах)
        this.isOn = false;              // Состояние устройства (вкл/выкл)
    }

    // Генерация случайного отклонения на основе процента
    getRandomVariation(value, percent = 3) {
        if (value === 0) return 0; // Избегаем NaN, если базовое значение 0
        const variation = value * (percent / 100);
        return value + (Math.random() * 2 - 1) * variation;
    }

    /**
     * Генерирует данные о потреблении для одного шага времени.
     * @param {number} timeStepMs - Длительность шага времени в миллисекундах.
     * @returns {{current: number, voltage: number, power: number}} - Объект с током (А), напряжением (В) и мощностью (Вт).
     */
    generateData(timeStepMs) {
        // Если устройство выключено, возвращаем нулевые значения
        if (!this.isOn) {
            // Сбрасываем время при выключении, чтобы пик тока сработал при следующем включении
            if (this.timeSinceOnMs !== 0) this.timeSinceOnMs = 0;
            return { current: 0, voltage: this.voltage, power: 0 };
        }

        // Увеличиваем время работы устройства
        this.timeSinceOnMs += timeStepMs;

        let current;
        const baseCurrent = this.basePower / this.voltage;

        // Определяем ток в зависимости от типа волны и времени с момента включения
        // Пиковый ток в первую секунду (или меньше, если шаг меньше секунды)
        if (this.timeSinceOnMs <= 1000) { // Пиковый ток в первую секунду
             // Плавный спад от пикового к базовому току за первую секунду
             const decayFactor = (1000 - this.timeSinceOnMs) / 1000;
             current = baseCurrent + (this.initialPeakCurrent - baseCurrent) * Math.max(0, decayFactor);
             // Добавляем шум даже к пиковому току
             current = this.getRandomVariation(current, 10); // 10% шум во время пуска
        } else {
            // Поведение после первой секунды
            switch (this.waveform) {
                case 'sinusoidal': {
                    // Синусоидальная волна для изменения тока
                    // Частоту подбираем так, чтобы цикл был несколько минут
                    const frequency = 2 * Math.PI / (5 * 60 * 1000); // Цикл ~5 минут
                    const amplitude = baseCurrent * 0.3; // Амплитуда 30% от базового тока
                    current = baseCurrent + amplitude * Math.sin(this.timeSinceOnMs * frequency);
                    current = this.getRandomVariation(current, 5); // Небольшой шум
                    break;
                }
                case 'random': {
                    // Случайное значение с вариациями для создания "шума"
                    current = this.getRandomVariation(baseCurrent, 20); // 20% шум
                    break;
                }
                case 'motor': {
                    // Колебания для асинхронного двигателя
                    // Частота колебаний ~10-20 секунд
                    const motorFrequency = 2 * Math.PI / (15 * 1000);
                    current = baseCurrent + (Math.sin(this.timeSinceOnMs * motorFrequency) * 0.05 * baseCurrent); // 5% синусоидальные колебания
                    // Небольшой случайный шум поверх синусоидального колебания
                    current = this.getRandomVariation(current, 5); // Еще 5% случайного шума
                    break;
                }
                case 'constant':
                default: {
                    // Постоянное значение с небольшими случайными колебаниями
                    current = this.getRandomVariation(baseCurrent, 5); // 5% шум
                    break;
                }
            }
        }


        // Обеспечиваем, чтобы ток не был отрицательным
        current = Math.max(0, current);

        const power = current * this.voltage;

        // Логирование для отладки (можно закомментировать для быстрой генерации)
        // console.log(`Устройство: ${this.name}, Состояние: ${this.isOn}, Время вкл: ${this.timeSinceOnMs} мс, Ток: ${current.toFixed(2)} А, Мощность: ${power.toFixed(2)} Вт`);

        return {
            current: current,
            voltage: this.voltage, // Возвращаем условное напряжение
            power: power
        };
    }

    // Сброс состояния устройства при выключении
    reset() {
        this.timeSinceOnMs = 0;
    }

    // Установка состояния устройства (включено/выключено)
    setPowerState(state) {
        const changed = this.isOn !== state;
        this.isOn = state;
        // Сбрасываем таймер при выключении, чтобы пик срабатывал при следующем включении
        if (!state) {
            this.reset();
        }
        // Возвращаем true, если состояние действительно изменилось
        return changed;
    }
}

module.exports = Device;