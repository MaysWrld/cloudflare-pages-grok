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
const assistantLogo = document.getElementById('assistant-logo'); // 新增: 获取 Logo 元素

// 用于显示 AI 正在思考的加载消息的 DOM 元素
let loadingMessageEl = null; 

// --- 动画和效果函数 ---

/**
 * 实现打字机效果
 * @param {HTMLElement} targetElement - 文本将写入的目标元素
 * @param {string} text - 要显示的完整文本 (已包含 <br> 标签)
 */
function typeWriterEffect(targetElement, text) {
    return new Promise(resolve => {
        let i = 0;
        
        function type() {
            if (i < text.length) {
                // 如果遇到 <br>，跳过它，并在下次循环中处理
                if (text.substring(i, i + 4) === '<br>') {
                    targetElement.innerHTML += '<br>';
                    i += 4;
                } else {
                    targetElement.innerHTML += text.charAt(i);
                    i++;
                }
                // *** 移除：禁用 AI 消息展示时的自动滚动 ***
                // chatContainer.scrollTop = chatContainer.scrollHeight; 
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

    if (message.role === 'assistant') {
        messageEl.classList.add('animate-in');
        messageEl.innerHTML = `<p></p>`;
    } else {
        messageEl.innerHTML = `<p>${message.content.replace(/\n/g, '<br>')}</p>`; 
    }
    
    chatContainer.appendChild(messageEl);
    
    // *** 变更：如果是用户消息，将其滚动到顶部 ***
    if (message.role === 'user') {
        // 滚动到顶部，让 AI 有足够的空间显示回复
        chatContainer.scrollTo({ top: messageEl.offsetTop - 20, behavior: 'smooth' });
    } else if (message.role !== 'loading') {
        // AI 的最终回复不滚动
        return messageEl;
    }
    
    // 确保其他情况滚动到底部（如加载消息）
    if (message.role === 'assistant' || message.role === 'error' || message.role === 'loading') {
         chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    return messageEl;
}

// --- 加载状态管理 ---
function toggleLoadingState(isLoading) {
    messageInput.disabled = isLoading;
    sendButton.disabled = isLoading;
    // *** 变更：修改加载文本 ***
    sendButton.textContent = isLoading ? '深度思考30 秒...' : '发送';

    if (isLoading) {
        loadingMessageEl = document.createElement('div');
        loadingMessageEl.classList.add('message', 'assistant', 'loading');
        // *** 变更：修改加载文本 ***
        loadingMessageEl.innerHTML = `<p>深度思考30 秒... <span class="spinner">🧠</span></p>`; 
        chatContainer.appendChild(loadingMessageEl);
        chatContainer.scrollTop = chatContainer.scrollHeight;
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
    
    // 页面初始化时尝试获取配置，以显示正确的助手名称
    fetchConfig(true);
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

    // 1. 显示用户消息，并滚动到顶部
    appendMessage({ role: 'user', content: userMessage }); 
    conversationHistory.push({ role: 'user', content: userMessage });
    messageInput.value = '';

    // 2. 启用加载状态
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

    // 3. 关闭加载状态
    toggleLoadingState(false);
    
    if (data.success) {
        const assistantReply = data.reply;
        
        // 4. 创建 AI 消息元素 (应用展开动画)
        const assistantMessageEl = appendMessage({ role: 'assistant', content: assistantReply });
        const textTarget = assistantMessageEl.querySelector('p');

        await new Promise(r => setTimeout(r, 500)); 

        // 5. 使用打印机效果显示文本
        await typeWriterEffect(textTarget, assistantReply);
        
        // 6. 添加到历史记录
        conversationHistory.push({ role: 'assistant', content: assistantReply.replace(/<br>/g, '\n') });
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
});


// --- 管理面板交互和配置管理 ---

closeConfigButton.addEventListener('click', () => {
    adminPanel.style.display = 'none';
});

/**
 * 获取配置并填充表单，或仅更新前端 Logo。
 * @param {boolean} updateLogoOnly - 是否只更新 Logo，不显示面板。
 */
async function fetchConfig(updateLogoOnly = false) {
    // 如果不是仅更新 Logo，且未登录，则直接返回
    if (!updateLogoOnly && !basicAuthHeader) return; 
    
    // 如果仅更新 Logo，不需认证
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
            
            // *** 变更：更新前端助手名称 ***
            if (assistantLogo && config.name) {
                assistantLogo.textContent = config.name;
            }

            if (!updateLogoOnly) {
                // 填充表单（仅在打开面板时）
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

showConfigButton.addEventListener('click', () => {
    if (basicAuthHeader) {
        adminPanel.style.display = 'flex';
        fetchConfig(); // 再次调用以确保配置数据最新
    } else {
        document.getElementById('login-view').style.display = 'flex';
        document.getElementById('main-view').style.display = 'none';
    }
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
            // 保存成功后立即更新 Logo
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
