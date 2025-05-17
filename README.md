# DROID — Disaggregation-Oriented Realistic Input Data  
_Generator for Synthetic Energy Consumption Datasets_

## 📖 Overview / Обзор

**DROID** is a synthetic dataset generator designed to create realistic aggregated and device-level power consumption data. It is primarily intended for Non-Intrusive Load Monitoring (NILM) research and machine learning applications.

**DROID** — генератор синтетических датасетов, предназначенный для создания реалистичных агрегированных и индивидуальных профилей энергопотребления. Применяется для задач неинвазивной дезагрегации нагрузки (NILM) и обучения моделей машинного обучения.

## 🎯 Key Features / Основные возможности

- Aggregated and per-device energy consumption profiles generation.  
- Probabilistic device activation scenarios.  
- Configurable load shapes: `constant`, `sinusoidal`, `random`, `motor`.  
- Simulation of startup inrush currents and background noise.  
- Efficient CSV export for large datasets.  
- Web interface and REST API for configuration and simulation control.  

- Генерация профилей агрегированного и индивидуального энергопотребления.  
- Сценарии включения/выключения на основе вероятностных моделей.  
- Поддержка форм сигналов: `constant`, `sinusoidal`, `random`, `motor`.  
- Симуляция пусковых токов и фонового шума.  
- Эффективный экспорт данных в формат CSV.  
- Веб-интерфейс и API для управления симуляциями.

## 📦 Project Structure / Структура проекта

configs/         # JSON-конфигурации генерации  
datasets/        # Сгенерированные датасеты (CSV)  
devices/         # Модели устройств  
public/          # Веб-интерфейс (HTML, CSS, JS)  
generate_dataset.js  
scenario_generator.js  
data_writer.js  
server.js  

## 🚀 Installation / Установка

git clone https://github.com/QueQueEpta/Droid.git  
cd Droid  
npm install  

## 📈 Usage / Использование

CLI:  
node generate_dataset.js --config ./configs/my_config.json --output ./datasets/my_dataset.csv  

Web Interface / Веб-интерфейс:  
npm start  
Open in browser: http://localhost:3000  

## 📄 Output CSV Format / Формат выходного файла

timestamp: Временная метка (Unix ms)  
aggregated_power: Суммарная активная мощность (Вт)  
aggregated_current: Суммарный ток (А)  
<device_name>_power: Мощность отдельного устройства (Вт)  

# 📜 License / Лицензия

This software is **not open source** and is distributed under a **Restricted Commercial License**.  
Contact the author for commercial usage permissions via TG: [@Pztsr]  

**Данный проект не является открытым ПО и распространяется по лицензии с ограниченными коммерческими правами. Для получения разрешений на коммерческое использование свяжитесь с автором.**
