<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { homePosts, type HomePostItem } from '../../mocks/homePosts'
import { avatarAssets, resolveDisplayAvatarUrl } from '../../mocks/userProfile'
import { apiRequest } from '../../api/client'
import { deferIdle } from '../../utils/defer'

const AUTH_STORAGE_KEY = 'tq_bbs_auth'
const ITEMS_PER_PAGE = 3
const currentPage = ref(1)
const activeType = ref<'主页' | '精品' | '直播' | '我的' | '关注'>('主页')
const postTypes = ['主页', '精品', '直播', '我的', '关注'] as const
const route = useRoute()
const router = useRouter()
const isLoggedIn = ref(false)
const loginModalVisible = ref(false)
const loginAccount = ref('')
const loginPassword = ref('')
const loginError = ref('')
type AuthUser = {
  id: string
  uid: string
  nickname: string
  avatarUrl: string
  age: string
  gender: '男' | '女' | '未知'
  role: 'user' | 'admin'
}
const currentUser = ref<AuthUser | null>(null)
const searchKeyword = ref('')
const searchKeywordApplied = ref('')
const postModalVisible = ref(false)
const postTitle = ref('')
const postContent = ref('')
const postTag = ref('')
const postIsLive = ref(false)
const postError = ref('')
const authMode = ref<'login' | 'register'>('login')
const registerNickname = ref('')
const registerPassword = ref('')
const registerConfirmPassword = ref('')
const registerAge = ref('')
const registerGender = ref<'男' | '女' | '未知'>('未知')
const registerAvatarKey = ref<'eye' | 'ear' | 'mouth' | 'nose'>('nose')
const registerError = ref('')
const hasNewChat = ref(false)
const CHAT_READ_KEY = 'tq_bbs_chat_read_state'
const hasMyPostReplyAlert = ref(false)
const unreadPostReplyMap = ref<Record<string, boolean>>({})
const latestPostReplyAtMap = ref<Record<string, string>>({})
const POST_REPLY_READ_KEY = 'tq_bbs_post_reply_read_state'
const POST_FOLLOW_REPLY_READ_KEY = 'tq_bbs_follow_post_reply_read_state'
const hasFollowPostReplyAlert = ref(false)
const unreadFollowPostReplyMap = ref<Record<string, boolean>>({})
const latestFollowPostReplyAtMap = ref<Record<string, string>>({})
const POST_MENTION_READ_KEY = 'tq_bbs_post_mention_read_state'
const hasMentionAlert = ref(false)
const unreadMentionMap = ref<Record<string, boolean>>({})
const latestMentionAtMap = ref<Record<string, string>>({})
const posts = ref<HomePostItem[]>([])
const postsLoading = ref(true)
const postsLoadFailed = ref(false)
const deletingPostId = ref<string>('')
const deleteConfirmVisible = ref(false)
const pendingDeletePostId = ref('')
const avatarOptions = [
  { key: 'eye', label: '眼' },
  { key: 'ear', label: '耳' },
  { key: 'mouth', label: '口' },
  { key: 'nose', label: '鼻' },
] as const
type ApiPostItem = {
  id: string
  type: '' | '主页' | '精品' | '直播' | '我的'
  isFeatured?: boolean
  isPinned?: boolean
  tag: string
  title: string
  authorName: string
  avatarUrl: string
}

const followingNicknames = ref<string[]>([])
const followingLoaded = ref(false)

const loadFollowing = async () => {
  if (!isLoggedIn.value || !currentUser.value?.id) {
    followingNicknames.value = []
    followingLoaded.value = true
    return
  }
  try {
    const data = await apiRequest<Array<{ id: string; nickname: string; avatarUrl: string }>>('/api/users/following', { auth: true })
    followingNicknames.value = Array.isArray(data) ? data.map((u) => u.nickname).filter(Boolean) : []
  } catch {
    followingNicknames.value = []
  } finally {
    followingLoaded.value = true
  }
}

const filteredPosts = computed(() => {
  const base =
    activeType.value === '主页'
      ? posts.value
      : activeType.value === '我的'
        ? isLoggedIn.value && currentUser.value
          ? posts.value.filter((item) => item.authorName === currentUser.value?.nickname)
          : []
        : activeType.value === '精品'
          ? posts.value.filter((item) => item.isFeatured || item.type === '精品')
        : activeType.value === '关注'
          ? isLoggedIn.value
            ? posts.value.filter((item) => followingNicknames.value.includes(item.authorName))
            : []
          : posts.value.filter((item) => item.type === activeType.value)
  const orderedBase = [...base].sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)))
  const keyword = searchKeywordApplied.value.trim().toLowerCase()
  if (!keyword) return orderedBase
  return orderedBase.filter((item) => item.title.toLowerCase().includes(keyword) || item.tag.toLowerCase().includes(keyword))
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredPosts.value.length / ITEMS_PER_PAGE)))
const pagedPosts = computed(() => {
  const start = (currentPage.value - 1) * ITEMS_PER_PAGE
  return filteredPosts.value.slice(start, start + ITEMS_PER_PAGE)
})

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value -= 1
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value += 1
}

const switchType = (type: (typeof postTypes)[number]) => {
  activeType.value = type
  currentPage.value = 1
  if (type === '关注' && isLoggedIn.value) {
    followingLoaded.value = false
    void loadFollowing()
  }
}

const openPost = (postId: string) => {
  try {
    markPostReplyAsRead(postId)
    markFollowPostReplyAsRead(postId)
    markMentionAsRead(postId)
  } catch {
    // Never block navigation when read-state persistence fails.
  }
  router.push(`/posts/${postId}`)
}

const deletePost = async (postId: string) => {
  if (!isLoggedIn.value || !currentUser.value) return
  if (!postId) return

  if (
    postId &&
    posts.value.find((p) => p.id === postId && p.authorName !== currentUser.value?.nickname) &&
    currentUser.value.role !== 'admin'
  ) {
    // Safety: "我的" 列表正常情况下只包含自己，但这里兜底。
    return
  }
  pendingDeletePostId.value = postId
  deleteConfirmVisible.value = true
}

const featuringPostId = ref('')
const pinningPostId = ref('')
const toggleFeatured = async (post: HomePostItem) => {
  if (!isLoggedIn.value || !currentUser.value || currentUser.value.role !== 'admin') return
  if (!post.id) return
  featuringPostId.value = post.id
  try {
    if (post.isFeatured) {
      await apiRequest(`/api/posts/${encodeURIComponent(post.id)}/featured`, { method: 'DELETE', auth: true })
      post.isFeatured = false
      if (post.type === '精品') post.type = '主页'
    } else {
      await apiRequest(`/api/posts/${encodeURIComponent(post.id)}/featured`, { method: 'POST', auth: true })
      post.isFeatured = true
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
  } finally {
    featuringPostId.value = ''
  }
}

const togglePinned = async (post: HomePostItem) => {
  if (!isLoggedIn.value || !currentUser.value || currentUser.value.role !== 'admin') return
  if (!post.id) return
  pinningPostId.value = post.id
  try {
    if (post.isPinned) {
      await apiRequest(`/api/posts/${encodeURIComponent(post.id)}/pinned`, { method: 'DELETE', auth: true })
      post.isPinned = false
    } else {
      await apiRequest(`/api/posts/${encodeURIComponent(post.id)}/pinned`, { method: 'POST', auth: true })
      post.isPinned = true
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
  } finally {
    pinningPostId.value = ''
  }
}

const withoutPostKey = (map: Record<string, string> | Record<string, boolean>, postId: string) => {
  const next: Record<string, string | boolean> = {}
  Object.keys(map).forEach((key) => {
    if (key !== postId) next[key] = map[key]
  })
  return next
}

const cancelDeletePost = () => {
  if (deletingPostId.value) return
  deleteConfirmVisible.value = false
  pendingDeletePostId.value = ''
}

const confirmDeletePost = async () => {
  const postId = pendingDeletePostId.value
  if (!postId) return
  deletingPostId.value = postId
  try {
    await apiRequest(`/api/posts/${encodeURIComponent(postId)}`, { method: 'DELETE', auth: true })
    posts.value = posts.value.filter((p) => p.id !== postId)

    // Remove read-state entries so alerts don't show stale flags.
    const uid = currentUser.value?.id
    if (uid) {
      const followReadAll = getFollowPostReplyReadState()
      const followMine = followReadAll[uid] ?? {}
      delete followMine[postId]
      followReadAll[uid] = followMine
      localStorage.setItem(POST_FOLLOW_REPLY_READ_KEY, JSON.stringify(followReadAll))

      const mentionReadAll = getMentionReadState()
      const mentionMine = mentionReadAll[uid] ?? {}
      delete mentionMine[postId]
      mentionReadAll[uid] = mentionMine
      localStorage.setItem(POST_MENTION_READ_KEY, JSON.stringify(mentionReadAll))
    }
    const readAll = getPostReplyReadState()
    if (currentUser.value?.id) {
      const mine = readAll[currentUser.value.id] ?? {}
      delete mine[postId]
      readAll[currentUser.value.id] = mine
    }
    localStorage.setItem(POST_REPLY_READ_KEY, JSON.stringify(readAll))

    unreadPostReplyMap.value = withoutPostKey(unreadPostReplyMap.value, postId) as Record<string, boolean>
    latestPostReplyAtMap.value = withoutPostKey(latestPostReplyAtMap.value, postId) as Record<string, string>
    unreadFollowPostReplyMap.value = withoutPostKey(unreadFollowPostReplyMap.value, postId) as Record<string, boolean>
    latestFollowPostReplyAtMap.value = withoutPostKey(latestFollowPostReplyAtMap.value, postId) as Record<string, string>
    unreadMentionMap.value = withoutPostKey(unreadMentionMap.value, postId) as Record<string, boolean>
    latestMentionAtMap.value = withoutPostKey(latestMentionAtMap.value, postId) as Record<string, string>

    hasMyPostReplyAlert.value = Object.values(unreadPostReplyMap.value).some(Boolean)
    hasFollowPostReplyAlert.value = Object.values(unreadFollowPostReplyMap.value).some(Boolean)
    hasMentionAlert.value = Object.values(unreadMentionMap.value).some(Boolean)
  } catch (error) {
    // Keep UI stable; we don't want to block navigation when delete fails.
    // eslint-disable-next-line no-console
    console.error(error)
  } finally {
    deletingPostId.value = ''
    deleteConfirmVisible.value = false
    pendingDeletePostId.value = ''
  }
}

const openChatPage = () => {
  if (!isLoggedIn.value) {
    void router.replace({ path: '/home', query: { ...route.query, login: '1', redirect: '/chat' } })
    showLoginModal()
    return
  }
  hasNewChat.value = false
  router.push('/chat')
}

const doSearch = () => {
  searchKeywordApplied.value = searchKeyword.value.trim()
  currentPage.value = 1
}

const showPostModal = () => {
  postModalVisible.value = true
  postTitle.value = ''
  postContent.value = ''
  postTag.value = ''
  postIsLive.value = false
  postError.value = ''
}

const closePostModal = () => {
  postModalVisible.value = false
}

const showLoginModal = () => {
  loginModalVisible.value = true
  authMode.value = 'login'
  loginError.value = ''
  registerError.value = ''
}

const handleCircleClick = () => {
  if (isLoggedIn.value) {
    router.push('/profile')
    return
  }
  showLoginModal()
}

const closeLoginModal = () => {
  loginModalVisible.value = false
  if (String(route.query.login || '').trim() === '1') {
    const nextQuery: Record<string, string> = {}
    Object.entries(route.query).forEach(([key, value]) => {
      if (key === 'login' || key === 'redirect') return
      if (typeof value === 'string') nextQuery[key] = value
    })
    void router.replace({ path: '/home', query: nextQuery })
  }
}

// 仅持久化 uid + token，避免把密码写入本地存储
const persistAuth = (uid: string, token: string) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ uid, token }))
}

const loadCurrentUser = async () => {
  try {
    const data = await apiRequest<{
      uid: string
      user: { id: string; nickname: string; avatarUrl: string; age: string; gender: '男' | '女' | '未知'; role?: 'user' | 'admin' }
    }>('/api/auth/me', { auth: true })
    currentUser.value = {
      id: data.user.id,
      uid: data.uid,
      nickname: data.user.nickname,
      avatarUrl: resolveDisplayAvatarUrl(data.user.avatarUrl),
      age: data.user.age || '未知',
      gender: data.user.gender || '未知',
      role: data.user.role === 'admin' ? 'admin' : 'user',
    }
    isLoggedIn.value = true
    return true
  } catch {
    currentUser.value = null
    isLoggedIn.value = false
    return false
  }
}

const restoreAuth = async () => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) return false
  const ok = await loadCurrentUser()
  if (!ok) localStorage.removeItem(AUTH_STORAGE_KEY)
  return ok
}

const refreshSecondaryData = () => {
  if (!currentUser.value?.id) return
  void loadHomeAlerts()
}

const loadBackendPosts = async () => {
  postsLoading.value = true
  postsLoadFailed.value = false
  try {
    const data = await apiRequest<ApiPostItem[]>('/api/posts')
    const list = Array.isArray(data) ? data : []
    posts.value = list.map((item) => ({
      id: item.id,
      type: item.isFeatured ? '精品' : item.type || '主页',
      isFeatured: Boolean(item.isFeatured),
      isPinned: Boolean(item.isPinned),
      tag: item.tag || '讨论',
      title: item.title || '未命名帖子',
      authorName: item.authorName || '匿名用户',
      avatarUrl: resolveDisplayAvatarUrl(item.avatarUrl),
    }))
  } catch {
    postsLoadFailed.value = true
    if (import.meta.env.DEV) {
      posts.value = [...homePosts]
    } else {
      posts.value = []
    }
  } finally {
    postsLoading.value = false
    if (currentUser.value?.id) deferIdle(() => void loadHomeAlerts())
  }
}

const getPostReplyReadState = () => {
  try {
    const raw = localStorage.getItem(POST_REPLY_READ_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const normalized: Record<string, Record<string, string>> = {}
    Object.entries(parsed || {}).forEach(([userId, value]) => {
      if (!value || typeof value !== 'object') return
      const perPost: Record<string, string> = {}
      Object.entries(value as Record<string, unknown>).forEach(([postId, ts]) => {
        if (typeof ts === 'string') perPost[postId] = ts
      })
      normalized[userId] = perPost
    })
    return normalized
  } catch {
    return {}
  }
}

const markPostReplyAsRead = (postId: string) => {
  const userId = currentUser.value?.id
  if (!userId || !postId) return
  const latest = latestPostReplyAtMap.value[postId]
  if (!latest) return
  const all = getPostReplyReadState()
  const mine = all[userId] ?? {}
  mine[postId] = latest
  all[userId] = mine
  localStorage.setItem(POST_REPLY_READ_KEY, JSON.stringify(all))
  unreadPostReplyMap.value = { ...unreadPostReplyMap.value, [postId]: false }
  hasMyPostReplyAlert.value = Object.values(unreadPostReplyMap.value).some(Boolean)
}

type NotificationSummary = {
  chat: Array<{ contactId: string; latestIncomingAt: string }>
  myPostReplies: Array<{ postId: string; latestIncomingAt: string }>
  followPostReplies: Array<{ postId: string; latestIncomingAt: string }>
  mentions: Array<{ postId: string; latestMentionAt: string }>
}

const buildPostAlertMaps = (
  items: Array<{ postId: string; latestAt: string }>,
  readMap: Record<string, string>,
) => {
  const unreadMap: Record<string, boolean> = {}
  const latestMap: Record<string, string> = {}
  items.forEach(({ postId, latestAt }) => {
    latestMap[postId] = latestAt
    unreadMap[postId] = latestAt > (readMap[postId] || '')
  })
  return { unreadMap, latestMap }
}

const applyNotificationSummary = (data: NotificationSummary) => {
  const userId = currentUser.value?.id
  if (!userId) return

  const chatRead = getReadState()[userId] ?? {}
  hasNewChat.value = (data.chat ?? []).some(
    (item) => item.latestIncomingAt && item.latestIncomingAt > (chatRead[item.contactId] || ''),
  )

  const myReplyRead = getPostReplyReadState()[userId] ?? {}
  const myMaps = buildPostAlertMaps(
    (data.myPostReplies ?? []).map((item) => ({ postId: item.postId, latestAt: item.latestIncomingAt })),
    myReplyRead,
  )
  latestPostReplyAtMap.value = myMaps.latestMap
  unreadPostReplyMap.value = myMaps.unreadMap
  hasMyPostReplyAlert.value = Object.values(myMaps.unreadMap).some(Boolean)

  const followReplyRead = getFollowPostReplyReadState()[userId] ?? {}
  const followMaps = buildPostAlertMaps(
    (data.followPostReplies ?? []).map((item) => ({ postId: item.postId, latestAt: item.latestIncomingAt })),
    followReplyRead,
  )
  latestFollowPostReplyAtMap.value = followMaps.latestMap
  unreadFollowPostReplyMap.value = followMaps.unreadMap
  hasFollowPostReplyAlert.value = Object.values(followMaps.unreadMap).some(Boolean)

  const mentionRead = getMentionReadState()[userId] ?? {}
  const mentionMaps = buildPostAlertMaps(
    (data.mentions ?? []).map((item) => ({ postId: item.postId, latestAt: item.latestMentionAt })),
    mentionRead,
  )
  latestMentionAtMap.value = mentionMaps.latestMap
  unreadMentionMap.value = mentionMaps.unreadMap
  hasMentionAlert.value = Object.values(mentionMaps.unreadMap).some(Boolean)
}

const resetHomeAlerts = () => {
  hasNewChat.value = false
  hasMyPostReplyAlert.value = false
  hasFollowPostReplyAlert.value = false
  hasMentionAlert.value = false
  unreadPostReplyMap.value = {}
  unreadFollowPostReplyMap.value = {}
  unreadMentionMap.value = {}
  latestPostReplyAtMap.value = {}
  latestFollowPostReplyAtMap.value = {}
  latestMentionAtMap.value = {}
}

const loadHomeAlerts = async () => {
  const userId = currentUser.value?.id
  if (!userId) {
    resetHomeAlerts()
    return
  }
  try {
    const data = await apiRequest<NotificationSummary>('/api/notifications/summary', { auth: true })
    applyNotificationSummary(data)
  } catch {
    resetHomeAlerts()
  }
}

const getReadState = () => {
  try {
    const raw = localStorage.getItem(CHAT_READ_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, Record<string, string>>
  } catch {
    return {}
  }
}

const getFollowPostReplyReadState = () => {
  try {
    const raw = localStorage.getItem(POST_FOLLOW_REPLY_READ_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const normalized: Record<string, Record<string, string>> = {}
    Object.entries(parsed || {}).forEach(([userId, value]) => {
      if (!value || typeof value !== 'object') return
      const perPost: Record<string, string> = {}
      Object.entries(value as Record<string, unknown>).forEach(([postId, ts]) => {
        if (typeof ts === 'string') perPost[postId] = ts
      })
      normalized[userId] = perPost
    })
    return normalized
  } catch {
    return {}
  }
}

const markFollowPostReplyAsRead = (postId: string) => {
  const userId = currentUser.value?.id
  if (!userId || !postId) return
  const latest = latestFollowPostReplyAtMap.value[postId]
  if (!latest) return

  const all = getFollowPostReplyReadState()
  const mine = all[userId] ?? {}
  mine[postId] = latest
  all[userId] = mine
  localStorage.setItem(POST_FOLLOW_REPLY_READ_KEY, JSON.stringify(all))

  unreadFollowPostReplyMap.value = { ...unreadFollowPostReplyMap.value, [postId]: false }
  hasFollowPostReplyAlert.value = Object.values(unreadFollowPostReplyMap.value).some(Boolean)
}

const getMentionReadState = () => {
  try {
    const raw = localStorage.getItem(POST_MENTION_READ_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const normalized: Record<string, Record<string, string>> = {}
    Object.entries(parsed || {}).forEach(([userId, value]) => {
      if (!value || typeof value !== 'object') return
      const perPost: Record<string, string> = {}
      Object.entries(value as Record<string, unknown>).forEach(([postId, ts]) => {
        if (typeof ts === 'string') perPost[postId] = ts
      })
      normalized[userId] = perPost
    })
    return normalized
  } catch {
    return {}
  }
}

const markMentionAsRead = (postId: string) => {
  const userId = currentUser.value?.id
  if (!userId || !postId) return
  const latest = latestMentionAtMap.value[postId]
  if (!latest) return
  const all = getMentionReadState()
  const mine = all[userId] ?? {}
  mine[postId] = latest
  all[userId] = mine
  localStorage.setItem(POST_MENTION_READ_KEY, JSON.stringify(all))
  unreadMentionMap.value = { ...unreadMentionMap.value, [postId]: false }
  hasMentionAlert.value = Object.values(unreadMentionMap.value).some(Boolean)
}

const handlePostRead = (e: Event) => {
  const ce = e as CustomEvent<{ postId?: string }>
  const nextPostId = String(ce.detail?.postId || '').trim()
  if (!nextPostId) return

  unreadPostReplyMap.value = { ...unreadPostReplyMap.value, [nextPostId]: false }
  unreadFollowPostReplyMap.value = { ...unreadFollowPostReplyMap.value, [nextPostId]: false }
  unreadMentionMap.value = { ...unreadMentionMap.value, [nextPostId]: false }
  hasMyPostReplyAlert.value = Object.values(unreadPostReplyMap.value).some(Boolean)
  hasFollowPostReplyAlert.value = Object.values(unreadFollowPostReplyMap.value).some(Boolean)
  hasMentionAlert.value = Object.values(unreadMentionMap.value).some(Boolean)
  void loadHomeAlerts()
}

const handleChatRead = () => {
  void loadHomeAlerts()
}

const handlePostReplied = (e: Event) => {
  const ce = e as CustomEvent<{ postId?: string }>
  const nextPostId = String(ce.detail?.postId || '').trim()
  if (!nextPostId) return
  const userId = currentUser.value?.id
  if (!userId) return

  const now = new Date().toISOString()

  // Persist read-state so prompts won't re-appear after refresh.
  try {
    const postAll = getPostReplyReadState()
    const mine = postAll[userId] ?? {}
    mine[nextPostId] = now
    postAll[userId] = mine
    localStorage.setItem(POST_REPLY_READ_KEY, JSON.stringify(postAll))
  } catch {
    // ignore
  }

  try {
    const followAll = getFollowPostReplyReadState()
    const mine = followAll[userId] ?? {}
    mine[nextPostId] = now
    followAll[userId] = mine
    localStorage.setItem(POST_FOLLOW_REPLY_READ_KEY, JSON.stringify(followAll))
  } catch {
    // ignore
  }

  // Immediate UI update (Home page may stay mounted).
  unreadPostReplyMap.value = { ...unreadPostReplyMap.value, [nextPostId]: false }
  unreadFollowPostReplyMap.value = { ...unreadFollowPostReplyMap.value, [nextPostId]: false }
  hasMyPostReplyAlert.value = Object.values(unreadPostReplyMap.value).some(Boolean)
  hasFollowPostReplyAlert.value = Object.values(unreadFollowPostReplyMap.value).some(Boolean)
}

const doLogin = async () => {
  const account = loginAccount.value.trim()
  const password = loginPassword.value

  try {
    const data = await apiRequest<{
      token: string
      uid: string
      user: { id: string; nickname: string; avatarUrl: string; age: string; gender: '男' | '女' | '未知'; role?: 'user' | 'admin' }
    }>('/api/auth/login', {
      method: 'POST',
      body: { account, password },
    })

    currentUser.value = {
      id: data.user.id,
      uid: data.uid,
      nickname: data.user.nickname,
      avatarUrl: resolveDisplayAvatarUrl(data.user.avatarUrl),
      age: data.user.age || '未知',
      gender: data.user.gender || '未知',
      role: data.user.role === 'admin' ? 'admin' : 'user',
    }
    isLoggedIn.value = true
    persistAuth(data.uid, data.token)
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : '后端登录失败，请稍后重试'
    return
  }

  loginModalVisible.value = false
  loginAccount.value = ''
  loginPassword.value = ''
  loginError.value = ''

  const redirect = String(route.query.redirect || '').trim()
  if (redirect) {
    const target = redirect.startsWith('/') ? redirect : `/${redirect}`
    void router.replace(target)
  }
}

const switchToRegister = () => {
  authMode.value = 'register'
  loginError.value = ''
  registerError.value = ''
  registerGender.value = '未知'
  registerAvatarKey.value = 'nose'
  registerAge.value = ''
}

const switchToLogin = () => {
  authMode.value = 'login'
  registerError.value = ''
}

const doRegister = async () => {
  const nickname = registerNickname.value.trim()
  const password = registerPassword.value
  const confirmPassword = registerConfirmPassword.value
  const age = registerAge.value.trim()

  if (!nickname || !password || !confirmPassword || !age) {
    registerError.value = '请完整填写注册信息'
    return
  }
  if (!/^\d{1,3}$/.test(age)) {
    registerError.value = '年龄请输入 1-3 位数字'
    return
  }
  if (password !== confirmPassword) {
    registerError.value = '两次输入的密码不一致'
    return
  }
  try {
    await apiRequest<{ uid: string; user: { nickname: string; avatarUrl: string } }>('/api/auth/register', {
      method: 'POST',
      body: {
        nickname,
        password,
        age,
        gender: registerGender.value,
        avatarUrl: registerAvatarKey.value,
      },
    })
  } catch (error) {
    registerError.value = error instanceof Error ? error.message : '后端注册失败，请稍后重试'
    return
  }
  authMode.value = 'login'
  loginAccount.value = nickname
  loginPassword.value = ''
  registerNickname.value = ''
  registerPassword.value = ''
  registerConfirmPassword.value = ''
  registerAge.value = ''
  registerGender.value = '未知'
  registerAvatarKey.value = 'nose'
  registerError.value = ''
}

const submitPost = async () => {
  const title = postTitle.value.trim()
  const content = postContent.value.trim()
  if (!title) {
    postError.value = '请填写帖子标题'
    return
  }
  if (!content) {
    postError.value = '请填写帖子内容'
    return
  }
  const tag = postTag.value.trim()
  if (!postIsLive.value && (!tag || tag.length !== 2)) {
    postError.value = '非直播贴标签必须输入2个字'
    return
  }

  if (!isLoggedIn.value || !currentUser.value) {
    postError.value = '请先登录后再发帖'
    return
  }

  try {
    const data = await apiRequest<{
      id: string
      type: '' | '主页' | '精品' | '直播' | '我的'
      isFeatured?: boolean
      isPinned?: boolean
      tag: string
      title: string
      authorName: string
      avatarUrl: string
    }>('/api/posts', {
      method: 'POST',
      auth: true,
      body: { title, content, tag, isLive: postIsLive.value },
    })
    posts.value.unshift({
      id: data.id,
      type: data.isFeatured ? '精品' : data.type,
      isFeatured: Boolean(data.isFeatured),
      isPinned: Boolean(data.isPinned),
      tag: data.tag,
      title: data.title,
      authorName: data.authorName || currentUser.value.nickname,
      avatarUrl: resolveDisplayAvatarUrl(data.avatarUrl || currentUser.value.avatarUrl),
    })
  } catch (error) {
    postError.value = error instanceof Error ? error.message : '发帖失败，请稍后重试'
    return
  }

  postTitle.value = ''
  postContent.value = ''
  postTag.value = ''
  postIsLive.value = false
  postError.value = ''
  postModalVisible.value = false
  activeType.value = '我的'
  searchKeyword.value = ''
  searchKeywordApplied.value = ''
  currentPage.value = 1
}

const headerUserName = computed(() => (isLoggedIn.value ? currentUser.value?.nickname ?? '佚名' : '未登录'))
const headerUid = computed(() => (isLoggedIn.value ? currentUser.value?.uid ?? '0000000' : '0000000'))
/** 未登录也显示默认头像，避免 token 失效（401）时整圈空白像「裂图」 */
const circleAvatarUrl = computed(() => resolveDisplayAvatarUrl(currentUser.value?.avatarUrl))
const isAdmin = computed(() => currentUser.value?.role === 'admin')

watch(totalPages, () => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
})

watch(
  () => currentUser.value?.id,
  (userId) => {
    if (!userId) return
    followingLoaded.value = false
    void loadFollowing()
    deferIdle(refreshSecondaryData)
  },
)

onMounted(() => {
  const typeFromQuery = String(route.query.type || '').trim()
  if (postTypes.includes(typeFromQuery as (typeof postTypes)[number])) {
    activeType.value = typeFromQuery as (typeof postTypes)[number]
    currentPage.value = 1
  }

  void loadBackendPosts()
  void restoreAuth().then((loggedIn) => {
    if (loggedIn) deferIdle(refreshSecondaryData)
  })

  window.addEventListener('tq_bbs_post_replied', handlePostReplied)
  window.addEventListener('tq_bbs_post_read', handlePostRead)
  window.addEventListener('tq_bbs_chat_read', handleChatRead)
  if (String(route.query.login || '').trim() === '1') {
    showLoginModal()
  }
})

onUnmounted(() => {
  window.removeEventListener('tq_bbs_post_replied', handlePostReplied)
  window.removeEventListener('tq_bbs_post_read', handlePostRead)
  window.removeEventListener('tq_bbs_chat_read', handleChatRead)
})
</script>

<template>
  <div class="tq-panel relative h-full flex flex-col overflow-hidden">
    <header class="tq-home-header shrink-0 border-b border-[var(--tq-line)] px-14px py-12px">
      <div class="tq-home-header__info min-w-0 truncate pt-4px text-danger">
        用户：{{ headerUserName }}　UID：{{ headerUid }}
      </div>
      <div class="tq-home-header__actions">
        <div class="mb-10px flex gap-0">
          <input
            v-model="searchKeyword"
            class="tq-input min-w-0 flex-1 rounded-r-none py-8px text-danger"
            placeholder="搜索"
            @keydown.enter="doSearch"
          />
          <button class="tq-btn shrink-0 rounded-l-none px-12px py-8px whitespace-nowrap sm:px-16px" @click="doSearch">搜索</button>
        </div>
        <div class="tq-home-header__avatar-row">
          <button
            type="button"
            class="tq-avatar-xl ml-auto overflow-hidden rounded-full border-[5px] border-black bg-danger/90 p-0"
            :title="isLoggedIn ? '进入档案' : '点击登录'"
            @click="handleCircleClick"
          >
            <img :src="circleAvatarUrl" alt="用户头像" class="h-full w-full rounded-full object-cover" loading="lazy" decoding="async" />
          </button>
          <button class="tq-btn relative min-w-90px sm:min-w-120px h-36px sm:h-40px shrink-0" @click="openChatPage">
            私聊
            <span
              v-if="hasNewChat"
              class="pointer-events-none absolute -right-8px -top-8px inline-flex h-18px min-w-18px items-center justify-center rounded-2px bg-[#ff2a2a] px-4px text-12px font-800 leading-none text-black"
              aria-label="私聊有新消息"
            >!</span>
          </button>
        </div>
      </div>
    </header>

    <div class="tq-home-body flex min-h-0 flex-col">
      <section class="relative min-h-0 flex-1 bg-[rgba(103,149,166,.22)] px-10px py-10px">
        <nav class="border-b border-[var(--tq-line)] px-8px py-8px sm:px-12px sm:py-10px">
          <div class="tq-home-tabs">
            <button
              v-for="type in postTypes"
              :key="type"
              class="relative"
              :class="activeType === type ? 'tq-btn' : 'tq-btn-ghost'"
              @click="switchType(type)"
            >
              {{ type }}
              <span
                v-if="(type === '我的' && hasMyPostReplyAlert) || (type === '关注' && hasFollowPostReplyAlert) || (type === '主页' && hasMentionAlert)"
                class="pointer-events-none absolute -right-8px -top-8px inline-flex h-18px min-w-18px items-center justify-center rounded-2px bg-[#ff2a2a] px-4px text-12px font-800 leading-none text-black"
                aria-label="帖子有新回复或被提及"
              >!</span>
            </button>
          </div>
        </nav>

       <div class="relative z-1 mt-8px h-[calc(100%-58px)] overflow-hidden pr-2px">
          <div v-if="postsLoading" class="tq-home-post-list h-full">
            <div
              v-for="n in 3"
              :key="n"
              class="tq-home-post-card animate-pulse border border-[var(--tq-line)] bg-[rgba(0,0,0,.24)] p-10px"
            >
              <div class="tq-home-post-card__row">
                <div class="tq-avatar-md rounded-full bg-danger/25" />
                <div class="h-16px flex-1 rounded-2px bg-danger/20" />
              </div>
            </div>
          </div>
          <div v-else-if="pagedPosts.length" class="tq-home-post-list h-full overflow-auto">
          <article
            v-for="item in pagedPosts"
            :key="item.id"
            class="tq-home-post-card group relative min-h-0 flex-1 cursor-pointer border border-[var(--tq-line)] bg-[rgba(0,0,0,.24)] p-10px transition hover:bg-[rgba(180,20,20,.18)]"
            @click="openPost(item.id)"
          >
            <div class="tq-home-post-card__row h-full">
              <img
                :src="resolveDisplayAvatarUrl(item.avatarUrl)"
                alt="帖子头像"
                class="tq-avatar-md shrink-0 rounded-full border-[5px] border-black object-cover"
                loading="lazy"
                decoding="async"
              />
              <h3 class="tq-home-post-card__title m-0 min-w-0 flex-1 text-[var(--tq-text-md)] font-700 leading-[1.35] text-danger">
                <span
                  v-if="item.isPinned"
                  class="mr-4px inline-flex items-center rounded-2px border border-danger/60 bg-danger/20 px-3px py-0 text-10px tracking-1px text-danger"
                >
                  置顶
                </span>
                「{{ item.tag }}」{{ item.title }}
                <span
                  v-if="(activeType === '我的' && unreadPostReplyMap[item.id]) || (activeType === '关注' && unreadFollowPostReplyMap[item.id]) || unreadMentionMap[item.id]"
                  class="pointer-events-none ml-4px inline-flex h-16px min-w-16px items-center justify-center rounded-2px bg-[#ff2a2a] px-3px text-10px font-800 leading-none text-black"
                  aria-label="该帖子有新回复或被提及"
                >!</span>
              </h3>
              <div class="tq-post-row__actions tq-home-post-card__actions" @click.stop>
                <button
                  v-if="isAdmin"
                  class="tq-btn-ghost px-8px py-4px sm:px-12px sm:py-6px text-10px sm:text-12px"
                  :disabled="pinningPostId === item.id"
                  @click="togglePinned(item)"
                >
                  {{ pinningPostId === item.id ? '处理中...' : item.isPinned ? '取消置顶' : '置顶' }}
                </button>

                <button
                  v-if="isAdmin"
                  class="tq-btn-ghost px-8px py-4px sm:px-12px sm:py-6px text-10px sm:text-12px"
                  :disabled="featuringPostId === item.id"
                  @click="toggleFeatured(item)"
                >
                  {{ featuringPostId === item.id ? '处理中...' : item.isFeatured ? '取消精品' : '加精' }}
                </button>

                <button
                  v-if="isLoggedIn && currentUser && (item.authorName === currentUser.nickname || isAdmin)"
                  class="tq-btn-ghost px-8px py-4px sm:px-12px sm:py-6px text-10px sm:text-12px"
                  :disabled="deletingPostId === item.id"
                  @click="deletePost(item.id)"
                >
                  {{ deletingPostId === item.id ? '删除中...' : '删除' }}
                </button>
              </div>
            </div>
          </article>
          </div>
          <div v-if="!postsLoading && pagedPosts.length === 0" class="flex h-full items-center justify-center text-14px text-muted">
            {{
              postsLoadFailed
                ? '帖子加载失败，请检查网络或稍后刷新'
                : activeType === '我的' && !isLoggedIn
                  ? '请先登录后查看“我的帖子”'
                  : activeType === '关注' && !isLoggedIn
                    ? '请先登录后查看“关注”帖子'
                    : searchKeywordApplied
                      ? '未搜索到相关帖子'
                      : '当前分类暂无帖子'
            }}
          </div>
        </div>

        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,.08),transparent_48%)]" />
      </section>

      <footer class="shrink-0 flex flex-wrap items-center justify-between gap-8px border-t border-[var(--tq-line)] bg-[rgba(214,234,242,.25)] px-10px py-8px sm:px-12px sm:py-10px">
        <button
          class="text-22px sm:text-28px leading-none text-danger"
          :class="{ 'opacity-40 cursor-not-allowed': currentPage === 1 }"
          @click="prevPage"
        >
          &lt;
        </button>
        <div class="text-14px sm:text-18px tracking-2px sm:tracking-6px text-danger">{{ currentPage }} / {{ totalPages }}</div>
        <button
          class="text-22px sm:text-28px leading-none text-danger"
          :class="{ 'opacity-40 cursor-not-allowed': currentPage === totalPages }"
          @click="nextPage"
        >
          &gt;
        </button>
        <button class="tq-btn ml-auto min-w-90px sm:min-w-120px" @click="showPostModal">发帖</button>
      </footer>
    </div>

    <div
      v-if="postModalVisible"
      class="absolute inset-0 z-25 flex items-center justify-center bg-black/65 px-16px"
      @click.self="closePostModal"
    >
      <div class="w-full max-w-460px border border-[var(--tq-line)] bg-panel p-14px">
        <div class="mb-12px flex items-center justify-between text-danger">
          <span class="text-16px font-700">发帖</span>
          <button class="text-22px leading-none" @click="closePostModal">×</button>
        </div>

        <div class="space-y-10px">
          <input v-model="postTitle" class="tq-input rounded-none text-danger" placeholder="输入帖子标题" />
          <input
            v-model="postTag"
            class="tq-input rounded-none text-danger"
            maxlength="2"
            :placeholder="postIsLive ? '直播贴可不填标签（填了需2字）' : '非直播贴必填2字标签（例如：故事）'"
          />
          <label class="flex items-center gap-8px text-13px text-danger/85">
            <input v-model="postIsLive" type="checkbox" />
            直播帖子（发布后会显示在“主页”和“直播”）
          </label>
          <textarea
            v-model="postContent"
            class="tq-input h-96px w-full resize-none rounded-none text-danger leading-[1.6]"
            placeholder="输入帖子内容"
          />
        </div>

        <p v-if="postError" class="m-0 mt-10px text-13px text-danger">{{ postError }}</p>

        <div class="mt-14px flex items-center gap-10px">
          <button class="tq-btn-ghost flex-1 rounded-none" @click="closePostModal">取消</button>
          <button class="tq-btn flex-1 rounded-none" @click="submitPost">确认发帖</button>
        </div>
      </div>
    </div>

    <div
      v-if="loginModalVisible"
      class="absolute inset-0 z-20 flex items-center justify-center bg-black/65 px-16px"
      @click.self="closeLoginModal"
    >
      <div class="w-full max-w-420px border border-[var(--tq-line)] bg-panel p-14px">
        <div class="mb-12px flex items-center justify-between text-danger">
          <span class="text-16px font-700">{{ authMode === 'login' ? '登录' : '注册' }}</span>
          <button class="text-22px leading-none" @click="closeLoginModal">×</button>
        </div>

        <div v-if="authMode === 'login'" class="space-y-10px">
          <input v-model="loginAccount" class="tq-input rounded-none text-danger" placeholder="输入用户名" />
          <input
            v-model="loginPassword"
            type="password"
            class="tq-input rounded-none text-danger"
            placeholder="输入密码"
            @keydown.enter="doLogin"
          />
        </div>
        <div v-else class="space-y-10px">
          <input v-model="registerNickname" class="tq-input rounded-none text-danger" placeholder="输入用户名" />
          <input
            v-model="registerPassword"
            type="password"
            class="tq-input rounded-none text-danger"
            placeholder="输入密码"
          />
          <input
            v-model="registerConfirmPassword"
            type="password"
            class="tq-input rounded-none text-danger"
            placeholder="确认密码"
            @keydown.enter="doRegister"
          />
          <input
            v-model="registerAge"
            type="text"
            inputmode="numeric"
            class="tq-input rounded-none text-danger"
            placeholder="输入年龄"
          />
          <div class="text-13px text-danger/85">选择性别</div>
          <div class="grid grid-cols-3 gap-8px">
            <button
              class="tq-btn-ghost rounded-none py-6px"
              :class="{ 'tq-tab-active': registerGender === '男' }"
              @click="registerGender = '男'"
            >
              男
            </button>
            <button
              class="tq-btn-ghost rounded-none py-6px"
              :class="{ 'tq-tab-active': registerGender === '女' }"
              @click="registerGender = '女'"
            >
              女
            </button>
            <button
              class="tq-btn-ghost rounded-none py-6px"
              :class="{ 'tq-tab-active': registerGender === '未知' }"
              @click="registerGender = '未知'"
            >
              未知
            </button>
          </div>
          <div class="text-13px text-danger/85">选择头像</div>
          <div class="grid grid-cols-4 gap-8px">
            <button
              v-for="item in avatarOptions"
              :key="item.key"
              class="tq-btn-ghost rounded-none p-6px"
              :class="{ 'tq-tab-active': registerAvatarKey === item.key }"
              @click="registerAvatarKey = item.key"
            >
              <img
                :src="avatarAssets[item.key]"
                :alt="`${item.label}头像`"
                class="mx-auto h-30px w-30px rounded-full border-[2px] border-black object-cover"
              />
              <span class="mt-4px block text-12px">{{ item.label }}</span>
            </button>
          </div>
        </div>

        <p v-if="authMode === 'login' && loginError" class="m-0 mt-10px text-13px text-danger">{{ loginError }}</p>
        <p v-if="authMode === 'register' && registerError" class="m-0 mt-10px text-13px text-danger">{{ registerError }}</p>

        <div class="mt-14px flex items-center gap-10px">
          <button class="tq-btn-ghost flex-1 rounded-none" @click="authMode === 'login' ? switchToRegister() : switchToLogin()">
            {{ authMode === 'login' ? '注册账号' : '返回登录' }}
          </button>
          <button class="tq-btn flex-1 rounded-none" @click="authMode === 'login' ? doLogin() : doRegister()">
            {{ authMode === 'login' ? '确认登录' : '确认注册' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="deleteConfirmVisible"
      class="absolute inset-0 z-30 flex items-center justify-center bg-black/65 px-16px"
      @click.self="cancelDeletePost"
    >
      <div class="w-full max-w-420px border border-[var(--tq-line)] bg-panel p-14px text-danger">
        <div class="mb-10px text-18px font-700">确认删除</div>
        <p class="m-0 text-14px text-danger/90">删除后无法恢复，确定删除这条帖子吗？</p>

        <div class="mt-14px flex items-center gap-10px">
          <button class="tq-btn-ghost flex-1 rounded-none" :disabled="Boolean(deletingPostId)" @click="cancelDeletePost">取消</button>
          <button class="tq-btn flex-1 rounded-none" :disabled="Boolean(deletingPostId)" @click="confirmDeletePost">
            {{ deletingPostId ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
