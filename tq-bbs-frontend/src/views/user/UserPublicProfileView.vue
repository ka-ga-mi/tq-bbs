<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { avatarAssets, resolveDisplayAvatarUrl } from '../../mocks/userProfile'
import { apiRequest } from '../../api/client'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const errorText = ref('')
const profile = ref<{
  id: string
  uid: string
  nickname: string
  avatarUrl: string
  age: string
  role?: 'user' | 'admin'
  fansCount: number
  postCount: number
} | null>(null)
const following = ref(false)
const followLoading = ref(false)
const blocked = ref(false)
const blockLoading = ref(false)

const userId = computed(() => String(route.params.id || '').trim())

const goBack = () => router.back()
const goChat = () => {
  if (!profile.value) return
  if (!localStorage.getItem('tq_bbs_auth')) {
    void router.push({
      path: '/home',
      query: {
        login: '1',
        redirect: `/chat?target=${encodeURIComponent(profile.value.nickname)}&avatar=${encodeURIComponent(profile.value.avatarUrl)}&targetId=${encodeURIComponent(profile.value.id)}`,
      },
    })
    return
  }
  if (blocked.value) {
    errorText.value = '你已拉黑该用户，无法私聊'
    return
  }
  router.push({
    path: '/chat',
    query: {
      target: profile.value.nickname,
      avatar: profile.value.avatarUrl,
      targetId: profile.value.id,
    },
  })
}

const loadFollowStatus = async () => {
  if (!profile.value) return
  try {
    const data = await apiRequest<{ followed: boolean }>(`/api/users/${encodeURIComponent(profile.value.id)}/follow-status`, { auth: true })
    following.value = Boolean(data.followed)
  } catch {
    following.value = false
  }
}

const loadBlockStatus = async () => {
  if (!profile.value) return
  try {
    const data = await apiRequest<{ blocked: boolean }>(`/api/users/${encodeURIComponent(profile.value.id)}/block-status`, { auth: true })
    blocked.value = Boolean(data.blocked)
  } catch {
    blocked.value = false
  }
}

const toggleFollow = async () => {
  if (!profile.value || followLoading.value) return
  followLoading.value = true
  errorText.value = ''
  try {
    if (following.value) {
      await apiRequest<{ ok: boolean }>(`/api/users/${encodeURIComponent(profile.value.id)}/follow`, { method: 'DELETE', auth: true })
      following.value = false
      profile.value.fansCount = Math.max(0, profile.value.fansCount - 1)
    } else {
      await apiRequest<{ ok: boolean }>(`/api/users/${encodeURIComponent(profile.value.id)}/follow`, { method: 'POST', auth: true })
      following.value = true
      profile.value.fansCount += 1
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '关注操作失败'
  } finally {
    followLoading.value = false
  }
}

const toggleBlock = async () => {
  if (!profile.value || blockLoading.value) return
  blockLoading.value = true
  errorText.value = ''
  try {
    if (blocked.value) {
      await apiRequest<{ ok: boolean }>(`/api/users/${encodeURIComponent(profile.value.id)}/block`, { method: 'DELETE', auth: true })
      blocked.value = false
    } else {
      await apiRequest<{ ok: boolean }>(`/api/users/${encodeURIComponent(profile.value.id)}/block`, { method: 'POST', auth: true })
      blocked.value = true
      if (following.value) {
        following.value = false
        profile.value.fansCount = Math.max(0, profile.value.fansCount - 1)
      }
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '拉黑操作失败'
  } finally {
    blockLoading.value = false
  }
}

const loadProfile = async () => {
  if (!userId.value) {
    profile.value = null
    errorText.value = '用户不存在或已注销'
    loading.value = false
    return
  }
  loading.value = true
  errorText.value = ''
  try {
    const data = await apiRequest<{
      id: string
      uid: string
      nickname: string
      avatarUrl: string
      age: string
      role?: 'user' | 'admin'
      fansCount: number
      postCount: number
    }>(`/api/users/${encodeURIComponent(userId.value)}/public`)
    profile.value = {
      id: data.id,
      uid: data.uid,
      nickname: data.nickname,
      avatarUrl: resolveDisplayAvatarUrl(data.avatarUrl),
      age: data.age || '未知',
      role: data.role === 'admin' ? 'admin' : 'user',
      fansCount: Number.isFinite(data.fansCount) ? data.fansCount : 0,
      postCount: Number.isFinite(data.postCount) ? data.postCount : 0,
    }
    await loadFollowStatus()
    await loadBlockStatus()
  } catch (error) {
    profile.value = null
    errorText.value = error instanceof Error ? error.message : '用户不存在或已注销'
  } finally {
    loading.value = false
  }
}

watch(userId, () => {
  void loadProfile()
})

onMounted(() => {
  void loadProfile()
})
</script>

<template>
  <div class="h-full bg-black/96 p-14px">
    <div class="h-full flex flex-col border border-[var(--tq-line)] p-14px text-danger">
      <div v-if="loading" class="flex flex-1 items-center justify-center text-16px text-muted">加载中...</div>

      <template v-else-if="profile">
        <div class="mb-14px flex items-start justify-between gap-16px">
          <div class="flex items-center gap-12px">
            <div class="h-170px w-170px overflow-hidden rounded-full border-[5px] border-black bg-danger/90 p-0">
              <img :src="profile.avatarUrl || avatarAssets.nose" alt="用户头像" class="h-full w-full rounded-full object-cover" />
            </div>
            <div>
              <h2 class="m-0 text-34px tracking-4px text-danger">[ {{ profile.nickname }} ]</h2>
              <div v-if="profile.role === 'admin'" class="mt-6px text-20px tracking-2px text-danger/85">管理员</div>
              <div class="mt-10px flex items-center gap-10px">
                <button class="tq-btn min-w-180px text-24px" :disabled="blocked" @click="goChat">
                  {{ blocked ? '已拉黑，无法私聊' : '与 TA 私聊' }}
                </button>
                <button class="tq-btn-ghost min-w-160px text-24px" :disabled="followLoading" @click="toggleFollow">
                  {{ followLoading ? '处理中...' : following ? '取消关注' : '关注 TA' }}
                </button>
              </div>
            </div>
          </div>
          <div class="text-danger/80 text-24px">UID：{{ profile.uid }}</div>
        </div>

        <div class="mb-18px flex-1 grid grid-cols-[140px_1fr_1fr] content-center gap-y-12px text-danger">
          <div class="flex items-center justify-center text-40px tracking-8px [writing-mode:vertical-rl]">
            用户档案
          </div>
          <div class="space-y-12px pl-8px text-38px">
            <div>年龄：{{ profile.age }}</div>
            <div>粉丝：{{ profile.fansCount }}</div>
            <div>发帖：{{ profile.postCount }}</div>
          </div>
          <div class="space-y-12px text-38px">
            <div>状态：正常</div>
            <div>可私聊：是</div>
          </div>
        </div>

        <div class="mt-12px flex shrink-0 items-end justify-between">
          <button class="bg-transparent border-none p-0 text-48px tracking-4px text-danger font-700" @click="goBack">
            &lt; 返回
          </button>
          <button class="tq-btn-ghost min-w-180px text-24px" :disabled="blockLoading" @click="toggleBlock">
            {{ blockLoading ? '处理中...' : blocked ? '取消拉黑' : '拉黑 TA' }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="flex flex-1 flex-col items-center justify-center gap-16px">
          <div class="text-20px text-danger">{{ errorText || '用户不存在或已注销' }}</div>
          <div class="text-14px text-muted">该用户已注销或不可访问，无法查看主页和发起私聊。</div>
          <button class="tq-btn min-w-160px" @click="goBack">返回</button>
        </div>
      </template>
    </div>
  </div>
</template>
