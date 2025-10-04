// Глобальные переменные
let API_URL = '';
let clientId = generateUUID();
let ws = null;
let currentNodeId = null;
let currentPromptId = null;
let upscaleModels = [];
let currentWorkflow = null;
let isUpscaling = false;
let history = [];
let uploadedImageFile = null;

// Кэширование DOM-элементов
const elements = {
    alertBox: document.getElementById('alertBox'),
    apiUrl: document.getElementById('apiUrl'),
    btnConnect: document.getElementById('btnConnect'),
    connectionStatus: document.getElementById('connectionStatus'),
    modelSection: document.getElementById('modelSection'),
    modelSelect: document.getElementById('modelSelect'),
    paramsCard: document.getElementById('paramsCard'),
    uploadArea: document.getElementById('uploadArea'),
    imageUpload: document.getElementById('imageUpload'),
    imagePreview: document.getElementById('imagePreview'),
    btnUpscale: document.getElementById('btnUpscale'),
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
    modalParamsContent: document.getElementById('modalParamsContent'),
    imageUrl: document.getElementById('imageUrl'),
    btnLoadFromUrl: document.getElementById('btnLoadFromUrl'),
};

// Конфигурация для localStorage
const storageConfig = {
    apiUrl: 'upscale_apiUrl',
    selectedModel: 'upscale_selectedModel',
    history: 'upscale_history'
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
    
    // Обработчики событий
    elements.btnConnect.addEventListener('click', connectToServer);
    elements.btnUpscale.addEventListener('click', upscaleImage);
    elements.btnCancel.addEventListener('click', cancelUpscaling);
    elements.clearHistoryBtn.addEventListener('click', clearHistory);
    
    // Обработчики загрузки изображения
    elements.uploadArea.addEventListener('click', function() {
        elements.imageUpload.click();
    });
    
    elements.imageUpload.addEventListener('change', handleImageUpload);
    
    // Drag and drop
    elements.uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });
    
    elements.uploadArea.addEventListener('dragleave', function() {
        this.classList.remove('dragover');
    });
    
    elements.uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
        
        if (e.dataTransfer.files.length) {
            elements.imageUpload.files = e.dataTransfer.files;
            handleImageUpload({target: elements.imageUpload});
        }
    });
    
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    
    // Добавленные обработчики
    elements.btnLoadFromUrl.addEventListener('click', loadImageFromUrl);
    elements.btnRemoveImage.addEventListener('click', removeUploadedImage);
    
    // Обработчик нажатия Enter в поле URL
    elements.imageUrl.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loadImageFromUrl();
        }
    });
});

function showAlert(message, type = 'error') {
    elements.alertBox.textContent = message;
    elements.alertBox.className = `alert alert-${type}`;
    elements.alertBox.classList.remove('hidden');
    
    setTimeout(() => {
        elements.alertBox.classList.add('hidden');
    }, 5000);
}

// Добавленная функция: Загрузка изображения по URL
async function loadImageFromUrl() {
    const imageUrl = elements.imageUrl.value.trim();
    
    if (!imageUrl) {
        showAlert('Пожалуйста, введите URL изображения.');
        return;
    }
    
    try {
        elements.btnLoadFromUrl.disabled = true;
        elements.btnLoadFromUrl.textContent = 'Loading...';
        
        // Проверяем, является ли URL действительным
        if (!isValidUrl(imageUrl)) {
            throw new Error('Invalid URL. Make sure it starts with http:// or https://');
        }
        
        // Загружаем изображение
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Image upload error: ${response.status} ${response.statusText}`);
        }
        
        const blob = await response.blob();
        
        // Проверяем, что это изображение
        if (!blob.type.startsWith('image/')) {
            throw new Error('The specified URL does not lead to the image');
        }
        
        // Создаем файл из blob
        const file = new File([blob], 'image_from_url.jpg', { type: blob.type });
        
        // Обрабатываем как обычную загрузку файла
        uploadedImageFile = file;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            elements.imagePreview.src = event.target.result;
            elements.imagePreview.style.display = 'block';
            elements.btnRemoveImage.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
        
        showAlert('The image was successfully uploaded via URL', 'success');
        elements.imageUrl.value = '';
        
    } catch (error) {
        console.error('Error loading image from URL:', error);
        showAlert(`Image upload error: ${error.message}`);
    } finally {
        elements.btnLoadFromUrl.disabled = false;
        elements.btnLoadFromUrl.textContent = 'Upload';
    }
}

// Добавленная функция: Проверка валидности URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Обновленная функция: Обработка загрузки изображения
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.match('image.*')) {
        showAlert('Please select the image file.');
        return;
    }
    
    uploadedImageFile = file;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        elements.imagePreview.src = event.target.result;
        elements.imagePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function updateConnectionStatus(status, type = 'info') {
    elements.connectionStatus.textContent = `Status: ${status}`;
    elements.connectionStatus.classList.remove('alert-error', 'alert-success', 'alert-warning', 'alert-info');
    
    if (type !== 'info') {
        elements.connectionStatus.classList.add(`alert-${type}`);
    }
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.match('image.*')) {
        showAlert('Please select the image file.');
        return;
    }
    
    uploadedImageFile = file;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        elements.imagePreview.src = event.target.result;
        elements.imagePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

async function connectToServer() {
    let apiUrl = elements.apiUrl.value.trim();
    
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
        apiUrl = 'http://' + apiUrl;
    }
    
    apiUrl = apiUrl.replace(/\/+$/, '');
    
    API_URL = apiUrl;
    elements.apiUrl.value = apiUrl;
    
    if (!API_URL) {
        showAlert('Please enter the server address.');
        return;
    }
    
    localStorage.setItem(storageConfig.apiUrl, API_URL);
    
    updateConnectionStatus('connecting...');
    
    try {
        const response = await fetch(`${API_URL}/system_stats`);
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        await fetchUpscaleModels();
        
        currentWorkflow = await loadUpscaleWorkflowTemplate();
        
        elements.modelSection.classList.remove('hidden');
        elements.paramsCard.classList.remove('hidden');
        
        updateConnectionStatus('connected');
        showAlert('Successful connection to the server', 'success');
        
    } catch (error) {
        console.error('Connection error:', error);
        updateConnectionStatus('connection error');
        showAlert(`Couldn't connect to the server: ${error.message}`);
    }
}

async function fetchUpscaleModels() {
    try {
        const response = await fetch(`${API_URL}/object_info`);
        if (!response.ok) {
            throw new Error(`Couldn't get information about nodes`);
        }
        
        const objectInfo = await response.json();
        
        // Ищем ноду загрузки моделей апскейла
        if (objectInfo['UpscaleModelLoader']) {
            const upscaleModelNode = objectInfo['UpscaleModelLoader'];
            if (upscaleModelNode.input && upscaleModelNode.input.required && upscaleModelNode.input.required.model_name) {
                const modelList = upscaleModelNode.input.required.model_name[0];
                
                if (Array.isArray(modelList)) {
                    upscaleModels = modelList.map(model => ({ name: model, filename: model }));
                } else {
                    upscaleModels = await getUpscaleModelsFromDirectory();
                }
            } else {
                upscaleModels = await getUpscaleModelsFromDirectory();
            }
        } else {
            upscaleModels = await getUpscaleModelsFromDirectory();
        }
        
        populateModelSelect();
        
    } catch (error) {
        console.error('Model loading error:', error);
        showAlert('The list of models could not be loaded. Some functions may not be available.', 'warning');
    }
}

async function getUpscaleModelsFromDirectory() {
    try {
        const response = await fetch(`${API_URL}/upscale_models`);
        if (response.ok) {
            return await response.json();
        } else {
            return [];
        }
    } catch (error) {
        console.error('Error getting models from the directory:', error);
        return [];
    }
}

function populateModelSelect() {
    elements.modelSelect.innerHTML = '';
    
    if (upscaleModels.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Модели апскейла не найдены';
        elements.modelSelect.appendChild(option);
        showAlert('No upscale models were found. Make sure that the models are uploaded to the correct ComfyUI folders.', 'warning');
        return;
    }
    
    upscaleModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.filename;
        option.textContent = model.name || model.filename;
        elements.modelSelect.appendChild(option);
    });
    
    const savedModel = localStorage.getItem(storageConfig.selectedModel);
    if (savedModel && upscaleModels.some(m => m.filename === savedModel)) {
        elements.modelSelect.value = savedModel;
    }
    
    elements.modelSelect.addEventListener('change', () => {
        localStorage.setItem(storageConfig.selectedModel, elements.modelSelect.value);
    });
}

async function loadUpscaleWorkflowTemplate() {
    return {
        "3": {
            "inputs": {
                "image": ["5", 0],
                "upscale_model": ["4", 0]
            },
            "class_type": "ImageUpscaleWithModel"
        },
        "4": {
            "inputs": {
                "model_name": "" // Будет заменено динамически
            },
            "class_type": "UpscaleModelLoader"
        },
        "5": {
            "inputs": {
                "image": "" // Будет заменено на имя загруженного файла
            },
            "class_type": "LoadImage"
        },
        "6": {
            "inputs": {
                "filename_prefix": "Upscaled_Image",
                "images": ["3", 0]
            },
            "class_type": "SaveImage"
        }
    };
}

async function uploadImageToServer() {
    if (!uploadedImageFile) {
        throw new Error('There is no image to upload');
    }
    
    const formData = new FormData();
    formData.append('image', uploadedImageFile);
    
    const response = await fetch(`${API_URL}/upload/image`, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`Image upload error: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
}

function setupWebSocket() {
    return new Promise((resolve, reject) => {
        if (ws) {
            ws.onclose = null;
            ws.close();
            ws = null;
        }

        const wsProtocol = API_URL.startsWith('https') ? 'wss:' : 'ws:';
        const hostname = new URL(API_URL).hostname;
        const port = new URL(API_URL).port;
        
        const websocketUrl = `${wsProtocol}//${hostname}${port ? ':' + port : ''}/ws?clientId=${clientId}`;
        
        try {
            ws = new WebSocket(websocketUrl);
            
            const timeout = setTimeout(() => {
                if (ws.readyState !== WebSocket.OPEN) {
                    reject(new Error('WebSocket Connection Timeout'));
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
                if (isUpscaling) {
                    showAlert('The connection is terminated. Upscale has been stopped.', 'error');
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
            elements.statusText.textContent = `Start execution...`;
            break;
            
        case 'execution_cached':
            elements.statusText.textContent = `Cached: ${message.data.nodes.join(', ')}`;
            break;
            
        case 'executing':
            currentNodeId = message.data.node;
            if (currentNodeId) {
                elements.statusText.textContent = `The node is in progress: ${currentNodeId}`;
            } else {
                elements.statusText.textContent = `Execution completed`;
            }
            break;
            
        case 'progress':
            const progress = message.data.value / message.data.max * 100;
            elements.progressBarFill.style.width = `${progress}%`;
            elements.statusText.textContent = `Progress: ${Math.round(progress)}% (Шаг ${message.data.value} из ${message.data.max})`;
            break;
            
        case 'executed':
            if (message.data.node === currentNodeId) {
                elements.statusText.textContent = 'Upscale complete!';
                fetchHistory(message.data.prompt_id);
            }
            break;
            
        case 'execution_error':
            showAlert(`Execution error: ${message.data.exception_message}`);
            resetUI();
            break;
    }
}

async function upscaleImage() {
    if (isUpscaling) {
        showAlert('The upscale is already in progress. Wait for it to finish.');
        return;
    }
    
    if (!uploadedImageFile) {
        showAlert('Please upload an image for the upscale.');
        return;
    }
    
    const selectedModel = elements.modelSelect.value;
    if (!selectedModel) {
        showAlert('Please select the model for the upscale.');
        return;
    }
    
    elements.btnUpscale.disabled = true;
    elements.progressSection.classList.remove('hidden');
    elements.statusText.textContent = "Подготовка...";
    elements.progressBarFill.style.width = '0%';
    elements.imageResult.classList.add('hidden');
    
    isUpscaling = true;
    
    try {
        // Загружаем изображение на сервер
        elements.statusText.textContent = "Uploading an image...";
        const uploadResult = await uploadImageToServer();
        
        // Настраиваем WebSocket соединение для отслеживания прогресса
        await setupWebSocket();
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket connection is not established');
        }
        
        const prompt = constructUpscalePrompt(uploadResult.name);
        
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
            throw new Error(`API error: ${response.status} ${response.statusText}. ${errorText}`);
        }
        
        const responseData = await response.json();
        currentPromptId = responseData.prompt_id;
        console.log("Prompt queued:", responseData);
        
    } catch (error) {
        console.error('Upscale error:', error);
        showAlert(`Error when starting upscale: ${error.message}`);
        resetUI();
    }
}

function constructUpscalePrompt(imageFilename) {
    const selectedModel = elements.modelSelect.value;
    
    const now = new Date();
    const dateTimeString = now.toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .substring(0, 19);
    const filenamePrefix = `Upscaled_${dateTimeString}`;

    const promptData = JSON.parse(JSON.stringify(currentWorkflow));
    
    promptData["4"]["inputs"]["model_name"] = selectedModel;
    promptData["5"]["inputs"]["image"] = imageFilename;
    promptData["6"]["inputs"]["filename_prefix"] = filenamePrefix;
    
    return promptData;
}

async function fetchHistory(promptId) {
    try {
        const response = await fetch(`${API_URL}/history/${promptId}`);
        const historyData = await response.json();
        console.log("History received:", historyData);
        
        const promptHistory = historyData[promptId];
        if (promptHistory && promptHistory.outputs) {
            for (const nodeId in promptHistory.outputs) {
                const nodeOutput = promptHistory.outputs[nodeId];
                if (nodeOutput.images && nodeOutput.images.length > 0) {
                    const image = nodeOutput.images[0];
                    const imageUrl = `${API_URL}/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`;
                    
                    elements.imageResult.src = imageUrl;
                    elements.imageResult.classList.remove('hidden');
                    
                    elements.imageResult.onclick = () => window.open(imageUrl, '_blank');
                    
                    elements.statusText.textContent = 'Готово!';
                    
                    addToHistory(imageUrl, promptId, promptHistory);
                    
                    setTimeout(() => {
                        resetUI();
                    }, 3000);
                    
                    break;
                }
            }
        }
    } catch (error) {
        console.error('History upload error:', error);
        showAlert('The image was upscaled, but an error occurred when uploading it.');
        resetUI();
    }
}

function addToHistory(imageUrl, promptId, promptHistory) {
    const params = {
        model: elements.modelSelect.value
    };
    
    const historyItem = {
        id: promptId,
        imageUrl: imageUrl,
        timestamp: new Date().toISOString(),
        model: elements.modelSelect.value,
        params: params
    };
    
    history.unshift(historyItem);
    
    localStorage.setItem(storageConfig.history, JSON.stringify(history));
    
    elements.historySection.classList.remove('hidden');
    
    renderHistory();
}

function renderHistory() {
    elements.historyList.innerHTML = '';
    
    history.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        historyItem.innerHTML = `
            <img src="${item.imageUrl}" alt="Upscaled image">
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

function deleteHistoryItem(event, index) {
    event.stopPropagation();
    if (confirm('Delete this image from the history?')) {
        history.splice(index, 1);
        localStorage.setItem(storageConfig.history, JSON.stringify(history));
        
        if (history.length === 0) {
            elements.historySection.classList.add('hidden');
        }
        
        renderHistory();
    }
}

function clearHistory() {
    if (confirm('Are you sure you want to completely clear the history?')) {
        history = [];
        localStorage.removeItem(storageConfig.history);
        elements.historySection.classList.add('hidden');
        elements.historyList.innerHTML = '';
        showAlert('История очищена', 'success');
    }
}

function showHistoryParams(event, index) {
    event.stopPropagation();
    
    const item = history[index];
    const modal = elements.paramsModal;
    const content = elements.modalParamsContent;
    
    let html = '';
    
    if (item.params) {
        const keyNames = {
            model: 'Model'
        };
        
        for (const [key, value] of Object.entries(item.params)) {
            const displayKey = keyNames[key] || key;
            
            html += `
                <div class="param-row">
                    <div class="param-name">${displayKey}</div>
                    <div class="param-value">${value}</div>
                </div>
            `;
        }
    } else {
        html = '<p>The upscale parameters for this image are not saved.</p>';
    }
    
    content.innerHTML = html;
    modal.style.display = 'flex';
}

function closeModal() {
    elements.paramsModal.style.display = 'none';
}

window.onclick = function(event) {
    if (event.target === elements.paramsModal) {
        closeModal();
    }
}

function cancelUpscaling() {
    if (currentPromptId && isUpscaling) {
        fetch(`${API_URL}/interrupt`, { method: 'POST' })
            .then(response => {
                if (response.ok) {
                    showAlert('Upscale canceled', 'warning');
                } else {
                    showAlert(`Couldn't cancel upscale`, 'error');
                }
            })
            .catch(error => {
                console.error('Upscale cancellation error:', error);
                showAlert('Error when canceling upscale', 'error');
            })
            .finally(() => {
                resetUI();
            });
    } else {
        resetUI();
    }
}

function resetUI() {
    isUpscaling = false;
    currentNodeId = null;
    currentPromptId = null;
    
    elements.btnUpscale.disabled = false;
    elements.progressSection.classList.add('hidden');
    elements.statusText.textContent = "Expectation...";
    elements.progressBarFill.style.width = '0%';
    
    if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
    }
}

window.deleteHistoryItem = deleteHistoryItem;
window.showHistoryParams = showHistoryParams;

window.closeModal = closeModal;

