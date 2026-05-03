import avatarEye from '../assets/images/avatars/眼.png'
import avatarEar from '../assets/images/avatars/耳.png'
import avatarMouth from '../assets/images/avatars/嘴.png'
import avatarNose from '../assets/images/avatars/鼻.png'

export type UserStatItem = {
  label: string
  value: string
}

export type UserProfile = {
  id: string
  uid: string
  nickname: string
  password: string
  signature: string
  avatarUrl: string
  avatarColor: string
  stats: UserStatItem[]
}

export const avatarAssets = {
  eye: avatarEye,
  ear: avatarEar,
  mouth: avatarMouth,
  nose: avatarNose,
}

export const currentUserProfile: UserProfile = {
  id: 'user-001',
  uid: '7207094',
  nickname: '佚名',
  password: '123456',
  signature: '档案记录',
  avatarUrl: avatarNose,
  avatarColor: 'rgba(170,15,15,.35)',
  stats: [
    { label: '年龄', value: '未知' },
    { label: '性别', value: '女' },
    { label: '粉丝', value: '0' },
    { label: '足迹', value: '1' },
    { label: '关注', value: '0' },
    { label: '我的帖子', value: '0' },
  ],
}

export const mockUsers: UserProfile[] = [
  currentUserProfile,
  {
    id: 'user-002',
    uid: '9911042',
    nickname: '九生有幸',
    password: '123456',
    signature: '夜半回帖中',
    avatarUrl: avatarEye,
    avatarColor: 'rgba(130,10,10,.35)',
    stats: [
      { label: '年龄', value: '24' },
      { label: '性别', value: '男' },
      { label: '粉丝', value: '17' },
      { label: '足迹', value: '96' },
      { label: '关注', value: '13' },
      { label: '我的帖子', value: '41' },
    ],
  },
  {
    id: 'user-003',
    uid: '8803001',
    nickname: '红花女（狄）',
    password: '123456',
    signature: '夜行者',
    avatarUrl: avatarEar,
    avatarColor: 'rgba(130,10,10,.35)',
    stats: [
      { label: '年龄', value: '26' },
      { label: '性别', value: '女' },
      { label: '粉丝', value: '34' },
      { label: '足迹', value: '152' },
      { label: '关注', value: '19' },
      { label: '我的帖子', value: '58' },
    ],
  },
  {
    id: 'user-004',
    uid: '7702551',
    nickname: '西封主编-风',
    password: '123456',
    signature: '线索整理中',
    avatarUrl: avatarMouth,
    avatarColor: 'rgba(130,10,10,.35)',
    stats: [
      { label: '年龄', value: '31' },
      { label: '性别', value: '男' },
      { label: '粉丝', value: '67' },
      { label: '足迹', value: '210' },
      { label: '关注', value: '25' },
      { label: '我的帖子', value: '104' },
    ],
  },
]
