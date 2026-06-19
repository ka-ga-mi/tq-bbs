<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { homePosts } from '../../mocks/homePosts'
import { postDetails } from '../../mocks/postDetails'
import { resolveDisplayAvatarUrl } from '../../mocks/userProfile'
import { formatMessageTime, resolveMessageCreatedAt, shouldShowMessageTime } from '../../utils/messageTime'
import { buildMentionPrefix, latestMentionAt } from '../../utils/mention'
import { apiRequest } from '../../api/client'

type PostReply = {
  id: string
  userId?: string
  userName: string
  avatarUrl: string
  content: string
  createdAt?: string
}

type PostDetailData = {
  id: string
  title: string
  createdAt: string
  isLocked?: boolean
  replies: PostReply[]
}

type ApiPostDetail = {
  id: string
  title: string
  createdAt: string
  isLocked?: boolean
  replies?: PostReply[]
}

const route = useRoute()
const router = useRouter()
const replyContent = ref('')
const replyError = ref('')
const selectedReplyIds = ref<string[]>([])
const replyListRef = ref<HTMLElement | null>(null)
const backendDetail = ref<PostDetailData | null>(null)
const detailLoading = ref(true)
const detailLoadFailed = ref(false)

const postId = computed(() => String(route.params.id || ''))
const useDevMock = import.meta.env.DEV
const currentPost = computed(() => (useDevMock ? homePosts.find((item) => item.id === postId.value) : undefined))
const detail = computed(() => (useDevMock ? postDetails.find((item) => item.id === postId.value) : undefined))
const POST_REPLY_READ_KEY = 'tq_bbs_post_reply_read_state'
const POST_FOLLOW_REPLY_READ_KEY = 'tq_bbs_follow_post_reply_read_state'
const POST_MENTION_READ_KEY = 'tq_bbs_post_mention_read_state'

const currentUser = ref<{ id: string; nickname: string; role?: 'user' | 'admin' } | null>(null)

const replies = computed<PostReply[]>(() => {
  if (detailLoading.value) return []
  if (backendDetail.value) return backendDetail.value.replies
  if (useDevMock && detail.value?.replies?.length) return detail.value.replies
  return []
})
const timeText = computed(() => {
  if (detailLoading.value) return '加载中...'
  if (backendDetail.value?.createdAt) return backendDetail.value.createdAt.slice(0, 16).replace('T', ' ')
  if (useDevMock && detail.value?.time) return detail.value.time
  return '未记录时间'
})
const titleText = computed(() => {
  if (detailLoading.value) return '加载中...'
  if (backendDetail.value?.title) return backendDetail.value.title
  if (useDevMock && currentPost.value?.title) return currentPost.value.title
  if (detailLoadFailed.value) return '帖子加载失败'
  return `帖子详情（${postId.value || 'unknown'}）`
})
const isLocked = computed(() => Boolean(backendDetail.value?.isLocked))
const isAdmin = computed(() => currentUser.value?.role === 'admin')
const myDisplayName = computed(() => currentUser.value?.nickname ?? '佚名')
const isMyReply = (replyUserName: string) => replyUserName === myDisplayName.value
const selectedReplies = computed(() => replies.value.filter((item) => selectedReplyIds.value.includes(item.id)))

const toggleReplySelection = (replyId: string) => {
  if (selectedReplyIds.value.includes(replyId)) {
    selectedReplyIds.value = selectedReplyIds.value.filter((id) => id !== replyId)
    return
  }
  selectedReplyIds.value = [...selectedReplyIds.value, replyId]
}

const isReplySelected = (replyId: string) => selectedReplyIds.value.includes(replyId)

const selectedReplyNames = computed(() => {
  const names: string[] = []
  selectedReplies.value.forEach((reply) => {
    if (reply.userName && !names.includes(reply.userName)) names.push(reply.userName)
  })
  return names
})

const showReplyTime = (index: number) => {
  const list = replies.value
  const current = list[index]
  const previous = index > 0 ? list[index - 1] : undefined
  return shouldShowMessageTime(current?.createdAt, previous?.createdAt, current?.id, previous?.id)
}

const SCROLL_BOTTOM_THRESHOLD = 80

const isNearBottom = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_BOTTOM_THRESHOLD

const scrollToReplyBottom = async (force = false) => {
  await nextTick()
  const el = replyListRef.value
  if (!el) return
  if (!force && !isNearBottom(el)) return
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
const mapPostDetail = (data: ApiPostDetail): PostDetailData => ({
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
    createdAt: resolveMessageCreatedAt(item.createdAt, item.id),
  })),
})

const markViewedPostAsRead = () => {
  const userId = currentUser.value?.id
  const nickname = currentUser.value?.nickname ?? ''
  const id = postId.value
  if (!userId || !id || !backendDetail.value) return

  const persist = (readKey: string, ts: string) => {
    if (!ts) return
    try {
      const raw = localStorage.getItem(readKey)
      const all = (raw ? JSON.parse(raw) : {}) as Record<string, Record<string, string>>
      const mine = all[userId] ?? {}
      mine[id] = ts
      all[userId] = mine
      localStorage.setItem(readKey, JSON.stringify(all))
    } catch {
      // ignore
    }
  }

  const incomingTimes = backendDetail.value.replies
    .filter((reply) => reply.userId && reply.userId !== userId && reply.createdAt)
    .map((reply) => reply.createdAt as string)
    .sort()
  const latestReply = incomingTimes[incomingTimes.length - 1] || ''
  persist(POST_REPLY_READ_KEY, latestReply)
  persist(POST_FOLLOW_REPLY_READ_KEY, latestReply)
  persist(POST_MENTION_READ_KEY, latestMentionAt(backendDetail.value.replies, nickname, userId))

  window.dispatchEvent(new CustomEvent('tq_bbs_post_read', { detail: { postId: id } }))
}

const loadBackendPostDetail = async (options?: { silent?: boolean }) => {
  if (!postId.value) return
  const silent = options?.silent ?? false
  if (!silent) {
    detailLoading.value = true
    detailLoadFailed.value = false
    backendDetail.value = null
  }
  try {
    const data = await apiRequest<ApiPostDetail>(`/api/posts/${postId.value}`)
    backendDetail.value = mapPostDetail(data)
    detailLoadFailed.value = false
    markViewedPostAsRead()
  } catch {
    if (!silent) {
      detailLoadFailed.value = true
      backendDetail.value = null
    }
  } finally {
    if (!silent) {
      detailLoading.value = false
      void scrollToReplyBottom(true)
    }
  }
}

let postPollTimer: ReturnType<typeof window.setInterval> | undefined
let postPollInFlight = false
const POST_POLL_INTERVAL_MS = 4000

const appendPolledReplies = (items: PostReply[]) => {
  if (!backendDetail.value || !items.length) return
  const existing = new Set(backendDetail.value.replies.map((item) => item.id))
  items.forEach((item) => {
    if (!item.id || existing.has(item.id)) return
    backendDetail.value!.replies.push(item)
  })
}

const pollPostUpdates = async () => {
  if (document.hidden || postPollInFlight || !postId.value || detailLoading.value || !backendDetail.value) return

  postPollInFlight = true
  try {
    const el = replyListRef.value
    const shouldFollow = el ? isNearBottom(el) : true
    const prevLastId = replies.value.at(-1)?.id || ''
    const data = await apiRequest<{
      replyCount: number
      lastReplyId: string
      isLocked: boolean
      newReplies: PostReply[]
    }>(`/api/posts/${encodeURIComponent(postId.value)}/replies/poll?afterReplyId=${encodeURIComponent(prevLastId)}`)

    backendDetail.value.isLocked = Boolean(data.isLocked)
    const mapped = (data.newReplies ?? []).map((item) => ({
      id: item.id,
      userId: item.userId,
      userName: item.userName || '匿名用户',
      avatarUrl: resolveDisplayAvatarUrl(item.avatarUrl),
      content: item.content || '',
      createdAt: resolveMessageCreatedAt(item.createdAt, item.id),
    }))
    appendPolledReplies(mapped)
    if (mapped.length) markViewedPostAsRead()

    const nextLastId = replies.value.at(-1)?.id || ''
    if (nextLastId && nextLastId !== prevLastId && shouldFollow) void scrollToReplyBottom()
  } catch {
    // Ignore polling errors; the next tick may recover.
  } finally {
    postPollInFlight = false
  }
}

const startPostPolling = () => {
  if (postPollTimer) return
  void pollPostUpdates()
  postPollTimer = window.setInterval(() => void pollPostUpdates(), POST_POLL_INTERVAL_MS)
}

const stopPostPolling = () => {
  if (!postPollTimer) return
  window.clearInterval(postPollTimer)
  postPollTimer = undefined
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
  if (!backendDetail.value && !(useDevMock && detail.value)) {
    replyError.value = detailLoadFailed.value ? '帖子加载失败，请返回后重试' : '当前帖子暂无回帖入口'
    return
  }

  const prefix = buildMentionPrefix(selectedReplyNames.value, content)
  try {
    const data = await apiRequest<{
      id: string
      userName: string
      avatarUrl: string
      content: string
      createdAt?: string
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
      userId: currentUser.value?.id,
      createdAt: resolveMessageCreatedAt(data.createdAt, data.id) || new Date().toISOString(),
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
  markViewedPostAsRead()
  window.dispatchEvent(new CustomEvent('tq_bbs_post_replied', { detail: { postId: postId.value } }))

  replyContent.value = ''
  replyError.value = ''
  selectedReplyIds.value = []
  void scrollToReplyBottom(true)
}

watch(postId, () => {
  void loadBackendPostDetail()
})

onMounted(() => {
  startPostPolling()
  void loadCurrentUser()
  void loadBackendPostDetail()
})

onUnmounted(() => {
  stopPostPolling()
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
        <div v-if="detailLoading" class="space-y-14px">
          <div v-for="n in 3" :key="n" class="flex animate-pulse items-start gap-10px">
            <div class="h-48px w-48px shrink-0 rounded-full bg-danger/25" />
            <div class="h-48px flex-1 rounded-4px bg-danger/15" />
          </div>
        </div>
        <p v-else-if="detailLoadFailed" class="m-0 text-center text-14px text-muted">帖子加载失败，请检查网络后刷新</p>
        <p v-else-if="replies.length === 0" class="m-0 text-center text-14px text-muted">暂无回帖，来抢沙发吧</p>
        <template v-else>
          <template v-for="(reply, index) in replies" :key="reply.id">
            <div
              v-if="showReplyTime(index)"
              class="relative z-1 mb-8px text-center text-13px text-danger"
            >
              {{ formatMessageTime(reply.createdAt, reply.id) }}
            </div>
          <article
          class="flex cursor-pointer items-start gap-8px sm:gap-10px rounded-6px p-4px"
          :class="isMyReply(reply.userName) ? 'justify-end' : 'justify-start'"
          @click="toggleReplySelection(reply.id)"
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
              <span v-if="isReplySelected(reply.id)" class="ml-8px text-13px text-danger">（已选中）</span>
            </div>
            <div
              class="inline-block max-w-85% sm:max-w-60% border px-8px py-8px sm:px-10px sm:py-10px text-left text-14px sm:text-20px leading-[1.6] text-black whitespace-pre-line break-words h-auto min-h-fit"
              :class="isReplySelected(reply.id) ? 'border-danger bg-danger/75' : 'border-[var(--tq-line)] bg-danger/60'"
            >
              {{ reply.content }}
            </div>
          </div>
        </article>
          </template>
        </template>

      </div>

      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,.08),transparent_48%)]" />
    </section>

    <footer class="shrink-0 border-t border-[var(--tq-line)] bg-[rgba(214,234,242,.25)] px-12px py-10px">
      <textarea
        v-model="replyContent"
        class="tq-input h-68px w-full resize-none rounded-none text-danger leading-[1.6]"
        :placeholder="isLocked ? '该帖子已被管理员锁定，无法继续发言' : '在这里输入回帖内容，也可手动输入 @昵称 ...'"
        :disabled="isLocked"
        @keydown.enter.exact.prevent="submitReply"
      />
      <div v-if="selectedReplyNames.length" class="mt-8px text-12px text-danger/85">
        将 @：{{ selectedReplyNames.join('、') }}（点击消息可多选，再次点击取消）
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
