document.addEventListener('DOMContentLoaded', () => {
    // Получаем ссылки на элементы
    const configSelect = document.getElementById('config-select');
    const generationForm = document.getElementById('generation-form');
    const generateButton = document.getElementById('generate-button');
    const statusMessage = document.getElementById('status-message');
    const processLog = document.getElementById('process-log');
    const configContent = document.getElementById('config-content'); // Textarea для контента
    const saveSection = document.getElementById('save-section');     // Секция сохранения
    const saveConfigButton = document.getElementById('save-config-button');
    const saveCommentInput = document.getElementById('save-comment');
    const configError = document.getElementById('config-error');    // Для ошибок валидации JSON

    let isGenerating = false;      // Флаг, идет ли генерация
    let currentConfigContent = ''; // Исходное содержимое ПОСЛЕ форматирования
    let selectedConfigFile = '';   // Имя текущего выбранного файла

    // --- Функция очистки состояния редактирования ---
    function resetEditState() {
        configContent.value = '';
        configContent.readOnly = true;
        configError.style.display = 'none';
        saveSection.style.display = 'none';
        saveCommentInput.value = '';
        currentConfigContent = '';
        selectedConfigFile = '';
        // Не сбрасываем configSelect.value здесь, чтобы не терять выбор при ошибках
    }

    // --- Функция загрузки списка конфигов ---
    function loadConfigs() {
        statusMessage.textContent = 'Загрузка списка конфигураций...';
        generateButton.disabled = true; // Блокируем кнопку генерации пока грузим
        fetch('/api/configs')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                const previouslySelected = configSelect.value; // Запоминаем, что было выбрано
                configSelect.innerHTML = '<option value="" disabled selected>Выберите конфигурацию</option>';
                if (data.configs && data.configs.length > 0) {
                    data.configs.forEach(configName => {
                        const option = document.createElement('option');
                        option.value = configName;
                        option.textContent = configName;
                        configSelect.appendChild(option);
                    });
                    // Пытаемся восстановить выбор, если он был
                    if (previouslySelected && data.configs.includes(previouslySelected)) {
                        configSelect.value = previouslySelected;
                        // После перезагрузки списка выбранный файл остается,
                        // но контент нужно загрузить заново, если его нет
                        if(!configContent.value || selectedConfigFile !== previouslySelected){
                             loadConfigContent(previouslySelected);
                        } else {
                            // Если контент уже есть и файл тот же, просто обновляем статус
                            statusMessage.textContent = `Конфигурация ${previouslySelected} загружена. Можно редактировать.`;
                            generateButton.disabled = isGenerating; // Кнопка зависит от статуса генерации
                        }

                    } else {
                       resetEditState(); // Сбрасываем редактор, если выбор пропал
                       configSelect.value = ''; // Убедимся, что ничего не выбрано
                       statusMessage.textContent = 'Ожидание выбора конфига...';
                       generateButton.disabled = true; // Нельзя генерировать без выбора
                    }

                } else {
                    configSelect.innerHTML = '<option value="" disabled selected>Конфигурации не найдены</option>';
                    statusMessage.textContent = 'Ошибка: Не найдены файлы конфигурации в папке /configs.';
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

    // --- Функция загрузки содержимого конфига ---
    function loadConfigContent(filename) {
        if (!filename) {
             resetEditState();
             generateButton.disabled = true;
             return;
        }
        selectedConfigFile = filename; // Сохраняем имя выбранного файла
        statusMessage.textContent = `Загрузка содержимого ${filename}...`;
        configContent.value = 'Загрузка...';
        configContent.readOnly = true;
        configError.style.display = 'none';
        saveSection.style.display = 'none'; // Скрываем кнопку сохранения при загрузке
        generateButton.disabled = true; // Блокируем генерацию во время загрузки

        fetch(`/api/configs/${encodeURIComponent(filename)}`) // Используем новый эндпоинт
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json(); // Ожидаем JSON вида { content: "..." }
            })
            .then(data => {
                if (typeof data.content === 'string') { // Проверяем, что content - строка
                    let formattedContent = '';
                    let isValidJson = false;
                    try {
                        // Пытаемся распарсить и красиво отформатировать
                        const parsedConfig = JSON.parse(data.content);
                        formattedContent = JSON.stringify(parsedConfig, null, 2);
                        isValidJson = true;
                        configError.style.display = 'none'; // Скрываем ошибку, если JSON валиден
                    } catch (e) {
                         console.warn(`Контент ${filename} не является валидным JSON, показываем как есть.`);
                         formattedContent = data.content; // Показываем как есть
                         configError.textContent = 'Внимание: содержимое не является валидным JSON.';
                         configError.style.display = 'block';
                         isValidJson = false;
                    }
                    // Сохраняем именно отформатированный (или исходный, если не JSON) контент как "оригинал"
                    currentConfigContent = formattedContent;
                    configContent.value = formattedContent;
                    configContent.readOnly = false; // Разрешаем редактирование
                    statusMessage.textContent = `Конфигурация ${filename} загружена. ${isValidJson ? 'Можно редактировать.' : 'Содержит ошибки JSON.'}`;
                    generateButton.disabled = isGenerating; // Разблокируем генерацию (если не идет уже)
                    saveSection.style.display = 'none'; // Убедимся, что кнопка скрыта после загрузки
                } else {
                    throw new Error('Ответ сервера не содержит строковое поле content.');
                }
            })
            .catch(error => {
                console.error(`Ошибка загрузки содержимого ${filename}:`, error);
                statusMessage.textContent = `Ошибка загрузки ${filename}: ${error.message}`;
                configContent.value = `Не удалось загрузить ${filename}.`;
                configContent.readOnly = true;
                generateButton.disabled = true;
                saveSection.style.display = 'none';
            });
    }

    // --- Обработчик выбора конфига в выпадающем списке ---
    configSelect.addEventListener('change', () => {
        const selectedValue = configSelect.value;
        loadConfigContent(selectedValue);
    });

    // --- Обработчик изменения содержимого в textarea ---
    configContent.addEventListener('input', () => {
        const newContent = configContent.value;
        let isJsonValid = false;
        // Проверяем, является ли текущее содержимое валидным JSON
        try {
            JSON.parse(newContent);
            configError.style.display = 'none'; // Ошибки нет
            isJsonValid = true;
        } catch (e) {
            configError.textContent = `Ошибка в JSON: ${e.message}`;
            configError.style.display = 'block';
            isJsonValid = false;
        }

        // Показываем кнопку сохранения, если:
        // 1. JSON валиден
        // 2. Контент ОТЛИЧАЕТСЯ от исходного (currentConfigContent)
        if (isJsonValid && newContent !== currentConfigContent) {
            saveSection.style.display = 'block';
            // console.log("Показываем кнопку сохранения");
        } else {
            saveSection.style.display = 'none'; // Скрываем в остальных случаях
            // console.log("Скрываем кнопку сохранения");
        }
    });

     // --- Обработчик клика по кнопке "Сохранить как новый конфиг" ---
     saveConfigButton.addEventListener('click', () => {
         const newContent = configContent.value;
         const comment = saveCommentInput.value.trim();
         let parsedConfig;
         try { // Повторная валидация перед отправкой
             parsedConfig = JSON.parse(newContent);
         } catch (e) {
             configError.textContent = `Невозможно сохранить: ошибка в JSON. ${e.message}`;
             configError.style.display = 'block';
             return; // Не отправляем невалидный JSON
         }

         saveConfigButton.disabled = true;
         saveConfigButton.textContent = 'Сохранение...';
         statusMessage.textContent = 'Сохранение новой конфигурации...';

         fetch('/api/configs', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
                 originalFilename: selectedConfigFile,
                 newContent: JSON.stringify(parsedConfig, null, 2), // Отправляем отформатированный JSON
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
                 statusMessage.textContent = `Конфигурация успешно сохранена как ${data.newFilename}`;
                 saveSection.style.display = 'none'; // Скрываем секцию сохранения
                 saveCommentInput.value = '';       // Очищаем комментарий

                 // ОБНОВЛЯЕМ ИСХОДНЫЙ КОНТЕНТ ПОСЛЕ УСПЕШНОГО СОХРАНЕНИЯ
                 const newlySavedContent = JSON.stringify(parsedConfig, null, 2);
                 currentConfigContent = newlySavedContent;
                 configContent.value = newlySavedContent; // Обновляем и textarea

                 // Перезагружаем список конфигов И АВТОМАТИЧЕСКИ ВЫБИРАЕМ НОВЫЙ
                 loadConfigs(); // Эта функция вызовет loadConfigContent опосредованно, если новый файл будет в списке
                 // Используем setTimeout чтобы дать списку время обновиться в DOM
                 setTimeout(() => {
                      if (Array.from(configSelect.options).some(opt => opt.value === data.newFilename)) {
                          configSelect.value = data.newFilename;
                          // Обновляем selectedConfigFile, так как выбор изменился
                          selectedConfigFile = data.newFilename;
                          console.log(`Автоматически выбран новый конфиг: ${selectedConfigFile}`);
                          // Можно еще раз вызвать loadConfigContent, чтобы убедиться, что все синхронизировано
                          // loadConfigContent(selectedConfigFile);
                          saveSection.style.display = 'none'; // Убедимся что кнопка сохранения скрыта
                      } else {
                           console.warn(`Не удалось найти новый файл ${data.newFilename} в списке после обновления.`);
                           // В этом случае просто оставляем как есть, пользователь выберет вручную
                      }
                 }, 300); // Небольшая задержка

             } else {
                 throw new Error(data.message || 'Неизвестная ошибка сохранения.');
             }
         })
         .catch(error => {
             console.error('Ошибка сохранения конфига:', error);
             statusMessage.textContent = `Ошибка сохранения: ${error.message}`;
         })
         .finally(() => {
              // Разблокируем кнопку в любом случае (кроме успеха, где скрывается вся секция)
             if (saveSection.style.display !== 'none') {
                saveConfigButton.disabled = false;
                saveConfigButton.textContent = 'Сохранить как новый конфиг';
             }
         });
     });


    // --- Обработка отправки формы ЗАПУСКА ГЕНЕРАЦИИ ---
    generationForm.addEventListener('submit', (event) => {
        event.preventDefault();

        if (isGenerating) {
            statusMessage.textContent = 'Генерация уже запущена.';
            return;
        }
        // !!! ИСПОЛЬЗУЕМ ТЕКУЩЕЕ ЗНАЧЕНИЕ ВЫБРАННОГО ЭЛЕМЕНТА В SELECT !!!
        const configToUse = configSelect.value;

        if (!configToUse) {
            statusMessage.textContent = 'Ошибка: Пожалуйста, выберите файл конфигурации.';
            return;
        }

        // Проверка на несохраненные изменения
        // Сравниваем текущее значение textarea с последним *загруженным* или *сохраненным* содержимым
        // И проверяем, отображается ли кнопка "Сохранить" (что означает валидные, но не сохраненные изменения)
        if (configContent.value !== currentConfigContent && saveSection.style.display !== 'none') {
             if (!confirm("Внимание! Содержимое выбранной конфигурации было изменено, но не сохранено.\n\nЗапустить генерацию с НЕ СОХРАНЕННЫМИ изменениями?")) {
                 return; // Отменяем запуск
             }
             console.warn("Запуск генерации с несохраненными изменениями в конфигурации!");
        }


        isGenerating = true;
        generateButton.disabled = true;
        configSelect.disabled = true; // Блокируем выбор конфига во время генерации
        configContent.readOnly = true; // Блокируем редактирование
        saveConfigButton.disabled = true; // Блокируем сохранение
        saveSection.style.display = 'none'; // Скрываем секцию сохранения на время генерации
        generateButton.textContent = 'Генерация...';
        statusMessage.textContent = `Запуск генерации с конфигурацией: ${configToUse}...`;
        processLog.textContent = '';
        processLog.style.display = 'block';

        console.log(`Отправка запроса на генерацию с configFile: ${configToUse}`); // Логгируем отправляемое имя

        fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ configFile: configToUse }) // Отправляем актуально выбранный файл
        })
        .then(response => {
             if (!response.ok) { // Обрабатываем ошибки HTTP
                 return response.json().then(err => { throw new Error(err.message || `Ошибка сервера: ${response.status}`) });
             }
             return response.json();
         })
        .then(data => {
            if (data.status === 'success') {
                statusMessage.textContent = `Генерация (${configToUse}) запущена! Выходной файл: ${data.outputFile || '...'}. Следите за логами сервера.`;
                // Не разблокируем кнопки сразу, так как процесс фоновый
                // Можно добавить таймер или WebSocket для отслеживания статуса
                 setTimeout(() => { // Условное "завершение" через N секунд
                     if (isGenerating) { // Проверяем, не было ли ошибки ранее
                         statusMessage.textContent = `Генерация (${configToUse}), вероятно, завершена. Проверьте папку /datasets.`;
                         isGenerating = false;
                         generateButton.disabled = false;
                         generateButton.textContent = 'Запустить Генерацию';
                         configSelect.disabled = false;
                         // Разрешаем редактирование только если файл успешно загружен
                         if (currentConfigContent) configContent.readOnly = false;
                         // Показываем/скрываем кнопку сохранения в зависимости от состояния контента
                         if (configContent.value !== currentConfigContent && configError.style.display === 'none') {
                              saveSection.style.display = 'block';
                              saveConfigButton.disabled = false;
                         } else {
                              saveSection.style.display = 'none';
                         }
                     }
                 }, 10000); // Увеличим время ожидания
            } else {
                 // Ошибка пришла в JSON ответе
                 throw new Error(data.message || 'Неизвестная ошибка запуска.');
            }
        })
        .catch(error => {
            console.error('Ошибка запуска генерации:', error);
            statusMessage.textContent = `Ошибка запуска: ${error.message}`;
            // Разблокируем все при ошибке запуска
            isGenerating = false;
            generateButton.disabled = false;
            generateButton.textContent = 'Запустить Генерацию';
            configSelect.disabled = false;
            if (currentConfigContent) configContent.readOnly = false; // Разрешаем редактирование
            // Показываем/скрываем кнопку сохранения
            if (configContent.value !== currentConfigContent && configError.style.display === 'none') {
                 saveSection.style.display = 'block';
                 saveConfigButton.disabled = false;
            } else {
                 saveSection.style.display = 'none';
            }
            processLog.style.display = 'none';
        });
    });

    // Начальная загрузка конфигов
    loadConfigs();
});