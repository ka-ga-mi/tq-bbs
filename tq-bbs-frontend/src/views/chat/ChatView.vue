<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { chatDataByUid, emptyChatData, type ChatDataset, type ChatMessage } from '../../mocks/chatData'
import { avatarAssets, resolveDisplayAvatarUrl } from '../../mocks/userProfile'
import { formatMessageTime, resolveMessageCreatedAt, shouldShowMessageTime } from '../../utils/messageTime'
import { apiRequest } from '../../api/client'

const route = useRoute()
const router = useRouter()
const activeContactId = ref('')
const replyContent = ref('')
const replyError = ref('')
const messageListRef = ref<HTMLElement | null>(null)
const backendMessages = ref<ChatMessage[]>([])
const backendChatData = ref<ChatDataset | null>(null)
const unreadContactMap = ref<Record<string, boolean>>({})
const latestIncomingAtMap = ref<Record<string, string>>({})
const CHAT_READ_KEY = 'tq_bbs_chat_read_state'
const deletingContactId = ref('')
const deleteContactModalVisible = ref(false)
const pendingDeleteContact = ref<{ id: string; name: string } | null>(null)
const mobileContactsOpen = ref(false)

type AuthUser = { id: string; uid: string; nickname: string; avatarUrl: string }
const currentUser = ref<AuthUser | null>(null)
const currentUserId = computed(() => currentUser.value?.id ?? '')
const currentUid = computed(() => currentUser.value?.uid ?? '')
const currentChatData = computed(() => chatDataByUid[currentUid.value] ?? emptyChatData)
const targetName = computed(() => String(route.query.target || '').trim())
const targetAvatar = computed(() => String(route.query.avatar || '').trim())
const targetUserId = computed(() => String(route.query.targetId || '').trim())
const targetContactId = computed(() => (targetName.value ? `route-target-${targetName.value}` : ''))
const singleTargetMode = computed(() => Boolean(targetUserId.value))
const targetContact = computed(() =>
  targetName.value
    ? {
        id: targetUserId.value || targetContactId.value,
        name: targetName.value,
        avatarUrl: resolveDisplayAvatarUrl(targetAvatar.value),
      }
    : null,
)

const currentChatContacts = computed(() => {
  if (backendChatData.value) {
    if (singleTargetMode.value && targetContact.value && !backendChatData.value.contacts.some((item) => item.id === targetContact.value?.id)) {
      return [targetContact.value, ...backendChatData.value.contacts]
    }
    return backendChatData.value.contacts
  }
  return currentChatData.value.contacts
})
const currentChatThreads = computed(() => backendChatData.value?.threads ?? currentChatData.value.threads)

const activeThread = computed(() => currentChatThreads.value.find((item) => item.contactId === activeContactId.value))
const activeMessages = computed(() => {
  if (activeThread.value) return activeThread.value.messages
  if (singleTargetMode.value) return backendMessages.value
  return []
})
const activeContactName = computed(() => {
  if (activeThread.value) return activeThread.value.contactName
  if (singleTargetMode.value) return targetName.value || '未选择会话'
  return '未选择会话'
})
const hasOtherUnread = computed(() =>
  Object.entries(unreadContactMap.value).some(([contactId, unread]) => unread && contactId !== activeContactId.value),
)

const selectContact = (contact: { id: string; name: string }) => {
  activeContactId.value = contact.id
  markContactAsRead(contact.id)
  mobileContactsOpen.value = false
}

const toggleMobileContacts = () => {
  mobileContactsOpen.value = !mobileContactsOpen.value
}

const goHome = () => router.push('/home')
const isMine = (message: ChatMessage) => message.from === 'me' || message.sender === myDisplayName.value

const openUserProfile = (message: ChatMessage) => {
  let userId = message.userId?.trim() || ''
  if (!userId) {
    userId = isMine(message) ? currentUserId.value : singleTargetMode.value ? targetUserId.value : activeContactId.value
  }
  if (!userId || userId.startsWith('c-') || userId.startsWith('route-target-')) {
    replyError.value = '该用户不可访问'
    return
  }
  if (!currentUser.value) {
    void router.push({
      path: '/home',
      query: { login: '1', redirect: `/users/${encodeURIComponent(userId)}` },
    })
    return
  }
  router.push(`/users/${encodeURIComponent(userId)}`)
}

const SCROLL_BOTTOM_THRESHOLD = 80

const isNearBottom = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_BOTTOM_THRESHOLD

const scrollToBottom = async (force = false) => {
  await nextTick()
  const el = messageListRef.value
  if (!el) return
  if (!force && !isNearBottom(el)) return
  el.scrollTop = el.scrollHeight
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

const markContactAsRead = (contactId: string) => {
  if (!contactId || !currentUserId.value) return
  const latestIncomingAt = latestIncomingAtMap.value[contactId]
  if (!latestIncomingAt) return
  const all = getReadState()
  const mine = all[currentUserId.value] ?? {}
  mine[contactId] = latestIncomingAt
  all[currentUserId.value] = mine
  localStorage.setItem(CHAT_READ_KEY, JSON.stringify(all))
  unreadContactMap.value = { ...unreadContactMap.value, [contactId]: false }
  window.dispatchEvent(new CustomEvent('tq_bbs_chat_read', { detail: { contactId } }))
}

const markActiveContactAsRead = () => {
  const contactId = singleTargetMode.value ? targetUserId.value || activeContactId.value : activeContactId.value
  if (contactId) markContactAsRead(contactId)
}

const hasChatHistory = (contactId: string) => {
  if (!contactId) return false
  const thread = currentChatThreads.value.find((item) => item.contactId === contactId)
  if (thread?.messages?.length) return true
  if (singleTargetMode.value && targetUserId.value === contactId) {
    return backendMessages.value.length > 0
  }
  return false
}

const requestDeleteContact = (contact: { id: string; name: string }) => {
  if (!hasChatHistory(contact.id)) return
  pendingDeleteContact.value = contact
  deleteContactModalVisible.value = true
}

const closeDeleteContactModal = () => {
  if (deletingContactId.value) return
  deleteContactModalVisible.value = false
  pendingDeleteContact.value = null
}

const removeContactReadState = (contactId: string) => {
  if (!currentUserId.value || !contactId) return
  const all = getReadState()
  const mine = all[currentUserId.value] ?? {}
  if (Object.prototype.hasOwnProperty.call(mine, contactId)) {
    delete mine[contactId]
    all[currentUserId.value] = mine
    localStorage.setItem(CHAT_READ_KEY, JSON.stringify(all))
  }
}

const confirmDeleteContact = async () => {
  const target = pendingDeleteContact.value
  if (!target?.id) return
  if (!hasChatHistory(target.id)) {
    closeDeleteContactModal()
    return
  }
  deletingContactId.value = target.id
  try {
    if (!target.id.startsWith('route-target-') && !target.id.startsWith('c-')) {
      await apiRequest(`/api/chat/conversations/${encodeURIComponent(target.id)}`, { method: 'DELETE', auth: true })
    }
    if (backendChatData.value) {
      backendChatData.value = {
        contacts: backendChatData.value.contacts.filter((c) => c.id !== target.id),
        threads: backendChatData.value.threads.filter((t) => t.contactId !== target.id),
      }
    } else {
      currentChatData.value.contacts = currentChatData.value.contacts.filter((c) => c.id !== target.id)
      currentChatData.value.threads = currentChatData.value.threads.filter((t) => t.contactId !== target.id)
    }
    unreadContactMap.value = { ...unreadContactMap.value, [target.id]: false }
    latestIncomingAtMap.value = { ...latestIncomingAtMap.value, [target.id]: '' }
    removeContactReadState(target.id)

    if (activeContactId.value === target.id) {
      const rest = currentChatContacts.value.filter((c) => c.id !== target.id)
      activeContactId.value = rest[0]?.id || ''
    }
    if (targetUserId.value && targetUserId.value === target.id) {
      backendMessages.value = []
    }
  } catch (error) {
    replyError.value = error instanceof Error ? error.message : '删除会话失败'
  } finally {
    deletingContactId.value = ''
    deleteContactModalVisible.value = false
    pendingDeleteContact.value = null
  }
}

const loadCurrentUser = async () => {
  try {
    const data = await apiRequest<{ uid: string; user: { id: string; nickname: string; avatarUrl: string } }>('/api/auth/me', { auth: true })
    currentUser.value = {
      id: data.user.id,
      uid: data.uid,
      nickname: data.user.nickname,
      avatarUrl: resolveDisplayAvatarUrl(data.user.avatarUrl),
    }
  } catch {
    currentUser.value = null
  }
}

const myDisplayName = computed(() => currentUser.value?.nickname || '佚名')
const myAvatarUrl = computed(() => currentUser.value?.avatarUrl || avatarAssets.nose)
const displaySender = (message: ChatMessage) => (isMine(message) ? myDisplayName.value : message.sender)
const displayAvatar = (message: ChatMessage) => {
  const avatar = isMine(message) ? myAvatarUrl.value : message.avatarUrl
  return avatar?.trim() || avatarAssets.nose
}

const showMessageTime = (index: number) => {
  const list = activeMessages.value
  const current = list[index]
  const previous = index > 0 ? list[index - 1] : undefined
  return shouldShowMessageTime(current?.createdAt, previous?.createdAt, current?.id, previous?.id)
}
const ensureRouteTargetThread = () => {
  if (singleTargetMode.value) return
  if (backendChatData.value) return
  if (!targetContact.value || !currentUid.value) return
  if (currentChatData.value.contacts.some((item) => item.name === targetContact.value?.name)) return

  currentChatData.value.contacts.unshift(targetContact.value)
  currentChatData.value.threads.unshift({
    contactId: targetContact.value.id,
    contactName: targetContact.value.name,
    messages: [
      {
        id: `m-route-${Date.now()}`,
        from: 'other',
        sender: targetContact.value.name,
        avatarUrl: targetContact.value.avatarUrl,
        content: '你好，我在帖子里看到了你的消息。',
      },
    ],
  })
}

const loadConversations = async () => {
  try {
    const data = await apiRequest<
      Array<{
        contactId: string
        contactName: string
        avatarUrl: string
        messages: Array<{ id: string; senderId: string; content: string; createdAt: string }>
      }>
    >('/api/chat/conversations', { auth: true })
    if (!Array.isArray(data)) return
    const allRead = getReadState()
    const myRead = allRead[currentUserId.value] ?? {}
    const nextUnreadMap: Record<string, boolean> = {}
    const nextLatestIncomingAtMap: Record<string, string> = {}

    backendChatData.value = {
      contacts: data.map((item) => ({
        id: item.contactId,
        name: item.contactName,
        avatarUrl: resolveDisplayAvatarUrl(item.avatarUrl),
      })),
      threads: data.map((item) => ({
        contactId: item.contactId,
        contactName: item.contactName,
        messages: (item.messages ?? []).map((msg) => ({
          id: msg.id,
          from: msg.senderId === currentUserId.value ? 'me' : 'other',
          sender: msg.senderId === currentUserId.value ? myDisplayName.value : item.contactName,
          avatarUrl: msg.senderId === currentUserId.value ? myAvatarUrl.value : resolveDisplayAvatarUrl(item.avatarUrl),
          content: msg.content || '',
          userId: msg.senderId,
          createdAt: resolveMessageCreatedAt(msg.createdAt, msg.id),
        })),
      })),
    }

    data.forEach((item) => {
      const incoming = (item.messages ?? []).filter((msg) => msg.senderId !== currentUserId.value)
      const latestIncomingAt = incoming[incoming.length - 1]?.createdAt || ''
      if (!latestIncomingAt) {
        nextUnreadMap[item.contactId] = false
        return
      }
      nextLatestIncomingAtMap[item.contactId] = latestIncomingAt
      const lastReadAt = myRead[item.contactId] || ''
      nextUnreadMap[item.contactId] = latestIncomingAt > lastReadAt
    })
    unreadContactMap.value = nextUnreadMap
    latestIncomingAtMap.value = nextLatestIncomingAtMap
  } catch {
    backendChatData.value = null
  }
}

type RawChatMessage = { id: string; senderId: string; content: string; createdAt?: string }

const isBackendContactId = (contactId: string) =>
  Boolean(contactId) && !contactId.startsWith('c-') && !contactId.startsWith('route-target-')

const mapRawMessages = (
  items: RawChatMessage[],
  contactName: string,
  contactAvatar: string,
): ChatMessage[] =>
  items.map((item) => ({
    id: item.id,
    from: item.senderId === currentUserId.value ? 'me' : 'other',
    sender: item.senderId === currentUserId.value ? myDisplayName.value : contactName,
    avatarUrl: item.senderId === currentUserId.value ? myAvatarUrl.value : contactAvatar,
    content: item.content || '',
    userId: item.senderId,
    createdAt: resolveMessageCreatedAt(item.createdAt, item.id),
  }))

const loadBackendMessages = async () => {
  if (!targetUserId.value) {
    backendMessages.value = []
    return
  }
  try {
    const data = await apiRequest<RawChatMessage[]>(
      `/api/chat/messages/${encodeURIComponent(targetUserId.value)}`,
      { auth: true },
    )
    backendMessages.value = mapRawMessages(
      Array.isArray(data) ? data : [],
      targetName.value || '对方',
      resolveDisplayAvatarUrl(targetAvatar.value),
    )
  } catch (error) {
    replyError.value = error instanceof Error ? error.message : '加载私聊记录失败'
    backendMessages.value = []
  }
}

const loadActiveContactMessages = async () => {
  if (singleTargetMode.value) {
    await loadBackendMessages()
    return
  }

  const contactId = activeContactId.value
  if (!isBackendContactId(contactId)) return

  const contact = currentChatContacts.value.find((item) => item.id === contactId)
  const data = await apiRequest<RawChatMessage[]>(`/api/chat/messages/${encodeURIComponent(contactId)}`, {
    auth: true,
  })
  const messages = mapRawMessages(Array.isArray(data) ? data : [], contact?.name || '对方', contact?.avatarUrl || '')

  if (!backendChatData.value) return
  const threadIndex = backendChatData.value.threads.findIndex((item) => item.contactId === contactId)
  if (threadIndex < 0) return

  backendChatData.value.threads[threadIndex] = {
    ...backendChatData.value.threads[threadIndex],
    messages,
  }
}

// Lightweight polling: keep chat view updated without requiring navigation refresh.
let chatPollTimer: ReturnType<typeof window.setInterval> | undefined
let chatPollInFlight = false
const CHAT_POLL_INTERVAL_MS = 2500

const pollChatUpdates = async () => {
  if (document.hidden || chatPollInFlight) return

  chatPollInFlight = true
  try {
    if (!currentUserId.value) await loadCurrentUser()
    if (!currentUserId.value) return

    const el = messageListRef.value
    const shouldFollow = el ? isNearBottom(el) : true
    const prevLastId = activeMessages.value.at(-1)?.id || ''
    await loadActiveContactMessages()
    await loadConversations()
    markActiveContactAsRead()
    const nextLastId = activeMessages.value.at(-1)?.id || ''
    if (nextLastId && nextLastId !== prevLastId && shouldFollow) void scrollToBottom()
  } catch {
    // Ignore polling errors; the next tick may recover.
  } finally {
    chatPollInFlight = false
  }
}

const startChatPolling = () => {
  if (chatPollTimer) return
  void pollChatUpdates()
  chatPollTimer = window.setInterval(() => void pollChatUpdates(), CHAT_POLL_INTERVAL_MS)
}

const stopChatPolling = () => {
  if (!chatPollTimer) return
  window.clearInterval(chatPollTimer)
  chatPollTimer = undefined
}

const sendReply = async () => {
  const content = replyContent.value.trim()
  if (!content) {
    replyError.value = '请输入回复内容'
    return
  }
  if (!singleTargetMode.value && !activeThread.value) {
    replyError.value = '当前未选择会话'
    return
  }
  let sentMessage: RawChatMessage | null = null
  try {
    if (singleTargetMode.value && targetUserId.value) {
      sentMessage = await apiRequest<RawChatMessage>(`/api/chat/messages/${encodeURIComponent(targetUserId.value)}`, {
        method: 'POST',
        auth: true,
        body: { content },
      })
    } else {
      const thread = activeThread.value
      if (!thread) {
        replyError.value = '当前未选择会话'
        return
      }
      const backendTargetId = thread.contactId
      if (backendTargetId && !backendTargetId.startsWith('c-') && !backendTargetId.startsWith('route-target-')) {
        sentMessage = await apiRequest<RawChatMessage>(`/api/chat/messages/${encodeURIComponent(backendTargetId)}`, {
          method: 'POST',
          auth: true,
          body: { content },
        })
      } else {
        sentMessage = await apiRequest<RawChatMessage>(
          `/api/chat/messages/by-name/${encodeURIComponent(thread.contactName)}`,
          {
            method: 'POST',
            auth: true,
            body: { content },
          },
        )
      }
    }
  } catch (error) {
    replyError.value = error instanceof Error ? error.message : '发送失败，请稍后重试'
    return
  }

  const appendSentMessage = (msg: RawChatMessage): ChatMessage => ({
    id: msg.id,
    from: 'me',
    sender: myDisplayName.value,
    avatarUrl: myAvatarUrl.value,
    content: msg.content || content,
    userId: currentUserId.value,
    createdAt: resolveMessageCreatedAt(msg.createdAt, msg.id),
  })

  if (singleTargetMode.value) {
    backendMessages.value.push(
      sentMessage
        ? appendSentMessage(sentMessage)
        : {
            id: `m-local-${Date.now()}`,
            from: 'me',
            sender: myDisplayName.value,
            avatarUrl: myAvatarUrl.value,
            content,
            userId: currentUserId.value,
            createdAt: new Date().toISOString(),
          },
    )
  } else {
    const thread = activeThread.value
    if (!thread) {
      replyError.value = '当前未选择会话'
      return
    }
    if (sentMessage && backendChatData.value) {
      const threadIndex = backendChatData.value.threads.findIndex((item) => item.contactId === thread.contactId)
      if (threadIndex >= 0) {
        const nextMessage = appendSentMessage(sentMessage)
        backendChatData.value.threads[threadIndex] = {
          ...backendChatData.value.threads[threadIndex],
          messages: [...backendChatData.value.threads[threadIndex].messages, nextMessage],
        }
      }
    }
    void loadActiveContactMessages()
    void loadConversations()
  }
  void scrollToBottom(true)
  replyContent.value = ''
  replyError.value = ''
}

watch(
  [currentUid, targetName, targetAvatar, currentChatContacts],
  ([, , , contacts]) => {
    ensureRouteTargetThread()
    if (!contacts.length) {
      activeContactId.value = ''
      return
    }
    if (targetContactId.value && contacts.some((item) => item.id === targetContactId.value)) {
      activeContactId.value = targetContactId.value
      return
    }
    if (!contacts.some((item) => item.id === activeContactId.value)) {
      activeContactId.value = contacts[0].id
    }
  },
  { immediate: true },
)

watch([targetUserId, currentUid], () => {
  if (!singleTargetMode.value) return
  if (!currentUid.value) return
  void loadBackendMessages().then(() => scrollToBottom(true))
})

watch(activeContactId, (contactId) => {
  if (!contactId || !currentUserId.value) return
  void loadActiveContactMessages().then(() => {
    markContactAsRead(contactId)
    void scrollToBottom(true)
  })
})

onMounted(() => {
  startChatPolling()
  void loadCurrentUser().then(() => {
    void loadConversations().then(() => {
      markActiveContactAsRead()
    })
    if (singleTargetMode.value && targetContactId.value) {
      activeContactId.value = targetUserId.value || targetContactId.value
      void loadBackendMessages().then(() => {
        markActiveContactAsRead()
        void scrollToBottom(true)
      })
      return
    }
    void loadActiveContactMessages().then(() => {
      markActiveContactAsRead()
      void scrollToBottom(true)
    })
  })
})

onUnmounted(() => {
  stopChatPolling()
})
</script>

<template>
  <div class="tq-panel h-full min-h-0 border border-[var(--tq-line)] bg-black/96 p-8px sm:p-10px">
    <div class="tq-chat-layout">
      <aside class="tq-chat-aside min-h-0 border border-[var(--tq-line)]" :class="{ 'is-contacts-open': mobileContactsOpen }">
        <button
          type="button"
          class="tq-chat-contacts-toggle"
          :aria-expanded="mobileContactsOpen"
          @click="toggleMobileContacts"
        >
          <span class="tq-chat-contacts-toggle__arrow">{{ mobileContactsOpen ? '⌃' : '⌄' }}</span>
          <span class="min-w-0 flex-1 truncate text-left">{{ activeContactName }}</span>
          <span
            v-if="hasOtherUnread && !mobileContactsOpen"
            class="inline-flex h-18px min-w-18px shrink-0 items-center justify-center rounded-2px bg-[#ff2a2a] px-4px text-12px font-800 leading-none text-black"
            aria-label="其他联系人有新消息"
          >!</span>
        </button>

        <div class="tq-chat-aside-top flex h-48px sm:h-68px items-center justify-center border-b border-[var(--tq-line)] text-24px sm:text-30px text-danger">⌃</div>

        <div class="tq-chat-aside-body h-[calc(100%-96px)] sm:h-[calc(100%-136px)] overflow-auto">
          <button
            v-for="contact in currentChatContacts"
            :key="contact.id"
            class="group relative flex h-72px w-full items-center border-b border-[var(--tq-line)] bg-transparent px-12px text-left text-16px text-danger"
            :class="{ 'bg-danger/15': activeContactId === contact.id }"
            @click="selectContact(contact)"
          >
            <img :src="contact.avatarUrl || avatarAssets.nose" alt="联系人头像" class="mr-10px h-42px w-42px rounded-full border-[5px] border-black object-cover" />
            <span class="min-w-0 flex-1">
              <span class="inline-flex max-w-full items-center gap-6px align-middle">
                <span class="truncate">{{ contact.name }}</span>
                <span
                  v-if="unreadContactMap[contact.id] && activeContactId !== contact.id"
                  class="inline-flex h-18px min-w-18px shrink-0 items-center justify-center rounded-2px bg-[#ff2a2a] px-4px text-12px font-800 leading-none text-black"
                  aria-label="新消息"
                >!</span>
              </span>
            </span>
            <span
              v-if="hasChatHistory(contact.id)"
              class="absolute right-10px top-50% -translate-y-50% cursor-pointer rounded border border-[var(--tq-line)] px-8px py-2px text-12px opacity-0 transition group-hover:opacity-100"
              @click.stop="requestDeleteContact({ id: contact.id, name: contact.name })"
            >
              删除
            </span>
          </button>
          <div v-if="!currentChatContacts.length" class="p-12px text-13px text-muted">当前账号暂无私聊联系人</div>
        </div>

        <div class="tq-chat-aside-bottom flex h-48px sm:h-68px items-center justify-center border-t border-[var(--tq-line)] text-24px sm:text-30px text-danger">⌄</div>
      </aside>

      <section class="min-h-0 flex h-full flex-col border border-[var(--tq-line)]">
        <header class="flex h-56px sm:h-70px items-center border-b border-[var(--tq-line)] px-12px sm:px-16px text-24px sm:text-42px text-danger">
          <span class="max-w-full truncate">【{{ activeContactName }}】</span>
        </header>

        <div ref="messageListRef" class="min-h-0 flex-1 overflow-auto px-12px py-10px">
          <template v-for="(message, index) in activeMessages" :key="message.id">
            <div
              v-if="showMessageTime(index)"
              class="mb-8px text-center text-13px text-danger"
            >
              {{ formatMessageTime(message.createdAt, message.id) }}
            </div>
            <article
              class="mb-14px flex items-end gap-8px"
              :class="isMine(message) ? 'justify-end' : 'justify-start'"
            >
            <div
              class="flex h-48px w-48px sm:h-62px sm:w-62px shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-[5px] border-black bg-black/70 text-14px text-danger"
              :class="isMine(message) ? 'order-2' : 'order-1'"
              @click.stop="openUserProfile(message)"
            >
              <img :src="displayAvatar(message)" alt="消息头像" class="h-full w-full rounded-full object-cover" />
            </div>
            <div :class="isMine(message) ? 'order-1 w-full flex flex-col items-end' : 'order-2 w-full flex flex-col items-start'">
              <div class="mb-6px max-w-80% truncate tq-text-md text-muted">{{ displaySender(message) }}</div>
              <div
                class="w-fit max-w-85% sm:max-w-80% whitespace-pre-wrap break-words border border-[var(--tq-line)] px-12px py-8px sm:px-16px sm:py-10px text-left text-16px sm:text-24px leading-[1.6] text-black"
                :class="isMine(message) ? 'bg-danger/75' : 'bg-danger/90'"
              >
                {{ message.content }}
              </div>
            </div>
          </article>
          </template>
        </div>

        <footer class="shrink-0 border-t border-[var(--tq-line)] px-14px py-10px">
          <textarea
            v-model="replyContent"
            class="tq-input h-56px w-full resize-none rounded-none text-danger leading-[1.6]"
            placeholder="在这里输入回复内容..."
            @keydown.enter.exact.prevent="sendReply"
          />
          <div class="mt-8px flex flex-wrap items-center justify-between gap-8px">
            <button class="bg-transparent border-none p-0 text-24px sm:text-40px text-danger font-700" @click="goHome">返回</button>
            <button class="tq-btn rounded-none px-16px py-6px text-16px sm:text-24px" @click="sendReply">发送</button>
          </div>
          <p v-if="replyError" class="m-0 mt-8px text-13px text-danger">{{ replyError }}</p>
        </footer>
      </section>
    </div>

    <div
      v-if="deleteContactModalVisible"
      class="absolute inset-0 z-30 flex items-center justify-center bg-black/65 px-16px"
      @click.self="closeDeleteContactModal"
    >
      <div class="w-full max-w-420px border border-[var(--tq-line)] bg-panel p-14px text-danger">
        <div class="mb-10px text-18px font-700">确认删除会话</div>
        <p class="m-0 text-14px text-danger/90">
          确定删除与「{{ pendingDeleteContact?.name || '该用户' }}」的聊天记录吗？删除后无法恢复。
        </p>
        <div class="mt-14px flex items-center gap-10px">
          <button class="tq-btn-ghost flex-1 rounded-none" :disabled="Boolean(deletingContactId)" @click="closeDeleteContactModal">取消</button>
          <button class="tq-btn flex-1 rounded-none" :disabled="Boolean(deletingContactId)" @click="confirmDeleteContact">
            {{ deletingContactId ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
