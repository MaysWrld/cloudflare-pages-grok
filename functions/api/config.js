// functions/api/config.js

const CONFIG_KEY = 'ASSISTANT_CONFIG';

// GET: 获取配置 (需要认证)
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

// POST: 保存/更新配置 (需要认证)
export async function post(context) {
    const { request, env } = context;
    try {
        const newConfig = await request.json();
        
        // 校验：检查所有必需字段，包括 temperature
        if (!newConfig.name || !newConfig.apiKey || !newConfig.model || !newConfig.systemInstruction || !newConfig.apiEndpoint || newConfig.temperature === undefined || newConfig.temperature === null) {
             return new Response(JSON.stringify({ 
                success: false, 
                message: 'Missing required config fields (name, apiKey, model, systemInstruction, apiEndpoint, temperature).' 
            }), { 
                headers: { 'Content-Type': 'application/json' }, 
                status: 400 
            });
        }

        // 确保 temperature 是数字
        newConfig.temperature = parseFloat(newConfig.temperature);

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
