import { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { WARNA_RISIKO, rupiahFmt, levelTone } from '../lib/utils';

export const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    boxShadow: '0 10px 30px -12px rgba(16,24,40,.25)',
    fontSize: 12,
    padding: '8px 12px',
  },
  labelStyle: { fontWeight: 700, marginBottom: 4, color: '#0f172a' },
};

export function GrafikDoughnut({ data, tinggi = 200, centerLabel, centerSub }) {
  const total = data.reduce((a, b) => a + (b.value || 0), 0);
  return (
    <div className="relative" style={{ height: tinggi }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="86%"
            paddingAngle={2}
            stroke="#fff"
            strokeWidth={2}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color || `hsl(${i * 47}, 70%, 50%)`} />
            ))}
          </Pie>
          <Tooltip {...TOOLTIP_STYLE} formatter={(v, n) => [`${v} (${total ? Math.round((v / total) * 100) : 0}%)`, n]} />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            <p className="text-2xl font-extrabold text-slate-900 leading-none">{centerLabel}</p>
            {centerSub && <p className="text-[11px] text-slate-500 mt-1">{centerSub}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function GrafikBatang({
  data,
  tinggi = 260,
  kunci = 'nilai',
  label = 'label',
  warna = '#1447e1',
  horizontal = false,
  formatterY,
  formatterTooltip,
  tumpuk = false,
}) {
  const data2 = data.map((d) => ({ ...d, [kunci]: d[kunci] ?? 0 }));
  return (
    <div style={{ height: tinggi }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data2}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 12, left: horizontal ? 8 : -18, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={!horizontal} horizontal={horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatterY} />
              <YAxis type="category" dataKey={label} width={130} tick={{ fontSize: 11 }} />
            </>
          ) : (
            <>
              <XAxis dataKey={label} tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={62} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={formatterY} />
            </>
          )}
          <Tooltip {...TOOLTIP_STYLE} formatter={formatterTooltip || ((v) => [v, kunci])} />
          {tumpuk ? (
            <Bar dataKey={kunci} radius={[5, 5, 0, 0]} stackId="a">
              {data2.map((d, i) => (
                <Cell key={i} fill={warna || d.color || '#1447e1'} />
              ))}
            </Bar>
          ) : (
            <Bar dataKey={kunci} radius={[5, 5, 0, 0]}>
              {data2.map((d, i) => (
                <Cell key={i} fill={d.color || warna} />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GrafikGaris({ data, tinggi = 240, linhas = [], formatterY }) {
  return (
    <div style={{ height: tinggi }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={formatterY} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {linhas.map((g) => (
            <Line
              key={g.kunci}
              type="monotone"
              dataKey={g.kunci}
              name={g.nama || g.kunci}
              stroke={g.warna}
              strokeWidth={2}
              dot={{ r: 2.5 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GrafikArea({ data, tinggi = 200, kunci = 'nilai', label = 'label', warna = '#1447e1', formatterY }) {
  const id = `grad-${kunci}`;
  return (
    <div style={{ height: tinggi }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={warna} stopOpacity={0.35} />
              <stop offset="100%" stopColor={warna} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={label} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={formatterY} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Area type="monotone" dataKey={kunci} stroke={warna} strokeWidth={2} fill={`url(#${id})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GrafikRadar({ data, tinggi = 240 }) {
  return (
    <div style={{ height: tinggi }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="label" tick={{ fontSize: 10 }} />
          <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
          <Radar dataKey="nilai" stroke="#ea580c" fill="#fb923c" fillOpacity={0.35} />
          <Tooltip {...TOOLTIP_STYLE} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Matriks risiko probabilitas x dampak (5x5). */
export function MatriksRisiko({ data, onKlik }) {
  const sel = {};
  (data || []).forEach((d) => {
    sel[`${d.probabilitas}-${d.dampak}`] = d.n;
  });
  const warnaSel = (p, d) => {
    const s = p * d;
    if (s >= 20) return 'bg-red-600 text-white';
    if (s >= 12) return 'bg-orange-500 text-white';
    if (s >= 6) return 'bg-amber-400 text-slate-900';
    if (s >= 3) return 'bg-sky-300 text-slate-900';
    return 'bg-emerald-200 text-slate-700';
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th className="text-[10px] text-slate-500 font-semibold w-20 pb-1">Prob \ Dampak</th>
            {[1, 2, 3, 4, 5].map((d) => (
              <th key={d} className="text-[10px] text-slate-500 font-semibold pb-1">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[5, 4, 3, 2, 1].map((p) => (
            <tr key={p}>
              <td className="text-[11px] font-semibold text-slate-600 pr-1 text-right">{p}</td>
              {[1, 2, 3, 4, 5].map((d) => {
                const n = sel[`${p}-${d}`] || 0;
                return (
                  <td key={d} className="p-0">
                    <button
                      onClick={() => onKlik?.(p, d)}
                      className={`w-full h-11 rounded-md text-[12px] font-bold transition
                        ${warnaSel(p, d)} ${n ? 'hover:ring-2 hover:ring-slate-400' : 'opacity-40'} `}
                    >
                      {n || ''}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-slate-500">
        {[
          ['bg-emerald-200', 'Rendah 1-2'],
          ['bg-sky-300', 'Sedang 3-5'],
          ['bg-amber-400', 'Tinggi 6-11'],
          ['bg-orange-500', 'Tinggi 12-15'],
          ['bg-red-600', 'Ekstrem 16-25'],
        ].map(([c, t]) => (
          <span key={t} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded ${c}`} />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export { WARNA_RISIKO, levelTone, rupiahFmt };