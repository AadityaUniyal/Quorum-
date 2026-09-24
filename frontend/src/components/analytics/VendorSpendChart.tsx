'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Building2 } from 'lucide-react';

interface VendorSpendItem {
  vendor_name: string;
  invoice_count: number;
  total_spend: number;
  avg_invoice_value: number;
  confidence: number;
}

interface VendorSpendChartProps {
  data: VendorSpendItem[];
}

const BAR_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item: VendorSpendItem = payload[0].payload;
    return (
      <div className="glass-card bg-black/90 border border-white/10 p-3 rounded-xl shadow-2xl text-xs space-y-1 select-none font-sans">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <span>{item.vendor_name}</span>
        </div>
        <div className="text-emerald-400 font-mono font-extrabold text-sm">
          ${item.total_spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-muted-foreground flex justify-between gap-4 text-[11px]">
          <span>Invoices: {item.invoice_count}</span>
          <span>Avg: ${item.avg_invoice_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="text-primary text-[10px] font-mono">
          AI Consensus Confidence: {item.confidence}%
        </div>
      </div>
    );
  }
  return null;
};

export const VendorSpendChart: React.FC<VendorSpendChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-xs font-sans">
        <Building2 className="h-8 w-8 mb-2 opacity-30" />
        <span>No vendor spend data for selected period</span>
      </div>
    );
  }

  // Format short vendor labels for X axis
  const formattedData = data.slice(0, 8).map((d) => ({
    ...d,
    shortName: d.vendor_name.length > 14 ? d.vendor_name.substring(0, 12) + '...' : d.vendor_name,
  }));

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formattedData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF10" vertical={false} />
          <XAxis
            dataKey="shortName"
            stroke="#94A3B8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#FFFFFF15' }}
          />
          <YAxis
            stroke="#94A3B8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#FFFFFF15' }}
            tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="total_spend" radius={[6, 6, 0, 0]}>
            {formattedData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default VendorSpendChart;
