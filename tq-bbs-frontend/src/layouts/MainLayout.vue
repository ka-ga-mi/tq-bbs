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
  <main class="tq-page px-10px py-20px">
    <div class="mx-auto h-90vh w-90vw max-w-1600px">
      <!--
      <header class="mb-16px tq-panel px-16px py-14px">
        <div class="flex items-center justify-between gap-12px">
          <h1 class="m-0 text-18px text-danger tracking-1px">TQ BBS</h1>
          <nav class="flex flex-wrap items-center gap-8px">
            <RouterLink
              v-for="tab in tabs"
              :key="tab.name"
              :to="tab.to"
              class="tq-tab min-w-74px text-center"
              :class="{ 'tq-tab-active': currentTab === tab.name }"
            >
              {{ tab.label }}
            </RouterLink>
          </nav>
     
        </div>
      </header>
     -->
     
      <section class="mx-auto h-full w-full">
        <RouterView />
      </section>
    </div>
  </main>
</template>
