// public/script.js (最终版本，移除欢迎语和初始消息)

// 存储对话历史，用于关联上下文
let conversationHistory = []; 
// 存储 Basic Auth 头部，仅用于 Admin API 调用
let basicAuthHeader = null; 
// 打印机效果速度（设置为最快）
const TYPING_SPEED_MS = 1; 

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
const assistantLogo = document.getElementById('assistant-logo'); 
const loginView = document.getElementById('login-view'); // 获取整个登录视图
const closeLoginButton = document.getElementById('close-login-button'); // 新增：获取登录关闭按钮

// 用于显示 AI 正在思考的加载消息的 DOM 元素
let loadingMessageEl = null; 

// --- 动画和效果函数 (typeWriterEffect, appendMessage) ---

/**
 * 实现打字机效果
 */
function typeWriterEffect(targetElement, text) {
    return new Promise(resolve => {
        let i = 0;
        
        function type() {
            if (i < text.length) {
                if (text.substring(i, i + 4) === '<br>') {
                    targetElement.innerHTML += '<br>';
                    i += 4;
                } else {
                    targetElement.innerHTML += text.charAt(i);
                    i++;
                }
                // 禁用 AI 消息展示时的自动滚动
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
 */
function appendMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.classList.add('message', message.role);

    if (message.role === 'assistant') {
        messageEl.classList.add('animate-in');
        messageEl.innerHTML = `<p></p>`;
    } else {
        messageEl.innerHTML = `<p>${message.content.replace(/\n/g, '<br>')}</p>`; 
    }
    
    // 始终在哨兵之前添加消息
    const sentinel = chatContainer.querySelector('.chat-scroll-sentinel');
    chatContainer.insertBefore(messageEl, sentinel);
    
    // *** 变更：用户消息滚动逻辑 ***
    if (message.role === 'user') {
        // 将用户消息滚动到屏幕顶部 (滚动到该元素的位置，减去一个顶部边距)
        chatContainer.scrollTo({ top: messageEl.offsetTop - 20, behavior: 'smooth' });
    } else if (message.role === 'assistant' || message.role === 'loading') {
        // AI 消息和加载消息只需要确保当前消息可见，不需要强制置顶
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    return messageEl;
}

// --- 加载状态管理 ---
function toggleLoadingState(isLoading) {
    messageInput.disabled = isLoading;
    sendButton.disabled = isLoading;
    sendButton.textContent = isLoading ? '深度思考30 秒...' : '发送';

    if (isLoading) {
        loadingMessageEl = document.createElement('div');
        loadingMessageEl.classList.add('message', 'assistant', 'loading');
        loadingMessageEl.innerHTML = `<p>深度思考30 秒... <span class="spinner">🧠</span></p>`; 
        
        const sentinel = chatContainer.querySelector('.chat-scroll-sentinel');
        chatContainer.insertBefore(loadingMessageEl, sentinel);
        
        loadingMessageEl.scrollIntoView({ behavior: 'smooth', block: 'end' });

    } else {
        if (loadingMessageEl) {
            loadingMessageEl.remove();
            loadingMessageEl = null;
        }
    }
}

// --- 页面初始化和 UI 切换 ---

function toggleAdminButtons(isAdmin) {
    logoutButton.style.display = isAdmin ? 'block' : 'none';
}

function initPage() {
    // *** 变更：主视图始终显示 ***
    document.getElementById('main-view').style.display = 'flex';
    // *** 变更：登录视图默认隐藏 ***
    loginView.style.display = 'none';

    const authData = localStorage.getItem('basicAuth');
    if (authData) {
        basicAuthHeader = authData;
        toggleAdminButtons(true);
    } else {
        basicAuthHeader = null;
        toggleAdminButtons(false);
    }
    
    fetchConfig(true);
}

// --- 事件监听器 ---

// 登录关闭按钮
closeLoginButton.addEventListener('click', () => {
    loginView.style.display = 'none';
});

showConfigButton.addEventListener('click', () => {
    // *** 变更：根据是否已登录决定显示配置面板还是登录框 ***
    if (basicAuthHeader) {
        adminPanel.style.display = 'flex';
        fetchConfig(); 
    } else {
        // 未登录时，显示登录对话框
        loginView.style.display = 'flex';
    }
});

// ... (其他事件监听器和登录/配置逻辑保持不变)

// --- 核心聊天逻辑 (保持不变) ---
async function sendMessage() {
    const userMessage = messageInput.value.trim();
    if (!userMessage) return;

    appendMessage({ role: 'user', content: userMessage }); 
    conversationHistory.push({ role: 'user', content: userMessage });
    messageInput.value = '';

    toggleLoadingState(true);

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

    toggleLoadingState(false);
    
    if (data.success) {
        const assistantReply = data.reply;
        
        const assistantMessageEl = appendMessage({ role: 'assistant', content: assistantReply });
        const textTarget = assistantMessageEl.querySelector('p');

        await new Promise(r => setTimeout(r, 500)); 

        await typeWriterEffect(textTarget, assistantReply);
        
        conversationHistory.push({ role: 'assistant', content: assistantReply.replace(/<br>/g, '\n') });
    } else {
        const errorMsg = data.message.includes('not configured') 
            ? 'AI 助手尚未配置。请联系管理员进行设置。' 
            : data.message;
        appendMessage({ role: 'error', content: `[Error] ${errorMsg}` });
        conversationHistory.pop(); 
    }
}

// ... (以下代码与上一版本相同，确保完整性) ...

newChatButton.addEventListener('click', () => {
    toggleLoadingState(false); 
    conversationHistory = []; 
    chatContainer.innerHTML = ''; 
    const sentinel = document.createElement('div');
    sentinel.classList.add('chat-scroll-sentinel');
    chatContainer.appendChild(sentinel);
});


closeConfigButton.addEventListener('click', () => {
    adminPanel.style.display = 'none';
});

/**
 * 获取配置并填充表单，或仅更新前端 Logo。
 */
async function fetchConfig(updateLogoOnly = false) {
    if (!updateLogoOnly && !basicAuthHeader) return; 
    
    const headers = updateLogoOnly && !basicAuthHeader ? {} : { 'Authorization': basicAuthHeader };

    try {
        const response = await fetch('/api/config', {
            method: 'GET',
            headers: headers
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

        if (data.success && data.config) {
            const config = data.config;
            
            if (assistantLogo && config.name) {
                assistantLogo.textContent = config.name;
            }

            if (!updateLogoOnly) {
                document.getElementById('assistant-name').value = config.name || '';
                document.getElementById('api-key').value = config.apiKey || ''; 
                document.getElementById('api-endpoint').value = config.apiEndpoint || '';
                document.getElementById('model-name').value = config.model || ''; 
                document.getElementById('temperature').value = config.temperature !== undefined && config.temperature !== null ? config.temperature : 0.7; 
                document.getElementById('system-instruction').value = config.systemInstruction || '';
            }

        } else if (!updateLogoOnly) {
            console.error('Failed to fetch config:', data.message);
        }
    } catch (error) {
        console.error('Error fetching config:', error);
        if (!updateLogoOnly) alert('无法连接到配置 API。');
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    
    const authString = btoa(`${username}:${password}`);
    const authHeader = `Basic ${authString}`;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader 
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            localStorage.setItem('basicAuth', authHeader);
            basicAuthHeader = authHeader;
            toggleAdminButtons(true);
            
            // 登录成功后，关闭登录视图，打开配置面板
            loginView.style.display = 'none';
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
            if (assistantLogo && configData.name) {
                 assistantLogo.textContent = configData.name;
            }
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
