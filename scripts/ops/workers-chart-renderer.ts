/** 실제 호출량은 그대로 두고 README 일러스트와 어울리는 차트를 그립니다. */
import sharp from 'sharp';
import {
  buildDataLabelIndexes,
  calculateMovingAverage,
  findMinNonZero,
  formatCompactNumber,
  formatNumber,
  isWeekendKst,
  shouldShowWeeklyTick,
  WORKERS_CHART_ACCENT_COLORS,
} from './workers-chart-helpers.ts';

const INK = '#583c2c';
const MUTED = '#7e6753';
const CORAL = '#ce694b';
const SAGE = '#70876a';
const AREA = { left: 112, top: 182, right: 1488, bottom: 554 };

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function linePath(points) {
  return points
    .filter((point) => point.y !== null)
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}

function pawSvg(x, y) {
  return `<g transform="translate(${x} ${y})" fill="${CORAL}" opacity="0.65">
    <ellipse cx="0" cy="9" rx="13" ry="10" />
    <ellipse cx="-16" cy="-3" rx="5" ry="7" transform="rotate(-25 -16 -3)" />
    <ellipse cx="-6" cy="-12" rx="5" ry="7" />
    <ellipse cx="7" cy="-12" rx="5" ry="7" />
    <ellipse cx="17" cy="-3" rx="5" ry="7" transform="rotate(25 17 -3)" />
  </g>`;
}

function metricSvg(x, y, width, label, value, accent) {
  return `<g>
    <rect x="${x}" y="${y}" width="${width}" height="82" rx="16" fill="#fffcf6" stroke="#dfcbb4" stroke-width="1.4" />
    <rect x="${x + 20}" y="${y + 18}" width="5" height="45" rx="2.5" fill="${accent}" />
    <text x="${x + 39}" y="${y + 29}" class="metric-label">${escapeXml(label)}</text>
    <text x="${x + 39}" y="${y + 62}" class="metric-value" fill="${INK}">${escapeXml(value)}</text>
  </g>`;
}

function recentPanel(points) {
  const recent = points.slice(-14);
  const values = recent.map((point) => point.requests);
  const min = Math.min(...values);
  const range = Math.max(Math.max(...values) - min, 1);
  const x = AREA.left;
  const y = 610;
  const width = AREA.right - x;
  const toX = (index) => x + 24 + (index / Math.max(recent.length - 1, 1)) * (width - 48);
  const toY = (value) => y + 91 - ((value - min) / range) * 39;
  const line = linePath(recent.map((point, index) => ({ x: toX(index), y: toY(point.requests) })));
  const latest = recent[recent.length - 1];
  return `<g>
    <rect x="${x}" y="${y}" width="${width}" height="110" rx="18" fill="#f3f0e4" stroke="#d9d1b9" />
    <text x="${x + 24}" y="${y + 29}" class="panel-title">Last 14 days</text>
    <text x="${x + 174}" y="${y + 29}" class="small">${escapeXml(recent[0].date)} ~ ${escapeXml(latest.date)} · relative scale</text>
    <text x="${AREA.right - 24}" y="${y + 29}" text-anchor="end" class="panel-title">Latest ${escapeXml(formatNumber(latest.requests))}</text>
    <line x1="${x + 24}" y1="${y + 91}" x2="${AREA.right - 24}" y2="${y + 91}" stroke="#dbd4c2" />
    <path d="${line}" fill="none" stroke="${WORKERS_CHART_ACCENT_COLORS.recent14Line}" stroke-width="3" stroke-linejoin="round" />
    ${recent.map((point, index) => `<circle cx="${toX(index).toFixed(1)}" cy="${toY(point.requests).toFixed(1)}" r="${index === recent.length - 1 ? 5 : 3}" fill="${WORKERS_CHART_ACCENT_COLORS.recent14Line}" stroke="#fffcf6" stroke-width="1.5" />`).join('\n')}
  </g>`;
}

export function buildChartSvg(points, summary, metadata) {
  const width = 1600;
  const height = 980;
  const plotWidth = AREA.right - AREA.left;
  const plotHeight = AREA.bottom - AREA.top;
  const values = points.map((point) => point.requests);
  const yMax = Math.ceil(Math.max(...values, 1) / 1000) * 1000;
  const toX = (index) => AREA.left + (index / Math.max(points.length - 1, 1)) * plotWidth;
  const toY = (value) => AREA.bottom - (value / yMax) * plotHeight;
  const chartPoints = points.map((point, index) => ({ x: toX(index), y: toY(point.requests) }));
  const movingAverage = calculateMovingAverage(points, 7).map((value, index) => ({
    x: toX(index),
    y: value === null ? null : toY(value),
  }));
  const min = findMinNonZero(points);
  const peakIndex = values.findIndex((value) => value === Math.max(...values));
  const highlights = new Set([
    points.length - 1,
    peakIndex,
    points.findIndex((point) => point.date === min.date),
  ]);
  const labels = buildDataLabelIndexes(points);
  const line = linePath(chartPoints);
  const area = `${line} L ${AREA.right} ${AREA.bottom} L ${AREA.left} ${AREA.bottom} Z`;
  const metrics = [
    ['Total requests', formatNumber(summary.total), CORAL],
    ['Average / day', formatNumber(summary.average), '#d6a04b'],
    ['Median / day', formatNumber(summary.median), SAGE],
    ['Recent 7-day average', formatNumber(summary.recent7Average), SAGE],
    [
      'Week-over-week change',
      `${summary.weekOverWeekDiff >= 0 ? '+' : ''}${formatNumber(summary.weekOverWeekDiff)}`,
      '#b69ac2',
    ],
    [
      'Day-over-day change',
      `${summary.dayOverDayDiff >= 0 ? '+' : ''}${formatNumber(summary.dayOverDayDiff)}`,
      '#7fa6b1',
    ],
  ];
  const cardWidth = (plotWidth - 32) / 3;

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chart-title chart-description">
    <title id="chart-title">Cloudflare Requests</title>
    <desc id="chart-description">${escapeXml(`${metadata.startDate} ~ ${metadata.endDate}; ${formatNumber(summary.total)} requests; KST. Requests are not unique users.`)}</desc>
    <defs>
      <linearGradient id="paper" x2="0" y2="1"><stop stop-color="#fff9ee"/><stop offset="1" stop-color="#fcf3e4"/></linearGradient>
      <linearGradient id="area" x2="0" y2="1"><stop stop-color="#e5a17d" stop-opacity="0.4"/><stop offset="1" stop-color="#edcbb0" stop-opacity="0.12"/></linearGradient>
    </defs>
    <style>
      text { font-family: Arial, Helvetica, sans-serif; fill: ${INK}; }
      .title { font-size: 36px; font-weight: 700; }
      .subtitle { font-size: 18px; fill: ${MUTED}; }
      .axis, .small { font-size: 15px; fill: ${MUTED}; }
      .legend, .panel-title { font-size: 18px; font-weight: 600; }
      .metric-label { font-size: 16px; fill: ${MUTED}; }
      .metric-value { font-size: 28px; font-weight: 700; }
      .data-label { font-size: 15px; font-weight: 700; fill: ${INK}; paint-order: stroke; stroke: #fffaf1; stroke-width: 5px; stroke-linejoin: round; }
    </style>
    <rect width="${width}" height="${height}" rx="32" fill="url(#paper)"/>
    <rect x="14" y="14" width="1572" height="952" rx="26" fill="none" stroke="#8b6950" stroke-width="2"/>
    <rect x="24" y="24" width="1552" height="932" rx="20" fill="none" stroke="#e8d8be"/>
    <text x="${AREA.left}" y="76" class="title">Cloudflare Requests</text>
    <text x="${AREA.left}" y="108" class="subtitle">${escapeXml(`${metadata.startDate} ~ ${metadata.endDate} · ${points.length} days · KST`)}</text>
    <text x="${AREA.right - 50}" y="68" text-anchor="end" class="legend">DAISO MCP</text>
    <text x="${AREA.right - 50}" y="99" text-anchor="end" class="small">${escapeXml(`Updated ${metadata.updatedAtText}`)}</text>
    ${pawSvg(AREA.right - 14, 61)}
    <line x1="${AREA.left}" y1="145" x2="${AREA.left + 36}" y2="145" stroke="${CORAL}" stroke-width="4" stroke-linecap="round"/>
    <text x="${AREA.left + 48}" y="151" class="legend">Daily requests</text>
    <line x1="${AREA.left + 230}" y1="145" x2="${AREA.left + 270}" y2="145" stroke="${SAGE}" stroke-width="3" stroke-dasharray="8 6"/>
    <text x="${AREA.left + 282}" y="151" class="legend">7-day average</text>
    <rect x="${AREA.right - 148}" y="133" width="16" height="16" rx="4" fill="#eee2cc"/>
    <text x="${AREA.right - 120}" y="147" class="small">Weekend</text>
    <g id="daily-plot" data-min="0" data-max="${yMax}">
    <rect x="${AREA.left}" y="${AREA.top}" width="${plotWidth}" height="${plotHeight}" rx="8" fill="#fffcf7"/>
    ${points
      .map((point, index) => {
        if (!isWeekendKst(point.date)) return '';
        const step = plotWidth / Math.max(points.length - 1, 1);
        const left = Math.max(AREA.left, toX(index) - step / 2);
        const right = Math.min(AREA.right, toX(index) + step / 2);
        return `<rect x="${left.toFixed(1)}" y="${AREA.top}" width="${(right - left).toFixed(1)}" height="${plotHeight}" fill="#eee2cc" opacity="0.38"/>`;
      })
      .join('\n')}
    ${Array.from({ length: 6 }, (_, index) => {
      const tick = Math.round((yMax / 5) * index);
      const y = toY(tick);
      return `<line x1="${AREA.left}" y1="${y.toFixed(1)}" x2="${AREA.right}" y2="${y.toFixed(1)}" stroke="#e7dcca" stroke-dasharray="3 6"/><text x="${AREA.left - 18}" y="${(y + 5).toFixed(1)}" text-anchor="end" class="axis">${escapeXml(formatCompactNumber(tick))}</text>`;
    }).join('\n')}
    ${points
      .map((point, index) => {
        if (!shouldShowWeeklyTick(points, index)) return '';
        const x = toX(index);
        return `<line x1="${x.toFixed(1)}" y1="${AREA.bottom}" x2="${x.toFixed(1)}" y2="${AREA.bottom + 7}" stroke="#b9a28c"/><text x="${x.toFixed(1)}" y="${AREA.bottom + 29}" text-anchor="middle" class="axis">${escapeXml(point.date.slice(5))}</text>`;
      })
      .join('\n')}
    <path d="${area}" fill="url(#area)"/>
    <path d="${line}" fill="none" stroke="${CORAL}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${linePath(movingAverage)}" fill="none" stroke="${WORKERS_CHART_ACCENT_COLORS.movingAverage}" stroke-width="3" stroke-dasharray="8 6"/>
    ${chartPoints.map((point, index) => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${highlights.has(index) ? 6 : 3}" fill="${CORAL}" stroke="#fffcf6" stroke-width="2"/>`).join('\n')}
    ${[...labels]
      .map((index) => {
        const point = chartPoints[index];
        return `<text x="${point.x.toFixed(1)}" y="${(point.y - 17).toFixed(1)}" text-anchor="middle" class="data-label">${escapeXml(formatNumber(points[index].requests))}</text>`;
      })
      .join('\n')}
    </g>
    ${recentPanel(points)}
    ${metrics.map(([label, value, color], index) => metricSvg(AREA.left + (index % 3) * (cardWidth + 16), 742 + Math.floor(index / 3) * 94, cardWidth, label, value, color)).join('\n')}
    <text x="${width / 2}" y="944" text-anchor="middle" class="small">Requests are not unique users · KST daily totals · 7-day trailing average</text>
  </svg>`;
}

export async function renderChart(points, summary, metadata) {
  return sharp(Buffer.from(buildChartSvg(points, summary, metadata)))
    .png()
    .toBuffer();
}
