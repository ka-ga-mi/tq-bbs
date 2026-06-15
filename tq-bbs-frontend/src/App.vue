<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import RouteLoading from '@/components/RouteLoading.vue'

const router = useRouter()
const routeLoading = ref(false)
let loadingTimer = 0

router.beforeEach(() => {
  window.clearTimeout(loadingTimer)
  loadingTimer = window.setTimeout(() => {
    routeLoading.value = true
  }, 120)
})

router.afterEach(() => {
  window.clearTimeout(loadingTimer)
  routeLoading.value = false
})
</script>

<template>
  <RouteLoading v-if="routeLoading" />
  <RouterView />
</template>

