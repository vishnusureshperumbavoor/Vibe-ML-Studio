import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Activity, Zap, Target, Gauge, Clock, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';

interface PlotPoint {
  vml_step: number;
  loss?: number;
  grad_norm?: number;
  learning_rate?: number;
  vml_epoch?: number;
  [key: string]: any;
}

interface PlotViewProps {
  data: PlotPoint[];
  onOpenArena?: (modelId: string) => void;
  metadata?: Record<string, any>;
}

export const PlotView: React.FC<PlotViewProps> = ({ data, onOpenArena, metadata }) => {
  const [deployState, setDeployState] = React.useState<'idle' | 'deploying' | 'ready' | 'error'>('idle');
  const [deployMessage, setDeployMessage] = React.useState('');
  const [now, setNow] = React.useState(Date.now());
  const hasTriggeredDeploy = React.useRef(false);
  
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-white/5 bg-black/20 rounded-2xl animate-pulse">
        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Awaiting Telemetry Stream...</p>
      </div>
    );
  }

  const getLatestMetric = (key: string, altKey?: string) => {
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i][key] !== undefined && data[i][key] !== null) return data[i][key];
      if (altKey && data[i][altKey] !== undefined && data[i][altKey] !== null) return data[i][altKey];
    }
    return undefined;
  };

  const currentLoss = getLatestMetric('loss', 'train_loss');
  const previousLoss = data.length > 1 ? (data[data.length - 2].loss || data[data.length - 2].train_loss) : undefined;
  const lossTrend = (currentLoss && previousLoss) ? ((currentLoss - previousLoss) / previousLoss) * 100 : undefined;

  const currentStep = getLatestMetric('vml_step');
  const totalSteps = getLatestMetric('vml_total_steps');
  const currentGradNorm = getLatestMetric('grad_norm');
  const currentAccuracy = getLatestMetric('mean_token_accuracy');

  // Final Performance Metrics
  const samplesPerSec = getLatestMetric('train_samples_per_second');
  const stepsPerSec = getLatestMetric('train_steps_per_second');
  const totalFlops = getLatestMetric('total_flos');
  const tflops = totalFlops ? (Number(totalFlops) / 1e12).toFixed(2) : undefined;
  // Live Ticker for high-resolution clock
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const firstTime = data.find(d => d.timestamp)?.timestamp;
  const lastTime = samplesPerSec ? [...data].reverse().find(d => d.timestamp)?.timestamp : now;
  
  let durationStr = '00:00';
  if (firstTime && lastTime) {
    const diff = Math.floor((lastTime - firstTime) / 1000);
    const mins = Math.floor(diff / 60).toString().padStart(2, '0');
    const secs = (diff % 60).toString().padStart(2, '0');
    durationStr = `${mins}:${secs}`;
  }



  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Performance Summary - Appears on Completion */}
      {samplesPerSec && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 animate-in slide-in-from-top duration-1000">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
               <Zap size={16} className="text-emerald-500" />
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/60">
                 Training Complete
              </h4>
              <p className="text-[9px] text-emerald-500/40 uppercase tracking-widest">
                 Efficiency & Hardware Throughput Summary
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-8 pr-4">
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-white/20 uppercase tracking-wider mb-1">Total Throughput</span>
              <span className="text-sm font-black text-white/70 tabular-nums">{samplesPerSec} <span className="text-[8px] font-normal text-white/30">samples/s</span></span>
            </div>
            <div className="flex flex-col border-l border-white/5 pl-8">
              <span className="text-[8px] font-bold text-white/20 uppercase tracking-wider mb-1">Iteration Speed</span>
              <span className="text-sm font-black text-white/70 tabular-nums">{stepsPerSec} <span className="text-[8px] font-normal text-white/30">steps/s</span></span>
            </div>
            <div className="flex flex-col border-l border-white/5 pl-8">
              <span className="text-[8px] font-bold text-white/20 uppercase tracking-wider mb-1">Computational Work</span>
              <span className="text-sm font-black text-white/70 tabular-nums">{tflops} <span className="text-[8px] font-normal text-white/30">TFLOPs</span></span>
            </div>
          </div>
        </div>
      )}

      {/* Top Row: Main Stats View */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard icon={<Clock size={14} className="text-blue-500" />} label="Runtime" value={durationStr} />
        <MetricCard icon={<Target size={14} className="text-amber-500" />} label="Loss" value={currentLoss} precision={3} trend={lossTrend} />
        <MetricCard icon={<Zap size={14} className="text-purple-500" />} label="Step" value={currentStep} total={totalSteps} />
        <MetricCard icon={<Gauge size={14} className="text-blue-500" />} label="Grad Norm" value={currentGradNorm} precision={3} />
        <MetricCard icon={<Activity size={14} className="text-emerald-500" />} label="Accuracy" value={currentAccuracy} precision={3} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Training Loss - The Master Chart */}
        <ChartContainer title="Training Loss" subtitle="Raw Value History">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="vml_step" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1A1625', border: '1px solid #3F3F46', fontSize: '10px', borderRadius: '8px' }}
                itemStyle={{ color: '#F59E0B' }}
              />
              <Area type="monotone" dataKey="loss" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#colorLoss)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Gradient Norm - Stability Tracker */}
        <ChartContainer title="Gradient Norm" subtitle="Numerical Stability">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="vml_step" hide />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1A1625', border: '1px solid #3F3F46', fontSize: '10px', borderRadius: '8px' }}
                itemStyle={{ color: '#3B82F6' }}
              />
              <Line type="monotone" dataKey="grad_norm" stroke="#3B82F6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Token Accuracy - The "Learning" Metric */}
        <ChartContainer title="Token Accuracy" subtitle="Mean Next-Token Match">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="vml_step" hide />
              <YAxis domain={[0, 1]} hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1A1625', border: '1px solid #3F3F46', fontSize: '10px', borderRadius: '8px' }}
                itemStyle={{ color: '#10B981' }}
              />
              <Area type="monotone" dataKey="mean_token_accuracy" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorAcc)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Model Entropy - Uncertainty Monitor */}
        <ChartContainer title="Model Entropy" subtitle="Prediction Uncertainty">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorEntropy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="vml_step" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1A1625', border: '1px solid #3F3F46', fontSize: '10px', borderRadius: '8px' }}
                itemStyle={{ color: '#8B5CF6' }}
              />
              <Area type="monotone" dataKey="entropy" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="url(#colorEntropy)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
};

const MetricCard = ({ icon, label, value, total, precision, trend }: { icon: React.ReactNode, label: string, value: any, total?: any, precision?: number, trend?: number }) => {
  // Only parse as number if it's not a clock string (MM:SS)
  const isClock = typeof value === 'string' && value.includes(':');
  const numericValue = (!isClock && typeof value === 'string') ? parseFloat(value) : value;
  const isNumber = typeof numericValue === 'number' && !isNaN(numericValue);
  
  let displayValue: string | number = value || 'N/A';
  if (total !== undefined && isNumber) {
    displayValue = `${numericValue} / ${total}`;
  } else if (isNumber && !isClock) {
    displayValue = precision !== undefined ? numericValue.toFixed(precision) : numericValue;
  }

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-1 hover:bg-white/[0.05] transition-colors">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-black text-white/80 tabular-nums whitespace-nowrap">{displayValue}</span>
        {trend !== undefined && (
          <span className={`text-[8px] font-bold ${trend < 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {trend > 0 ? '+' : ''}{trend.toFixed(2)}%
          </span>
        )}
      </div>
      {total && isNumber && (
        <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)] transition-all duration-700 ease-out"
            style={{ width: `${Math.min(100, (numericValue / total) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

const ChartContainer = ({ title, subtitle, children }: { title: string, subtitle: string, children: React.ReactNode }) => (
  <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5 space-y-4">
    <div className="flex flex-col">
      <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{title}</h3>
      <p className="text-[9px] text-white/10 uppercase tracking-widest">{subtitle}</p>
    </div>
    <div className="h-40 w-full">
      {children}
    </div>
  </div>
);
