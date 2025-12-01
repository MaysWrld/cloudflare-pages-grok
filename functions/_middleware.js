// functions/_middleware.js

// 简单的 Basic Auth 检查
function checkAuth(request, env) {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
        return false;
    }

    const [type, credentials] = authHeader.split(' ');
    
    if (type !== 'Basic') {
        return false;
    }

    const decoded = atob(credentials);
    const [username, password] = decoded.split(':');

    // 使用环境变量中的用户名和密码进行比对
    return username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD;
}

// 路由中间件，只保护 /api/config 路径
export async function onRequest({ request, next, env }) {
    const url = new URL(request.url);

    // 只有 /api/config 路径需要认证
    if (url.pathname.startsWith('/api/config')) {
        if (!checkAuth(request, env)) {
            // 返回 401 Unauthorized 响应
            return new Response('Unauthorized. Admin access required.', {
                status: 401,
                headers: {
                    // 提示浏览器弹出登录框
                    'WWW-Authenticate': 'Basic realm="AI Assistant Admin"',
                    'Content-Type': 'text/plain',
                },
            });
        }
    }
    
    // /api/login, /api/chat, 和静态文件都通过 (开放)
    return next();
}
