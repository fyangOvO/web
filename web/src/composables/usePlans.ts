import { ref } from 'vue';
import { getPlans, getPlansSeedState } from '../api';
import { plans as builtinPlans, type Plan } from '../data/plans';

/**
 * 计划数据源（模块级共享，多组件复用同一份缓存）
 *
 * 取数策略：
 *   1. 后台已初始化（db.plans 存在）→ 完全以后台数据为准，后台隐藏即前台消失
 *   2. 后台未初始化 → 用内置静态数据兜底，保证首屏永远有内容
 *   3. 接口异常 → 同样回退到内置数据（离线/后端未启动也不会白屏）
 */
const list = ref<Plan[] | null>(null);
const loaded = ref(false);
const usingBuiltin = ref(false);
let inflight: Promise<void> | null = null;

export function usePlans() {
  async function load(force = false): Promise<void> {
    if (inflight && !force) return inflight;
    if (loaded.value && !force) return;

    inflight = (async () => {
      try {
        const [state, remote] = await Promise.all([getPlansSeedState(), getPlans()]);
        if (state.seeded) {
          list.value = remote;
          usingBuiltin.value = false;
        } else {
          list.value = builtinPlans;
          usingBuiltin.value = true;
        }
      } catch {
        list.value = builtinPlans;
        usingBuiltin.value = true;
      } finally {
        loaded.value = true;
        inflight = null;
      }
    })();

    return inflight;
  }

  return { plans: list, loaded, usingBuiltin, load };
}
