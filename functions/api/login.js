// functions/api/login.js

// 登录处理函数
export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // 从请求体中解析用户名和密码
    const { username, password } = await request.json();

    // 检查用户名和密码是否匹配环境变量 (注意：这里需要和 _middleware.js 中的逻辑保持一致或使用相同方法)
    if (username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({
            success: true,
            message: 'Login successful.',
            // 颁发一个简单的 token，实际认证主要依赖前端存储的 username/password 进行 Basic Auth
            token: 'valid-admin-token', 
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });
    } else {
        return new Response(JSON.stringify({
            success: false,
            message: 'Invalid credentials.',
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 401,
        });
    }
}
