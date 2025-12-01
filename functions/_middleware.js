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

// 路由中间件，保护所有 /api/ 路径
export async function onRequest({ request, next, env }) {
    const url = new URL(request.url);

    // 排除 /api/login 路径，其他 /api/* 路径都需要认证
    if (url.pathname !== '/api/login' && url.pathname.startsWith('/api/')) {
        if (!checkAuth(request, env)) {
            // 返回 401 Unauthorized 响应
            return new Response('Unauthorized.', {
                status: 401,
                headers: {
                    // 提示浏览器弹出登录框
                    'WWW-Authenticate': 'Basic realm="AI Assistant Admin"',
                    'Content-Type': 'text/plain',
                },
            });
        }
    }
    
    // 如果通过认证或不是受保护的路径，则继续执行下一个处理函数
    return next();
}
