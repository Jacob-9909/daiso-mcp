/** 호출량 차트의 정보 보존과 실제 이미지 렌더링을 검증합니다. */
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { buildChartSvg, renderChart } from '../../scripts/ops/workers-chart-renderer.ts';
import { calculateSummary } from '../../scripts/ops/workers-chart-helpers.ts';

const points = Array.from({ length: 16 }, (_, index) => ({
  date: `2026-10-${String(index + 1).padStart(2, '0')}`,
  requests: (index + 1) * 1234,
}));
const metadata = {
  startDate: '2026-10-01',
  endDate: '2026-10-16',
  updatedAtText: '2026-10-20 13:00 KST',
};

describe('그림책 스타일 호출량 차트', () => {
  it('정확한 합계와 범례, 0 기준 축 및 상대 축 안내를 유지한다', () => {
    const svg = buildChartSvg(points, calculateSummary(points), metadata);
    expect(svg).toContain('167,824');
    expect(svg).toContain('2026-10-01');
    expect(svg).toContain('2026-10-16');
    expect(svg).toContain('Daily requests');
    expect(svg).toContain('7-day average');
    expect(svg).toContain('relative scale');
    expect(svg).toContain('Requests are not unique users');
    expect(svg).toContain('data-min="0"');
    expect(svg).toContain('stroke-dasharray="8 6"');
    expect(svg).not.toContain('NaN');
  });

  it('단일 0건 기록과 특수문자도 유효한 SVG로 표현한다', () => {
    const zero = [{ date: '2026-10-01', requests: 0 }];
    const svg = buildChartSvg(zero, calculateSummary(zero), {
      ...metadata,
      updatedAtText: '<test & data>',
    });
    expect(svg).toContain('&lt;test &amp; data&gt;');
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('Infinity');
  });

  it('실제로 디코딩되는 고해상도 PNG를 생성한다', async () => {
    const png = await renderChart(points, calculateSummary(points), metadata);
    const image = await sharp(png).metadata();
    expect(image.format).toBe('png');
    expect(image.width).toBe(1600);
    expect(image.height).toBe(980);
  });
});
