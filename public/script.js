// public/script.js (重构版)

// --- 全局状态 ---
let conversationHistory = []; 
let basicAuthHeader = null; 
const TYPING_SPEED_MS = 1; // 调整打字速度，防止过快无法观察效果

// --- DOM 元素映射 ---
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const sidebar = document.getElementById('sidebar');
const assistantLogo = document.getElementById('assistant-logo');
const mobileLogo = document.getElementById('mobile-logo');

// 模态框相关
const modalOverlay = document.getElementById('modal-overlay');
const loginCard = document.getElementById('login-card');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const configForm = document.getElementById('config-form');

// 按钮
const newChatButton = document.getElementById('new-chat-button');
const showConfigButton = document.getElementById('show-config-button');
const logoutButton = document.getElementById('logout-button');
const toggleSidebarButton = document.getElementById('toggle-sidebar');


let loadingMessageEl = null; 
let countdownInterval = null; 

// --- 工具函数 ---

/**
 * 切换模态框显示状态
 * @param {string} cardId - 要显示的卡片ID ('login-card' 或 'admin-panel')
 */
function showModal(cardId) {
    modalOverlay.style.display = 'flex';
    loginCard.style.display = (cardId === 'login-card') ? 'block' : 'none';
    adminPanel.style.display = (cardId === 'admin-panel') ? 'block' : 'none';
}

function hideModal() {
    modalOverlay.style.display = 'none';
    loginCard.style.display = 'none';
    adminPanel.style.display = 'none';
}

/**
 * 切换侧边栏状态（仅限移动端）
 */
function toggleSidebar() {
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
        const isOpen = sidebar.classList.contains('open');
        toggleSidebarButton.textContent = isOpen ? '✕' : '☰';
        document.body.style.overflow = isOpen ? 'hidden' : '';
    }
}

/**
 * 实现打字机效果
 */
function typeWriterEffect(targetElement, text) {
    // 确保内容显示前清空
    targetElement.innerHTML = ''; 
    return new Promise(resolve => {
        let i = 0;
        
        function type() {
            if (i < text.length) {
                // 处理 <br> 标签
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
 * @param {object} message - { role: 'user'/'assistant'/'error'/'loading', content: string }
 */
function appendMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.classList.add('message', message.role);

    if (message.role === 'assistant' || message.role === 'error' || message.role === 'user') {
        // 修复：消息内容只在非加载状态时写入 p 标签
        const content = message.content.replace(/\n/g, '<br>');
        messageEl.innerHTML = `<p>${content}</p>`;
        messageEl.classList.add('animate-in');
    }
    
    // 始终在哨兵之前添加消息
    const sentinel = chatContainer.querySelector('.chat-scroll-sentinel');
    chatContainer.insertBefore(messageEl, sentinel);
    
    // 滚动逻辑：用户消息置顶，加载消息置底确保可见
    if (message.role === 'user' || message.role === 'error' || message.role === 'loading') {
        requestAnimationFrame(() => {
            // 用户消息和加载消息置顶或置底
            messageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    return messageEl;
}

/**
 * 状态管理
 */
function toggleLoadingState(isLoading) {
    messageInput.disabled = isLoading;
    sendButton.disabled = isLoading;
    
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    if (isLoading) {
        let count = 30;
        
        loadingMessageEl = appendMessage({ role: 'loading', content: `深度思考中，预计 ${count} 秒...` });
        
        const updateCountdown = () => {
            count--;
            if (loadingMessageEl) {
                if (count >= 0) {
                    loadingMessageEl.querySelector('p').textContent = `深度思考中，预计 ${count} 秒...`;
                } else {
                    loadingMessageEl.querySelector('p').textContent = `深度思考中，请稍候...`;
                    clearInterval(countdownInterval);
                }
            }
        };

        countdownInterval = setInterval(updateCountdown, 1000);
        sendButton.textContent = '思考中...';
    } else {
        sendButton.textContent = '发送';
        if (loadingMessageEl) {
            loadingMessageEl.remove();
            loadingMessageEl = null;
        }
    }
}

// --- 核心业务逻辑 ---

/**
 * 认证和 UI 管理
 */
function updateAdminUI(isLoggedIn) {
    logoutButton.style.display = isLoggedIn ? 'block' : 'none';
}

function updateLogoName(name) {
    if (assistantLogo) assistantLogo.textContent = name;
    if (mobileLogo) mobileLogo.textContent = name;
}

function initPage() {
    const authData = localStorage.getItem('basicAuth');
    if (authData) {
        basicAuthHeader = authData;
        updateAdminUI(true);
        // 尝试获取配置以更新 Logo
        fetchConfig(true); 
    } else {
        basicAuthHeader = null;
        updateAdminUI(false);
    }
}

/**
 * 聊天功能
 */
async function sendMessage() {
    const userMessage = messageInput.value.trim();
    if (!userMessage) return;

    appendMessage({ role: 'user', content: userMessage }); 
    conversationHistory.push({ role: 'user', content: userMessage });
    messageInput.value = '';

    toggleLoadingState(true);

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: conversationHistory }) 
        });

        if (response.status === 401 && !basicAuthHeader) {
            throw new Error('聊天 API 未授权。');
        }

        const data = await response.json();
        
        if (data.success) {
            const assistantReply = data.reply;
            
            // 1. 移除加载状态
            toggleLoadingState(false);

            // 2. 添加 AI 消息，并开始打字机效果
            const assistantMessageEl = appendMessage({ role: 'assistant', content: '' }); // 空内容，等待打字机填充
            const textTarget = assistantMessageEl.querySelector('p');

            await typeWriterEffect(textTarget, assistantReply);
            
            // 3. 更新历史记录
            conversationHistory.push({ role: 'assistant', content: assistantReply.replace(/<br>/g, '\n') });
            
            // 4. AI 消息置顶
            requestAnimationFrame(() => {
                 assistantMessageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });

        } else {
            throw new Error(data.message.includes('not configured') 
                ? 'AI 助手尚未配置。请联系管理员设置。' 
                : data.message);
        }
    } catch (error) {
        console.error('Chat error:', error);
        toggleLoadingState(false);
        appendMessage({ role: 'error', content: `[Error] ${error.message}` });
        // 失败时移除最后一条用户消息
        if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
             conversationHistory.pop(); 
        }
    }
}

/**
 * 配置管理
 */
async function fetchConfig(updateLogoOnly = false) {
    if (!basicAuthHeader) return;
    
    try {
        const response = await fetch('/api/config', {
            method: 'GET',
            headers: { 'Authorization': basicAuthHeader }
        });
        
        if (response.status === 401) {
            throw new Error('登录已过期，请重新登录。');
        }

        const data = await response.json();

        if (data.success && data.config) {
            const config = data.config;
            
            updateLogoName(config.name || 'AI Assistant');

            if (!updateLogoOnly) {
                // 填充表单
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
        if (error.message.includes('过期')) {
            alert(error.message);
            localStorage.removeItem('basicAuth');
            basicAuthHeader = null;
            updateAdminUI(false);
            hideModal();
        } else if (!updateLogoOnly) {
            alert('无法连接到配置 API。');
        }
    }
}


// --- 事件监听器 ---

// 聊天输入/发送
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendButton.disabled) sendMessage();
    }
});

// 模态框关闭
document.querySelectorAll('.close-button').forEach(btn => {
    btn.addEventListener('click', hideModal);
});

// 新建对话
newChatButton.addEventListener('click', () => {
    toggleLoadingState(false); 
    conversationHistory = []; 
    chatContainer.innerHTML = '<div class="chat-scroll-sentinel"></div>'; 
});

// 显示配置/登录
showConfigButton.addEventListener('click', () => {
    // 手机端点击后关闭侧边栏
    if (sidebar.classList.contains('open')) {
        toggleSidebar();
    }
    
    if (basicAuthHeader) {
        showModal('admin-panel');
        fetchConfig(); 
    } else {
        showModal('login-card');
    }
});

// 侧边栏伸缩
toggleSidebarButton.addEventListener('click', toggleSidebar);

// 侧边栏按钮点击后关闭侧边栏
sidebar.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && e.target.classList.contains('sidebar-button')) {
        setTimeout(toggleSidebar, 300); 
    }
});


// 登录
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
            updateAdminUI(true);
            
            hideModal();
            showModal('admin-panel');
            fetchConfig();

        } else {
            alert('登录失败: ' + data.message);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('登录过程中发生错误。');
    }
});

// 登出
logoutButton.addEventListener('click', () => {
    localStorage.removeItem('basicAuth');
    basicAuthHeader = null;
    updateAdminUI(false);
    alert('已登出管理员账户。');
});

// 保存配置
configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!basicAuthHeader) return alert('请先登录管理员账户。');

    const configData = {
        name: e.target.name.value,
        apiKey: e.target.apiKey.value, 
        apiEndpoint: e.target.apiEndpoint.value, 
        model: e.target.model.value,
        temperature: parseFloat(e.target.temperature.value), 
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

        if (response.status === 401) {
             throw new Error('登录已过期，请重新登录。');
        }

        const data = await response.json();

        if (data.success) {
            alert('配置保存成功！');
            updateLogoName(configData.name);
            hideModal();
        } else {
            alert('保存配置失败: ' + data.message);
        }
    } catch (error) {
        console.error('Save config error:', error);
        if (error.message.includes('过期')) {
            alert(error.message);
            localStorage.removeItem('basicAuth');
            basicAuthHeader = null;
            updateAdminUI(false);
            hideModal();
        } else {
            alert('保存配置过程中发生错误。');
        }
    }
});


// 页面加载时执行初始化
initPage();
