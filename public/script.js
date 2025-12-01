// public/script.js

// 存储对话历史，用于关联上下文
let conversationHistory = []; 
// 存储 Basic Auth 头部，用于后续 API 调用
let basicAuthHeader = null; 

const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const newChatButton = document.getElementById('new-chat-button');
const loginForm = document.getElementById('login-form');
const adminPanel = document.getElementById('admin-panel');
const configForm = document.getElementById('config-form');

// --- 身份验证和页面初始化 ---

// 检查是否已登录 (例如检查 localStorage 中是否有 auth 信息)
function checkLoginStatus() {
    // 实际项目中，更安全的方法是使用 JWT 或 Session ID，这里简化为 Basic Auth
    const authData = localStorage.getItem('basicAuth');
    if (authData) {
        basicAuthHeader = authData;
        showChatInterface();
    } else {
        showLoginForm();
    }
}

function showLoginForm() {
    document.getElementById('login-view').style.display = 'block';
    document.getElementById('main-view').style.display = 'none';
}

function showChatInterface() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('main-view').style.display = 'flex'; // 或 block
    // 初始化对话，显示 AI 名称
    appendMessage({ 
        role: 'assistant', 
        content: "你好，我是你的专属 AI 助手，请开始提问吧！" 
    });
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    
    // 构建 Basic Auth 头部的值
    const authString = btoa(`${username}:${password}`);
    const authHeader = `Basic ${authString}`;

    try {
        // 调用 /api/login 验证凭证
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 即使是 login 接口，也建议带上 Basic Auth
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

// --- 对话功能 ---

function appendMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.classList.add('message', message.role);
    // 使用简单的 Markdown 解析，或者直接显示文本
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
                // 使用保存的 Basic Auth 头部进行身份验证
                'Authorization': basicAuthHeader
            },
            // **关键：发送完整的历史记录以关联上下文**
            body: JSON.stringify({ messages: conversationHistory }) 
        });

        const data = await response.json();

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
        appendMessage({ role: 'error', content: '与 AI 服务通信失败。' });
        conversationHistory.pop();
    }
}

// --- 新建对话功能 ---
newChatButton.addEventListener('click', () => {
    conversationHistory = []; // **关键：清空历史记录，实现新建对话和上下文重置**
    chatContainer.innerHTML = ''; // 清空聊天界面
    appendMessage({ 
        role: 'assistant', 
        content: "新的对话已开始，上下文已重置。请问有什么可以帮忙的？" 
    });
});

// --- 管理面板 (配置) 略 ---
// 你可以添加逻辑来展示 configForm，并使用 basicAuthHeader 调用 /api/config 接口来获取和保存配置。

// 页面加载时检查登录状态
checkLoginStatus();
