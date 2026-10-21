// 版本号与构建时间（由 vite.config.ts 的 define 注入，见 vite-env.d.ts 声明）
export const APP_VERSION: string = __APP_VERSION__
export const BUILD_TIME: string = __BUILD_TIME__

// 把 ISO 时间格式化为"YYYY-MM-DD HH:mm"（浏览器本地时区）
export function formatBuildTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}
