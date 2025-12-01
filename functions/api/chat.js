// functions/api/chat.js

const CONFIG_KEY = 'ASSISTANT_CONFIG';

// POST: 聊天接口 (开放)
export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        // 1. 获取 AI 助手配置
        const config = await env.AI_CONFIG_KV.get(CONFIG_KEY, 'json');
        
        // 检查关键配置项
        if (!config || !config.apiKey || !config.apiEndpoint) {
            return new Response(JSON.stringify({
                success: false,
                message: 'AI Assistant is not configured. Please contact the administrator.',
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 503,
            });
        }

        // 使用 KV 中配置的 AI 端点
        const AI_MODEL_ENDPOINT = config.apiEndpoint; 

        // 2. 获取请求体中的消息历史 (用于关联上下文)
        const { messages } = await request.json();

        if (!messages || messages.length === 0) {
             return new Response(JSON.stringify({
                success: false,
                message: 'Message history is required.',
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        // 3. 构建发送给 AI 模型的请求体
        const systemMessage = {
            role: "system",
            content: config.systemInstruction || "You are a helpful and friendly AI assistant."
        };

        const payload = {
            model: config.model || "gpt-3.5-turbo", // 默认模型
            // 将 system 指令作为第一条消息，然后是用户/助手的历史消息
            messages: [systemMessage, ...messages], 
            // 其他参数...
        };

        // 4. 调用外部 AI API
        const aiResponse = await fetch(AI_MODEL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 假设 AI API 使用 Authorization 头部传递 Key
                'Authorization': `Bearer ${config.apiKey}`, 
            },
            body: JSON.stringify(payload),
        });

        const aiData = await aiResponse.json();
        
        // 5. 返回 AI 的回复
        const assistantMessage = aiData.choices?.[0]?.message?.content || "Sorry, I encountered an error. Check the AI API response format.";

        return new Response(JSON.stringify({
            success: true,
            reply: assistantMessage,
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (e) {
        console.error("Chat API Error:", e);
        return new Response(JSON.stringify({ 
            success: false, 
            message: `Internal Server Error: ${e.message}` 
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500,
        });
    }
}
