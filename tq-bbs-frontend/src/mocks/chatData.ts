import { avatarAssets } from './userProfile'

export type ChatContact = {
  id: string
  name: string
  avatarUrl: string
}

export type ChatMessage = {
  id: string
  from: 'me' | 'other'
  sender: string
  avatarUrl: string
  content: string
  userId?: string
  createdAt?: string
}

export type ChatThread = {
  contactId: string
  contactName: string
  messages: ChatMessage[]
}

export type ChatDataset = {
  contacts: ChatContact[]
  threads: ChatThread[]
}

const defaultContacts: ChatContact[] = [
  { id: 'c-001', name: '版主-砂砂', avatarUrl: avatarAssets.eye },
  { id: 'c-002', name: '红花女（狱）', avatarUrl: avatarAssets.ear },
  { id: 'c-003', name: '西封主编-风', avatarUrl: avatarAssets.mouth },
]

const defaultThreads: ChatThread[] = [
  {
    contactId: 'c-001',
    contactName: '版主-砂砂',
    messages: [
      {
        id: 'm-001',
        from: 'other',
        sender: '版主-砂砂',
        avatarUrl: avatarAssets.eye,
        content: '欢迎来到本版，发帖前可以先看看版规。',
      },
      { id: 'm-002', from: 'me', sender: '佚名', avatarUrl: avatarAssets.nose, content: '收到，谢谢提醒。' },
    ],
  },
  {
    contactId: 'c-002',
    contactName: '红花女（狱）',
    messages: [
      {
        id: 'm-003',
        from: 'other',
        sender: '红花女（狱）',
        avatarUrl: avatarAssets.ear,
        content: '你那条“错位的脸”帖子很有意思，细节再补一点。',
      },
      { id: 'm-004', from: 'me', sender: '佚名', avatarUrl: avatarAssets.nose, content: '好的，我今晚回去再确认一次监控时间。' },
    ],
  },
  {
    contactId: 'c-003',
    contactName: '西封主编-风',
    messages: [
      {
        id: 'm-005',
        from: 'other',
        sender: '西封主编-风',
        avatarUrl: avatarAssets.mouth,
        content: '如果有问题可以问砂小姐，她会解答你的疑问。',
      },
      { id: 'm-006', from: 'me', sender: '佚名', avatarUrl: avatarAssets.nose, content: '收到。' },
      {
        id: 'm-007',
        from: 'other',
        sender: '西封主编-风',
        avatarUrl: avatarAssets.mouth,
        content: '我们今晚会再同步一次线索，记得在线。',
      },
    ],
  },
]

export const chatDataByUid: Record<string, ChatDataset> = {
  // 佚名账号
  '7207094': {
    contacts: defaultContacts,
    threads: defaultThreads,
  },
  // 九生有幸账号
  '9911042': {
    contacts: [
      { id: 'c-101', name: '佚名', avatarUrl: avatarAssets.nose },
      { id: 'c-102', name: '西封主编-风', avatarUrl: avatarAssets.mouth },
    ],
    threads: [
      {
        contactId: 'c-101',
        contactName: '佚名',
        messages: [
          { id: 'm-101', from: 'other', sender: '佚名', avatarUrl: avatarAssets.nose, content: '我把昨晚录屏上传了，你有空看看。' },
          { id: 'm-102', from: 'me', sender: '九生有幸', avatarUrl: avatarAssets.eye, content: '看到了，异常点大概在 02:14。' },
        ],
      },
      {
        contactId: 'c-102',
        contactName: '西封主编-风',
        messages: [
          { id: 'm-103', from: 'other', sender: '西封主编-风', avatarUrl: avatarAssets.mouth, content: '线索我已经整理到共享文档，记得补充。' },
          { id: 'm-104', from: 'me', sender: '九生有幸', avatarUrl: avatarAssets.eye, content: '收到，今晚前补完。' },
        ],
      },
    ],
  },
}

export const emptyChatData: ChatDataset = {
  contacts: [],
  threads: [],
}
