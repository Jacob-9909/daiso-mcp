/** 장식이 데이터 선과 수치 라벨을 가리지 않는지 검증합니다. */
import { describe, expect, it } from 'vitest';
import { placeChartStickers } from '../../scripts/ops/workers-chart-stickers.ts';

const area = { left: 144, top: 182, right: 1472, bottom: 514 };
const flat = [
  { x: 144, y: 500 },
  { x: 1472, y: 500 },
];
const overlaps = (a, b) =>
  a.left < b.left + b.width &&
  a.left + a.width > b.left &&
  a.top < b.top + b.height &&
  a.top + a.height > b.top;

describe('그래프 빈 공간 스티커 배치', () => {
  it('데이터 위의 빈 영역에 작고 분산된 스티커를 최대 3개 배치한다', () => {
    const slots = placeChartStickers(flat, [], area, []);
    expect(slots).toHaveLength(3);
    for (const slot of slots) {
      expect(slot.width).toBeLessThanOrEqual(64);
      expect(slot.top + slot.height + 24).toBeLessThan(500);
      expect(slot.left).toBeGreaterThan(area.left);
      expect(slot.left + slot.width).toBeLessThan(area.right);
    }
    for (let i = 0; i < slots.length; i++)
      for (let j = i + 1; j < slots.length; j++) expect(overlaps(slots[i], slots[j])).toBe(false);
  });

  it('일별 선이나 이동평균이 상단까지 차 있으면 장식을 생략한다', () => {
    const full = [
      { x: 144, y: 182 },
      { x: 1472, y: 182 },
    ];
    expect(placeChartStickers(full, [], area, [])).toEqual([]);
    expect(placeChartStickers(flat, full, area, [])).toEqual([]);
  });

  it('급격한 기울기의 두 끝점 사이도 피하고 라벨 영역은 침범하지 않는다', () => {
    const slope = [
      { x: 144, y: 500 },
      { x: 1472, y: 182 },
    ];
    const blocked = [{ left: 144, top: 182, width: 500, height: 260 }];
    const slots = placeChartStickers(slope, [], area, blocked);
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(overlaps(slot, blocked[0])).toBe(false);
      const lineY = 500 - ((slot.left + slot.width + 24 - 144) / 1328) * 318;
      expect(slot.top + slot.height + 24).toBeLessThan(lineY);
    }
  });

  it('기록이 없으면 장식을 표시하지 않는다', () => {
    expect(placeChartStickers([], [], area, [])).toEqual([]);
  });
});
