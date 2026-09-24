/**
 * 计划数据（Plan）
 *
 * 统一承载各类个人计划：旅行 / 数码 / 游戏 / 健康 / 生活。
 * 采用「Section + Block」的通用结构，便于后续持续新增不同类型的内容：
 *   - 每个 Plan 由若干 Section 组成
 *   - 每个 Section 通过 kind 决定渲染形式（时间线 / 卡片 / 预算 / 清单 / 表格 / 文本）
 *
 * 新增计划：往 plans 数组里追加一个对象即可，列表页与详情页自动生效。
 */

export type PlanCategory = 'travel' | 'tech' | 'game' | 'health' | 'life';

/** 时间线节点内的条目 */
export interface PlanNodeItem {
  /** 时间或阶段标签，如 "14:54" / "上午" */
  time?: string;
  label: string;
  note?: string;
}

/** 时间线节点底部的补充信息（住宿 / 提醒等） */
export interface PlanNodeFooter {
  icon: string;
  label: string;
  value: string;
  /** 高亮为提示色 */
  warn?: boolean;
}

/** 时间线节点：旅行=某一天，数码=某个升级阶段，食谱=某道菜 */
export interface PlanNode {
  /** 左侧圆点文字，如 "1" / "D1" */
  badge: string;
  title: string;
  /** 标题旁的次要信息，如 "10.1 周四" */
  meta?: string;
  emoji?: string;
  tags?: string[];
  desc?: string;
  items?: PlanNodeItem[];
  footer?: PlanNodeFooter[];
}

export interface PlanCard {
  emoji?: string;
  title: string;
  desc: string;
  /** 卡片右上角标记，如 "★ 推荐" / "性价比" */
  badge?: string;
}

export interface PlanBudgetItem {
  label: string;
  amount: string;
  note?: string;
}

export interface PlanListGroup {
  icon?: string;
  title?: string;
  items: string[];
}

export type PlanSectionKind = 'timeline' | 'cards' | 'budget' | 'list' | 'table' | 'text';

export interface PlanSection {
  icon: string;
  title: string;
  desc?: string;
  kind: PlanSectionKind;
  nodes?: PlanNode[];
  cards?: PlanCard[];
  budget?: PlanBudgetItem[];
  list?: PlanListGroup[];
  table?: { headers: string[]; rows: string[][] };
  text?: string;
}

export interface PlanMeta {
  label: string;
  value: string;
}

export interface PlanTipGroup {
  icon: string;
  title: string;
  items: string[];
}

export interface Plan {
  id: string;
  title: string;
  subtitle: string;
  category: PlanCategory;
  emoji: string;
  /** Tailwind 渐变类，用于封面与时间线圆点 */
  gradient: string;
  tags: string[];
  summary: string;
  /** 封面上的关键数字，2~4 个 */
  meta: PlanMeta[];
  /** 路线节点（仅旅行类），如 ["南京","聊城","青岛"] */
  route?: string[];
  sections: PlanSection[];
  tips: PlanTipGroup[];
  /* ---- 以下为后台管理字段（内置静态数据可省略） ---- */
  /** 是否在前台显示，默认 true */
  visible?: boolean;
  /** 列表排序，越小越靠前 */
  sort?: number;
  /** 最后更新时间（后端写入） */
  updatedAt?: string;
}

/** 分类元信息：label 走 i18n（plan.cat.<category>），此处只存 emoji */
export const CATEGORY_EMOJI: Record<PlanCategory, string> = {
  travel: '🧳',
  tech: '🖥️',
  game: '🎮',
  health: '💪',
  life: '🍳',
};

/** 列表页筛选用顺序 */
export const CATEGORY_ORDER: PlanCategory[] = ['travel', 'tech', 'game', 'health', 'life'];

export const plans: Plan[] = [
  /* ================= 旅行 ================= */
  {
    id: 'liaocheng-qingdao',
    title: '聊城音乐节 × 青岛看海',
    subtitle: '从摇滚现场到渤海之滨 · 一份可以照搬的攻略',
    category: 'travel',
    emoji: '🎸',
    gradient: 'from-cyan-600 via-sky-700 to-blue-800',
    tags: ['音乐节', '看海', '古城'],
    summary: '从摇滚现场的燃到渤海湾的盐汽水，这条路线是节日的最佳化学反应。',
    meta: [
      { label: '日期', value: '10.1 – 10.6' },
      { label: '时长', value: '6 天' },
      { label: '预算', value: '¥6,500±' },
      { label: '出行', value: '2 人' },
    ],
    route: ['南京', '聊城', '青岛', '南京'],
    sections: [
      {
        icon: 'sparkle',
        title: '行程亮点',
        kind: 'cards',
        cards: [
          { emoji: '🎸', title: '新青年音乐节', desc: '痛仰 / 万青 / 盘尼西林 / 张蔷' },
          { emoji: '🌊', title: '青岛看海', desc: '八大关 · 栈桥 · 五四广场' },
          { emoji: '🏛️', title: '水上古城', desc: '光岳楼 · 山陕会馆 · 东昌湖' },
          { emoji: '🍺', title: '啤酒与海鲜', desc: '原浆 + 辣炒蛤蜊 + 鲅鱼水饺' },
        ],
      },
      {
        icon: 'calendar',
        title: '逐日行程',
        desc: '按青岛方案排，选威海只需替换 Day 3 之后交通',
        kind: 'timeline',
        nodes: [
          {
            badge: '1',
            title: '奔赴聊城',
            meta: '10.1 周四',
            emoji: '🚄',
            tags: ['高铁', '古城'],
            desc: '下午抵达聊城，先逛水上古城，晚上坐画舫夜游东昌湖，让身体和心情都进入假期模式。',
            items: [
              { time: '14:54', label: 'G1706 南京南 → 聊城西 19:08', note: '二等座 ¥396 · 4h14min' },
              { time: '备选', label: 'D204 夜车', note: '二等卧 ¥133' },
              { time: '下午', label: '光岳楼 → 山陕会馆 → 运河文化博物馆' },
              { time: '晚上', label: '米市街晚餐：沙镇呱嗒、孙家烧鸽' },
              { time: '20:00', label: '东昌湖夜游画舫' },
            ],
            footer: [{ icon: 'home', label: '住宿', value: '聊城（九州洼附近）· 约 ¥300–500/晚' }],
          },
          {
            badge: '2',
            title: '新青年音乐节 DAY 2',
            meta: '10.2 周五',
            emoji: '🎸',
            tags: ['高潮日', '必蹦'],
            desc: '这是你最想要的那天——痛仰 / 万能青年旅店 / 盘尼西林 / 张蔷都在。',
            items: [
              { time: '票价', label: '预售票 ¥338 / 单日，双日通票 ¥588', note: '早鸟 ¥198 已售罄' },
              { time: '14:00', label: '提前到场，可领手环 / 周边' },
              { time: '15–18', label: '暖场：羽果 / 野肆 / 沉舟' },
              { time: '19–21:30', label: '压轴：盘尼西林 → 痛仰' },
              { time: '22–23', label: '万青收尾，泪奔现场' },
            ],
            footer: [
              { icon: 'lightbulb', label: '购票', value: '大麦 / 秀动 / 猫眼 / 票星球。10.1 DAY1 许巍 + 二手玫瑰也很炸，双日通票更值。', warn: true },
              { icon: 'home', label: '住宿', value: '聊城 · 约 ¥300–500/晚' },
            ],
          },
          {
            badge: '3',
            title: '转场看海',
            meta: '10.3 周六',
            emoji: '🌊',
            tags: ['聊城→青岛', '初见大海'],
            desc: '上午睡到自然醒，中午退房去聊城西站。下午到青岛，先到栈桥吹海风、看夕阳。',
            items: [
              { time: '11:24', label: 'G3212 聊城西 → 青岛北 14:40', note: '二等座 ¥233 · 3h16min' },
              { time: '备选', label: 'G5594 08:27 → 11:16', note: '¥214 早班车' },
              { time: '下午', label: '酒店寄存 → 栈桥喂海鸥', note: '傍晚最浪漫' },
              { time: '晚上', label: '劈柴院海鲜锅贴 → 台东夜市' },
            ],
            footer: [{ icon: 'home', label: '住宿', value: '市南区海景房 ¥400–800/晚' }],
          },
          {
            badge: '4',
            title: '青岛浪漫日',
            meta: '10.4 周日',
            emoji: '💑',
            tags: ['情侣专属', '出片日'],
            desc: '这一天专门给 TA：慢游八大关、咖啡馆、海边日落，晚上啤酒街配海鲜。',
            items: [
              { time: '上午', label: '八大关：公主楼 / 花石楼 / 西班牙风情馆', note: '10 月初秋色正当时' },
              { time: '中午', label: '大学路咖啡街 + 船歌鱼水饺', note: '必点墨鱼饺子' },
              { time: '下午', label: '五四广场 → 奥帆中心', note: '双人自行车 ¥20/h' },
              { time: '晚上', label: '啤酒街 / 营口路：原浆 + 辣炒蛤蜊' },
            ],
            footer: [{ icon: 'home', label: '住宿', value: '青岛 · 市南 / 八大关' }],
          },
          {
            badge: '5',
            title: '崂山 或 黄岛',
            meta: '10.5 周一',
            emoji: '🏔️',
            tags: ['二选一', '一日游'],
            desc: '崂山看海，或黄岛金沙滩慢游，按体力选一个。',
            items: [
              { time: 'A', label: '崂山仰口景区「海上仙山」', note: '门票 ¥90 · 缆车 ¥60 单程' },
              { time: 'B', label: '黄岛金沙滩，亚洲最大金色海滩', note: '免费 · 轻松休闲' },
              { time: '购物', label: '青啤原浆礼盒、海产干货', note: '建议大型超市买，避免景区被宰' },
            ],
            footer: [{ icon: 'home', label: '住宿', value: '青岛 · 市南区' }],
          },
          {
            badge: '6',
            title: '回宁',
            meta: '10.6 周二',
            emoji: '🚄',
            tags: ['返程'],
            desc: '最后再吃一次青岛早餐，买好伴手礼，从容上高铁。',
            items: [
              { time: '09:43', label: 'G248 青岛 → 南京南 14:30', note: '二等座约 ¥315 · 4h47min' },
              { time: '备选', label: '青岛胶东机场 ✈️ 南京禄口', note: '飞行 1.5h，¥400–800' },
            ],
          },
        ],
      },
      {
        icon: 'chart',
        title: '预算明细',
        desc: '舒适档（推荐）分项',
        kind: 'budget',
        budget: [
          { label: '高铁往返', amount: '¥1,900', note: '南京-聊城-青岛-南京' },
          { label: '音乐节门票', amount: '¥676', note: '2 张单日 ¥338' },
          { label: '住宿 5 晚', amount: '¥2,800', note: '聊城 1 晚 + 青岛 4 晚海景' },
          { label: '餐饮', amount: '¥1,500', note: '6 天 × 约 ¥250/天' },
          { label: '当地交通', amount: '¥500', note: '地铁 + 打车 + 共享单车' },
          { label: '景点门票', amount: '¥300', note: '崂山 + 咖啡馆 + 杂项' },
          { label: '伴手礼 + 应急', amount: '¥300', note: '青啤礼盒 + 海产' },
        ],
      },
    ],
    tips: [
      {
        icon: '🎫',
        title: '订票与抢票',
        items: [
          '音乐节门票 9.2 已开售，现在去大麦 / 秀动抢 ¥338 预售',
          '高铁票国庆前 15 天开售（约 9.20），务必定 9:00 闹钟',
          '酒店至少提前 1 个月订，聊城 1 晚 + 青岛 4 晚',
          '主推班次售罄时设置候补，成功率较高',
        ],
      },
      {
        icon: '🎒',
        title: '行前打包清单',
        items: [
          '身份证 + 备用证件（订票 / 入住都要）',
          '防晒霜 SPF50、墨镜、帽子（海边紫外线强）',
          '雨衣 + 雨伞（音乐节户外、海边天气多变）',
          '充电宝 20000mAh、自拍杆、相机',
          '轻便运动鞋 + 拖鞋 + 薄外套',
          '常用药：感冒、肠胃、晕车、创可贴',
        ],
      },
      {
        icon: '🎸',
        title: '音乐节现场',
        items: [
          '入场刷身份证，务必随身携带',
          '不允许带：专业相机、长柄雨伞、玻璃瓶',
          '场地可能泥泞，雨鞋 / 防水鞋很重要',
          '贵重物品放酒店或防水袋',
          '散场人流大，提前订好回酒店的车',
        ],
      },
      {
        icon: '🌊',
        title: '海边注意事项',
        items: [
          '10 月青岛海水开始凉，下水慎重，以沙滩散步为主',
          '不要独自去野海滩，认准有救生员的海水浴场',
          '海鲜要选活的、称重看秤，去明档餐厅',
          '青岛啤酒度数比一般高，别喝太猛',
          '看日落提前查时间，10 月约 17:30',
        ],
      },
    ],
  },

  {
    id: 'sichuan-easy',
    title: '慢游四川 · 国庆轻松版',
    subtitle: '合肥出发 × 熊猫 × 银河左岸 · 每天 1 个重点',
    category: 'travel',
    emoji: '🐼',
    gradient: 'from-emerald-600 via-teal-700 to-cyan-800',
    tags: ['熊猫', '音乐节', '慢游'],
    summary: '一条线走完，不回成都绕路——重庆离泸州更近，省时省钱省体力，全程只住 2 家酒店。',
    meta: [
      { label: '日期', value: '10.1 – 10.6' },
      { label: '时长', value: '6 天' },
      { label: '预算', value: '¥4,450' },
      { label: '出行', value: '人均' },
    ],
    route: ['南京', '合肥', '成都', '泸州', '重庆', '南京'],
    sections: [
      {
        icon: 'sparkle',
        title: '行程亮点',
        kind: 'cards',
        cards: [
          { emoji: '🐼', title: '大熊猫基地', desc: '月亮产房看幼崽，唯一早起的一天' },
          { emoji: '🎸', title: '银河左岸', desc: '许巍 / 痛仰 / 新裤子 / 逃跑计划' },
          { emoji: '🏛️', title: '武侯祠锦里', desc: '三国文化 + 鹤鸣茶社盖碗茶' },
          { emoji: '⛰️', title: '都江堰青城山', desc: '世界双遗产一日游' },
        ],
      },
      {
        icon: 'calendar',
        title: '逐日行程',
        desc: '轻松版 · 每天 1 个重点，其他时间随意',
        kind: 'timeline',
        nodes: [
          {
            badge: '1',
            title: '合肥 ✈️ 成都',
            meta: '10.1 周四',
            emoji: '✈️',
            tags: ['晚飞', '避峰省钱'],
            desc: '白天南京去合肥，晚上飞成都。晚班机比白天便宜 40%+。',
            items: [
              { time: '白天', label: '南京 → 合肥 高铁 1h', note: '¥60–80' },
              { time: '19:00', label: '合肥新桥 ✈️ 成都天府 / 双流', note: '选 19–21 点起飞' },
              { time: '22:00', label: '抵达成都，住春熙路 · 太古里' },
              { time: '23:00', label: '宵夜：串串香 或 老妈蹄花' },
            ],
            footer: [
              { icon: 'lightbulb', label: '为什么', value: '10.1 出行最贵，但合肥航线比南京便宜 30–50%，省下的钱远超高铁票。', warn: true },
              { icon: 'home', label: '住宿', value: '成都（第 1 晚）' },
            ],
          },
          {
            badge: '2',
            title: '成都慢慢逛',
            meta: '10.2 周五',
            emoji: '😴',
            tags: ['慢游', '不设闹钟'],
            desc: '睡到自然醒，武侯祠锦里慢慢逛，人民公园喝茶掏耳朵。',
            items: [
              { time: '10:00', label: '睡到自然醒' },
              { time: '11:00', label: 'brunch：钟水饺、龙抄手、甜水面、肥肠粉' },
              { time: '14:00', label: '武侯祠 ¥50 + 锦里古街（免费）' },
              { time: '17:00', label: '人民公园鹤鸣茶社，盖碗茶掏耳朵' },
              { time: '19:00', label: '宽窄巷子晚餐 + 玉林路小酒馆' },
            ],
            footer: [{ icon: 'home', label: '住宿', value: '成都（第 2 晚，行李不动）' }],
          },
          {
            badge: '3',
            title: '看熊猫日',
            meta: '10.3 周六',
            emoji: '🐼',
            tags: ['核心', '唯一早起'],
            desc: '全程唯一需要早起的一天——熊猫上午最活跃。',
            items: [
              { time: '06:40', label: '起床出发' },
              { time: '07:30', label: '大熊猫基地开门即入 → 月亮产房 → 太阳产房' },
              { time: '11:00', label: '文创店买周边（熊猫背包挂件必入）' },
              { time: '12:30', label: '午餐后回酒店午休 1 小时' },
              { time: '15:00', label: '杜甫草堂 ¥50 或 人民公园发呆' },
              { time: '18:00', label: '春熙路 · 太古里裸眼 3D + 正经火锅' },
            ],
            footer: [
              { icon: 'lightbulb', label: '预约', value: '公众号「成都大熊猫繁育研究基地」提前 3 天 0 点抢预约，9/30 0 点抢 10/3 的票，国庆秒空！', warn: true },
              { icon: 'home', label: '住宿', value: '成都（第 3 晚）' },
            ],
          },
          {
            badge: '4',
            title: '都江堰 + 青城山',
            meta: '10.4 周日',
            emoji: '🚄',
            tags: ['世界遗产', '20min'],
            desc: '犀浦站坐城际列车，20 分钟就到，跟坐地铁一样。',
            items: [
              { time: '08:00', label: '犀浦站城际 → 都江堰（20 分钟）' },
              { time: '09:00', label: '都江堰景区：宝瓶口 → 飞沙堰 → 鱼嘴' },
              { time: '12:00', label: '午餐：尤兔头、渣渣面、白果炖鸡' },
              { time: '14:00', label: '青城前山 ¥80（可坐缆车）' },
              { time: '17:30', label: '回成都，建设路小吃街：蛋烘糕、冰粉、三大炮' },
            ],
            footer: [
              { icon: 'lightbulb', label: '备选', value: '太累可以砍掉青城山，都江堰逛完直接回成都泡茶馆。', warn: true },
              { icon: 'home', label: '住宿', value: '成都（第 4 晚，行李不动）' },
            ],
          },
          {
            badge: '5',
            title: '银河左岸音乐节',
            meta: '10.5 周一',
            emoji: '🎸',
            tags: ['重头戏', '摇滚一整天'],
            desc: '成都高铁去泸州，下午入场，摇滚一整天。',
            items: [
              { time: '08:30', label: '成都东 / 南 → 泸州（约 2 小时）' },
              { time: '11:00', label: '抵泸州，酒店放行李', note: '住场地周边或万达商圈' },
              { time: '12:00', label: '午餐 + 补给：水、雨衣、充电宝', note: '场内贵' },
              { time: '14:00', label: '入场！下午场热身，傍晚压轴轮番轰炸' },
              { time: '深夜', label: '散场跟人流回酒店', note: '提前叫车 / 看接驳车' },
            ],
            footer: [
              { icon: 'lightbulb', label: '购票', value: '大麦 / 票牛搜「银河左岸」，买 10/5 单日票即可，¥300–600 档位按预算选。', warn: true },
              { icon: 'home', label: '住宿', value: '泸州（唯一一晚）' },
            ],
          },
          {
            badge: '6',
            title: '泸州 → 重庆 ✈️ 南京',
            meta: '10.6 周二',
            emoji: '🏠',
            tags: ['返程', '不走回头路'],
            desc: '睡到自然醒，上午逛泸州老窖，下午从重庆飞回南京。',
            items: [
              { time: '09:30', label: '泸州早餐：白糕、黄粑、猪儿粑、豆汤面' },
              { time: '10:30', label: '泸州老窖旅游区（国窖 1573）¥50' },
              { time: '12:30', label: '退房 → 重庆江北机场（约 2h）' },
              { time: '15:00', label: '重庆江北 ✈️ 南京禄口', note: '选 15–17 点起飞' },
              { time: '17:30', label: '抵南京，老门东一碗鸭血粉丝汤接风' },
            ],
            footer: [
              { icon: 'lightbulb', label: '为什么', value: '泸州到重庆只有 2h，重庆飞南京航班多；回成都要再坐 2h 高铁 + 去机场，绕一大圈。', warn: true },
            ],
          },
        ],
      },
      {
        icon: 'chart',
        title: '预算明细',
        desc: '人均 · 合肥出发 + 重庆返程',
        kind: 'budget',
        budget: [
          { label: '南京 → 合肥 高铁', amount: '¥75' },
          { label: '合肥 → 成都 机票', amount: '¥650', note: '10/1 晚班机' },
          { label: '成都 → 泸州 高铁', amount: '¥110' },
          { label: '泸州 → 重庆', amount: '¥80', note: '大巴 / 网约车' },
          { label: '重庆 → 南京 机票', amount: '¥750', note: '10/6 下午' },
          { label: '成都 → 都江堰 城际往返', amount: '¥40' },
          { label: '住宿 5 晚', amount: '¥975', note: '成都 4 晚 + 泸州 1 晚，双人分摊' },
          { label: '门票', amount: '¥365', note: '熊猫 + 武侯祠 + 都江堰 + 青城山 + 草堂 + 老窖' },
          { label: '音乐节单日票', amount: '¥450' },
          { label: '餐饮 5.5 天', amount: '¥605', note: '¥110/天' },
          { label: '市内交通 + 杂项', amount: '¥350' },
        ],
      },
    ],
    tips: [
      {
        icon: '🎯',
        title: '现在就订',
        items: [
          '音乐节单日票（大麦 / 票牛搜「银河左岸」）',
          '合肥 → 成都 10/1 晚班机，越早越便宜',
          '重庆 → 南京 10/6 下午机票',
        ],
      },
      {
        icon: '🏨',
        title: '提前 1 个月',
        items: [
          '订酒店：成都春熙路 4 晚 + 泸州音乐节周边 1 晚',
          '音乐节当天泸州房价暴涨，别等',
        ],
      },
      {
        icon: '🐼',
        title: '提前 3–7 天',
        items: [
          '熊猫基地公众号 0 点抢预约（9/30 抢 10/3）',
          '武侯祠 / 都江堰 / 草堂公众号预约',
        ],
      },
      {
        icon: '🎒',
        title: '音乐节当天',
        items: ['充电宝、雨衣（四川 10 月多雨）、舒服的鞋', '散场提前 10 分钟走能抢到车'],
      },
    ],
  },

  {
    id: 'yun-gu-chuan',
    title: '银河左岸 · 云贵川音乐节之旅',
    subtitle: '云贵川 × 摇滚 × 萌神熊猫 · 7 天 6 晚',
    category: 'travel',
    emoji: '🌌',
    gradient: 'from-violet-600 via-purple-700 to-fuchsia-800',
    tags: ['三省', '音乐节', '熊猫'],
    summary: '7 天 6 晚，总里程约 1800 km，一次走完云贵川三省，重头戏是 10/5 泸州银河左岸。',
    meta: [
      { label: '日期', value: '10.1 – 10.7' },
      { label: '时长', value: '7 天 6 晚' },
      { label: '预算', value: '¥6,635' },
      { label: '出行', value: '单人' },
    ],
    route: ['南京', '成都', '自贡', '泸州', '赤水', '重庆', '南京'],
    sections: [
      {
        icon: 'sparkle',
        title: '行程亮点',
        kind: 'cards',
        cards: [
          { emoji: '🎸', title: '银河左岸全阵容', desc: '许巍 / 痛仰 / 新裤子 / 逃跑计划 / 二手玫瑰' },
          { emoji: '🐼', title: '大熊猫基地', desc: '早上 7 点前到，看最活跃的熊猫' },
          { emoji: '🦖', title: '自贡恐龙博物馆', desc: '世界三大恐龙遗址博物馆' },
          { emoji: '🌊', title: '赤水大瀑布', desc: '顺路打卡贵州' },
        ],
      },
      {
        icon: 'calendar',
        title: '逐日行程',
        desc: '细到每小时，跟着走不慌',
        kind: 'timeline',
        nodes: [
          {
            badge: '1',
            title: '南京 ✈️ 成都',
            meta: '10.1 周四',
            emoji: '✈️',
            tags: ['初遇蓉城', '飞行 3h'],
            desc: '建议早班机，到成都正好午饭后开始逛。',
            items: [
              { time: '07:00', label: '南京禄口机场出发' },
              { time: '10:00', label: '抵达双流 / 天府，地铁 18 号线进市区' },
              { time: '11:30', label: '入住春熙路 / 太古里 / 宽窄巷子附近' },
              { time: '13:30', label: '武侯祠 ¥50 + 锦里古街（免费）', note: '公众号预约' },
              { time: '18:00', label: '玉林路晚餐：火锅 / 串串 / 夫妻肺片' },
              { time: '20:30', label: '锦江夜色 / 九眼桥酒吧街' },
            ],
            footer: [{ icon: 'home', label: '住宿', value: '成都 · ¥320/晚' }],
          },
          {
            badge: '2',
            title: '成都 · 看熊猫',
            meta: '10.2 周五',
            emoji: '🐼',
            tags: ['必看', '顶流萌神'],
            desc: '国庆游客爆炸，早上 7:00 前到是真理，下午只能看睡着的熊猫。',
            items: [
              { time: '06:30', label: '起床，7:00 前到达基地' },
              { time: '07:30', label: '月亮产房 → 太阳产房 → 小熊猫散步道' },
              { time: '11:00', label: '基地出口新博物馆 + 商店' },
              { time: '12:30', label: '回市区午餐：肥肠粉 / 甜水面 / 抄手' },
              { time: '14:30', label: '杜甫草堂 ¥50 + 四川博物院（免费）' },
              { time: '18:30', label: '建设路小吃街 / 奎星楼街逛吃' },
              { time: '21:00', label: '九眼桥 or 兰桂坊小酌' },
            ],
            footer: [
              { icon: 'lightbulb', label: '提醒', value: '必提前 1–3 天预约！建议买观光车票 ¥10 省腿。', warn: true },
              { icon: 'home', label: '住宿', value: '成都 · ¥320/晚' },
            ],
          },
          {
            badge: '3',
            title: '都江堰 + 青城山',
            meta: '10.3 周六',
            emoji: '⛰️',
            tags: ['世界遗产', '一日游'],
            desc: '青城天下幽，全山道教宫观，索道上步行下约 3h。',
            items: [
              { time: '07:00', label: '成都站 / 犀浦站 → 都江堰（约 30min）' },
              { time: '09:00', label: '都江堰景区 ¥80：鱼嘴 · 飞沙堰 · 宝瓶口 · 安澜索桥' },
              { time: '12:00', label: '午餐：渣渣面、青城泡菜、白果炖鸡' },
              { time: '13:30', label: '青城山前山 ¥90，月城湖索道 ¥60 双程' },
              { time: '17:30', label: '回成都，小龙坎 / 电台巷火锅' },
            ],
            footer: [
              { icon: 'lightbulb', label: '备选', value: '离堆公园 16:00 后光线最棒；青城山徒步量大，也可换成三星堆。', warn: true },
              { icon: 'home', label: '住宿', value: '成都 · ¥320/晚' },
            ],
          },
          {
            badge: '4',
            title: '成都 → 自贡 → 泸州',
            meta: '10.4 周日',
            emoji: '🦖',
            tags: ['盐都', '转场日'],
            desc: '自贡看恐龙和千年古盐井，吃盐帮菜，晚上到泸州。',
            items: [
              { time: '08:30', label: '成都东 → 自贡（约 1h15）' },
              { time: '10:00', label: '自贡恐龙博物馆 ¥40 或 燊海井' },
              { time: '12:30', label: '盐帮菜：鲜锅兔 / 冷吃兔 / 跳水蛙 / 火边子牛肉' },
              { time: '14:30', label: '自贡 → 泸州高铁（约 1h）' },
              { time: '17:30', label: '泸州老窖 1573 国宝窖池 ¥30 + 报恩塔' },
              { time: '19:30', label: '晚餐：泸州白烧、合江烤鱼、黄粑、猪儿粑' },
            ],
            footer: [{ icon: 'home', label: '住宿', value: '泸州 · ¥280/晚' }],
          },
          {
            badge: '5',
            title: '银河左岸音乐节',
            meta: '10.5 周一',
            emoji: '🎸',
            tags: ['HIGHLIGHT', '主舞台日'],
            desc: '许巍 / 痛仰 / 新裤子 / 逃跑计划 / 二手玫瑰 / 夏日入侵企划 / 告五人 / 陈粒……',
            items: [
              { time: '09:00', label: '睡个懒觉，元气满满' },
              { time: '10:30', label: '张坝桂圆林（免费），散步拍照' },
              { time: '12:30', label: '午餐：泸州豆花、肥儿粉' },
              { time: '14:00', label: '回酒店午休、整理装备' },
              { time: '16:30', label: '出发去场地，预留安检时间' },
              { time: '17:00', label: '安检入场，寄存大件包', note: '尽早站前排' },
              { time: '17:30', label: '开演！一般 21:30 之后压轴' },
              { time: '23:30', label: '预计散场' },
            ],
            footer: [
              { icon: 'lightbulb', label: '购票', value: '早鸟单日票性价比最高；关注公众号确认场地；可拼车提前订返程。', warn: true },
              { icon: 'home', label: '住宿', value: '泸州 · ¥280/晚' },
            ],
          },
          {
            badge: '6',
            title: '泸州 → 赤水 → 重庆',
            meta: '10.6 周二',
            emoji: '🌊',
            tags: ['打卡贵州', '返程'],
            desc: '赤水大瀑布顺路打卡贵州，然后从重庆飞回南京。',
            items: [
              { time: '07:00', label: '退房，豆花早餐' },
              { time: '08:00', label: '包车 / 拼车去赤水（约 1.5–2h）' },
              { time: '10:00', label: '赤水大瀑布 ¥90 + 四洞沟 / 燕子岩 ¥80' },
              { time: '13:00', label: '午餐：赤水腊肉、桶桶笋、豆花面' },
              { time: '方案 B', label: '赤水→泸州→重庆→飞南京（推荐）' },
              { time: '方案 A', label: '泸州云龙机场直飞（紧凑，班次少）' },
              { time: '方案 C', label: '高铁 + 顺风车（便宜但可能多一晚）' },
            ],
            footer: [
              { icon: 'lightbulb', label: '推荐', value: '方案 B：赤水→泸州 1.5h ¥80 → 泸州高铁→重庆 1.5h ¥110 → 重庆飞南京 2h ¥800。', warn: true },
            ],
          },
          {
            badge: '7',
            title: '回到南京',
            meta: '10.7 周三',
            emoji: '🏠',
            tags: ['缓冲日', '回血'],
            desc: '整理照片视频，下午老门东逛逛，晚上鸭血粉丝汤收尾。',
            items: [
              { time: '上午', label: '睡到自然醒，整理行李、照片、视频' },
              { time: '下午', label: '南京老门东 / 夫子庙，把遗憾留给下次' },
              { time: '晚上', label: '鸭血粉丝汤、盐水鸭，结束完美假期' },
            ],
          },
        ],
      },
      {
        icon: 'chart',
        title: '预算明细',
        desc: '单人 · 中等标准 · 旺季参考价',
        kind: 'budget',
        budget: [
          { label: '机票 南京 → 成都', amount: '¥900' },
          { label: '成都 → 自贡 高铁', amount: '¥120' },
          { label: '自贡 → 泸州 高铁', amount: '¥80' },
          { label: '泸州 → 重庆 高铁', amount: '¥110' },
          { label: '机票 重庆 → 南京', amount: '¥800' },
          { label: '成都住宿 3 晚', amount: '¥960', note: '¥320/晚' },
          { label: '泸州住宿 2 晚', amount: '¥560', note: '¥280/晚' },
          { label: '门票合计', amount: '¥385', note: '熊猫 55 + 都江堰青城山 170 + 恐龙馆 40 + 瀑布 90 + 窖池 30' },
          { label: '银河左岸音乐节', amount: '¥580', note: '¥480–680' },
          { label: '餐饮 7 天', amount: '¥840', note: '¥120/天' },
          { label: '市内交通 / 包车', amount: '¥500' },
          { label: '纪念品 / 零食', amount: '¥300' },
          { label: '应急预备金', amount: '¥500' },
        ],
      },
    ],
    tips: [
      {
        icon: '🎫',
        title: '必看提醒',
        items: [
          '熊猫基地关注公众号，提前 3 天 0 点放票，国庆非常抢手',
          '音乐节票：大麦 / 票牛 / 摩天轮搜「银河左岸」，建议买 10/5 单日票',
        ],
      },
      {
        icon: '🌂',
        title: '天气与装备',
        items: [
          '10 月川渝多雨，雨衣必备，不要带长柄伞进音乐节',
          '山区温差大，外套不可少',
          '舒适步行鞋（青城山要走 8km+）',
        ],
      },
      {
        icon: '🚖',
        title: '交通与住宿',
        items: [
          '国庆打车难，提前一天预约机场接送和赤水拼车',
          '泸州音乐节期间一房难求，至少提前 1 个月订',
        ],
      },
      {
        icon: '📷',
        title: '音乐节拍摄',
        items: [
          '场内禁止单反 / 长焦 / 直播杆',
          '手机自拍没关系，想拍 vlog 用稳定器没问题',
          '建议买带返程大巴的套餐',
        ],
      },
    ],
  },
  /* ================= 数码 ================= */
  {
    id: 'pc-upgrade-ue5',
    title: '电脑升级方案 · UE5 优化',
    subtitle: 'R5 3600 + GTX 1660S → 只升 CPU 和显卡就够',
    category: 'tech',
    emoji: '🖥️',
    gradient: 'from-violet-600 via-indigo-700 to-blue-900',
    tags: ['装机', 'UE5', '性价比'],
    summary:
      'SSD、双通道内存、金牌电源、塔散都已到位，真正要动的只有 CPU + 显卡，第一步先开 XMP。',
    meta: [
      { label: '预算', value: '¥2,800±' },
      { label: '平台', value: 'AM4' },
      { label: '目标', value: 'UE5 流畅' },
      { label: '已投入', value: '¥5,122' },
    ],
    sections: [
      {
        icon: 'layers',
        title: '现有配置速览',
        desc: '这套机器搭得不错，不用全部重买',
        kind: 'cards',
        cards: [
          { emoji: '🧠', title: 'CPU · R5 3600', desc: '当年主流，现偏弱 · 最大瓶颈', badge: '待升' },
          { emoji: '🎮', title: '显卡 · GTX 1660 SUPER 6G', desc: '无光追 / DLSS · 升级重点', badge: '待升' },
          { emoji: '🧩', title: '内存 · 16GB DDR4 3200', desc: '8G×2 双通道已 OK · 记得开 XMP', badge: '够用' },
          { emoji: '🔌', title: '主板 · B450M MORTAR MAX', desc: '可升级 Ryzen 5000 系列', badge: '可留' },
          { emoji: '💾', title: 'SSD · WD SN750 500G', desc: '高速 NVMe · 不用换', badge: '可留' },
          { emoji: '🔋', title: '电源 / 散热 · 500W + 玄冰400', desc: '金牌电源 + 四热管 · 已合格', badge: '可留' },
        ],
      },
      {
        icon: 'rocket',
        title: '升级优先级（建议顺序）',
        desc: '先免费后花钱，循序渐进最划算',
        kind: 'timeline',
        nodes: [
          {
            badge: '0',
            title: 'BIOS 开 XMP / DOCP',
            meta: '零成本 · 立刻做',
            emoji: '⚡',
            tags: ['免费', '立刻提升'],
            desc: '海盗船 3200 套条目前可能跑在 2133 JEDEC，必须进 BIOS 开 XMP 才会到 3200。开机按 DEL 进 BIOS → OC / 内存设定 → 开 XMP 或 DOCP → 储存重开。',
            items: [{ label: '对 Ryzen 帧数影响明显，且完全免费' }],
          },
          {
            badge: '1',
            title: '更换显卡（性能提升核心）',
            meta: '性价比 ★★★★★',
            emoji: '🎮',
            tags: ['核心', '必做'],
            desc: 'UE5 的 Lumen / Nanite 很吃显卡与显存，建议 12GB 以上显存 + 支持 DLSS / FSR。',
            items: [
              { label: '500W 金牌电源可轻松带 RTX 4060 / 4060 Ti / RX 6750 GRE' },
              { label: '要上 4070 SUPER / 7700 XT 建议同步升 650W 电源' },
            ],
          },
          {
            badge: '2',
            title: 'CPU 升级 Ryzen 5 5600 / 5700X3D',
            meta: '性价比 ★★★★☆',
            emoji: '🧠',
            tags: ['换 BIOS 后直插'],
            desc: '更新 BIOS 后直接换，不需换主板、不需重买散热（玄冰400 压 5700X3D 没问题）。',
            items: [
              { label: '5600 性价比高，配 4060 级别刚刚好' },
              { label: '5700X3D 对游戏低帧提升巨大，是 AM4 平台的终极游戏 U' },
            ],
          },
          {
            badge: '3',
            title: '内存扩到 32GB（选配）',
            meta: '选配 · 依需求再升',
            emoji: '🧩',
            desc: '16GB 玩 UE5 还够，但《黑神话》《艾尔登法环》开高材质会偏紧。建议直接买 2×16GB 全新套装，别在旧条上叠加。',
          },
          {
            badge: '4',
            title: '存储扩充（选配）',
            meta: '选配 · 空间不够再说',
            emoji: '💾',
            desc: '500G 系统盘 + 1~2 个 UE5 大作就满了。可加一条 1~2T NVMe 当游戏盘（2.5" SATA SSD 也很便宜，¥300~400 / 1T）。',
          },
        ],
      },
      {
        icon: 'chart',
        title: '显卡选购参考',
        desc: '按预算挑，UE5 建议显存 ≥ 12GB',
        kind: 'table',
        table: {
          headers: ['型号', '显存', '适合场景', '参考价', '评价'],
          rows: [
            ['RTX 3060 12G', '12GB', '1080p 中高画质', '¥1,600~1,900', '预算入门'],
            ['RX 6650 XT 8G', '8GB', '1080p 高画质', '¥1,500~1,700', '预算入门'],
            ['RTX 4060 8G', '8GB', '1080p 高画质流畅 / 2K 中画质', '¥2,100~2,400', '主流首选 · 有 DLSS3'],
            ['RX 6750 GRE 12G', '12GB', '1080p 全高 / 2K 中高', '¥2,000~2,300', '性价比高 · 显存足'],
            ['RTX 4060 Ti 16G', '16GB', '2K 中高画质', '¥3,100~3,500', '2K 均衡'],
            ['RX 7700 XT 12G', '12GB', '2K 高画质', '¥2,900~3,300', '2K 性价比'],
            ['RTX 4070 SUPER 12G', '12GB', '2K 全高 / 4K 入门', '¥4,300~4,800', '高阶'],
            ['RX 7800 XT 16G', '16GB', '2K 全高 / 4K 中高', '¥3,800~4,300', '高阶'],
          ],
        },
      },
      {
        icon: 'tool',
        title: 'CPU 选购参考',
        desc: '先到 MSI 官网更新 BIOS，再换 CPU',
        kind: 'table',
        table: {
          headers: ['型号', '核心/线程', '适合场景', '参考价', '评价'],
          rows: [
            ['Ryzen 5 5600（散片）', '6C/12T', '配 4060 / 6750GRE 级别', '¥650~750', '性价比之王'],
            ['Ryzen 5 5600（盒装）', '6C/12T', '同上，附散热器', '¥800~900', '省事之选'],
            ['Ryzen 5 5600X', '6C/12T', '与 5600 差异很小', '¥850~950', '可略过'],
            ['Ryzen 7 5700X', '8C/16T', '游戏 + 生产力兼顾', '¥1,000~1,200', '均衡'],
            ['Ryzen 7 5700X3D', '8C/16T', '游戏低帧提升巨大', '¥1,400~1,600', 'AM4 游戏首选'],
            ['Ryzen 7 5800X3D', '8C/16T', 'AM4 最强游戏 U', '¥1,800~2,200', '预算充足才考虑'],
          ],
        },
      },
      {
        icon: 'box',
        title: '其他零件参考',
        desc: '内存 / SSD / 电源 / 散热，按需再动',
        kind: 'table',
        table: {
          headers: ['类别', '型号举例', '规格 / 说明', '参考价'],
          rows: [
            ['内存', '金百达 银爵 32GB (16×2) DDR4 3200', '预算首选 · 建议直接买全新套装', '¥300~360'],
            ['内存', '芝奇 焰光戟 32GB (16×2) DDR4 3600', 'RGB 颜值 + 高频', '¥450~550'],
            ['SSD', '铠侠 RC20 1TB', 'NVMe Gen3 · 性价比高', '¥380~450'],
            ['SSD', '致态 TiPlus 7100 1TB', 'NVMe Gen4 · 旗舰级', '¥500~580'],
            ['电源', '550W 金牌全模组', '4060 / 6750GRE 安全选择', '¥280~350'],
            ['电源', '650W 金牌全模组', '4060Ti / 7700XT / 7800XT', '¥350~450'],
            ['散热', '利民 AX120 R SE', '单塔风冷 · 5600 标配', '¥60~80'],
            ['散热', '利民 PA120', '双塔风冷 · X3D 推荐', '¥130~180'],
          ],
        },
      },
      {
        icon: 'sparkle',
        title: '推荐组合方案',
        desc: '依预算选一套，直接照抄',
        kind: 'cards',
        cards: [
          { emoji: '🅰️', title: '方案 A · 显卡优先', desc: '约 ¥2,100~2,400 · RTX 4060 / RX 6750 GRE，沿用原 CPU + 500W · 1080p 高画质 60+ FPS' },
          { emoji: '🅱️', title: '方案 B · 显卡 + CPU', desc: '约 ¥2,800~3,200 · R5 5600 + RTX 4060 / 6750GRE，沿用 500W + 玄冰400 · 1080p 全高 80+ FPS', badge: '★ 推荐' },
          { emoji: '🅲', title: '方案 C · 2K 进阶', desc: '约 ¥4,500~5,200 · R7 5700X3D + 4060 Ti 16G / 7700 XT，电源升 650W · 2K 中高 60+ FPS' },
          { emoji: '🅳', title: '方案 D · 旗舰 2K', desc: '约 ¥6,300~7,200 · 5800X3D + 4070 SUPER / 7800 XT，升 750W · 2K 全高 90+ FPS' },
        ],
      },
      {
        icon: 'check',
        title: '动手前检查清单',
        kind: 'list',
        list: [
          {
            icon: '✅',
            title: '立刻做',
            items: [
              'BIOS 开 XMP：DEL 进 BIOS → OC / Tweaker → 开 XMP（华硕叫 DOCP）→ 储存退出，内存从 2133 升到 3200',
              '更新 BIOS：到 MSI 官网 B450M MORTAR MAX 页面下载最新版（支援 Ryzen 5000）',
              '检查 GPU 供电线：航嘉 500W 金牌有 8pin PCIe，4060 / 4060Ti / 6750GRE 都能直接接',
            ],
          },
          {
            icon: '📏',
            title: '装机前确认',
            items: [
              '量机箱显卡位深度，高阶卡（如 4070S）通常 30cm 上下',
              '内存插在第 2、4 槽（A2/B2）就是双通道，开了 XMP 会跑 3200',
              '换卡后用 DDU 卸载旧驱动再装新驱动，避免冲突',
              'CPU 重装要重涂硅脂，检查扣具别压太紧',
            ],
          },
        ],
      },
    ],
    tips: [
      {
        icon: '💰',
        title: '省钱贴士',
        items: [
          'SSD / RAM / 电源 / 散热都到位，不用再花钱',
          '只需升 CPU + 显卡；闲鱼 / 京东拍拍的 R5 5600 散片很保值，约 ¥650',
          '显卡建议买全新，避开矿卡',
        ],
      },
      {
        icon: '⚠️',
        title: '顺序提醒',
        items: [
          '先开 XMP → 升显卡 → 升 CPU，循序渐进最划算',
          '以上价格为 2026 年市场参考价，实际以京东 / 淘宝 / 拼多多当日行情为准',
        ],
      },
    ],
  },

  /* ================= 游戏 ================= */
  {
    id: 'game-mods',
    title: '热门 MOD 游戏推荐',
    subtitle: '一个游戏变 N 个游戏 · 2026 整理',
    category: 'game',
    emoji: '🎮',
    gradient: 'from-rose-500 via-fuchsia-600 to-purple-800',
    tags: ['MOD', '大型扩展', '单机'],
    summary:
      '15 年的 MOD 生态能把一个游戏变成 N 个游戏。按五个梯队整理，从零成本老游戏焕新到独立体量的大型扩展。',
    meta: [
      { label: '分类', value: '5 个梯队' },
      { label: '平台', value: 'Steam / 工坊' },
      { label: '成本', value: '多数免费' },
      { label: '更新', value: '2026' },
    ],
    sections: [
      {
        icon: 'gamepad',
        title: '第一梯队 · 一个游戏变 N 个游戏',
        desc: 'MOD 生态足够撑起独立作品',
        kind: 'cards',
        cards: [
          { emoji: '🗡️', title: '上古卷轴 5：天际', desc: 'Enderal / Beyond Skyrim，15 年 MOD 生态六位数起步，Enderal 已是独立体量新游戏；还能整成「少女卷轴」、加生存系统、现代武器载具', badge: 'MOD 之王' },
          { emoji: '🧱', title: '盖瑞模组', desc: '本身就是数字乐高，造计算机、沙盒、RP 服务器，什么都能玩' },
          { emoji: '🎲', title: '博德之门 3', desc: '官方支持 MOD，职业体系、遭遇战、UI 全面重做', badge: '官方支持' },
          { emoji: '☢️', title: '辐射 4', desc: '联邦重建、新势力 MOD，和天际同门，废土玩法彻底重铸' },
        ],
      },
      {
        icon: 'layers',
        title: '第二梯队 · 大型扩展 ≈ 官方 DLC',
        desc: '装上去等于白送一个新游戏',
        kind: 'cards',
        cards: [
          { emoji: '🌍', title: '环世界 RimWorld', desc: '工坊 4 万+ MOD，Combat Extended 重做战斗、中世纪化模组把科幻殖民地变成奇幻大陆，装 150 个 MOD 再开局是常态' },
          { emoji: '⚔️', title: '泰拉瑞亚', desc: '灾厄（Calamity）和瑟银（Thorium）等于白送两个新游戏，几十小时的新 Boss、新职业、新事件' },
          { emoji: '🌾', title: '星露谷物语', desc: '星露谷扩展（SVE）新增一整片地图和几十个新 NPC，原版玩腻了必备', badge: '必备' },
          { emoji: '⛏️', title: '我的世界', desc: 'GTNH、RLCraft 等大型整合包，核心玩法完全不同' },
          { emoji: '🃏', title: '杀戮尖塔 / 雨中冒险 2 / 以撒的结合', desc: 'Downfall（扮演 Boss）、Starstorm 2 等大型扩展，肉鸽内容无限叠加' },
        ],
      },
      {
        icon: 'grid',
        title: '第三梯队 · 策略 / 模拟类',
        desc: '一套机制换一套玩法',
        kind: 'cards',
        cards: [
          { emoji: '🏛️', title: '文明 6', desc: '「和而不同」平衡大包、「城市之光」每城独立经济、「超级大国」加全球变暖 / 瘟疫 / 贸易垄断' },
          { emoji: '🐉', title: '三国志 11', desc: '血色衣冠——中文策略圈神作级剧本，武将数值、单挑机制、地图剧本全部重构，十几年生态依然活跃', badge: '中文必玩' },
          { emoji: '🗡️', title: '全面战争：三国', desc: '武将合集（上百历史人物 + 独立技能树）、MTU（立绘事件重做）、分久必明（官职 + 经济重做）' },
          { emoji: '🌌', title: '群星 / 十字军之王 3', desc: 'Gigastructural Engineering 宇宙玩法翻倍、AGOT 冰与火之歌等全世界观替换' },
          { emoji: '🏭', title: '异星工厂 Factorio', desc: "Krastorio 2、Space Exploration、Bob's & Angel's——40 小时的游戏拉成 400 小时的执念" },
          { emoji: '🏙️', title: '城市：天际线', desc: '30 万+ 工坊资产，真实交通、真实人口，模拟城市玩家的最终归宿' },
        ],
      },
      {
        icon: 'star',
        title: '第四梯队 · 开放世界与经典焕新',
        desc: '整活与低成本高回报',
        kind: 'cards',
        cards: [
          { emoji: '🚗', title: 'GTA5', desc: 'FiveM RP 服务器——从单机变成完全不同的联机角色扮演世界，玩法跟本体毫无关系', badge: '整活' },
          { emoji: '💍', title: '艾尔登法环', desc: '无缝联机 MOD 把单机魂系变成合作开荒游戏，还有各种随机化 MOD' },
          { emoji: '🌃', title: '赛博朋克 2077', desc: '大型 MOD 生态成熟，V 的身份故事、义体系统重制' },
          { emoji: '🐺', title: '魔兽争霸 3', desc: '海量 RPG 地图（军团 TD、各种肉鸽地图），现在依然天天有新图' },
          { emoji: '😈', title: '暗黑破坏神 2 重制版', desc: 'PD2（Project Diablo 2）重做技能与赛季玩法，老玩家公认最耐玩版本' },
          { emoji: '🧟', title: '求生之路 2', desc: '官方停止更新的游戏，靠 MOD 活到 2026 年' },
          { emoji: '⚡', title: '宝可梦', desc: 'Radical Red、Emerald Kaizo 等 ROM hack，难度和机制完全重构', badge: '零成本' },
        ],
      },
      {
        icon: 'lightbulb',
        title: '针对性建议',
        desc: '按当下想玩什么来挑',
        kind: 'list',
        list: [
          { icon: '🔥', title: '想肝', items: ['泰拉瑞亚灾厄、环世界'] },
          { icon: '♟️', title: '想搞策略', items: ['三国志 11 血色衣冠（免费 MOD，中文圈子最成熟）'] },
          { icon: '🎪', title: '想整活', items: ['艾尔登法环无缝联机、GTA5 的 FiveM'] },
          { icon: '💰', title: '想省钱', items: ['魔兽争霸 3 老图、宝可梦 ROM hack 都是零成本'] },
        ],
      },
    ],
    tips: [
      {
        icon: '🛡️',
        title: '打 Mod 通用黄金法则',
        items: [
          '备份存档——任何大型 Mod 都有炸档风险，先复制存档文件夹',
          '一次别装太多——大型 Mod 之间数值冲突严重，控制数量',
          '前置框架必装——很多 Mod 需要公共前置（如天际的 SKSE、鬼谷的 Fatury 框架）',
          '注意排序——框架 → 修复 → 功能 → 剧情 → 大型综合，加载顺序决定成败',
          '首选创意工坊 / 官方平台——第三方整合包很多夹带私货，安全性差',
          '开新档——大型 Mod 基本都推荐新档游玩，老档容易属性错乱',
        ],
      },
    ],
  },

  /* ================= 健康 ================= */
  {
    id: 'lean-plan',
    title: '轻盈计划 · 减脂健身',
    subtitle: 'Leah 的减脂追踪台 · 按自己的节奏来',
    category: 'health',
    emoji: '💪',
    gradient: 'from-emerald-500 via-teal-600 to-cyan-700',
    tags: ['减脂', '力量训练', '习惯'],
    summary:
      '用连续趋势理解变化，不被单日数字影响。65.0 kg → 58.0 kg，温和可持续的能量缺口。',
    meta: [
      { label: '当前', value: '65.0 kg' },
      { label: '目标', value: '58.0 kg' },
      { label: '每日', value: '1700 kcal' },
      { label: '步数', value: '8000' },
    ],
    sections: [
      {
        icon: 'zap',
        title: '每日能量预算',
        desc: '营养值用于日常估算，生重熟重按食物状态记录',
        kind: 'cards',
        cards: [
          { emoji: '🔥', title: '每日总热量', desc: '1700 kcal 预算 · 温和缺口，可持续优先', badge: '目标' },
          { emoji: '🥩', title: '蛋白质 110g', desc: '按体重约 1.7g/kg，减脂期保护肌肉' },
          { emoji: '🍚', title: '碳水 190g', desc: '优先全谷物、薯类，训练日可略高' },
          { emoji: '🥑', title: '脂肪 55g', desc: '坚果、橄榄油、深海鱼为主，不低于 0.8g/kg' },
        ],
      },
      {
        icon: 'calendar',
        title: '每周训练安排',
        desc: '力量、有氧都可记录；完成质量比堆叠数字更重要',
        kind: 'timeline',
        nodes: [
          {
            badge: '一',
            title: '力量 · 推',
            meta: '上肢推',
            emoji: '🏋️',
            tags: ['胸 / 肩 / 三头'],
            desc: '每个动作 4 组 × 8-12 次，留 1-2 次余力',
            items: [
              { label: '卧推 / 哑铃卧推' },
              { label: '站姿推举' },
              { label: '双杠臂屈伸 / 绳索下压' },
            ],
          },
          {
            badge: '二',
            title: '有氧 · 轻量',
            meta: '恢复日',
            emoji: '🚶',
            tags: ['快走 / 慢跑'],
            desc: '30-40 分钟中低强度，心率保持在能说话的区间',
          },
          {
            badge: '三',
            title: '力量 · 拉',
            meta: '下肢 + 背',
            emoji: '🦵',
            tags: ['腿 / 背 / 二头'],
            desc: '深蹲 + 硬拉为主，动作标准优先于重量',
            items: [
              { label: '深蹲 / 高脚杯深蹲' },
              { label: '罗马尼亚硬拉' },
              { label: '划船 / 引体' },
            ],
          },
          {
            badge: '六',
            title: '有氧 + 复盘',
            meta: '周末',
            emoji: '📊',
            tags: ['周报'],
            desc: '一次较长有氧，然后打印周报，看本周稳定度而不是单日数字',
          },
          {
            badge: '日',
            title: '休息',
            meta: '同样是计划的一部分',
            emoji: '😴',
            desc: '睡够 7-8 小时，恢复不足会拉高食欲，减脂效率反而下降',
          },
        ],
      },
      {
        icon: 'chart',
        title: '能量与宏量目标',
        kind: 'table',
        table: {
          headers: ['项目', '目标', '说明'],
          rows: [
            ['每日热量', '1700 kcal', '温和缺口，可持续优先'],
            ['蛋白质', '110 g', '约 1.7g/kg，保护肌肉'],
            ['碳水', '190 g', '训练日可上调 20-30g'],
            ['脂肪', '55 g', '不低于 0.8g/kg'],
            ['步数', '8,000 步', 'NEAT 是减脂的隐形主力'],
            ['睡眠', '7-8 h', '恢复不足会拉高食欲'],
          ],
        },
      },
      {
        icon: 'heart',
        title: '习惯与恢复',
        desc: '低摩擦记录活动、恢复和每天想坚持的小事',
        kind: 'list',
        list: [
          { icon: '😴', title: '睡眠', items: ['目标 7-8 小时，尽量固定作息'] },
          { icon: '💧', title: '饮水', items: ['每天 2000ml 以上，训练日再加 500ml'] },
          { icon: '🔋', title: '精力', items: ['1 很低 / 5 很高，每天主观打分'] },
          { icon: '💪', title: '酸痛', items: ['1 很低 / 5 很高，持续高于 4 就降量'] },
        ],
      },
      {
        icon: 'sparkle',
        title: '温和洞察',
        desc: '只基于已记录数据',
        kind: 'text',
        text: '记录仍在积累。完成今天的饮食、活动和恢复记录后，洞察会更贴近你。用连续趋势理解变化，不被单日数字影响。',
      },
      {
        icon: 'shield',
        title: '免责声明',
        kind: 'text',
        text: '本工具用于个人趋势记录，不作医疗诊断。疾病、孕哺期、未成年人、饮食障碍风险或明显不适时，请优先咨询医生或注册营养师。建议采用温和、可持续的能量缺口。',
      },
    ],
    tips: [
      {
        icon: '🌱',
        title: '温和减脂原则',
        items: [
          '用连续趋势理解变化，不被单日数字影响',
          '力量训练 + 足够蛋白，减脂不减肌',
          '每周体重下降 0.5%–1% 体重为宜',
          '允许弹性，别追求完美',
        ],
      },
      {
        icon: '📊',
        title: '记录建议',
        items: [
          '体重固定晨起空腹称，看 7 日均值',
          '饮食记录生重熟重按实际状态',
          '每周打印一次周报做复盘',
        ],
      },
    ],
  },

  /* ================= 生活 ================= */
  {
    id: 'cooking-3-dishes',
    title: '今晚下厨指南',
    subtitle: '玉米排骨汤 · 木耳炒瘦肉 · 清炒西兰花',
    category: 'life',
    emoji: '🍳',
    gradient: 'from-amber-500 via-orange-600 to-red-700',
    tags: ['家常菜', '两人份', '电饭煲'],
    summary:
      '三菜一汤两人份，照时间顺序来不慌：进门先泡木耳，排骨入锅再炒菜，最后 5 分钟炒西兰花。',
    meta: [
      { label: '菜品', value: '3 道' },
      { label: '份量', value: '2 人' },
      { label: '耗时', value: '约 1.5h' },
      { label: '难度', value: '新手友好' },
    ],
    sections: [
      {
        icon: 'grid',
        title: '菜市场买菜清单（两人份）',
        desc: '照着买就行，挑选要点都在备注里',
        kind: 'table',
        table: {
          headers: ['食材', '用量', '挑选要点'],
          rows: [
            ['排骨（肋排）', '约 400 克 / 8 两', '骨头细、肉多、嫩；让摊主剁成 3-4 厘米小块，避开大棒骨'],
            ['甜玉米', '1 根（大的）或 2 小根', '选黄甜玉米，颗粒饱满；别买老糯玉米，煲汤不甜'],
            ['瘦肉（里脊/后腿）', '约 150 克 / 3 两', '里脊最嫩无筋膜，颜色淡红、纹理细腻、不粘手'],
            ['干木耳', '约 15 克（一小把）', '泡发膨胀 8-10 倍；或直接买鲜木耳约 150 克'],
            ['西兰花', '1 个（约 350 克）', '花球紧密、深绿、没开花，手感沉甸甸'],
            ['配料：姜 / 蒜 / 葱', '小份即可', '姜煲汤 + 爆香、蒜两道菜都要、葱撒花'],
            ['枸杞（可选）', '一小包', '汤里放点补血养眼'],
          ],
        },
      },
      {
        icon: 'coffee',
        title: '电饭煲煲汤关键提醒',
        desc: '汤清不腥的六个要点',
        kind: 'list',
        list: [
          {
            icon: '🍲',
            title: '煲汤关键',
            items: [
              '排骨必须先焯水：冷水下锅 + 几片姜 + 一勺料酒，大火煮开撇浮沫，再煮 2 分钟，捞出用温水冲洗',
              '水量一次性加足（没过食材再多 3-4 厘米），中途别开盖加水，否则汤不鲜',
              '选「煲汤」或「煮粥」功能，没有就选「煮饭」跑两轮，时间约 1~1.5 小时',
              '盐最后 5 分钟再放，提前放盐肉会发柴、汤也不鲜',
              '玉米切 3-4 厘米小段更容易入味，对半劈开也行',
              '内胆放稳妥，加热盘擦干净再通电',
            ],
          },
        ],
      },
      {
        icon: 'calendar',
        title: '三道菜详细步骤',
        desc: '按顺序做，汤煲着的时候正好炒菜',
        kind: 'timeline',
        nodes: [
          {
            badge: '一',
            title: '玉米排骨汤（电饭煲）',
            meta: '先做 · 煲 1~1.5 小时',
            emoji: '🍲',
            tags: ['电饭煲'],
            desc: '先做这个，煲着的时候再去炒菜。',
            items: [
              { label: '排骨冷水下锅，加 3 片姜 + 1 勺料酒，大火烧开撇去浮沫，再煮 2 分钟，捞出用温水冲净', note: '别用冷水冲，肉会缩' },
              { label: '玉米洗净切 3-4 厘米小段，姜切 2-3 片，葱打结备用' },
              { label: '内胆放入焯好的排骨、玉米、姜片、葱结，加热水没过食材再多 3-4 厘米，不超最高水位线' },
              { label: '盖上盖，选「煲汤」功能，时间设 1~1.5 小时，启动' },
              { label: '出锅前 5 分钟开盖加盐调味，撒一把枸杞，再盖盖焖 5 分钟' },
              { label: '盛碗时撒点葱花，完成' },
            ],
            footer: [{ icon: 'alert-circle', label: '注意', value: '焯水必须冷水下锅才能逼出血水；中途别开盖；盐务必最后放', warn: true }],
          },
          {
            badge: '二',
            title: '木耳炒瘦肉',
            meta: '汤煲上后做 · 约 20 分钟',
            emoji: '🥘',
            desc: '汤煲上之后做这个，前后约 20 分钟。',
            items: [
              { label: '提前泡木耳：干木耳冷水泡 2-3 小时（赶时间用温水 40-50 分钟），泡发后撕小朵，去掉根部硬蒂，反复洗净泥沙' },
              { label: '瘦肉切薄片，加半勺生抽 + 半勺料酒 + 半勺淀粉，抓匀腌 10 分钟', note: '肉片嫩的关键' },
              { label: '蒜切末；烧一锅水，水开下木耳焯 1-2 分钟捞出沥干', note: '焯过口感脆、不易爆锅' },
              { label: '热锅凉油，下腌好的肉片快速滑炒，变色立即盛出备用' },
              { label: '锅中留底油，下蒜末爆香，倒入木耳翻炒 1 分钟，加少许盐' },
              { label: '倒回肉片，加半勺生抽翻匀，出锅' },
            ],
            footer: [{ icon: 'alert-circle', label: '注意', value: '肉片要腌才嫩；热锅凉油防粘；木耳一定焯水，否则下锅容易溅油爆响；干木耳现泡现吃，泡过夜别吃', warn: true }],
          },
          {
            badge: '三',
            title: '清炒西兰花',
            meta: '最后做 · 5 分钟',
            emoji: '🥦',
            desc: '最后做，5 分钟搞定，趁绿上桌。',
            items: [
              { label: '西兰花掰成小朵（别用刀切，手掰更规整），茎部去皮切片也能吃' },
              { label: '用淡盐水浸泡 10 分钟去小虫和农残，再冲洗干净沥干' },
              { label: '烧水，水开下西兰花焯 1 分钟，水里加少许盐 + 几滴油', note: '保持翠绿' },
              { label: '热锅下油，蒜末爆香，下西兰花大火快炒 1-2 分钟' },
              { label: '加盐调味，翻匀出锅' },
            ],
            footer: [{ icon: 'alert-circle', label: '注意', value: '焯水是保持翠绿脆嫩的关键，别省；大火快炒时间要短，炒久会发黄变软', warn: true }],
          },
        ],
      },
      {
        icon: 'home',
        title: '今晚时间线（照这个顺序不慌）',
        kind: 'timeline',
        nodes: [
          { badge: '0', title: '进门先泡木耳', meta: '第 0 分钟', emoji: '⏱️', desc: '冷水泡上，顺手把米淘好（如果吃米饭）' },
          { badge: '5', title: '处理排骨焯水', meta: '第 5 分钟', emoji: '🥩', desc: '玉米切块，准备煲汤料' },
          { badge: '15', title: '排骨入电饭煲', meta: '第 15 分钟', emoji: '🍲', desc: '加水启动煲汤，1~1.5 小时倒计时开始' },
          { badge: '⏳', title: '煲汤期间备菜', meta: '20-70 分钟', emoji: '🔪', desc: '腌瘦肉、切蒜、焯木耳，把木耳炒瘦肉做好装盘' },
          { badge: '🥦', title: '做清炒西兰花', meta: '汤好前 15 分钟', emoji: '🥦', desc: '5 分钟搞定，三菜就齐了' },
          { badge: '🍽️', title: '全部上桌', meta: '开饭', emoji: '🍽️', desc: '汤加盐调味，撒葱花和枸杞' },
        ],
      },
    ],
    tips: [
      {
        icon: '⚠️',
        title: '关键要点',
        items: [
          '焯水一定冷水下锅才能逼出血水，别省这一步',
          '木耳一定焯水，否则下锅容易溅油爆响',
          '西兰花焯水是保持翠绿脆嫩的关键',
          '干木耳现泡现吃，泡过夜别吃',
        ],
      },
    ],
  },
];
