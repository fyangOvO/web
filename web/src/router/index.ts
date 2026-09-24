import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: '个人主页 · 技术作品集' },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/AboutView.vue'),
    meta: { title: '关于我' },
  },
  {
    path: '/projects',
    name: 'projects',
    component: () => import('../views/ProjectsView.vue'),
    meta: { title: '项目作品' },
  },
  {
    path: '/blog',
    name: 'blog',
    component: () => import('../views/BlogView.vue'),
    meta: { title: '博客文章' },
  },
  {
    path: '/blog/:id',
    name: 'blog-post',
    component: () => import('../views/BlogPostView.vue'),
    meta: { title: '文章详情' },
  },
  {
    path: '/essay',
    name: 'essay',
    component: () => import('../views/EssayView.vue'),
    meta: { title: '随笔' },
  },
  {
    path: '/essay/:id',
    name: 'essay-post',
    component: () => import('../views/BlogPostView.vue'),
    meta: { title: '随笔详情' },
  },
  {
    path: '/notes',
    name: 'notes',
    component: () => import('../views/NotesView.vue'),
    meta: { title: '图文' },
  },
  {
    path: '/nav',
    name: 'nav',
    component: () => import('../views/NavView.vue'),
    meta: { title: '网址导航' },
  },
  {
    path: '/guestbook',
    name: 'guestbook',
    component: () => import('../views/GuestbookView.vue'),
    meta: { title: '留言板' },
  },
  {
    path: '/contact',
    name: 'contact',
    component: () => import('../views/ContactView.vue'),
    meta: { title: '联系我' },
  },
  {
    path: '/album',
    name: 'album',
    component: () => import('../views/AlbumView.vue'),
    meta: { title: '私密相册' },
  },
  {
    path: '/album/:id',
    name: 'album-detail',
    component: () => import('../views/AlbumDetailView.vue'),
    meta: { title: '相册详情' },
  },
  {
    path: '/verse',
    name: 'verse',
    component: () => import('../views/VerseView.vue'),
    meta: { title: '拾句' },
  },
  {
    path: '/plans',
    name: 'plans',
    component: () => import('../views/PlansView.vue'),
    meta: { title: '计划' },
  },
  {
    path: '/plans/:id',
    name: 'plan-detail',
    component: () => import('../views/PlanDetailView.vue'),
    meta: { title: '计划详情' },
  },
  {
    path: '/travel',
    redirect: '/plans',
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: () => import('../views/PrivacyView.vue'),
    meta: { title: '隐私政策' },
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../views/AdminView.vue'),
    meta: { title: '后台管理' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 };
  },
});

router.afterEach((to) => {
  const base = '柳絮 · 个人主页';
  document.title = to.meta.title ? `${String(to.meta.title)} | ${base}` : base;
});
