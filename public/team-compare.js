import {bar} from './analysis-charts.js?v=20261122charts';
import {teamEvidence, teamMetrics} from './analysis-core.js';

const signed = number => (number > 0 ? '+' : '') + number.toFixed(2);

export function teamComparison(data, first, second, teamName) {
  const rows = [first, second];
  const evidence = rows.map(row => teamEvidence(data, row.code));
  const titles = rows.map((row, index) => teamName(row.code, index));
  const metrics = [
    ['score', '戰力 SRS'],
    ['margin', '場均淨勝分'],
    ['schedule', '賽程強度'],
  ];

  const marginCharts = metrics.map(([key, label]) => {
    const values = rows.map(row => row[key]);
    const range = Math.max(1, ...metrics.flatMap(([metric]) => rows.map(row => Math.abs(row[metric]))));
    return `<section class="comparison-metric"><h4>${label}</h4>
      ${values.map((number, index) => {
        const width = Math.abs(number) / range * 50;
        const left = number < 0 ? 50 - width : 50;
        return `<div class="comparison-value"><span>${titles[index]}</span><strong>${signed(number)}</strong>
          <div class="power-track" aria-hidden="true"><i class="compare-color-${index}" style="width:${width}%;left:${left}%"></i></div></div>`;
      }).join('')}</section>`;
  }).join('');

  const percentiles = teamMetrics.map(([key, label]) => `<section class="comparison-metric"><h4>${label}</h4>
    ${evidence.map((result, index) => {
      const metric = result?.metrics.find(item => item.key === key);
      const detail = metric ? `原值 ${metric.value.toFixed(2)}${key.endsWith('Pct') ? '%' : ''} · 第 ${metric.rank}／${metric.count}` : '';
      return `<div class="compare-series-${index}">${bar(rows[index].code, metric?.percentile, detail)}</div>`;
    }).join('')}</section>`).join('');

  return `<div class="panel comparison-panel"><h3>兩隊比較</h3>
    <div class="comparison-head">${rows.map((row, i) => `<div class="comparison-value">${titles[i]}<strong>第 ${row.rank} 名</strong><small>${row.wins} 勝 ${row.losses} 負</small></div>`).join('')}</div>
    <div class="comparison-grid">${marginCharts}</div>
    <details class="standalone-data-detail"><summary>單項百分位</summary><p>上方分差圖共用刻度，中線為 0。</p><div class="comparison-grid">${percentiles}</div></details>
    </div>`;
}
