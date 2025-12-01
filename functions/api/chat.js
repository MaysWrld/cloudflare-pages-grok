// functions/api/chat.js

const CONFIG_KEY = 'ASSISTANT_CONFIG';

/**
 * 格式化 AI 返回的纯文本，使其在 HTML 中更易读。
 * 主要将换行符转换为 <br> 标签。
 * @param {string} text - AI 返回的原始文本
 * @returns {string} 格式化后的 HTML 字符串
 */
function formatResponseText(text) {
    if (!text) return '';
    // 将双换行符 (\n\n) 转换为两个 <br> 标签，模拟段落分隔
    let formattedText = text.replace(/\n\s*\n/g, '<br><br>');
    // 将单换行符 (\n) 转换为 <br> 标签
    formattedText = formattedText.replace(/\n/g, '<br>');
    return formattedText;
}


// POST: 聊天接口 (开放)
export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        // 1. 获取 AI 助手配置
        const config = await env.AI_CONFIG_KV.get(CONFIG_KEY, 'json');
        
        if (!config || !config.apiKey || !config.apiEndpoint) {
            return new Response(JSON.stringify({
                success: false,
                message: 'AI Assistant is not configured. Please contact the administrator.',
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 503,
            });
        }

        const AI_MODEL_ENDPOINT = config.apiEndpoint; 

        // 2. 获取请求体中的消息历史
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
            model: config.model || "grok-4", 
            messages: [systemMessage, ...messages], 
            temperature: config.temperature !== undefined && config.temperature !== null ? parseFloat(config.temperature) : 0.7,
            // Grok API 示例中的 stream: false 
            stream: false, 
        };

        // 4. 调用外部 AI API
        const aiResponse = await fetch(AI_MODEL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`, 
            },
            body: JSON.stringify(payload),
        });

        const aiData = await aiResponse.json();
        
        // 5. 返回 AI 的回复
        const rawContent = aiData.choices?.[0]?.message?.content;
        
        if (!rawContent) {
            // 如果 API 返回空内容或错误格式，返回错误
            const errorMessage = aiData.error?.message || "Received invalid response from AI API.";
             return new Response(JSON.stringify({
                success: false,
                message: errorMessage,
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 502,
            });
        }

        // *** 格式化文本 ***
        const formattedReply = formatResponseText(rawContent);


        return new Response(JSON.stringify({
            success: true,
            reply: formattedReply, // 返回格式化后的 HTML 字符串
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
