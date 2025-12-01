// functions/api/config.js

const CONFIG_KEY = 'ASSISTANT_CONFIG';

// GET: 获取配置
export async function get(context) {
    const { env } = context;
    try {
        const config = await env.AI_CONFIG_KV.get(CONFIG_KEY, 'json');
        return new Response(JSON.stringify({ 
            success: true, 
            config: config || {} 
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (e) {
        return new Response(JSON.stringify({ 
            success: false, 
            message: e.message 
        }), { 
            headers: { 'Content-Type': 'application/json' }, 
            status: 500 
        });
    }
}

// POST: 保存/更新配置
export async function post(context) {
    const { request, env } = context;
    try {
        const newConfig = await request.json();
        
        // 简单的数据结构校验
        if (!newConfig.name || !newConfig.apiKey || !newConfig.model || !newConfig.systemInstruction) {
             return new Response(JSON.stringify({ 
                success: false, 
                message: 'Missing required config fields.' 
            }), { 
                headers: { 'Content-Type': 'application/json' }, 
                status: 400 
            });
        }

        await env.AI_CONFIG_KV.put(CONFIG_KEY, JSON.stringify(newConfig));

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Configuration saved successfully.' 
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (e) {
        return new Response(JSON.stringify({ 
            success: false, 
            message: e.message 
        }), { 
            headers: { 'Content-Type': 'application/json' }, 
            status: 500 
        });
    }
}

// 暴露 GET 和 POST 方法
export { get as onRequestGet, post as onRequestPost };
