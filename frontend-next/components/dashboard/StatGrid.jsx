import {
  AlertCircle,
  CalendarCheck,
  PieChart,
  Wallet,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatBrl, formatPct } from '@/lib/format';

const STATS = [
  { key: 'saldoMes', label: 'Saldo do mês', icon: Wallet },
  { key: 'quantoSobrouPct', label: 'Quanto sobrou', icon: PieChart, isPct: true },
  { key: 'gastoPorDia', label: 'Gasto por dia', icon: CalendarCheck },
  { key: 'aPagar', label: 'A pagar', icon: AlertCircle },
];

function StatIcon({ icon: Icon }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
      <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
    </span>
  );
}

export function StatGrid({ insights }) {
  return (
    <div className="grid min-h-[256px] grid-cols-2 gap-5">
      {STATS.map(({ key, label, icon, isPct }) => (
        <Card key={key} className="flex flex-col justify-center p-5">
          <div className="mb-3 flex items-center gap-3">
            <StatIcon icon={icon} />
            <span className="text-sm font-medium text-[var(--text-muted)]">{label}</span>
          </div>
          <p className="tabular-nums text-2xl font-bold leading-tight text-[var(--text-primary)]">
            {isPct ? formatPct(insights[key]) : formatBrl(insights[key])}
          </p>
        </Card>
      ))}
    </div>
  );
}
