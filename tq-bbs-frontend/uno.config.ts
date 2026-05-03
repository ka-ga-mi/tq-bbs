import { defineConfig, presetAttributify, presetIcons, presetUno, transformerDirectives } from 'unocss'

export default defineConfig({
  presets: [presetUno(), presetAttributify(), presetIcons()],
  transformers: [transformerDirectives()],
  theme: {
    colors: {
      bg: 'var(--tq-bg)',
      panel: 'var(--tq-panel)',
      text: 'var(--tq-text)',
      muted: 'var(--tq-muted)',
      line: 'var(--tq-line)',
      danger: 'var(--tq-danger)',
      accent: 'var(--tq-accent)',
    },
    boxShadow: {
      panel: '0 0 0 1px var(--tq-line), 0 16px 40px rgba(0,0,0,.45)',
    },
  },
  shortcuts: {
    'tq-page': 'min-h-dvh bg-bg text-text',
    'tq-panel': 'bg-panel shadow-panel rounded-8px',
    'tq-btn': 'inline-flex items-center justify-center gap-2 px-14px py-10px rounded-none bg-danger text-white font-600 active:opacity-80',
    'tq-btn-ghost': 'inline-flex items-center justify-center gap-2 px-14px py-10px rounded-none bg-transparent text-danger font-600 ring-1 ring-line active:opacity-80',
    'tq-input': 'w-full px-12px py-10px rounded-none bg-black/30 ring-1 ring-line outline-none focus:(ring-2 ring-danger)',
    'tq-tab': 'px-14px py-8px rounded-10px ring-1 ring-line text-muted',
    'tq-tab-active': 'bg-danger text-white ring-danger',
  },
})
