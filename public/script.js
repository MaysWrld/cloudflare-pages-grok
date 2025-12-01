// public/script.js (最终版本，新增 Temperature 和 Loading State)

// 存储对话历史，用于关联上下文
let conversationHistory = []; 
// 存储 Basic Auth 头部，仅用于 Admin API 调用
let basicAuthHeader = null; 

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

// --- 页面初始化和 UI 切换 ---

function toggleAdminButtons(isAdmin) {
    // 只有登录成功后，才显示配置管理和登出按钮
    logoutButton.style.display = isAdmin ? 'block' : 'none';
    // 确保 chat/login 视图正确切换
    if (document.getElementById('main-view').style.display === 'none' && !isAdmin) {
        document.getElementById('login-view').style.display = 'flex';
    }
}

function initPage() {
    // 聊天界面 (main-view) 始终可见
    document.getElementById('main-view').style.display = 'flex';
    document.getElementById('login-view').style.display = 'none';

    // 检查是否有存储的 Admin 凭证
    const authData = localStorage.getItem('basicAuth');
    if (authData) {
        basicAuthHeader = authData;
        toggleAdminButtons(true);
    } else {
        basicAuthHeader = null;
        toggleAdminButtons(false);
    }

    // 初始欢迎语
    if (conversationHistory.length === 0) {
        appendMessage({ 
            role: 'assistant', 
            content: `你好，我是你的专属 AI 助手，请开始提问吧！` 
        });
    }
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
        // 创建并显示加载消息
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

// --- 登录/登出 (仅用于 Admin 权限) ---

showConfigButton.addEventListener('click', () => {
    // 如果已登录，则直接打开配置面板
    if (basicAuthHeader) {
        adminPanel.style.display = 'flex';
        fetchConfig(); 
    } else {
        // 如果未登录，显示登录表单
        document.getElementById('login-view').style.display = 'flex';
        document.getElementById('main-view').style.display = 'none';
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    
    const authString = btoa(`${username}:${password}`);
    const authHeader = `Basic ${authString}`;

    try {
        // 调用 /api/login 验证凭证
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader // 使用 Auth 头部进行验证
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            // 登录成功，保存 Auth 头部，并切换回主界面，显示 Admin 按钮
            localStorage.setItem('basicAuth', authHeader);
            basicAuthHeader = authHeader;
            toggleAdminButtons(true);
            
            // 自动打开配置面板
            document.getElementById('login-view').style.display = 'none';
            document.getElementById('main-view').style.display = 'flex';
            adminPanel.style.display = 'flex';
            fetchConfig();

        } else {
            alert('登录失败: ' + data.message);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('登录过程中发生错误。');
    }
});

logoutButton.addEventListener('click', () => {
    localStorage.removeItem('basicAuth');
    basicAuthHeader = null;
    toggleAdminButtons(false);
    alert('已登出管理员账户。');
});


// --- 对话功能 (现在是开放的) ---

function appendMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.classList.add('message', message.role);
    messageEl.innerHTML = `<p>${message.content.replace(/\n/g, '<br>')}</p>`; 
    chatContainer.appendChild(messageEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const userMessage = messageInput.value.trim();
    if (!userMessage) return;

    // 1. 显示用户消息，并添加到历史记录
    appendMessage({ role: 'user', content: userMessage });
    conversationHistory.push({ role: 'user', content: userMessage });
    messageInput.value = '';

    // 2. 启用加载状态
    toggleLoadingState(true);

    // 3. 调用 Chat API 
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages: conversationHistory }) 
        });

        const data = await response.json();

        // 4. 关闭加载状态
        toggleLoadingState(false);
        
        if (data.success) {
            const assistantReply = data.reply;
            // 5. 显示 AI 助手回复，并添加到历史记录
            appendMessage({ role: 'assistant', content: assistantReply });
            conversationHistory.push({ role: 'assistant', content: assistantReply });
        } else {
            // 如果是 503 配置错误，给予用户提示
            const errorMsg = data.message.includes('not configured') 
                ? 'AI 助手尚未配置。请联系管理员进行设置。' 
                : data.message;
            appendMessage({ role: 'error', content: `[Error] ${errorMsg}` });
            conversationHistory.pop(); 
        }

    } catch (error) {
        console.error('Chat error:', error);
        // 4. 关闭加载状态
        toggleLoadingState(false);
        appendMessage({ role: 'error', content: `与 AI 服务通信失败：${error.message}` });
        if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
             conversationHistory.pop(); 
        }
    }
}

// --- 新建对话功能 ---
newChatButton.addEventListener('click', () => {
    // 确保在重置时没有加载状态
    toggleLoadingState(false); 
    conversationHistory = []; 
    chatContainer.innerHTML = ''; 
    // 重新初始化欢迎语
    appendMessage({ 
        role: 'assistant', 
        content: "新的对话已开始，上下文已重置。请问有什么可以帮忙的？" 
    });
});


// --- 管理面板交互和配置管理 (需要认证) ---

closeConfigButton.addEventListener('click', () => {
    adminPanel.style.display = 'none';
});

// 获取配置并填充表单
async function fetchConfig() {
    if (!basicAuthHeader) return; // 确保只有登录用户才能获取

    try {
        const response = await fetch('/api/config', {
            method: 'GET',
            headers: {
                'Authorization': basicAuthHeader // 必须使用 Basic Auth
            }
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

// 提交配置表单
configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!basicAuthHeader) return alert('请先登录管理员账户。');

    const temperatureValue = e.target.temperature.value;
    
    // 简单校验 temperature 必须是数字
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
