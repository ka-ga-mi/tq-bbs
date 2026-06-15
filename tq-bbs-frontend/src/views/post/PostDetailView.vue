<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { homePosts } from '../../mocks/homePosts'
import { postDetails } from '../../mocks/postDetails'
import { avatarAssets, resolveDisplayAvatarUrl } from '../../mocks/userProfile'
import { apiRequest } from '../../api/client'

const route = useRoute()
const router = useRouter()
const replyContent = ref('')
const replyError = ref('')
const selectedReplyId = ref('')
const replyListRef = ref<HTMLElement | null>(null)
const backendDetail = ref<{
  id: string
  title: string
  createdAt: string
  isLocked?: boolean
  replies: Array<{ id: string; userId?: string; userName: string; avatarUrl: string; content: string }>
} | null>(null)

const postId = computed(() => String(route.params.id || ''))
const currentPost = computed(() => homePosts.find((item) => item.id === postId.value))
const detail = computed(() => postDetails.find((item) => item.id === postId.value))
const POST_REPLY_READ_KEY = 'tq_bbs_post_reply_read_state'
const POST_FOLLOW_REPLY_READ_KEY = 'tq_bbs_follow_post_reply_read_state'

const currentUser = ref<{ id: string; nickname: string; role?: 'user' | 'admin' } | null>(null)

const upsertReadState = (readKey: string) => {
  const userId = currentUser.value?.id
  const currentPostId = postId.value
  if (!userId || !currentPostId) return

  const now = new Date().toISOString()
  try {
    const raw = localStorage.getItem(readKey)
    const all = (raw ? JSON.parse(raw) : {}) as Record<string, Record<string, string>>
    const mine = all[userId] ?? {}
    mine[currentPostId] = now
    all[userId] = mine
    localStorage.setItem(readKey, JSON.stringify(all))
  } catch {
    // Ignore localStorage errors (should not break replying).
  }
}

const replies = computed(() => {
  if (backendDetail.value) return backendDetail.value.replies
  if (detail.value?.replies?.length) return detail.value.replies
  return [
    {
      id: 'fallback-reply',
      userName: '系统',
      avatarUrl: '',
      content: '该帖子暂无详情数据，后续可在 mocks/postDetails.ts 中补充。',
    },
  ]
})
const timeText = computed(() => {
  if (backendDetail.value?.createdAt) return backendDetail.value.createdAt.slice(0, 16).replace('T', ' ')
  return detail.value?.time ?? '未记录时间'
})
const titleText = computed(() => {
  if (backendDetail.value?.title) return backendDetail.value.title
  return currentPost.value?.title ?? `帖子详情（${postId.value || 'unknown'}）`
})
const isLocked = computed(() => Boolean(backendDetail.value?.isLocked))
const isAdmin = computed(() => currentUser.value?.role === 'admin')
const myDisplayName = computed(() => currentUser.value?.nickname ?? '佚名')
const isMyReply = (replyUserName: string) => replyUserName === myDisplayName.value
const selectedReply = computed(() => replies.value.find((item) => item.id === selectedReplyId.value) ?? null)

const scrollToReplyBottom = async () => {
  await nextTick()
  const el = replyListRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

const goBack = () => router.back()
const openUserProfile = (reply: { userId?: string; userName: string }) => {
  if (!reply.userId || reply.userName === '该用户已注销') {
    replyError.value = '该用户已注销或不可访问'
    return
  }
  if (!currentUser.value) {
    void router.push({
      path: '/home',
      query: { login: '1', redirect: `/users/${encodeURIComponent(reply.userId)}` },
    })
    return
  }
  router.push(`/users/${encodeURIComponent(reply.userId)}`)
}
const loadBackendPostDetail = async () => {
  if (!postId.value) return
  try {
    const data = await apiRequest<{
      id: string
      title: string
      createdAt: string
      isLocked?: boolean
      replies?: Array<{ id: string; userId?: string; userName: string; avatarUrl: string; content: string }>
    }>(`/api/posts/${postId.value}`)
    backendDetail.value = {
      id: data.id,
      title: data.title || '',
      createdAt: data.createdAt || '',
      isLocked: Boolean(data.isLocked),
      replies: (data.replies ?? []).map((item) => ({
        id: item.id,
        userId: item.userId,
        userName: item.userName || '匿名用户',
        avatarUrl: resolveDisplayAvatarUrl(item.avatarUrl),
        content: item.content || '',
      })),
    }
  } catch {
    backendDetail.value = null
  }
}

const loadCurrentUser = async () => {
  try {
    const data = await apiRequest<{ uid: string; user: { id: string; nickname: string; role?: 'user' | 'admin' } }>('/api/auth/me', { auth: true })
    currentUser.value = { id: data.user.id, nickname: data.user.nickname, role: data.user.role === 'admin' ? 'admin' : 'user' }
  } catch {
    currentUser.value = null
  }
}

const toggleLocked = async () => {
  if (!isAdmin.value || !postId.value) return
  try {
    if (isLocked.value) {
      await apiRequest(`/api/posts/${postId.value}/locked`, { method: 'DELETE', auth: true })
    } else {
      await apiRequest(`/api/posts/${postId.value}/locked`, { method: 'POST', auth: true })
    }
    await loadBackendPostDetail()
  } catch (error) {
    replyError.value = error instanceof Error ? error.message : '锁帖操作失败'
  }
}

const submitReply = async () => {
  if (!currentUser.value) {
    void router.push({ path: '/home', query: { login: '1', redirect: route.fullPath } })
    return
  }
  if (isLocked.value) {
    replyError.value = '该帖子已被管理员锁定，暂时无法回帖'
    return
  }
  const content = replyContent.value.trim()
  if (!content) {
    replyError.value = '请输入回帖内容'
    return
  }
  if (!detail.value && !backendDetail.value) {
    replyError.value = '当前帖子暂无回帖入口'
    return
  }

  const prefix = selectedReply.value ? `@${selectedReply.value.userName} ` : ''
  try {
    const data = await apiRequest<{
      id: string
      userName: string
      avatarUrl: string
      content: string
    }>(`/api/posts/${postId.value}/replies`, {
      method: 'POST',
      auth: true,
      body: { content: `${prefix}${content}` },
    })
    const newReply = {
      id: data.id,
      userName: data.userName,
      avatarUrl: resolveDisplayAvatarUrl(data.avatarUrl),
      content: data.content,
    }
    if (backendDetail.value) {
      backendDetail.value.replies.push(newReply)
    } else if (detail.value) {
      detail.value.replies.push(newReply)
    }
  } catch (error) {
    replyError.value = error instanceof Error ? error.message : '回帖失败，请稍后重试'
    return
  }

  // If I replied to this post, clear "unread" prompts in Home page lists.
  upsertReadState(POST_REPLY_READ_KEY)
  upsertReadState(POST_FOLLOW_REPLY_READ_KEY)
  window.dispatchEvent(new CustomEvent('tq_bbs_post_replied', { detail: { postId: postId.value } }))

  replyContent.value = ''
  replyError.value = ''
  selectedReplyId.value = ''
}

watch(postId, () => {
  void loadBackendPostDetail()
})

watch(replies, () => {
  void scrollToReplyBottom()
})

onMounted(() => {
  void Promise.all([loadCurrentUser(), loadBackendPostDetail()]).then(() => {
    void scrollToReplyBottom()
  })
})
</script>

<template>
  <div class="tq-panel h-full flex flex-col overflow-hidden border border-[var(--tq-line)]">
    <section class="relative min-h-0 flex flex-1 flex-col bg-[rgba(103,149,166,.22)] px-14px py-12px">
      <div class="relative z-1 mb-14px text-center text-13px text-danger">{{ timeText }}</div>

      <div class="relative z-1 mb-12px text-14px sm:text-16px font-700 text-danger">
        <span v-if="isLocked" class="mr-8px inline-flex items-center rounded-2px border border-danger/70 bg-danger/20 px-6px py-2px text-12px text-danger">
          已锁帖
        </span>
        「{{ titleText }}」
      </div>

      <div ref="replyListRef" class="relative z-1 min-h-0 flex-1 space-y-14px overflow-auto pr-2px">
        <article
          v-for="reply in replies"
          :key="reply.id"
          class="flex cursor-pointer items-start gap-8px sm:gap-10px rounded-6px p-4px"
          :class="isMyReply(reply.userName) ? 'justify-end' : 'justify-start'"
          @click="selectedReplyId = selectedReplyId === reply.id ? '' : reply.id"
        >
          <div
            class="h-48px w-48px sm:h-62px sm:w-62px shrink-0 overflow-hidden rounded-full border-[5px] border-black bg-danger/90"
            :class="[
              isMyReply(reply.userName) ? 'order-2' : 'order-1',
              !reply.userId || reply.userName === '该用户已注销' ? 'cursor-not-allowed opacity-60' : '',
            ]"
            @click.stop="openUserProfile(reply)"
          >
            <img
              :src="resolveDisplayAvatarUrl(reply.avatarUrl)"
              alt="回复头像"
              class="h-full w-full rounded-full object-cover"
            />
          </div>

          <div class="flex-1" :class="isMyReply(reply.userName) ? 'order-1 text-right' : 'order-2 text-left'">
            <div class="mb-6px tq-text-lg text-muted">
              {{ reply.userName }}
              <span v-if="selectedReplyId === reply.id" class="ml-8px text-13px text-danger">（已选中）</span>
            </div>
            <div
              class="inline-block max-w-85% sm:max-w-60% border px-8px py-8px sm:px-10px sm:py-10px text-left text-14px sm:text-20px leading-[1.6] text-black whitespace-pre-line break-words h-auto min-h-fit"
              :class="selectedReplyId === reply.id ? 'border-danger bg-danger/75' : 'border-[var(--tq-line)] bg-danger/60'"
            >
              {{ reply.content }}
            </div>
          </div>
        </article>

      </div>

      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,.08),transparent_48%)]" />
    </section>

    <footer class="shrink-0 border-t border-[var(--tq-line)] bg-[rgba(214,234,242,.25)] px-12px py-10px">
      <textarea
        v-model="replyContent"
        class="tq-input h-68px w-full resize-none rounded-none text-danger leading-[1.6]"
        :placeholder="isLocked ? '该帖子已被管理员锁定，无法继续发言' : '在这里输入回帖内容...'"
        :disabled="isLocked"
        @keydown.enter.exact.prevent="submitReply"
      />
      <div v-if="selectedReply" class="mt-8px text-12px text-danger/85">
        正在回复：{{ selectedReply.userName }}（点击消息可切换/取消）
      </div>
      <p v-if="replyError" class="m-0 mt-8px text-13px text-danger">{{ replyError }}</p>
      <div class="mt-8px flex flex-wrap items-center justify-between gap-8px">
        <button class="bg-transparent border-none p-0 text-24px sm:text-40px text-danger font-700" @click="goBack">返回</button>
        <div class="flex flex-wrap items-center gap-8px sm:gap-10px">
          <button v-if="isAdmin" class="tq-btn-ghost rounded-none px-12px py-6px text-14px sm:text-18px" @click="toggleLocked">
            {{ isLocked ? '解除锁帖' : '锁帖' }}
          </button>
          <button class="tq-btn rounded-none px-16px py-6px text-16px sm:text-24px" :disabled="isLocked" @click="submitReply">发送</button>
        </div>
      </div>
    </footer>
  </div>
</template>
