document.addEventListener('DOMContentLoaded', () => {
    // --- Элементы для Генератора Конфигураций ---
    const configSelect = document.getElementById('config-select');
    const generationForm = document.getElementById('generation-form');
    const generateButton = document.getElementById('generate-button');
    const statusMessage = document.getElementById('status-message');
    const processLog = document.getElementById('process-log');
    const configContent = document.getElementById('config-content');
    const saveSection = document.getElementById('save-section');
    const saveConfigButton = document.getElementById('save-config-button');
    const saveCommentInput = document.getElementById('save-comment');
    const configError = document.getElementById('config-error');

    let isGenerating = false;
    let currentConfigContent = ''; 
    let selectedConfigFile = '';   

    function resetEditState() {
        if(configContent) configContent.value = '';
        if(configContent) configContent.readOnly = true;
        if(configError) configError.style.display = 'none';
        if(saveSection) saveSection.style.display = 'none';
        if(saveCommentInput) saveCommentInput.value = '';
        currentConfigContent = '';
        selectedConfigFile = '';
    }

    function loadConfigs() {
        if(!statusMessage || !generateButton || !configSelect) return; 
        statusMessage.textContent = 'Загрузка списка конфигураций...';
        generateButton.disabled = true;
        configSelect.innerHTML = '<option value="" disabled selected>Загрузка...</option>';

        fetch('/api/configs')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                const previouslySelected = configSelect.value;
                configSelect.innerHTML = '<option value="" disabled selected>Выберите конфигурацию</option>';
                if (data.configs && data.configs.length > 0) {
                    data.configs.forEach(configName => {
                        const option = document.createElement('option');
                        option.value = configName;
                        option.textContent = configName;
                        configSelect.appendChild(option);
                    });
                    if (previouslySelected && data.configs.includes(previouslySelected)) {
                        configSelect.value = previouslySelected;
                        if((!configContent || !configContent.value) || selectedConfigFile !== previouslySelected) { 
                            loadConfigContent(previouslySelected);
                        } else {
                            statusMessage.textContent = `Конфигурация ${previouslySelected} загружена.`;
                            generateButton.disabled = isGenerating;
                        }
                    } else {
                       resetEditState();
                       configSelect.value = '';
                       statusMessage.textContent = 'Ожидание выбора конфига...';
                       generateButton.disabled = true;
                    }
                } else {
                    configSelect.innerHTML = '<option value="" disabled selected>Конфигурации не найдены</option>';
                    statusMessage.textContent = 'Ошибка: Не найдены файлы конфигурации.';
                    resetEditState();
                    generateButton.disabled = true;
                }
            })
            .catch(error => {
                console.error('Ошибка загрузки конфигов:', error);
                statusMessage.textContent = `Ошибка загрузки конфигураций: ${error.message}`;
                configSelect.innerHTML = '<option value="" disabled selected>Ошибка загрузки</option>';
                generateButton.disabled = true;
                resetEditState();
            });
    }

    function loadConfigContent(filename) {
        if (!filename || !configContent) { 
             resetEditState();
             if(generateButton) generateButton.disabled = true;
             return;
        }
        selectedConfigFile = filename;
        if(statusMessage) statusMessage.textContent = `Загрузка содержимого ${filename}...`;
        configContent.value = 'Загрузка...';
        configContent.readOnly = true;
        if(configError) configError.style.display = 'none';
        if(saveSection) saveSection.style.display = 'none';
        if(generateButton) generateButton.disabled = true;

        fetch(`/api/configs/${encodeURIComponent(filename)}`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status} (${response.statusText})`);
                return response.json();
            })
            .then(data => {
                if (typeof data.content === 'string') {
                    let formattedContent = '';
                    let isValidJson = false;
                    try {
                        const parsedConfig = JSON.parse(data.content);
                        formattedContent = JSON.stringify(parsedConfig, null, 2);
                        isValidJson = true;
                        if(configError) configError.style.display = 'none';
                    } catch (e) {
                         console.warn(`Контент ${filename} не является валидным JSON, показываем как есть.`);
                         formattedContent = data.content;
                         if(configError) {
                            configError.textContent = 'Внимание: содержимое не является валидным JSON и не может быть сохранено с изменениями.';
                            configError.style.display = 'block';
                         }
                         isValidJson = false;
                    }
                    currentConfigContent = formattedContent; 
                    configContent.value = formattedContent;
                    configContent.readOnly = false;
                    if(statusMessage) statusMessage.textContent = `Конфигурация ${filename} загружена. ${isValidJson ? 'Можно редактировать.' : ''}`;
                    if(generateButton) generateButton.disabled = isGenerating;
                    if(saveSection) saveSection.style.display = 'none';
                } else {
                    throw new Error('Ответ сервера не содержит строковое поле content.');
                }
            })
            .catch(error => {
                console.error(`Ошибка загрузки содержимого ${filename}:`, error);
                if(statusMessage) statusMessage.textContent = `Ошибка загрузки ${filename}: ${error.message}`;
                configContent.value = `Не удалось загрузить ${filename}.`;
                configContent.readOnly = true;
                if(generateButton) generateButton.disabled = true;
                if(saveSection) saveSection.style.display = 'none';
            });
    }

    if (configSelect) {
        configSelect.addEventListener('change', () => {
            const selectedValue = configSelect.value;
            loadConfigContent(selectedValue);
        });
    }

    if (configContent) {
        configContent.addEventListener('input', () => {
            const newContent = configContent.value;
            let isJsonValid = false;
            try {
                JSON.parse(newContent);
                if(configError) configError.style.display = 'none';
                isJsonValid = true;
            } catch (e) {
                if(configError) {
                    configError.textContent = `Ошибка в JSON: ${e.message}. Изменения не могут быть сохранены.`;
                    configError.style.display = 'block';
                }
                isJsonValid = false;
            }

            if (isJsonValid && newContent !== currentConfigContent && saveSection) {
                saveSection.style.display = 'block';
            } else if (saveSection) {
                saveSection.style.display = 'none';
            }
        });
    }

    if (saveConfigButton) {
        saveConfigButton.addEventListener('click', () => {
            const newContent = configContent.value;
            const comment = saveCommentInput.value.trim();
            let parsedConfig;
            try {
                parsedConfig = JSON.parse(newContent); 
            } catch (e) {
                if(configError) {
                    configError.textContent = `Невозможно сохранить: ошибка в JSON. ${e.message}`;
                    configError.style.display = 'block';
                }
                return;
            }

            saveConfigButton.disabled = true;
            saveConfigButton.textContent = 'Сохранение...';
            if(statusMessage) statusMessage.textContent = 'Сохранение новой конфигурации...';

            fetch('/api/configs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originalFilename: selectedConfigFile,
                    newContent: JSON.stringify(parsedConfig, null, 2),
                    comment: comment
                })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw new Error(err.message || `HTTP error! status: ${response.status}`) });
                }
                return response.json();
            })
            .then(data => {
                if (data.status === 'success') {
                    if(statusMessage) statusMessage.textContent = `Конфигурация успешно сохранена как ${data.newFilename}`;
                    if(saveSection) saveSection.style.display = 'none';
                    if(saveCommentInput) saveCommentInput.value = '';
                    currentConfigContent = JSON.stringify(parsedConfig, null, 2); 
                    if(configContent) configContent.value = currentConfigContent;

                    loadConfigs(); 
                    setTimeout(() => { 
                         if (configSelect && Array.from(configSelect.options).some(opt => opt.value === data.newFilename)) {
                             configSelect.value = data.newFilename;
                             selectedConfigFile = data.newFilename; 
                         }
                    }, 300);
                } else {
                    throw new Error(data.message || 'Неизвестная ошибка сохранения.');
                }
            })
            .catch(error => {
                console.error('Ошибка сохранения конфига:', error);
                if(statusMessage) statusMessage.textContent = `Ошибка сохранения: ${error.message}`;
            })
            .finally(() => {
                if (saveSection && saveSection.style.display !== 'none') {
                   saveConfigButton.disabled = false;
                   saveConfigButton.textContent = 'Сохранить как новый конфиг';
                }
            });
        });
    }

    if (generationForm) {
        generationForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (isGenerating) {
                if(statusMessage) statusMessage.textContent = 'Генерация уже запущена.';
                return;
            }
            const configToUse = configSelect.value;
            if (!configToUse) {
                if(statusMessage) statusMessage.textContent = 'Ошибка: Пожалуйста, выберите файл конфигурации.';
                return;
            }

            if (configContent && configContent.value !== currentConfigContent && saveSection && saveSection.style.display !== 'none') {
                 if (!confirm("Внимание! Содержимое выбранной конфигурации было изменено, но не сохранено.\n\nЗапустить генерацию с НЕ СОХРАНЕННЫМИ изменениями?")) {
                     return;
                 }
                 console.warn("Запуск генерации с несохраненными изменениями в конфигурации!");
            }

            isGenerating = true;
            if(generateButton) generateButton.disabled = true;
            if(configSelect) configSelect.disabled = true;
            if(configContent) configContent.readOnly = true;
            if (saveConfigButton) saveConfigButton.disabled = true;
            if (saveSection) saveSection.style.display = 'none';
            if(generateButton) generateButton.textContent = 'Генерация...';
            if(statusMessage) statusMessage.textContent = `Запуск генерации с конфигурацией: ${configToUse}...`;
            if (processLog) {
                 processLog.textContent = ''; 
                 processLog.style.display = 'block'; 
            }

            fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configFile: configToUse })
            })
            .then(response => {
                 if (!response.ok) {
                     return response.json().then(err => { throw new Error(err.message || `Ошибка сервера: ${response.status}`) });
                 }
                 return response.json();
             })
            .then(data => {
                if (data.status === 'success') {
                    if(statusMessage) statusMessage.textContent = `Генерация (${configToUse}) запущена! Выходной файл: ${data.outputFile || '...'}. Следите за логами сервера.`;
                     setTimeout(() => {
                         if (isGenerating) {
                             if(statusMessage) statusMessage.textContent = `Процесс генерации (${configToUse}) запущен на сервере. Проверьте папку /datasets через некоторое время.`;
                             isGenerating = false;
                             if(generateButton) {
                                generateButton.disabled = false;
                                generateButton.textContent = 'Запустить Генерацию';
                             }
                             if(configSelect) configSelect.disabled = false;
                             if (configContent && currentConfigContent) configContent.readOnly = false; 
                             if (configContent && configContent.value !== currentConfigContent && configError && configError.style.display === 'none') {
                                  if(saveSection) saveSection.style.display = 'block';
                                  if(saveConfigButton) saveConfigButton.disabled = false;
                             }
                             if (datasetSelect) loadDatasetList();
                         }
                     }, 5000); 
                } else {
                     throw new Error(data.message || 'Неизвестная ошибка запуска.');
                }
            })
            .catch(error => {
                console.error('Ошибка запуска генерации:', error);
                if(statusMessage) statusMessage.textContent = `Ошибка запуска: ${error.message}`;
                isGenerating = false;
                if(generateButton){
                    generateButton.disabled = false;
                    generateButton.textContent = 'Запустить Генерацию';
                }
                if(configSelect) configSelect.disabled = false;
                if (configContent && currentConfigContent) configContent.readOnly = false;
                if (configContent && configContent.value !== currentConfigContent && configError && configError.style.display === 'none') {
                     if(saveSection) saveSection.style.display = 'block';
                     if(saveConfigButton) saveConfigButton.disabled = false;
                }
                if (processLog) processLog.style.display = 'none';
            });
        });
    }
    
    // --- Логика для Визуализации ---
    const datasetSelect = document.getElementById('dataset-select');
    const loadChartButton = document.getElementById('load-chart-button');
    const chartCanvas = document.getElementById('dataset-chart');
    const chartMessage = document.getElementById('chart-message');
    const chartRowLimitInput = document.getElementById('chart-row-limit'); // ВОССТАНОВИЛИ ПОЛЕ
    let currentChart = null;

    function getRandomColor() {
        const r = Math.floor(Math.random() * 220);
        const g = Math.floor(Math.random() * 220);
        const b = Math.floor(Math.random() * 220);
        return `rgb(${r},${g},${b})`;
    }
    
    function loadDatasetList() {
        if (!datasetSelect) return;
        datasetSelect.innerHTML = '<option value="" disabled selected>Загрузка...</option>';
        if (loadChartButton) loadChartButton.disabled = true;
        
        fetch('/api/datasets')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                datasetSelect.innerHTML = '<option value="" disabled selected>Выберите датасет</option>';
                if (data.datasets && data.datasets.length > 0) {
                    data.datasets.forEach(datasetName => {
                        const option = document.createElement('option');
                        option.value = datasetName;
                        option.textContent = datasetName;
                        datasetSelect.appendChild(option);
                    });
                    if (loadChartButton) loadChartButton.disabled = false;
                } else {
                    datasetSelect.innerHTML = '<option value="" disabled selected>Датасеты не найдены</option>';
                    if (chartMessage) {
                        chartMessage.textContent = 'Нет доступных датасетов для визуализации.';
                        chartMessage.style.display = 'block';
                    }
                }
            })
            .catch(error => {
                console.error('Ошибка загрузки списка датасетов:', error);
                datasetSelect.innerHTML = '<option value="" disabled selected>Ошибка загрузки</option>';
                if (chartMessage) {
                    chartMessage.textContent = `Ошибка загрузки списка датасетов: ${error.message}`;
                    chartMessage.style.display = 'block';
                }
            });
    }

    if (loadChartButton) {
        loadChartButton.addEventListener('click', () => {
            const selectedDataset = datasetSelect.value;
            if (!selectedDataset) {
                if (chartMessage) {
                    chartMessage.textContent = 'Пожалуйста, выберите датасет.';
                    chartMessage.style.display = 'block';
                }
                return;
            }

            // Используем значение из input для лимита
            const rowLimitValue = chartRowLimitInput.value; 
            const rowLimit = parseInt(rowLimitValue, 10); 

            if (isNaN(rowLimit) || rowLimit <= 0) {
                if (chartMessage) {
                    chartMessage.textContent = 'Пожалуйста, введите корректный лимит строк (положительное число).';
                    chartMessage.style.display = 'block';
                }
                return;
            }

            loadChartButton.disabled = true;
            loadChartButton.textContent = 'Загрузка данных...';
            if (chartMessage) {
                chartMessage.textContent = `Загрузка данных из ${selectedDataset} (лимит: ${rowLimit} строк)...`;
                chartMessage.style.display = 'block';
            }

            if (currentChart) {
                currentChart.destroy();
                currentChart = null;
            }

            const fetchURL = `/api/datasets/${encodeURIComponent(selectedDataset)}?limit=${rowLimit}`;
            console.log("Fetching data from URL:", fetchURL);

            fetch(fetchURL)
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(err => { throw new Error(err.message || `HTTP error! status: ${response.status}`) });
                    }
                    return response.json();
                })
                .then(result => {
                    if (result.data && result.data.length > 0) {
                        let messageText = `Данные из ${result.filename} загружены. Показано строк: ${result.rowCount}.`;
                        if (result.maxRowsLimitHit) {
                             messageText += ` (Всего в файле: ${result.totalRowsInFile}, отображен лимит строк из ${chartRowLimitInput.value} запрошенных)`;
                        } else if (result.totalRowsInFile !== undefined) {
                             messageText += ` (Всего в файле: ${result.totalRowsInFile})`;
                        }
                        if(chartMessage) chartMessage.textContent = messageText;
                        renderChart(result.data, result.filename); // Используем старую функцию рендеринга
                    } else {
                        if(chartMessage) chartMessage.textContent = `В файле ${result.filename} нет данных или файл пуст (возможно, после применения лимита).`;
                    }
                })
                .catch(error => {
                    console.error('Ошибка загрузки данных датасета:', error);
                    if(chartMessage) chartMessage.textContent = `Ошибка загрузки данных: ${error.message}`;
                })
                .finally(() => {
                    loadChartButton.disabled = false;
                    loadChartButton.textContent = 'Загрузить и Показать График';
                });
        });
    }

    // Старая функция рендеринга без плагина зума
    function renderChart(csvData, filename) { 
        if (!csvData || csvData.length === 0 || !chartCanvas) return;

        const labels = csvData.map(row => new Date(row.timestamp));
        const datasets = [];
        const columnNames = Object.keys(csvData[0]);
        const predefinedColors = [ 
            'rgb(255, 99, 132)', 'rgb(54, 162, 235)', 'rgb(255, 205, 86)',
            'rgb(75, 192, 192)', 'rgb(153, 102, 255)', 'rgb(255, 159, 64)',
            'rgb(201, 203, 207)', 'rgb(100, 100, 100)'
        ];
        let colorIndex = 0;

        columnNames.forEach(columnName => {
            if (columnName.toLowerCase() === 'timestamp') return;
            const hasNumericData = csvData.some(row => typeof row[columnName] === 'number' && !isNaN(row[columnName]));
            if (!hasNumericData) {
                console.warn(`Колонка ${columnName} не содержит числовых данных и будет пропущена.`);
                return;
            }
            let color = predefinedColors[colorIndex % predefinedColors.length];
            if (datasets.length >= predefinedColors.length) { color = getRandomColor(); }
            colorIndex++;

            datasets.push({
                label: columnName,
                data: csvData.map(row => row[columnName] ?? null),
                borderColor: color,
                backgroundColor: color + '33', 
                fill: false, 
                tension: 0.2,
                borderWidth: columnName.toLowerCase().includes('aggregated') ? 2.5 : 1.5,
                pointRadius: csvData.length > 500 ? 0 : (csvData.length > 200 ? 1 : 2), 
                pointHoverRadius: 4,
            });
        });

        const data = { labels: labels, datasets: datasets };

        const config = {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                stacked: false, 
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
                    title: { display: true, text: `Энергопотребление: ${filename}`, font: { size: 16 } },
                    tooltip: { 
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2) + ' (Вт/А)'; 
                                }
                                return label;
                            }
                        }
                    }
                    // УБРАЛИ плагин zoom отсюда
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            parser: 'YYYY-MM-DDTHH:mm:ss.SSSZ', 
                            tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
                            unit: csvData.length > 1440*2 ? 'hour' : (csvData.length > 120 ? 'minute' : 'second'), 
                            displayFormats: {
                                second: 'HH:mm:ss', minute: 'HH:mm', hour: 'HH:mm dd MMM', day: 'dd MMM yy'
                            }
                        },
                        title: { display: true, text: 'Время' }
                    },
                    y: { 
                        beginAtZero: true,
                        title: { display: true, text: 'Значение (Вт или А)' },
                        ticks: {
                            callback: function(value) { return value.toFixed(1); }
                        }
                    }
                },
                animation: { duration: 500 }, 
            }
        };
        if (currentChart) currentChart.destroy(); 
        currentChart = new Chart(chartCanvas, config);
    }

    if (configSelect) loadConfigs();
    if (datasetSelect) loadDatasetList();
});