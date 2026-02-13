/** 偶数に切り下げ（Floor） */
export function toEvenFloor(value: number): number {
  const n = Math.floor(value);
  return n % 2 === 0 ? n : n - 1;
}

/** 値を偶数に補正（奇数なら -1） */
export function ensureEven(value: number): number {
  return value % 2 === 0 ? value : value - 1;
}

/** 2px単位にスナップ（偶数に） */
export function snapToEven(value: number): number {
  const n = Math.round(value / 2) * 2;
  return Math.max(2, n);
}
