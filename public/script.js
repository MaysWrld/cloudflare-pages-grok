// public/script.js (最终版本，高级动画和打印机效果)

// 存储对话历史，用于关联上下文
let conversationHistory = []; 
// 存储 Basic Auth 头部，仅用于 Admin API 调用
let basicAuthHeader = null; 
// 打印机效果速度（设置为最快）
const TYPING_SPEED_MS = 1; // 1毫秒/字符

// --- DOM 元素获取 ---
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const newChatButton = document.getElementById('new-chat-button');
const showConfigButton = document.getElementById('show-config-button');
const logoutButton = document.getElementById('logout-button');
const loginForm = document.getElementById('login-form');
const configForm = document.getElementById('config-form');
const adminPanel = document.getElementById('admin-panel');
const closeConfigButton = document.getElementById('close-config-button');

// 用于显示 AI 正在思考的加载消息的 DOM 元素
let loadingMessageEl = null; 

// --- 动画和效果函数 ---

/**
 * 实现打字机效果
 * @param {HTMLElement} targetElement - 文本将写入的目标元素
 * @param {string} text - 要显示的完整文本
 */
function typeWriterEffect(targetElement, text) {
    return new Promise(resolve => {
        const fullText = text.replace(/\n/g, '<br>');
        let i = 0;
        
        function type() {
            if (i < fullText.length) {
                // 每次显示一个字符
                targetElement.innerHTML += fullText.charAt(i);
                i++;
                chatContainer.scrollTop = chatContainer.scrollHeight;
                setTimeout(type, TYPING_SPEED_MS); 
            } else {
                resolve();
            }
        }
        type();
    });
}

/**
 * 将消息添加到聊天容器
 * @param {object} message - 包含 role 和 content 的消息对象
 * @returns {HTMLElement} 新创建的消息元素
 */
function appendMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.classList.add('message', message.role);

    // AI 消息需要额外的类用于 CSS 展开动画
    if (message.role === 'assistant') {
        messageEl.classList.add('animate-in');
        // AI 消息的内容初始为空，等待打字机效果填充
        messageEl.innerHTML = `<p></p>`;
    } else {
        // 用户消息直接显示内容，依赖 CSS 动画
        messageEl.innerHTML = `<p>${message.content.replace(/\n/g, '<br>')}</p>`; 
    }
    
    chatContainer.appendChild(messageEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return messageEl;
}

// --- 加载状态管理 ---
/**
 * 切换输入区域和聊天区域的加载状态
 * @param {boolean} isLoading - 是否处于加载中
 */
function toggleLoadingState(isLoading) {
    messageInput.disabled = isLoading;
    sendButton.disabled = isLoading;
    sendButton.textContent = isLoading ? '思考中...' : '发送';

    if (isLoading) {
        // 创建并显示加载消息 (具有呼吸动画)
        loadingMessageEl = document.createElement('div');
        loadingMessageEl.classList.add('message', 'assistant', 'loading');
        loadingMessageEl.innerHTML = `<p>正在思考... <span class="spinner">🧠</span></p>`; 
        chatContainer.appendChild(loadingMessageEl);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } else {
        // 移除加载消息
        if (loadingMessageEl) {
            loadingMessageEl.remove();
            loadingMessageEl = null;
        }
    }
}

// --- 页面初始化和 UI 切换 (保持不变) ---

function toggleAdminButtons(isAdmin) {
    logoutButton.style.display = isAdmin ? 'block' : 'none';
    if (document.getElementById('main-view').style.display === 'none' && !isAdmin) {
        document.getElementById('login-view').style.display = 'flex';
    }
}

function initPage() {
    document.getElementById('main-view').style.display = 'flex';
    document.getElementById('login-view').style.display = 'none';

    const authData = localStorage.getItem('basicAuth');
    if (authData) {
        basicAuthHeader = authData;
        toggleAdminButtons(true);
    } else {
        basicAuthHeader = null;
        toggleAdminButtons(false);
    }

    if (conversationHistory.length === 0) {
        // 初始消息直接显示，不需要动画
        const welcomeEl = appendMessage({ 
            role: 'assistant', 
            content: `你好，我是你的专属 AI 助手，请开始提问吧！` 
        });
        // 移除初始消息的动画类，让它直接可见
        welcomeEl.classList.remove('animate-in'); 
        welcomeEl.style.opacity = 1;
        welcomeEl.style.width = 'auto'; 
    }
}


sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// --- 核心聊天逻辑 ---
async function sendMessage() {
    const userMessage = messageInput.value.trim();
    if (!userMessage) return;

    // 1. 显示用户消息，并添加到历史记录
    // appendMessage 现在会自动应用 CSS 漂移动画
    appendMessage({ role: 'user', content: userMessage }); 
    conversationHistory.push({ role: 'user', content: userMessage });
    messageInput.value = '';

    // 2. 启用加载状态 (显示呼吸动画)
    toggleLoadingState(true);

    // 3. 调用 Chat API 
    let response;
    let data;

    try {
        response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: conversationHistory }) 
        });

        data = await response.json();
    } catch (error) {
        console.error('Chat error:', error);
        toggleLoadingState(false);
        appendMessage({ role: 'error', content: `与 AI 服务通信失败：${error.message}` });
        if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
             conversationHistory.pop(); 
        }
        return;
    }

    // 4. 关闭加载状态
    toggleLoadingState(false);
    
    if (data.success) {
        const assistantReply = data.reply;
        
        // 5. 创建 AI 消息元素 (应用展开动画)
        const assistantMessageEl = appendMessage({ role: 'assistant', content: assistantReply });
        const textTarget = assistantMessageEl.querySelector('p');

        // 6. 等待 CSS 展开动画完成 (可选，但推荐)
        await new Promise(r => setTimeout(r, 500)); 

        // 7. 使用打印机效果显示文本
        await typeWriterEffect(textTarget, assistantReply);
        
        // 8. 添加到历史记录
        conversationHistory.push({ role: 'assistant', content: assistantReply });
    } else {
        const errorMsg = data.message.includes('not configured') 
            ? 'AI 助手尚未配置。请联系管理员进行设置。' 
            : data.message;
        appendMessage({ role: 'error', content: `[Error] ${errorMsg}` });
        conversationHistory.pop(); 
    }
}

// --- 新建对话功能 (保持不变) ---
newChatButton.addEventListener('click', () => {
    toggleLoadingState(false); 
    conversationHistory = []; 
    chatContainer.innerHTML = ''; 
    
    // 重新初始化欢迎语 (确保没有动画)
    const welcomeEl = appendMessage({ 
        role: 'assistant', 
        content: "新的对话已开始，上下文已重置。请问有什么可以帮忙的？" 
    });
    welcomeEl.classList.remove('animate-in'); 
    welcomeEl.style.opacity = 1;
    welcomeEl.style.width = 'auto'; 
});


// --- 管理面板交互和配置管理 (保持不变) ---

closeConfigButton.addEventListener('click', () => {
    adminPanel.style.display = 'none';
});

// 获取配置并填充表单 (保持不变)
async function fetchConfig() {
    if (!basicAuthHeader) return; 

    try {
        const response = await fetch('/api/config', {
            method: 'GET',
            headers: { 'Authorization': basicAuthHeader }
        });
        
        if (response.status === 401) {
            alert('管理员登录已过期，请重新登录。');
            localStorage.removeItem('basicAuth');
            basicAuthHeader = null;
            toggleAdminButtons(false);
            adminPanel.style.display = 'none';
            return;
        }

        const data = await response.json();

        if (data.success && data.config) {
            const config = data.config;
            document.getElementById('assistant-name').value = config.name || '';
            document.getElementById('api-key').value = config.apiKey || ''; 
            document.getElementById('api-endpoint').value = config.apiEndpoint || '';
            document.getElementById('model-name').value = config.model || ''; 
            document.getElementById('temperature').value = config.temperature !== undefined && config.temperature !== null ? config.temperature : 0.7; 
            document.getElementById('system-instruction').value = config.systemInstruction || '';
        } else {
            console.error('Failed to fetch config:', data.message);
        }
    } catch (error) {
        console.error('Error fetching config:', error);
        alert('无法连接到配置 API。');
    }
}

// 提交配置表单 (保持不变)
configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!basicAuthHeader) return alert('请先登录管理员账户。');

    const temperatureValue = e.target.temperature.value;
    
    if (isNaN(parseFloat(temperatureValue))) {
        alert('温度设置必须是一个数字！');
        return;
    }
    
    const configData = {
        name: e.target.name.value,
        apiKey: e.target.apiKey.value, 
        apiEndpoint: e.target.apiEndpoint.value, 
        model: e.target.model.value,
        temperature: parseFloat(temperatureValue), 
        systemInstruction: e.target.systemInstruction.value,
    };

    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': basicAuthHeader
            },
            body: JSON.stringify(configData)
        });

        const data = await response.json();

        if (response.status === 401) {
             alert('管理员登录已过期，请重新登录。');
             localStorage.removeItem('basicAuth');
             basicAuthHeader = null;
             toggleAdminButtons(false);
             adminPanel.style.display = 'none';
             return;
        }

        if (data.success) {
            alert('配置保存成功！');
            adminPanel.style.display = 'none';
        } else {
            alert('保存配置失败: ' + data.message);
        }
    } catch (error) {
        console.error('Save config error:', error);
        alert('保存配置过程中发生错误。');
    }
});


// 页面加载时执行初始化
initPage();
