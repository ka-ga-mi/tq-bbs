import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      children: [
        { path: '', redirect: '/home' },
        { path: 'home', name: 'home', component: () => import('@/views/home/HomeView.vue') },
        { path: 'posts', name: 'posts', component: () => import('@/views/post/PostListView.vue') },
        { path: 'posts/:id', name: 'post-detail', component: () => import('@/views/post/PostDetailView.vue') },
        { path: 'chat', name: 'chat', component: () => import('@/views/chat/ChatView.vue') },
        { path: 'profile', name: 'profile', component: () => import('@/views/user/ProfileView.vue') },
        { path: 'users/:id', name: 'user-public-profile', component: () => import('@/views/user/UserPublicProfileView.vue') },
      ],
    },
  ],
})

export default router
