import { avatarAssets } from './userProfile'

export type PostReply = {
  id: string
  userId?: string
  userName: string
  avatarUrl: string
  content: string
}

export type PostDetail = {
  id: string
  time: string
  replies: PostReply[]
}

export const postDetails: PostDetail[] = [
  {
    id: 'post-001',
    time: '7/9 23:40',
    replies: [
      {
        id: 'r-001',
        userName: '玲铃铃',
        avatarUrl: avatarAssets.ear,
        content: `楼主是今年刚搬来的这个小区，说实话距离上班的地方不远，而且又旧，但是它便宜啊！
        一年房租才一千块，脏点破点又算什么呢`,
      },
      {
        id: 'r-002',
        userName: '九生有幸',
        avatarUrl: avatarAssets.eye,
        content: '便宜没好货啊楼楼，记住这点。你看恐怖片里演的，便宜的都是凶宅，既然你帖子都发到这个论坛里了，你肯定是租到凶宅了吧？',
      },
    ],
  },
  {
    id: 'post-002',
    time: '7/10 00:13',
    replies: [
      {
        id: 'r-003',
        userName: '匿名观众',
        avatarUrl: avatarAssets.nose,
        content: '直播里看到那扇门自己开了，弹幕都炸了，你要不先去物业问问这房子的历史？',
      },
      {
        id: 'r-004',
        userName: '西封主编-风',
        avatarUrl: avatarAssets.mouth,
        content: '先别慌，记录好每一次异常发生的时间点和环境，我们帮你一起判断。',
      },
    ],
  },
  {
    id: 'post-003',
    time: '7/10 08:22',
    replies: [
      {
        id: 'r-005',
        userName: '路过的客',
        avatarUrl: avatarAssets.nose,
        content: '我这边村口也供着一尊不知名的小像，老人说不能直呼名字，晚上经过要低头。',
      },
      {
        id: 'r-006',
        userName: '九生有幸',
        avatarUrl: avatarAssets.eye,
        content: '你们那边如果也有类似情况，可以把地点和时间整理一下，说不定能拼出同一条线索。',
      },
    ],
  },
  {
    id: 'post-004',
    time: '7/10 12:09',
    replies: [
      {
        id: 'r-007',
        userName: '探灵小队',
        avatarUrl: avatarAssets.nose,
        content: '“错位的脸”这个说法在老帖里出现过，通常和镜面反光、走廊监控延迟有关。',
      },
      {
        id: 'r-008',
        userName: '西封主编-风',
        avatarUrl: avatarAssets.mouth,
        content: '你先别单独行动，今晚十点我们开连麦，按流程复现场景。',
      },
    ],
  },
]
