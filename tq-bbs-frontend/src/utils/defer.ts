/** 将非关键任务推迟到浏览器空闲时执行，避免阻塞首屏渲染 */
export const deferIdle = (task: () => void) => {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => task(), { timeout: 2000 })
    return
  }
  setTimeout(task, 0)
}

/** 延迟执行，适合次要数据刷新 */
export const deferLater = (task: () => void, ms = 300) => {
  setTimeout(task, ms)
}
