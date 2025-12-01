// public/script.js

// 存储对话历史，用于关联上下文
let conversationHistory = []; 
// 存储 Basic Auth 头部，用于后续 API 调用
let basicAuthHeader = null; 

// --- DOM 元素获取 ---
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const newChatButton = document.getElementById('new-chat-button');
const showConfigButton = document.getElementById('show-config-button');
const closeConfigButton = document.getElementById('close-config-button');
const logoutButton = document.getElementById('logout-button');
const loginForm = document.getElementById('login-form');
const configForm = document.getElementById('config-form');

// --- 身份验证和页面初始化 ---

function checkLoginStatus() {
    // 检查 localStorage 中是否有 auth 信息
    const authData = localStorage.getItem('basicAuth');
    if (authData) {
        basicAuthHeader = authData;
        showChatInterface();
    } else {
        showLoginForm();
    }
}

function showLoginForm() {
    document.getElementById('login-view').style.display = 'flex'; // 使用 flex 使卡片居中
    document.getElementById('main-view').style.display = 'none';
}

async function showChatInterface() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('main-view').style.display = 'flex';
    
    // 尝试获取配置中的助手名称，用于欢迎语
    let assistantName = "AI 助手";
    try {
        const response = await fetch('/api/config', {
            method: 'GET',
            headers: { 'Authorization': basicAuthHeader }
        });
        const data = await response.json();
        if (data.success && data.config && data.config.name) {
            assistantName = data.config.name;
        }
    } catch (e) {
        console.warn('Could not fetch assistant name on load.');
    }

    // 初始欢迎语
    if (conversationHistory.length === 0) {
        appendMessage({ 
            role: 'assistant', 
            content: `你好，我是你的专属 ${assistantName}，请开始提问吧！` 
        });
    }
}

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
                // 使用 Auth 头部进行验证
                'Authorization': authHeader
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            // 登录成功，保存 Auth 头部，并切换到聊天界面
            localStorage.setItem('basicAuth', authHeader);
            basicAuthHeader = authHeader;
            showChatInterface();
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
    conversationHistory = [];
    chatContainer.innerHTML = '';
    showLoginForm();
});

// --- 对话功能 ---

function appendMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.classList.add('message', message.role);
    // 简单的文本内容处理
    messageEl.innerHTML = `<p>${message.content.replace(/\n/g, '<br>')}</p>`; 
    chatContainer.appendChild(messageEl);
    // 滚动到底部
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

    // 2. 调用 Chat API
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // **关键：使用 Basic Auth 头部保护 API**
                'Authorization': basicAuthHeader 
            },
            // **关键：发送完整的历史记录以关联上下文**
            body: JSON.stringify({ messages: conversationHistory }) 
        });

        const data = await response.json();

        if (response.status === 401) {
            throw new Error("Unauthorized. Please log in again.");
        }
        
        if (data.success) {
            const assistantReply = data.reply;
            // 3. 显示 AI 助手回复，并添加到历史记录
            appendMessage({ role: 'assistant', content: assistantReply });
            conversationHistory.push({ role: 'assistant', content: assistantReply });
        } else {
            appendMessage({ role: 'error', content: `[Error] ${data.message}` });
            // 如果 API 失败，移除最后一条用户消息，因为它未被处理
            conversationHistory.pop(); 
        }

    } catch (error) {
        console.error('Chat error:', error);
        appendMessage({ role: 'error', content: `与 AI 服务通信失败或身份验证失败：${error.message}` });
        if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
             conversationHistory.pop(); 
        }
    }
}

// --- 新建对话功能 ---
newChatButton.addEventListener('click', () => {
    conversationHistory = []; // **关键：清空历史记录，实现新建对话和上下文重置**
    chatContainer.innerHTML = ''; // 清空聊天界面
    showChatInterface(); // 重新显示欢迎语
});


// --- 管理面板交互和配置管理 ---

showConfigButton.addEventListener('click', () => {
    document.getElementById('admin-panel').style.display = 'flex';
    fetchConfig(); // 每次打开时获取最新配置
});

closeConfigButton.addEventListener('click', () => {
    document.getElementById('admin-panel').style.display = 'none';
});

// 获取配置并填充表单
async function fetchConfig() {
    try {
        const response = await fetch('/api/config', {
            method: 'GET',
            headers: {
                'Authorization': basicAuthHeader // 使用 Basic Auth
            }
        });
        const data = await response.json();

        if (data.success && data.config) {
            const config = data.config;
            document.getElementById('assistant-name').value = config.name || '';
            document.getElementById('api-key').value = config.apiKey || ''; 
            document.getElementById('model-select').value = config.model || 'gpt-4o'; // 默认值
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

    const configData = {
        name: e.target.name.value,
        // 注意：如果你不想在前端保存 API Key，你需要在后端做特殊处理，
        // 这里假设是直接发送并覆盖 KV 存储中的值。
        apiKey: e.target.apiKey.value, 
        model: e.target.model.value,
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

        if (data.success) {
            alert('配置保存成功！');
            document.getElementById('admin-panel').style.display = 'none';
        } else {
            alert('保存配置失败: ' + data.message);
        }
    } catch (error) {
        console.error('Save config error:', error);
        alert('保存配置过程中发生错误。');
    }
});


// 页面加载时检查登录状态
checkLoginStatus();
