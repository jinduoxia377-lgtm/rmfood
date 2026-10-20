/**
 * 头像 URL 解析工具（全局共用）
 *
 * 后端返回相对头像路径（如 /uploads/avatars/xxx.jpg）：
 * - 生产环境：nginx 已将 /uploads/ 反向代理到后端，浏览器同源可直接加载，
 *   因此直接返回相对路径（禁止拼接 VITE_BACKEND_URL——生产默认为
 *   http://localhost:8000，会导致浏览器访问用户本机而加载失败）。
 * - 绝对 URL（https://、data:、blob:）原样返回。
 */
export const resolveAvatarUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  if (url.startsWith('/')) {
    // 站内相对路径：同源加载（nginx /uploads 代理到后端）
    return url;
  }
  return url;
};