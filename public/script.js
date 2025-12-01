// public/script.js (最终修复版本)

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
const loginView = document.getElementById('login-view'); 
const closeLoginButton = document.getElementById('close-login-button');

// 侧边栏伸缩元素
const sidebar = document.querySelector('.sidebar');
const toggleSidebarButton = document.getElementById('toggle-sidebar');


// 用于显示 AI 正在思考的加载消息的 DOM 元素
let loadingMessageEl = null; 
let countdownInterval = null; // 倒计时计时器

// --- 动画和效果函数 ---

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
    
    const sentinel = chatContainer.querySelector('.chat-scroll-sentinel');
    chatContainer.insertBefore(messageEl, sentinel);
    
    // 滚动逻辑：仅在用户发送消息时强制置顶
    if (message.role === 'user') {
        requestAnimationFrame(() => {
            messageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    } 
    // AI 消息和加载消息，只需要确保其在视口内即可
    else if (message.role === 'assistant' || message.role === 'loading') {
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    return messageEl;
}

// --- 加载状态管理 ---
function toggleLoadingState(isLoading) {
    messageInput.disabled = isLoading;
    sendButton.disabled = isLoading;
    
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    if (isLoading) {
        let count = 30;
        
        loadingMessageEl = document.createElement('div');
        loadingMessageEl.classList.add('message', 'assistant', 'loading');
        
        const updateCountdown = () => {
            loadingMessageEl.innerHTML = `<p>深度思考中，预计 ${count} 秒...</p>`; 
            count--;
            if (count < 0) {
                loadingMessageEl.innerHTML = `<p>深度思考中，请稍候... </p>`;
                clearInterval(countdownInterval);
            }
        };

        const sentinel = chatContainer.querySelector('.chat-scroll-sentinel');
        chatContainer.insertBefore(loadingMessageEl, sentinel);
        
        updateCountdown();
        countdownInterval = setInterval(updateCountdown, 1000);

        sendButton.textContent = '思考中...';
        loadingMessageEl.scrollIntoView({ behavior: 'smooth', block: 'end' });

    } else {
        sendButton.textContent = '发送';
        if (loadingMessageEl) {
            loadingMessageEl.remove();
            loadingMessageEl = null;
        }
    }
}

// --- 伸缩侧边栏逻辑 ---
function toggleSidebar() {
    // 仅在移动设备上执行伸缩
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
        if (sidebar.classList.contains('open')) {
            toggleSidebarButton.textContent = '✕'; 
            // 阻止主页面滚动
            document.body.style.overflow = 'hidden'; 
        } else {
            toggleSidebarButton.textContent = '☰';
            // 恢复主页面滚动
            document.body.style.overflow = ''; 
        }
    }
}


// --- 页面初始化和 UI 切换 ---

function toggleAdminButtons(isAdmin) {
    logoutButton.style.display = isAdmin ? 'block' : 'none'; 
}

function initPage() {
    document.getElementById('main-view').style.display = 'flex';
    
    loginView.style.display = 'none';

    const authData = localStorage.getItem('basicAuth');
    if (authData) {
        basicAuthHeader = authData;
        toggleAdminButtons(true);
    } else {
        basicAuthHeader = null;
        toggleAdminButtons(false);
    }
    
    // 仅在已登录时尝试获取配置
    if (basicAuthHeader) {
        fetchConfig(true); 
    }
}

// --- 事件监听器 ---

// 核心发送消息功能
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

toggleSidebarButton.addEventListener('click', toggleSidebar);

// 点击侧边栏内的任意按钮后自动关闭侧边栏（增强移动端体验）
sidebar.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && e.target.classList.contains('sidebar-button')) {
        setTimeout(toggleSidebar, 300); 
    }
});


closeLoginButton.addEventListener('click', () => {
    loginView.style.display = 'none';
});

showConfigButton.addEventListener('click', () => {
    if (basicAuthHeader) {
        adminPanel.style.display = 'flex';
        fetchConfig(); 
    } else {
        loginView.style.display = 'flex';
    }
    // 如果是手机端，点击配置后自动关闭侧边栏
    if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
        setTimeout(toggleSidebar, 100); 
    }
});

// --- 核心聊天逻辑 ---
async function sendMessage() {
    const userMessage = messageInput.value.trim();
    if (!userMessage) return;

    const userMessageEl = appendMessage({ role: 'user', content: userMessage }); 
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

        if (response.status === 401 && !basicAuthHeader) {
            toggleLoadingState(false);
            appendMessage({ role: 'error', content: '聊天 API 未授权。请联系管理员或检查配置。' });
            conversationHistory.pop();
            return;
        }

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
        
        // AI 回复完成后，将 AI 消息置顶
        requestAnimationFrame(() => {
             assistantMessageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

    } else {
        const errorMsg = data.message.includes('not configured') 
            ? 'AI 助手尚未配置。请联系管理员进行设置。' 
            : data.message;
        appendMessage({ role: 'error', content: `[Error] ${errorMsg}` });
        conversationHistory.pop(); 
    }
}

// --- 新建对话功能 ---
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
    if (!basicAuthHeader) {
        return; 
    }
    
    const headers = { 'Authorization': basicAuthHeader };

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
