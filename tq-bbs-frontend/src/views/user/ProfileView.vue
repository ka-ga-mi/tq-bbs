<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { avatarAssets, currentUserProfile, resolveDisplayAvatarUrl } from '../../mocks/userProfile'
import { apiRequest } from '../../api/client'

const AUTH_STORAGE_KEY = 'tq_bbs_auth'
const router = useRouter()

const goHome = () => {
  router.push('/home')
}

const goMyPosts = () => {
  router.push({ path: '/home', query: { type: '我的' } })
}

const logout = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  router.replace('/home')
}

const deleting = ref(false)
const deleteError = ref('')
const deleteModalVisible = ref(false)
const followingModalVisible = ref(false)
const followingLoading = ref(false)
const followingList = ref<Array<{ id: string; nickname: string; avatarUrl: string }>>([])
const followingError = ref('')
const followersModalVisible = ref(false)
const followersLoading = ref(false)
const followersList = ref<Array<{ id: string; nickname: string; avatarUrl: string }>>([])
const followersError = ref('')

const deleteAccount = async () => {
  if (deleting.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await apiRequest<{ ok: boolean }>('/api/auth/account', { method: 'DELETE', auth: true })
    localStorage.removeItem(AUTH_STORAGE_KEY)
    router.replace('/home')
  } catch (error) {
    deleteError.value = error instanceof Error ? error.message : '注销失败，请稍后重试'
  } finally {
    deleting.value = false
    deleteModalVisible.value = false
  }
}

const backendProfile = ref<{
  uid: string
  nickname: string
  avatarUrl: string
  role?: 'user' | 'admin'
  stats: Array<{ label: string; value: string }>
} | null>(null)

const activeProfile = computed(() => backendProfile.value ?? currentUserProfile)
const isAdminProfile = computed(() => backendProfile.value?.role === 'admin')

const loadProfile = async () => {
  try {
    const data = await apiRequest<{
      uid: string
      user: { nickname: string; avatarUrl: string; age: string; gender: string; role?: 'user' | 'admin' }
      postCount: number
      fansCount: number
      followingCount: number
    }>('/api/auth/me', { auth: true })
    backendProfile.value = {
      uid: data.uid,
      nickname: data.user.nickname,
      avatarUrl: resolveDisplayAvatarUrl(data.user.avatarUrl),
      role: data.user.role === 'admin' ? 'admin' : 'user',
      stats: [
        { label: '年龄', value: data.user.age || '未知' },
        { label: '性别', value: data.user.gender || '未知' },
        { label: '粉丝', value: String(data.fansCount ?? 0) },
        { label: '足迹', value: '0' },
        { label: '关注', value: String(data.followingCount ?? 0) },
        { label: '我的帖子', value: String(data.postCount ?? 0) },
      ],
    }
  } catch {
    backendProfile.value = null
  }
}

const openFollowingList = async () => {
  followingModalVisible.value = true
  followingLoading.value = true
  followingError.value = ''
  try {
    const data = await apiRequest<Array<{ id: string; nickname: string; avatarUrl: string }>>('/api/users/following', {
      auth: true,
    })
    followingList.value = Array.isArray(data)
      ? data.map((u) => ({ ...u, avatarUrl: resolveDisplayAvatarUrl(u.avatarUrl) }))
      : []
  } catch (error) {
    followingList.value = []
    followingError.value = error instanceof Error ? error.message : '加载关注列表失败'
  } finally {
    followingLoading.value = false
  }
}

const goUserProfile = (id: string) => {
  followingModalVisible.value = false
  followersModalVisible.value = false
  router.push(`/users/${encodeURIComponent(id)}`)
}

const openFollowersList = async () => {
  followersModalVisible.value = true
  followersLoading.value = true
  followersError.value = ''
  try {
    const data = await apiRequest<Array<{ id: string; nickname: string; avatarUrl: string }>>('/api/users/followers', {
      auth: true,
    })
    followersList.value = Array.isArray(data)
      ? data.map((u) => ({ ...u, avatarUrl: resolveDisplayAvatarUrl(u.avatarUrl) }))
      : []
  } catch (error) {
    followersList.value = []
    followersError.value = error instanceof Error ? error.message : '加载粉丝列表失败'
  } finally {
    followersLoading.value = false
  }
}

const getStatValue = (label: string) => activeProfile.value.stats.find((item) => item.label === label)?.value ?? '-'

onMounted(() => {
  void loadProfile()
})
</script>

<template>
  <div class="h-full bg-black/96 p-10px sm:p-14px">
    <div class="h-full flex flex-col border border-[var(--tq-line)] p-10px sm:p-14px">
      <div class="mb-14px flex flex-col gap-12px sm:flex-row sm:items-start sm:justify-between">
        <div class="flex flex-col items-center gap-12px sm:flex-row sm:items-center">
          <div class="tq-avatar-lg shrink-0 overflow-hidden rounded-full border-[5px] border-black bg-danger/90 p-0">
            <img
              v-if="activeProfile.avatarUrl"
              :src="activeProfile.avatarUrl"
              alt="用户头像"
              class="h-full w-full rounded-full object-cover"
            />
            <div v-else class="h-full w-full rounded-full bg-black/70" />
          </div>
          <div class="text-center sm:text-left">
            <h2 class="tq-text-hero m-0 tracking-2px sm:tracking-4px text-danger">[ {{ activeProfile.nickname }} ]</h2>
            <div v-if="isAdminProfile" class="mt-6px tq-text-lg tracking-1px sm:tracking-2px text-danger/85">管理员</div>
          </div>
        </div>
        <div class="flex flex-col items-center gap-8px sm:items-end">
          <div class="text-danger/80 tq-text-lg">UID：{{ activeProfile.uid }}</div>
          <button
            class="bg-transparent border-none p-0 tq-text-lg tracking-1px sm:tracking-2px text-danger/85 font-700"
            :disabled="deleting"
            @click="deleteModalVisible = true"
          >
            {{ deleting ? '注销中...' : '注销账号' }}
          </button>
          <p v-if="deleteError" class="m-0 text-13px text-danger">{{ deleteError }}</p>
        </div>
      </div>

      <div class="tq-profile-grid mb-18px flex-1 text-danger">
        <div class="tq-profile-side-label flex items-center justify-center">
          档案记录
        </div>

        <div class="space-y-8px sm:space-y-12px pl-0 sm:pl-8px tq-text-stat">
          <div>年龄：{{ getStatValue('年龄') }}</div>
          <div>性别：{{ getStatValue('性别') }}</div>
          <button class="bg-transparent border-none p-0 tq-text-stat text-danger" @click="openFollowingList">
            关注：{{ getStatValue('关注') }}
          </button>
        </div>

        <div class="space-y-8px sm:space-y-12px tq-text-stat">
          <button class="bg-transparent border-none p-0 tq-text-stat text-danger" @click="openFollowersList">
            粉丝：{{ getStatValue('粉丝') }}
          </button>
          <div>足迹：{{ getStatValue('足迹') }}</div>
          <button class="bg-transparent border-none p-0 tq-text-stat text-danger" @click="goMyPosts">
            我的帖子：{{ getStatValue('我的帖子') }}
          </button>
        </div>
      </div>

      <div class="mt-12px flex shrink-0 flex-wrap items-end justify-between gap-12px">
        <button class="bg-transparent border-none p-0 text-28px sm:text-48px tracking-2px sm:tracking-4px text-danger font-700" @click="goHome">
          &lt; 返回
        </button>
        <button class="bg-transparent border-none p-0 text-28px sm:text-48px tracking-3px sm:tracking-6px text-danger font-700" @click="logout">
          退出登录
        </button>
      </div>
    </div>

    <div
      v-if="followingModalVisible"
      class="absolute inset-0 z-20 flex items-center justify-center bg-black/65 px-16px"
      @click.self="followingModalVisible = false"
    >
      <div class="w-full max-w-520px border border-[var(--tq-line)] bg-panel p-14px text-danger">
        <div class="mb-12px flex items-center justify-between">
          <span class="text-18px font-700">我关注的用户</span>
          <button class="text-22px leading-none" @click="followingModalVisible = false">×</button>
        </div>

        <div v-if="followingLoading" class="py-20px text-center text-14px text-muted">加载中...</div>
        <div v-else-if="followingError" class="py-20px text-center text-14px text-danger">{{ followingError }}</div>
        <div v-else-if="followingList.length === 0" class="py-20px text-center text-14px text-muted">你还没有关注任何用户</div>
        <div v-else class="max-h-320px space-y-8px overflow-auto pr-4px">
          <button
            v-for="user in followingList"
            :key="user.id"
            class="flex w-full items-center gap-10px border border-[var(--tq-line)] bg-[rgba(0,0,0,.24)] px-10px py-8px text-left transition hover:bg-[rgba(180,20,20,.18)]"
            @click="goUserProfile(user.id)"
          >
            <img :src="user.avatarUrl || avatarAssets.nose" alt="关注用户头像" class="h-42px w-42px rounded-full border-[3px] border-black object-cover" />
            <span class="min-w-0 flex-1 truncate text-16px text-danger">{{ user.nickname }}</span>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="followersModalVisible"
      class="absolute inset-0 z-20 flex items-center justify-center bg-black/65 px-16px"
      @click.self="followersModalVisible = false"
    >
      <div class="w-full max-w-520px border border-[var(--tq-line)] bg-panel p-14px text-danger">
        <div class="mb-12px flex items-center justify-between">
          <span class="text-18px font-700">关注我的人</span>
          <button class="text-22px leading-none" @click="followersModalVisible = false">×</button>
        </div>

        <div v-if="followersLoading" class="py-20px text-center text-14px text-muted">加载中...</div>
        <div v-else-if="followersError" class="py-20px text-center text-14px text-danger">{{ followersError }}</div>
        <div v-else-if="followersList.length === 0" class="py-20px text-center text-14px text-muted">暂时还没有粉丝</div>
        <div v-else class="max-h-320px space-y-8px overflow-auto pr-4px">
          <button
            v-for="user in followersList"
            :key="user.id"
            class="flex w-full items-center gap-10px border border-[var(--tq-line)] bg-[rgba(0,0,0,.24)] px-10px py-8px text-left transition hover:bg-[rgba(180,20,20,.18)]"
            @click="goUserProfile(user.id)"
          >
            <img :src="user.avatarUrl || avatarAssets.nose" alt="粉丝头像" class="h-42px w-42px rounded-full border-[3px] border-black object-cover" />
            <span class="min-w-0 flex-1 truncate text-16px text-danger">{{ user.nickname }}</span>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="deleteModalVisible"
      class="absolute inset-0 z-20 flex items-center justify-center bg-black/65 px-16px"
      @click.self="deleteModalVisible = false"
    >
      <div class="w-full max-w-420px border border-[var(--tq-line)] bg-panel p-14px text-danger">
        <div class="mb-12px flex items-center justify-between">
          <span class="text-18px font-700">确认注销账号</span>
          <button class="text-22px leading-none" :disabled="deleting" @click="deleteModalVisible = false">×</button>
        </div>
        <p class="m-0 text-14px leading-[1.6] text-danger/90">注销后账号无法恢复，且该账号将无法再次登录，确认继续吗？</p>
        <div class="mt-14px flex items-center gap-10px">
          <button class="tq-btn-ghost flex-1 rounded-none" :disabled="deleting" @click="deleteModalVisible = false">取消</button>
          <button class="tq-btn flex-1 rounded-none" :disabled="deleting" @click="deleteAccount">
            {{ deleting ? '注销中...' : '确认注销' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
