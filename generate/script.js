// Глобальные переменные
let API_URL = '';
let clientId = generateUUID();
let ws = null;
let currentNodeId = null;
let currentPromptId = null;
let models = [];
let samplers = [];
let currentWorkflow = null;
let isGenerating = false;
let history = [];
let historyAdded = false;

// Кэширование DOM-элементов
const elements = {
    alertBox: document.getElementById('alertBox'),
    apiUrl: document.getElementById('apiUrl'),
    btnConnect: document.getElementById('btnConnect'),
    connectionStatus: document.getElementById('connectionStatus'),
    modelSection: document.getElementById('modelSection'),
    modelSelect: document.getElementById('modelSelect'),
    paramsCard: document.getElementById('paramsCard'),
    positivePrompt: document.getElementById('positivePrompt'),
    negativePrompt: document.getElementById('negativePrompt'),
    width: document.getElementById('width'),
    height: document.getElementById('height'),
    steps: document.getElementById('steps'),
    cfg: document.getElementById('cfg'),
    samplerSelect: document.getElementById('samplerSelect'),
    schedulerSelect: document.getElementById('schedulerSelect'),
    randomSeed: document.getElementById('randomSeed'),
    seed: document.getElementById('seed'),
    btnGenerate: document.getElementById('btnGenerate'),
    progressSection: document.getElementById('progressSection'),
    statusText: document.getElementById('statusText'),
    progressBarFill: document.getElementById('progressBarFill'),
    btnCancel: document.getElementById('btnCancel'),
    resultSection: document.getElementById('resultSection'),
    imageResult: document.getElementById('imageResult'),
    historySection: document.getElementById('historySection'),
    historyList: document.getElementById('historyList'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    paramsModal: document.getElementById('paramsModal'),
    modalParamsContent: document.getElementById('modalParamsContent')
};

// Конфигурация для localStorage
const storageConfig = {
    apiUrl: 'generate_apiUrl',
    positivePrompt: 'generate_positivePrompt',
    negativePrompt: 'generate_negativePrompt',
    width: 'generate_width',
    height: 'generate_height',
    steps: 'generate_steps',
    cfg: 'generate_cfg',
    sampler: 'generate_sampler',
    scheduler: 'generate_scheduler',
    seed: 'generate_seed',
    randomSeed: 'generate_randomSeed',
    selectedModel: 'generate_selectedModel',
    activeTab: 'generate_activeTab',
    history: 'generate_history'
};

elements.alertBox.addEventListener('click', function() {
    this.classList.add('hidden');
});

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Восстановление сохраненных данных
    const savedApiUrl = localStorage.getItem(storageConfig.apiUrl);
    if (savedApiUrl) {
        elements.apiUrl.value = savedApiUrl;
    }
    
    // Восстановление истории из localStorage
    const savedHistory = localStorage.getItem(storageConfig.history);
    if (savedHistory) {
        history = JSON.parse(savedHistory);
        if (history.length > 0) {
            elements.historySection.classList.remove('hidden');
            renderHistory();
        }
    }
    
    // Инициализация табов
    initTabs();

    // Обработчики событий
    elements.randomSeed.addEventListener('change', function() {
        elements.seed.disabled = this.checked;
        if (this.checked) {
            elements.seed.value = "";
        }
        // Сохраняем состояние при изменении
        saveAllParams();
    });
    
    // Делегирование событий для всех параметров
    const paramElements = [
        elements.positivePrompt, elements.negativePrompt, 
        elements.width, elements.height, elements.steps, 
        elements.cfg, elements.samplerSelect, elements.schedulerSelect, 
        elements.seed, elements.modelSelect
    ];
    
    paramElements.forEach(el => {
        if (el) el.addEventListener('input', saveAllParams);
        if (el && el.type === 'number') el.addEventListener('change', saveAllParams);
    });

    elements.samplerSelect.addEventListener('change', saveAllParams);
    elements.schedulerSelect.addEventListener('change', saveAllParams);
    
    // Генерируем начальный случайный сид, если нужно
    updateRandomSeed();

    elements.btnConnect.addEventListener('click', connectToServer);
    elements.btnGenerate.addEventListener('click', generateImage);
    elements.btnCancel.addEventListener('click', cancelGeneration);
    elements.clearHistoryBtn.addEventListener('click', clearHistory);

    document.querySelector('.modal-close').addEventListener('click', closeModal);
});

// Функция сохранения всех параметров
function saveAllParams() {
    const params = {
        [storageConfig.positivePrompt]: elements.positivePrompt.value,
        [storageConfig.negativePrompt]: elements.negativePrompt.value,
        [storageConfig.width]: elements.width.value,
        [storageConfig.height]: elements.height.value,
        [storageConfig.steps]: elements.steps.value,
        [storageConfig.cfg]: elements.cfg.value,
        [storageConfig.sampler]: elements.samplerSelect.value,
        [storageConfig.scheduler]: elements.schedulerSelect.value,
        [storageConfig.seed]: elements.seed.value,
        [storageConfig.randomSeed]: elements.randomSeed.checked,
        [storageConfig.selectedModel]: elements.modelSelect.value
    };
    
    Object.keys(params).forEach(key => {
        localStorage.setItem(key, params[key]);
    });
    
    // Сохраняем активную вкладку
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {
        localStorage.setItem(storageConfig.activeTab, activeTab.getAttribute('data-tab'));
    }
}

// Функция восстановления всех параметров
function restoreAllParams() {
    // Восстановление текстовых параметров
    const textParams = [
        storageConfig.positivePrompt, storageConfig.negativePrompt,
        storageConfig.width, storageConfig.height, storageConfig.steps,
        storageConfig.cfg, storageConfig.seed
    ];
    
    textParams.forEach(key => {
        const savedValue = localStorage.getItem(key);
        if (savedValue !== null && elements[key.split('_')[1]]) {
            elements[key.split('_')[1]].value = savedValue;
        }
    });
    
    // Восстановление семплера и планировщика
    const savedSampler = localStorage.getItem(storageConfig.sampler);
    if (savedSampler !== null) {
        elements.samplerSelect.value = savedSampler;
    }
    
    const savedScheduler = localStorage.getItem(storageConfig.scheduler);
    if (savedScheduler !== null) {
        elements.schedulerSelect.value = savedScheduler;
    }
    
    // Восстановление выбранной модели
    const savedModel = localStorage.getItem(storageConfig.selectedModel);
    if (savedModel !== null) {
        setTimeout(() => {
            if (elements.modelSelect.querySelector(`option[value="${savedModel}"]`)) {
                elements.modelSelect.value = savedModel;
            }
        }, 500);
    }
    
    // Восстановление чекбокса случайного сида
    const savedRandomSeed = localStorage.getItem(storageConfig.randomSeed);
    if (savedRandomSeed !== null) {
        elements.randomSeed.checked = savedRandomSeed === 'true';
        elements.seed.disabled = savedRandomSeed === 'true';
    }
    
    // Восстановление активной вкладки
    const savedActiveTab = localStorage.getItem(storageConfig.activeTab);
    if (savedActiveTab) {
        // Деактивируем все табы и контент
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Активируем сохраненную вкладку
        const tabToActivate = document.querySelector(`.tab[data-tab="${savedActiveTab}"]`);
        const contentToActivate = document.getElementById(`tab-${savedActiveTab}`);
        
        if (tabToActivate && contentToActivate) {
            tabToActivate.classList.add('active');
            contentToActivate.classList.add('active');
        }
    }
}

function updateRandomSeed() {
    if (elements.randomSeed.checked) {
        elements.seed.value = generateRandomSeed();
    }
}

function generateRandomSeed() {
    return Math.floor(Math.random() * 4294967295);
}

function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            
            // Деактивируем все табы и контент
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Активируем выбранный таб и контент
            tab.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
        });
    });
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function showAlert(message, type = 'error') {
    elements.alertBox.textContent = message;
    elements.alertBox.className = `alert alert-${type}`;
    elements.alertBox.classList.remove('hidden');
    
    // Автоматическое скрытие всех alert через 5 секунд
    setTimeout(() => {
        elements.alertBox.classList.add('hidden');
    }, 5000);
}

function updateConnectionStatus(status, type = 'info') {
    elements.connectionStatus.textContent = `Статус: ${status}`;
    
    // Убираем все классы alert-*
    elements.connectionStatus.classList.remove('alert-error', 'alert-success', 'alert-warning', 'alert-info');
    
    // Добавляем класс только если это не обычный статус
    if (type !== 'info') {
        elements.connectionStatus.classList.add(`alert-${type}`);
    }
}

async function connectToServer() {
    let apiUrl = elements.apiUrl.value.trim();
    
    // Добавляем протокол если отсутствует
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
        apiUrl = 'http://' + apiUrl;
    }
    
    // Убираем завершающие слэши
    apiUrl = apiUrl.replace(/\/+$/, '');
    
    API_URL = apiUrl;
    elements.apiUrl.value = apiUrl;
    
    if (!API_URL) {
        showAlert('Пожалуйста, введите адрес сервера generate.');
        return;
    }
    
    // Сохраняем URL для будущего использования
    localStorage.setItem(storageConfig.apiUrl, API_URL);
    
    // Показываем статус подключения
    updateConnectionStatus('подключение...');
    
    try {
        // Проверяем доступность сервера
        const response = await fetch(`${API_URL}/system_stats`);
        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status}`);
        }
        
        // Получаем информацию о сервере
        const serverInfo = await fetch(`${API_URL}/system_stats`).then(r => r.json());
        
        // Дождаться завершения всех загрузок
        await Promise.all([
            fetchModels(),
            fetchSamplers(), 
            fetchSchedulers()
        ]);

        // Восстановление ВСЕХ параметров
        restoreAllParams();
        
        // Автоматически загружаем стандартный workflow
        currentWorkflow = await loadWorkflowTemplate('default');
        
        // Показываем секцию с моделью и параметрами
        elements.modelSection.classList.remove('hidden');
        elements.paramsCard.classList.remove('hidden');
        
        updateConnectionStatus('подключено');
        showAlert('Успешное подключение к серверу', 'success');
        
    } catch (error) {
        console.error('Ошибка подключения:', error);
        updateConnectionStatus('ошибка подключения');
        showAlert(`Не удалось подключиться к серверу: ${error.message}`);
    }
}

async function fetchModels() {
    try {
        // Получаем информацию о доступных нодах
        const response = await fetch(`${API_URL}/object_info`);
        if (!response.ok) {
            throw new Error('Не удалось получить информацию о нодах');
        }
        
        const objectInfo = await response.json();
        
        // Ищем ноду загрузки моделей (CheckpointLoaderSimple)
        if (objectInfo['CheckpointLoaderSimple']) {
            const checkpointNode = objectInfo['CheckpointLoaderSimple'];
            if (checkpointNode.input && checkpointNode.input.required && checkpointNode.input.required.ckpt_name) {
                // Получаем список моделей из параметров ноды
                const modelList = checkpointNode.input.required.ckpt_name[0];
                
                if (Array.isArray(modelList)) {
                    models = modelList.map(model => ({ name: model, filename: model }));
                } else {
                    // Если это не массив, пытаемся получить модели через другие методы
                    models = await getModelsFromDirectory();
                }
            } else {
                models = await getModelsFromDirectory();
            }
        } else {
            models = await getModelsFromDirectory();
        }
        
        await populateModelSelect();
        
    } catch (error) {
        console.error('Ошибка загрузки моделей:', error);
        showAlert('Не удалось загрузить список моделей. Некоторые функции могут быть недоступны.', 'warning');
    }
}

async function getModelsFromDirectory() {
    try {
        // Попытка получить модели через нестандартный эндпоинт
        // или сканирование директории
        const response = await fetch(`${API_URL}/models`);
        if (response.ok) {
            return await response.json();
        } else {
            // Если эндпоинт не доступен, возвращаем пустой список
            return [];
        }
    } catch (error) {
        console.error('Ошибка получения моделей из директории:', error);
        return [];
    }
}

async function fetchSamplers() {
    try {
        // Получаем информацию о доступных сэмплерах
        const response = await fetch(`${API_URL}/object_info`);
        if (response.ok) {
            const objectInfo = await response.json();
            
            // Ищем KSampler ноду для получения информации о доступных сэмплерах
            if (objectInfo['KSampler']) {
                const ksamplerInfo = objectInfo['KSampler'];
                if (ksamplerInfo.input && ksamplerInfo.input.required && ksamplerInfo.input.required.sampler_name) {
                    const samplerOptions = ksamplerInfo.input.required.sampler_name[0];
                    if (Array.isArray(samplerOptions)) {
                        populateSamplerSelect(samplerOptions);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки сэмплеров:', error);
        // Используем значения по умолчанию
        const defaultSamplers = ['euler', 'euler_ancestral', 'dpm_2', 'dpm_2_ancestral', 'lms', 'dpmpp_2s_ancestral', 'dpmpp_2m', 'ddim'];
        await populateSamplerSelect(defaultSamplers);
    }
}

async function fetchSchedulers() {
    try {
        // Получаем информацию о доступных планировщиках
        const response = await fetch(`${API_URL}/object_info`);
        if (response.ok) {
            const objectInfo = await response.json();
            
            // Ищем KSampler ноду для получения информации о доступных планировщиках
            if (objectInfo['KSampler']) {
                const ksamplerInfo = objectInfo['KSampler'];
                if (ksamplerInfo.input && ksamplerInfo.input.required && ksamplerInfo.input.required.scheduler) {
                    const schedulerOptions = ksamplerInfo.input.required.scheduler[0];
                    if (Array.isArray(schedulerOptions)) {
                        populateSchedulerSelect(schedulerOptions);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки планировщиков:', error);
        // В случае ошибки используем значения по умолчанию
        const defaultSchedulers = ['normal', 'karras', 'exponential', 'simple', 'ddim_uniform'];
        await populateSchedulerSelect(defaultSchedulers);
    }
}

function populateModelSelect() {
    elements.modelSelect.innerHTML = '';
    
    if (models.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Модели не найдены';
        elements.modelSelect.appendChild(option);
        showAlert('Модели не найдены. Убедитесь, что модели загружены в правильные папки generate.', 'warning');
        return;
    }
    
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.filename;
        option.textContent = model.name || model.filename;
        elements.modelSelect.appendChild(option);
    });
    
    // Восстановление выбранной модели после заполнения списка
    const savedModel = localStorage.getItem(storageConfig.selectedModel);
    if (savedModel && models.some(m => m.filename === savedModel)) {
        elements.modelSelect.value = savedModel;
    }
    
    // Сохранение выбранной модели при изменении
    elements.modelSelect.addEventListener('change', () => {
        localStorage.setItem(storageConfig.selectedModel, elements.modelSelect.value);
    });
}

function populateSamplerSelect(samplers) {
    elements.samplerSelect.innerHTML = '';
    
    samplers.forEach(sampler => {
        const option = document.createElement('option');
        option.value = sampler;
        option.textContent = sampler;
        elements.samplerSelect.appendChild(option);
    });
    
    // Восстановление выбранного сэмплера после заполнения списка
    const savedSampler = localStorage.getItem(storageConfig.sampler);
    if (savedSampler && samplers.includes(savedSampler)) {
        elements.samplerSelect.value = savedSampler;
    }
    
    // Сохранение выбранного сэмплера при изменении
    elements.samplerSelect.addEventListener('change', () => {
        localStorage.setItem(storageConfig.sampler, elements.samplerSelect.value);
    });
}

function populateSchedulerSelect(schedulers) {
    elements.schedulerSelect.innerHTML = '';
    
    schedulers.forEach(scheduler => {
        const option = document.createElement('option');
        option.value = scheduler;
        option.textContent = scheduler;
        elements.schedulerSelect.appendChild(option);
    });
    
    // Восстановление выбранного планировщика
    const savedScheduler = localStorage.getItem(storageConfig.scheduler);
    if (savedScheduler && schedulers.includes(savedScheduler)) {
        elements.schedulerSelect.value = savedScheduler;
    }
    
    // Сохранение выбранного планировщика при изменении
    elements.schedulerSelect.addEventListener('change', () => {
        localStorage.setItem(storageConfig.scheduler, elements.schedulerSelect.value);
    });
}

async function loadWorkflowTemplate(workflowId) {
    // Загрузка предопределенных workflow шаблонов
    const workflows = {
        'default': {
            // Базовый workflow для текстовой генерации
            "3": {
                "inputs": {
                    "seed": 0, // Будет заменено динамически
                    "steps": 20, // Будет заменено динамически
                    "cfg": 8, // Будет заменено динамически
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "denoise": 1,
                    "model": ["4", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["5", 0]
                },
                "class_type": "KSampler",
                "_meta": { "title": "KSampler" }
            },
            "4": {
                "inputs": { 
                    "ckpt_name": "" // Будет заменено динамически
                },
                "class_type": "CheckpointLoaderSimple",
                "_meta": { "title": "Load Checkpoint" }
            },
            "5": {
                "inputs": {
                    "width": 512, // Будет заменено динамически
                    "height": 512, // Будет заменено динамически
                    "batch_size": 1 // Фиксированный размер пачки
                },
                "class_type": "EmptyLatentImage",
                "_meta": { "title": "Empty Latent Image" }
            },
            "6": {
                "inputs": {
                    "text": "", // Будет заменено динамически
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode",
                "_meta": { "title": "CLIP Text Encode (Prompt)" }
            },
            "7": {
                "inputs": {
                    "text": "", // Будет заменено динамически
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode",
                "_meta": { "title": "CLIP Text Encode (Prompt)" }
            },
            "8": {
                "inputs": {
                    "samples": ["3", 0],
                    "vae": ["4", 2]
                },
                "class_type": "VAEDecode",
                "_meta": { "title": "VAE Decode" }
            },
            "9": {
                "inputs": {
                    "filename_prefix": "generate",
                    "images": ["8", 0]
                },
                "class_type": "SaveImage",
                "_meta": { "title": "Save Image" }
            }
        }
    };
    
    return workflows[workflowId] || workflows['default'];
}

function setupWebSocket() {
    return new Promise((resolve, reject) => {
        // Закрываем существующее соединение, если есть
        if (ws) {
            ws.onclose = null; // Убираем обработчик, чтобы избежать рекурсии
            ws.close();
            ws = null;
        }

        const wsProtocol = API_URL.startsWith('https') ? 'wss:' : 'ws:';
        const hostname = new URL(API_URL).hostname;
        const port = new URL(API_URL).port;
        
        const websocketUrl = `${wsProtocol}//${hostname}${port ? ':' + port : ''}/ws?clientId=${clientId}`;
        
        try {
            ws = new WebSocket(websocketUrl);
            
            // Таймаут для подключения
            const timeout = setTimeout(() => {
                if (ws.readyState !== WebSocket.OPEN) {
                    reject(new Error('Таймаут подключения WebSocket'));
                    ws.close();
                }
            }, 5000);
            
            ws.onopen = () => {
                clearTimeout(timeout);
                console.log('WebSocket connected');
                resolve();
            };
            
            ws.onerror = (error) => {
                clearTimeout(timeout);
                console.error('WebSocket error:', error);
                reject(error);
            };
            
            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                handleWebSocketMessage(message);
            };
            
            ws.onclose = (event) => {
                clearTimeout(timeout);
                console.log('WebSocket disconnected', event.code, event.reason);
                if (isGenerating) {
                    showAlert('Соединение прервано. Генерация остановлена.', 'error');
                    resetUI();
                }
            };
        } catch (error) {
            reject(error);
        }
    });
}

function handleWebSocketMessage(message) {
    console.log("WebSocket message:", message);
    
    switch (message.type) {
        case 'execution_start':
            elements.statusText.textContent = `Начало выполнения...`;
            break;
            
        case 'execution_cached':
            elements.statusText.textContent = `Кэшировано: ${message.data.nodes.join(', ')}`;
            break;
            
        case 'executing':
            currentNodeId = message.data.node;
            if (currentNodeId) {
                elements.statusText.textContent = `Выполняется узел: ${currentNodeId}`;
            } else {
                elements.statusText.textContent = `Выполнение завершено`;
                // Если node is null, значит выполнение завершено
                // Но не вызываем fetchHistory здесь, ждем 'executed'
            }
            break;
            
        case 'progress':
            const progress = message.data.value / message.data.max * 100;
            elements.progressBarFill.style.width = `${progress}%`;
            elements.statusText.textContent = `Прогресс: ${Math.round(progress)}% (Шаг ${message.data.value} из ${message.data.max})`;
            break;
            
        case 'executed':
            if (message.data.node === currentNodeId && !historyAdded) {
                elements.statusText.textContent = 'Генерация завершена!';
                fetchHistory(message.data.prompt_id);
            }
            break;
            
        case 'execution_error':
            showAlert(`Ошибка выполнения: ${message.data.exception_message}`);
            resetUI();
            break;
    }
}

function checkWebSocketState() {
    if (!ws) {
        return "Не инициализирован";
    }
    
    switch (ws.readyState) {
        case WebSocket.CONNECTING:
            return "Подключается";
        case WebSocket.OPEN:
            return "Открыт";
        case WebSocket.CLOSING:
            return "Закрывается";
        case WebSocket.CLOSED:
            return "Закрыт";
        default:
            return "Неизвестное состояние";
    }
}

async function generateImage() {
    if (isGenerating) {
        showAlert('Генерация уже выполняется. Дождитесь завершения.');
        return;
    }
    
    // Обновляем случайный seed если нужно
    updateRandomSeed();
    
    const positivePrompt = elements.positivePrompt.value;
    if (!positivePrompt) {
        showAlert('Пожалуйста, введите позитивный промт.');
        return;
    }
    
    // Показываем UI прогресса
    elements.btnGenerate.disabled = true;
    elements.progressSection.classList.remove('hidden');
    elements.statusText.textContent = "Подготовка...";
    elements.progressBarFill.style.width = '0%';
    elements.imageResult.classList.add('hidden');
    
    isGenerating = true;
    
    try {
        // Настраиваем WebSocket соединение для отслеживания прогресса
        await setupWebSocket();
        
        // Даем время на установление соединения
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket соединение не установлено');
        }
        
        // Подготавливаем промпт
        const prompt = constructPrompt();
        
        // Отправляем промпт на выполнение
        const response = await fetch(`${API_URL}/prompt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                client_id: clientId
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ошибка API: ${response.status} ${response.statusText}. ${errorText}`);
        }
        
        const responseData = await response.json();
        currentPromptId = responseData.prompt_id;
        console.log("Prompt queued:", responseData);
        
    } catch (error) {
        console.error('Ошибка генерации:', error);
        showAlert(`Ошибка при запуске генерации: ${error.message}`);
        resetUI();
    }
}

function constructPrompt() {
    // Получаем выбранную модель
    const selectedModel = elements.modelSelect.value;
    
    // Получаем параметры из UI
    const width = parseInt(elements.width.value);
    const height = parseInt(elements.height.value);
    const steps = parseInt(elements.steps.value);
    const cfg = parseFloat(elements.cfg.value);
    const sampler = elements.samplerSelect.value;
    const scheduler = elements.schedulerSelect.value;
    const useRandomSeed = elements.randomSeed.checked;
    let seed = parseInt(elements.seed.value);
    
    // Если выбран случайный сид, но значение не установлено, генерируем его
    if (useRandomSeed && seed === -1) {
        seed = generateRandomSeed();
        elements.seed.value = seed; // Обновляем поле для отображения
    }

    const positivePrompt = elements.positivePrompt.value;
    const negativePrompt = elements.negativePrompt.value || "text, watermark, low quality, worst quality";

    const now = new Date();
    const dateTimeString = now.toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .substring(0, 19);
    const filenamePrefix = `Generated_${dateTimeString}`;

    // Копируем текущий workflow
    const promptData = JSON.parse(JSON.stringify(currentWorkflow));
    
    // Заменяем параметры в workflow
    promptData["4"]["inputs"]["ckpt_name"] = selectedModel;
    promptData["5"]["inputs"]["width"] = width;
    promptData["5"]["inputs"]["height"] = height;
    promptData["3"]["inputs"]["seed"] = seed;
    promptData["3"]["inputs"]["steps"] = steps;
    promptData["3"]["inputs"]["cfg"] = cfg;
    promptData["3"]["inputs"]["sampler_name"] = sampler;
    promptData["3"]["inputs"]["scheduler"] = scheduler;
    promptData["6"]["inputs"]["text"] = positivePrompt;
    promptData["7"]["inputs"]["text"] = negativePrompt;
    promptData["9"]["inputs"]["filename_prefix"] = filenamePrefix;
    
    return promptData;
}

async function fetchHistory(promptId) {
    try {
        // Проверяем, не добавляли ли уже эту генерацию в историю
        if (historyAdded) {
            return;
        }
        
        const response = await fetch(`${API_URL}/history/${promptId}`);
        const historyData = await response.json();
        console.log("History received:", historyData);
        
        const promptHistory = historyData[promptId];
        if (promptHistory && promptHistory.outputs) {
            // Ищем узел с изображениями
            for (const nodeId in promptHistory.outputs) {
                const nodeOutput = promptHistory.outputs[nodeId];
                if (nodeOutput.images && nodeOutput.images.length > 0) {
                    const image = nodeOutput.images[0];
                    const imageUrl = `${API_URL}/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`;
                    
                    // Показываем изображение
                    elements.imageResult.src = imageUrl;
                    elements.imageResult.classList.remove('hidden');
                    
                    elements.imageResult.onclick = () => window.open(imageUrl, '_blank');
                    
                    elements.statusText.textContent = 'Готово!';
                    
                    // Добавляем в историю только если еще не добавляли
                    if (!historyAdded) {
                        addToHistory(imageUrl, promptId, promptHistory);
                        historyAdded = true; // Устанавливаем флаг
                    }
                    
                    // Сбрасываем UI через 3 секунды
                    setTimeout(() => {
                        resetUI();
                    }, 3000);
                    
                    break;
                }
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
        showAlert('Изображение сгенерировано, но произошла ошибка при его загрузке.');
        resetUI();
    }
}

function addToHistory(imageUrl, promptId, promptHistory) {
    // Собираем параметры генерации
    const params = {
        positivePrompt: elements.positivePrompt.value,
        negativePrompt: elements.negativePrompt.value,
        width: parseInt(elements.width.value),
        height: parseInt(elements.height.value),
        steps: parseInt(elements.steps.value),
        cfg: parseFloat(elements.cfg.value),
        sampler: elements.samplerSelect.value,
        scheduler: elements.schedulerSelect.value,
        seed: elements.seed.value, // Сохраняем фактический сид
        model: elements.modelSelect.value
    };
    
    // Добавляем в истории
    const historyItem = {
        id: promptId,
        imageUrl: imageUrl,
        timestamp: new Date().toISOString(),
        prompt: elements.positivePrompt.value,
        model: elements.modelSelect.value,
        params: params // сохраняем параметры
    };
    
    history.unshift(historyItem);
    
    // Сохраняем историю в localStorage
    localStorage.setItem(storageConfig.history, JSON.stringify(history));
    
    // Показываем секцию истории, если она скрыта
    elements.historySection.classList.remove('hidden');
    
    // Рендерим историю
    renderHistory();
}

function renderHistory() {
    elements.historyList.innerHTML = '';
    
    history.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        historyItem.innerHTML = `
            <img src="${item.imageUrl}" alt="Generated image">
            <div class="history-item-info">
                ${new Date(item.timestamp).toLocaleTimeString()}
            </div>
            <div class="history-item-controls">
                <button class="history-btn info" onclick="showHistoryParams(event, ${index})">i</button>
                <button class="history-btn delete" onclick="deleteHistoryItem(event, ${index})">&times;</button>
            </div>
        `;
        
        historyItem.onclick = () => window.open(item.imageUrl, '_blank');
        elements.historyList.appendChild(historyItem);
    });
}

// Функция удаления элемента из истории
function deleteHistoryItem(event, index) {
    event.stopPropagation(); // Предотвращаем открытие изображения
    if (confirm('Удалить это изображение из истории?')) {
        history.splice(index, 1);
        localStorage.setItem(storageConfig.history, JSON.stringify(history));
        
        if (history.length === 0) {
            elements.historySection.classList.add('hidden');
        }
        
        renderHistory();
    }
}

function clearHistory() {
    if (confirm('Вы уверены, что хотите полностью очистить историю?')) {
        history = [];
        localStorage.removeItem(storageConfig.history);
        elements.historySection.classList.add('hidden');
        // Очищаем отображение истории
        elements.historyList.innerHTML = '';
        showAlert('История очищена', 'success');
    }
}

// Функция показа параметров генерации
function showHistoryParams(event, index) {
    event.stopPropagation(); // Предотвращаем открытие изображения
    
    const item = history[index];
    const modal = elements.paramsModal;
    const content = elements.modalParamsContent;
    
    // Форматируем параметры для отображения
    let html = '';
    
    if (item.params) {
        // Специальная обработка для промтов
        const specialParams = {
            positivePrompt: 'Позитивный промт',
            negativePrompt: 'Негативный промт'
        };
        
        // Сначала выводим обычные параметры
        for (const [key, value] of Object.entries(item.params)) {
            if (key in specialParams) continue; // Пропускаем промты, они будут обработаны отдельно
            
            let displayValue = value;
            
            // Форматируем ключи для лучшего отображения
            const keyNames = {
                width: 'Ширина',
                height: 'Высота',
                steps: 'Шаги',
                cfg: 'CFG Scale',
                sampler: 'Сэмплер',
                scheduler: 'Планировщик',
                seed: 'Сид',
                model: 'Модель'
            };
            
            const displayKey = keyNames[key] || key;
            
            html += `
                <div class="param-row">
                    <div class="param-name">${displayKey}</div>
                    <div class="param-value">${displayValue}</div>
                </div>
            `;
        }
        
        // Затем выводим промты с особой разметкой
        for (const [key, title] of Object.entries(specialParams)) {
            if (item.params[key]) {
                html += `
                    <div class="prompt-label">${title}</div>
                    <div class="copyable-prompt" onclick="copyPrompt('${item.params[key].replace(/'/g, "\\'").replace(/"/g, '\\"')}', '${title}')">
                        ${item.params[key]}
                    </div>
                `;
            }
        }
    } else {
        html = '<p>Параметры генерации для этого изображения не сохранены.</p>';
    }
    
    content.innerHTML = html;
    modal.style.display = 'flex';
}

// Простая функция для копирования текста в буфер обмена
function copyPrompt(text, title) {
    // Создаем временный textarea элемент
    const textarea = document.createElement('textarea');
    textarea.value = text.replace(/\\'/g, "'").replace(/\\"/g, '"');
    document.body.appendChild(textarea);
    
    // Выделяем и копируем текст
    textarea.select();
    try {
        document.execCommand('copy');
        
        // Показываем уведомление
        showAlert(`${title} скопирован в буфер обмена!`, 'success');
        
        // Визуальная обратная связь
        const prompts = document.querySelectorAll('.copyable-prompt');
        prompts.forEach(prompt => {
            if (prompt.textContent === textarea.value) {
                prompt.classList.add('copied');
                setTimeout(() => prompt.classList.remove('copied'), 2000);
            }
        });
    } catch (err) {
        console.error('Ошибка при копировании текста: ', err);
        showAlert('Не удалось скопировать промт', 'error');
    }
    
    // Удаляем временный элемент
    document.body.removeChild(textarea);
}

// Функция закрытия модального окна
function closeModal() {
    elements.paramsModal.style.display = 'none';
}

// Закрытие модального окна при клике вне его
window.onclick = function(event) {
    if (event.target === elements.paramsModal) {
        closeModal();
    }
}

function cancelGeneration() {
    if (currentPromptId && isGenerating) {
        // Отправляем запрос на отмену выполнения
        fetch(`${API_URL}/interrupt`, { method: 'POST' })
            .then(response => {
                if (response.ok) {
                    showAlert('Генерация отменена', 'warning');
                } else {
                    showAlert('Не удалось отменить генерацию', 'error');
                }
            })
            .catch(error => {
                console.error('Ошибка отмены генерации:', error);
                showAlert('Ошибка при отмене генерации', 'error');
            })
            .finally(() => {
                resetUI();
            });
    } else {
        resetUI();
    }
}

function resetUI() {
    isGenerating = false;
    currentNodeId = null;
    currentPromptId = null;
    historyAdded = false; // Сбрасываем флаг
    
    elements.btnGenerate.disabled = false;
    elements.progressSection.classList.add('hidden');
    elements.statusText.textContent = "Ожидание...";
    elements.progressBarFill.style.width = '0%';
    
    if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
    }
}

window.deleteHistoryItem = deleteHistoryItem;
window.showHistoryParams = showHistoryParams;
window.copyPrompt = copyPrompt;

window.closeModal = closeModal;



