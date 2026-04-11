import { routes } from '@/util/routes';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: routes.map(r => ({
    name: r.name,
    path: r.path,
    component: r.component,
  })),
});

export default router;