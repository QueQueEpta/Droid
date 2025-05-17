# DROID — Disaggregation-Oriented Realistic Input Data  
_Generator for Synthetic Energy Consumption Datasets_

**DROID** is a synthetic dataset generator designed to create realistic aggregated and device-level power consumption data. It is primarily intended for Non-Intrusive Load Monitoring (NILM) research and machine learning applications. The generator supports complex, configurable device behavior scenarios and provides a web interface for easy management and data visualization. **DROID** — генератор синтетических датасетов, предназначенный для создания реалистичных агрегированных и индивидуальных профилей энергопотребления. Применяется для задач неинвазивной дезагрегации нагрузки (NILM) и обучения моделей машинного обучения. Генератор поддерживает сложные, настраиваемые сценарии поведения устройств и предоставляет веб-интерфейс для удобного управления и визуализации данных.

🎯 Key Features / Основные возможности  
- Generation of aggregated and per-device energy consumption profiles.  
- Modular device definitions, allowing easy addition of new custom devices.  
- Advanced scenario engine with multiple behavior types for devices:  
  - `always_on`: Continuous operation.  
  - `cyclic`: Regular on/off cycles (e.g., refrigerators, ACs).  
  - `scheduled_usage`: Specific times or intervals.  
  - `manual_short_usage`: Short, frequent, random usage (e.g., kettles).  
  - `complex_cycle_device`: Multi-stage operational cycles (e.g., washing machines).  
- Configurable load shapes: `constant`, `sinusoidal`, `random`, `motor`.  
- Simulation of startup inrush currents and background noise.  
- Efficient CSV export for large datasets.  
- Web interface for:  
  - Managing generation configurations.  
  - Initiating dataset generation.  
  - Visualizing datasets with interactive charts.  
- REST API for programmatic control.  
- Command-Line Interface (CLI) for batch generation.  

🛠️ Project Structure / Структура проекта  
├── configs/ (JSON configurations for datasets)  
│   └── config.json (Example configuration)  
├── datasets/ (Generated datasets - GIT IGNORED)  
├── devices/ (Device behavior models)  
│   ├── Device.js  
│   ├── device1.js  
│   └── index.js  
├── public/ (Web interface frontend)  
│   ├── index.html  
│   ├── script.js  
│   └── styles.css  
├── .gitignore  
├── data_writer.js (CSV writer utility)  
├── generate_dataset.js (CLI dataset generation script)  
├── package.json  
├── package-lock.json  
├── README.md  
├── scenario_generator.js (Device behavior logic)  
└── server.js (Node.js server for API and UI)  

🚀 Installation / Установка  
git clone https://github.com/YourUsername/YourRepositoryName.git  
cd YourRepositoryName  
npm install  

📈 Usage / Использование  
Web Interface:  
npm start  
Navigate to: http://localhost:3000  
Use the interface to manage configs, generate datasets, and visualize data.

CLI:  
node generate_dataset.js --config ./configs/your_config_name.json --output ./datasets/your_output_dataset.csv  

⚙️ Configuration / Конфигурация  
- simulationDurationHours: Total simulation time.  
- timeStepMs: Time resolution in milliseconds.  
- outputFile: Output filename (can be overridden).  
- noiseLevelWatts: Background noise level.  
- devicesToInclude: Array of device IDs.  
- deviceScenarioConfigs: Device-specific scenario settings.  
See scenario_generator.js for available scenario types and parameters.

📄 Output CSV Format  
| timestamp | aggregated_power | aggregated_current | <device_name>_power ... |  
- timestamp: Unix timestamp (ms, UTC).  
- aggregated_power: Total power consumption + noise (Watts).  
- aggregated_current: Total current (Amps).  
- <device_name>_power: Power per individual device (Watts).  

📜 License / Лицензия  
This software is not open source and is distributed under a Restricted Commercial License.  
Contact the author for commercial usage via Telegram: @Pztsr  
Данный проект не является открытым ПО и распространяется по лицензии с ограниченными коммерческими правами. Для получения разрешений на коммерческое использование свяжитесь с автором.
