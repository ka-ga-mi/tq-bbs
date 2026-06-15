<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const tabs = [
  { name: 'home', label: '首页', to: '/home' },
  { name: 'posts', label: '帖子', to: '/posts' },
  { name: 'chat', label: '私聊', to: '/chat' },
  { name: 'profile', label: '我的', to: '/profile' },
]

const currentTab = computed(() => route.name)
</script>

<template>
  <main class="tq-page">
    <div class="tq-shell">
      <section class="mx-auto h-full w-full">
        <RouterView v-slot="{ Component }">
          <Suspense>
            <component :is="Component" />
            <template #fallback>
              <div class="tq-panel flex h-full items-center justify-center text-14px text-muted">页面加载中...</div>
            </template>
          </Suspense>
        </RouterView>
      </section>
    </div>
  </main>
</template>
