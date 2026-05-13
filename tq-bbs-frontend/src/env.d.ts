/// <reference types="vite/client" />

/** 由 vite.config.ts 的 define 注入（生产构建会剥掉仅含 localhost 的地址） */
declare const __TQ_BBS_API_BASE__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

