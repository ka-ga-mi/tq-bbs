<script setup lang="ts">
const list = [
  { title: '版主-砂砂', content: '欢迎来到版区，请遵守版规。' },
  { title: '红花女（狱）', content: '征集灵异故事，优质帖会加精。' },
  { title: '西封主编-风', content: '本周专题：旧小区怪谈。' },
]
</script>

<template>
  <div class="tq-panel p-12px">
    <div class="mb-10px flex items-center justify-between">
      <h2 class="m-0 text-16px">帖子广场</h2>
      <span class="text-12px text-muted">1 / 1</span>
    </div>

    <article v-for="item in list" :key="item.title" class="mb-8px border border-[var(--tq-line)] p-10px last:mb-0">
      <h3 class="m-0 text-15px text-danger">{{ item.title }}</h3>
      <p class="mb-0 mt-6px text-13px text-muted">{{ item.content }}</p>
    </article>

    <div class="mt-10px flex gap-8px">
      <button class="tq-btn-ghost flex-1">返回</button>
      <button class="tq-btn flex-1">回复</button>
    </div>
  </div>
</template>
