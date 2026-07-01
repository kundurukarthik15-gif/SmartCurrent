// frontend/src/pages/Dashboard.tsx
import React, { useContext, useEffect, useState } from 'react';
import { 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Leaf, 
  AlertTriangle, 
  ChevronRight, 
  Cpu, 
  Sparkles,
  Info,
  Calendar,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { PropertyContext, AuthContext, API_BASE } from '../App';

interface PredictionData {
  prediction_month: string;
  predicted_units: number;
  predicted_bill: number;
  confidence_score: number;
  model_used: string;
  anomaly: {
    status: string;
    reasons: string[];
  };
  carbon_footprint: {
    monthly_co2_kg: number;
    annual_co2_kg: number;
    trees_offset: number;
  };
  insights: string[];
}

interface ForecastData {
  date: string;
  predicted_units: number;
  lower_bound_units: number;
  upper_bound_units: number;
  predicted_bill: number;
}

interface BillData {
  id: number;
  bill_date: string;
  units_consumed: number;
  bill_amount: number;
  payment_status: string;
}

export default function Dashboard() {
  const auth = useContext(AuthContext);
  const propCtx = useContext(PropertyContext);
  
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [forecasts, setForecasts] = useState<ForecastData[]>([]);
  const [bills, setBills] = useState<BillData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeMeter = propCtx?.activeMeter;
  const activeProperty = propCtx?.activeProperty;

  useEffect(() => {
    if (activeMeter?.id && auth?.token) {
      loadDashboardData();
    } else {
      setPrediction(null);
      setForecasts([]);
      setBills([]);
    }
  }, [activeMeter, auth?.token]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch live predictions
      const predRes = await fetch(`${API_BASE}/prediction/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth?.token}`
        },
        body: JSON.stringify({ meter_id: activeMeter?.id })
      });
      
      // 2. Fetch future forecasts
      const foreRes = await fetch(`${API_BASE}/prediction/forecast?meter_id=${activeMeter?.id}`, {
        headers: { "Authorization": `Bearer ${auth?.token}` }
      });
      
      // 3. Fetch past bill history for graphs
      const billsRes = await fetch(`${API_BASE}/billing/bills?meter_id=${activeMeter?.id}`, {
        headers: { "Authorization": `Bearer ${auth?.token}` }
      });

      if (predRes.ok && foreRes.ok && billsRes.ok) {
        const predData = await predRes.json();
        const foreData = await foreRes.json();
        const billsData = await billsRes.json();
        
        setPrediction(predData);
        setForecasts(foreData);
        setBills(billsData);
      } else {
        setError("Error loading metrics. Verify billing database seed data.");
      }
    } catch {
      setError("Unable to connect to prediction APIs.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!activeProperty || !activeMeter) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xl">
        <Zap className="h-16 w-16 text-indigo-500 fill-indigo-500/20 mb-4 animate-pulse-slow" />
        <h2 className="text-xl font-bold mb-2">No Properties Registered</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          To start monitoring and predicting electricity bills, please scan the QR code on your meter or register your property manually.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="bg-indigo-500 text-white font-semibold py-2.5 px-6 rounded-xl text-sm shadow-md shadow-indigo-500/20 cursor-pointer hover:bg-indigo-400">
            Scan Meter QR Code
          </div>
        </div>
      </div>
    );
  }

  // Cost breakdown variables
  const ratePerUnit = 0.12; 
  const fixedFee = 15.00;
  const fuelSurcharge = 0.02;

  const costBreakdownData = prediction ? [
    { name: 'Fixed Charge', value: fixedFee, color: '#6366F1' },
    { name: 'Energy Consumption', value: prediction.predicted_bill - fixedFee - (prediction.predicted_units * fuelSurcharge), color: '#10B981' },
    { name: 'Fuel Adjustments', value: prediction.predicted_units * fuelSurcharge, color: '#F59E0B' }
  ] : [];

  // Compile history for chart (chronological order)
  const chartHistory = [...bills]
    .reverse()
    .slice(-12)
    .map(b => ({
      name: new Date(b.bill_date).toLocaleDateString(undefined, {month: 'short', year: '2-digit'}),
      Units: b.units_consumed,
      Bill: b.bill_amount
    }));

  const latestBill = bills.length > 0 ? bills[0] : null;

  return (
    <div className="space-y-6">
      
      {/* Alert Warning Box for Anomaly Status */}
      {prediction && prediction.anomaly.status !== "Low" && (
        <div className="bg-rose-50 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40 p-5 rounded-2xl flex items-start gap-4">
          <div className="p-3 bg-rose-500 rounded-xl text-white shadow-lg shadow-rose-500/20">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-rose-800 dark:text-rose-400 text-sm">Abnormal Usage Alert Flagged ({prediction.anomaly.status} Severity)</h3>
            <ul className="list-disc ml-5 mt-2 space-y-1.5 text-xs text-rose-700 dark:text-rose-400/80 leading-relaxed">
              {prediction.anomaly.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] font-semibold text-rose-600 dark:text-rose-400/60 uppercase tracking-wider">
              Recommendation: inspect night appliance draw or verify meter calibration with the landlord.
            </p>
          </div>
        </div>
      )}

      {/* Top Overview Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold">{activeProperty.name} Dashboard</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1.5 font-medium">
            <span>Meter: <b className="text-slate-600 dark:text-slate-300 font-mono">{activeMeter.meter_number}</b></span>
            <span>•</span>
            <span className="capitalize">Tariff: <b className="text-slate-600 dark:text-slate-300">{activeMeter.tariff_name}</b></span>
            <span>•</span>
            <span className="capitalize">Phase: <b className="text-slate-600 dark:text-slate-300">{activeMeter.connection_type}</b></span>
          </div>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/60 rounded-xl px-4 py-2 text-xs">
          <div className={`h-2.5 w-2.5 rounded-full ${activeMeter.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`}></div>
          <span className="font-semibold text-slate-500 dark:text-slate-300 capitalize">{activeMeter.status} connection</span>
        </div>
      </div>

      {/* Cards Panel */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1,2,3,4].map(n => (
            <div key={n} className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/60 rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Card 1: AI Prediction */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 text-indigo-500 dark:text-white">
              <Sparkles className="h-16 w-16" />
            </div>
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Projected Current Bill</span>
              <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                <Cpu className="h-3 w-3" /> AI
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold">${prediction?.predicted_bill.toFixed(2) || "0.00"}</span>
              <span className="text-xs text-slate-400">/{prediction?.predicted_units.toFixed(0) || "0"} kWh</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> For current calendar month
            </p>
          </div>

          {/* Card 2: Confidence Index */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Predict Confidence</span>
              <Info className="h-4 w-4 text-slate-400" title="Based on model convergence score (R2)" />
            </div>
            <div className="flex items-center gap-4">
              <div className="relative flex items-center justify-center">
                <svg className="w-14 h-14 transform -rotate-90">
                  <circle cx="28" cy="28" r="23" stroke="#e2e8f0" strokeWidth="4.5" fill="transparent" className="dark:stroke-slate-800" />
                  <circle 
                    cx="28" 
                    cy="28" 
                    r="23" 
                    stroke="#6366f1" 
                    strokeWidth="4.5" 
                    fill="transparent" 
                    strokeDasharray={2 * Math.PI * 23}
                    strokeDashoffset={2 * Math.PI * 23 * (1 - (prediction?.confidence_score || 0.95))}
                  />
                </svg>
                <span className="absolute text-xs font-extrabold">{(prediction?.confidence_score || 0.95) * 100}%</span>
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">{prediction?.model_used || "XGBoost Model"}</p>
                <p className="text-[10px] text-slate-400">Trained on 5 year history</p>
              </div>
            </div>
          </div>

          {/* Card 3: Previous Month Bill */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Previous Bill</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${latestBill?.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20' : 'bg-rose-50 text-rose-500 dark:bg-rose-950/20'}`}>
                {latestBill?.payment_status || "N/A"}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold">${latestBill?.bill_amount.toFixed(2) || "0.00"}</span>
              <span className="text-xs text-slate-400">/{latestBill?.units_consumed.toFixed(0) || "0"} kWh</span>
            </div>
            {prediction && latestBill && (
              <p className="text-[11px] mt-3 flex items-center gap-1">
                {prediction.predicted_bill > latestBill.bill_amount ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-rose-500" />
                    <span className="text-rose-500 font-bold">+{((prediction.predicted_bill - latestBill.bill_amount)/latestBill.bill_amount*100).toFixed(0)}%</span>
                    <span className="text-slate-400">than last statement</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-4 w-4 text-emerald-500" />
                    <span className="text-emerald-500 font-bold">{((prediction.predicted_bill - latestBill.bill_amount)/latestBill.bill_amount*100).toFixed(0)}%</span>
                    <span className="text-slate-400">than last statement</span>
                  </>
                )}
              </p>
            )}
          </div>

          {/* Card 4: Carbon Audit */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 text-emerald-500">
              <Leaf className="h-16 w-16" />
            </div>
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Carbon Footprint</span>
              <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">CO₂ Offset</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-emerald-500">{prediction?.carbon_footprint.monthly_co2_kg.toFixed(0) || "0"}</span>
              <span className="text-xs text-emerald-500/80 font-bold">kg CO₂</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5">
              <Leaf className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500/10" />
              <span>Requires <b>{prediction?.carbon_footprint.trees_offset || "0"}</b> trees to offset annually</span>
            </p>
          </div>

        </div>
      )}

      {/* Graphs Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Graph 1: Consumption Trend (Area Chart) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-extrabold text-sm tracking-wide uppercase text-slate-400">Monthly Usage Trend (12 Month actual)</h3>
            <span className="text-xs text-slate-400 font-semibold">Values in kWh / Month</span>
          </div>
          <div className="h-72">
            {chartHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      border: 'none', 
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '12px'
                    }} 
                  />
                  <Area type="monotone" dataKey="Units" stroke="#6366F1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorUnits)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading historical data...</div>
            )}
          </div>
        </div>

        {/* Graph 2: Cost Breakdown (Pie Chart) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm flex flex-col">
          <h3 className="font-extrabold text-sm tracking-wide uppercase text-slate-400 mb-5">Estimated Bill Cost Breakdown</h3>
          <div className="flex-1 h-56 relative flex items-center justify-center">
            {prediction ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {costBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      border: 'none', 
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '11px'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">Unavailable</div>
            )}
            {prediction && (
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-xxs font-semibold uppercase text-slate-400">Total Est.</span>
                <span className="text-xl font-extrabold text-slate-800 dark:text-white">${prediction.predicted_bill.toFixed(0)}</span>
              </div>
            )}
          </div>
          
          {/* Legend Table */}
          <div className="space-y-2 mt-4">
            {costBreakdownData.map((d, i) => (
              <div key={i} className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                  <span className="text-slate-500 dark:text-slate-400">{d.name}</span>
                </div>
                <span className="font-bold">${d.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Row 3: Future Forecasts & AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Forecasts lists */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-extrabold text-sm tracking-wide uppercase text-slate-400">Future Predictions</h3>
            <span className="bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 text-[10px] px-2 py-0.5 rounded-full font-bold">3 Month Forecast</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {forecasts.slice(1).map((f, i) => (
              <div key={i} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <Calendar className="h-4 w-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{f.date}</p>
                    <p className="text-[10px] text-slate-400">Interval: {f.lower_bound_units.toFixed(0)} - {f.upper_bound_units.toFixed(0)} kWh</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-sm text-slate-800 dark:text-white">${f.predicted_bill.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-400">{f.predicted_units.toFixed(0)} kWh (est)</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insight Cards */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="p-2 bg-indigo-500 rounded-lg text-white shadow-md shadow-indigo-500/20">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white">AI Energy Efficiency Recommendations</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prediction && prediction.insights.map((ins, i) => (
              <div 
                key={i} 
                className="p-3.5 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 rounded-xl hover:border-indigo-500/30 transition-all hover:bg-slate-50/70"
              >
                <div className="flex gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0"></div>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{ins}</p>
                </div>
              </div>
            ))}
            {!prediction && (
              <div className="text-xs text-slate-400 py-6 text-center col-span-2">No recommendations available. Complete calculations first.</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
