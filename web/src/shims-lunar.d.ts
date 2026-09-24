/**
 * lunar-javascript 最小类型声明（仅覆盖本项目用到的 API）。
 * 库为 CJS 导出，组件内通过默认导入再解构：import LunarJS from 'lunar-javascript'
 */
declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getFestivals(): string[];
    getLunar(): Lunar;
  }

  export class Lunar {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    isLeap(): boolean;
    getYearInChinese(): string;
    getMonthInChinese(): string;
    getDayInChinese(): string;
    getFestivals(): string[];
  }

  const _default: { Solar: typeof Solar; Lunar: typeof Lunar };
  export default _default;
}
