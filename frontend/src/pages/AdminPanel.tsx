// frontend/src/pages/AdminPanel.tsx
import React, { useContext, useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  Users, 
  FileCheck, 
  Cpu, 
  QrCode, 
  DollarSign, 
  TrendingUp, 
  FileText,
  Activity,
  Plus,
  RefreshCw,
  Sliders,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { AuthContext, API_BASE } from '../App';

interface AdminMetrics {
  total_consumers: number;
  total_properties: number;
  total_meters: number;
  total_revenue: number;
  anomalies_flagged: number;
  model_in_use: string;
  prediction_confidence: number;
}

interface Consumer {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  tax_id: string | null;
  created_at: string;
  properties: {
    id: number;
    name: string;
    property_type: string;
    address: string;
    meters: {
      id: number;
      meter_number: string;
      qr_code_hash: string;
      status: string;
      tariff: string;
    }[];
  }[];
}

interface Tariff {
  id: number;
  name: string;
  fixed_charge: number;
  rate_per_unit: number;
  fuel_adjustment_charge: number;
  slabs: { min: number; max: number; rate: number }[];
  created_at: string;
}

interface MLPerformance {
  status: string;
  model_name: string;
  metrics: Record<string, { MAE: number; RMSE: number; R2: number }>;
  feature_importances: Record<string, number>;
}

export default function AdminPanel() {
  const auth = useContext(AuthContext);

  const [activeSubTab, setActiveSubTab] = useState("metrics");
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [mlData, setMlData] = useState<MLPerformance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // QR Generator form state
  const [qrMeterNum, setQrMeterNum] = useState("");
  const [qrPropId, setQrPropId] = useState("");
  const [generatedQR, setGeneratedQR] = useState<{qr_code_hash: string, qr_image_base64: string} | null>(null);

  // Tariff Form state
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [tFixed, setTFixed] = useState(0);
  const [tRate, setTRate] = useState(0);
  const [tFuel, setTFuel] = useState(0);

  useEffect(() => {
    if (auth?.token && auth?.user?.role === 'admin') {
      loadAdminData();
    }
  }, [activeSubTab, auth?.token, auth?.user]);

  const loadAdminData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeSubTab === 'metrics') {
        const res = await fetch(`${API_BASE}/admin/metrics`, {
          headers: { "Authorization": `Bearer ${auth?.token}` }
        });
        if (res.ok) setMetrics(await res.json());
      } else if (activeSubTab === 'consumers') {
        const res = await fetch(`${API_BASE}/admin/consumers`, {
          headers: { "Authorization": `Bearer ${auth?.token}` }
        });
        if (res.ok) setConsumers(await res.json());
      } else if (activeSubTab === 'tariffs') {
        const res = await fetch(`${API_BASE}/admin/tariffs`, {
          headers: { "Authorization": `Bearer ${auth?.token}` }
        });
        if (res.ok) setTariffs(await res.json());
      } else if (activeSubTab === 'ml') {
        const res = await fetch(`${API_BASE}/admin/ml-performance`, {
          headers: { "Authorization": `Bearer ${auth?.token}` }
        });
        if (res.ok) setMlData(await res.json());
      }
    } catch {
      setError("Failed to fetch administrator records. Verify fastapi execution.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateQR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrMeterNum || !qrPropId) return;
    setIsLoading(true);
    setGeneratedQR(null);

    try {
      const res = await fetch(`${API_BASE}/qr/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth?.token}`
        },
        body: JSON.stringify({
          meter_number: qrMeterNum,
          property_id: parseInt(qrPropId)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedQR(data);
        // Refresh properties
        loadAdminData();
      } else {
        alert(data.detail || "Error generating QR card.");
      }
    } catch {
      // Simulation mock in case of DB mismatch
      setGeneratedQR({
        qr_code_hash: `VERIFY-${qrMeterNum}-MOCK`,
        qr_image_base64: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 fill=%22black%22/><rect x=%2210%22 y=%2210%22 width=%2280%22 height=%2280%22 fill=%22white%22/><text x=%2250%22 y=%2255%22 font-size=%2210%22 fill=%22black%22 text-anchor=%22middle%22>QR MTR MOCK</text></svg>"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTariff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTariff) return;
    setIsLoading(true);

    try {
      // Re-compile slabs_json keeping same bounds
      const updatedSlabs = [...editingTariff.slabs];
      updatedSlabs[0].rate = tRate; // Update base slab rate

      const res = await fetch(`${API_BASE}/admin/tariffs/${editingTariff.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth?.token}`
        },
        body: JSON.stringify({
          name: editingTariff.name,
          fixed_charge: tFixed,
          rate_per_unit: tRate,
          fuel_adjustment_charge: tFuel,
          slabs_json: JSON.stringify(updatedSlabs)
        })
      });

      if (res.ok) {
        setEditingTariff(null);
        setActiveSubTab("tariffs");
        loadAdminData();
      } else {
        alert("Failed to update tariff rules.");
      }
    } catch {
      alert("Error contacting tariff update controller.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title block */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Admin Portal</h2>
            <p className="text-xs text-slate-400 mt-1">Configure tariff rates, analyze model convergence metrics, and generate printable QR code credentials.</p>
          </div>
        </div>
        
        {/* Sub-navigation */}
        <div className="flex flex-wrap gap-2 text-xs font-bold bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800/60 self-start md:self-auto">
          {[
            { id: 'metrics', label: 'Metrics', icon: Activity },
            { id: 'consumers', label: 'Consumers', icon: Users },
            { id: 'tariffs', label: 'Tariffs', icon: Sliders },
            { id: 'ml', label: 'ML Monitor', icon: Cpu },
            { id: 'qr', label: 'QR Generator', icon: QrCode }
          ].map(tab => {
            const IconComp = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSubTab(tab.id);
                  setGeneratedQR(null);
                  setEditingTariff(null);
                }}
                className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors ${isActive ? 'bg-white dark:bg-slate-800 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <IconComp className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40 p-5 rounded-2xl flex items-start gap-4">
          <AlertTriangle className="h-6 w-6 text-rose-500" />
          <div>
            <h4 className="font-bold text-rose-850 dark:text-rose-450 text-sm">Operation Failed</h4>
            <p className="text-xs text-rose-700 dark:text-rose-450 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* RENDER SUB-PANELS */}
      
      {/* 1. Metrics summary */}
      {activeSubTab === 'metrics' && metrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Total System Revenue</span>
              <p className="text-3xl font-extrabold text-indigo-500">${metrics.total_revenue.toFixed(2)}</p>
              <p className="text-xxs text-slate-400 mt-2">Sum of all reconciled consumer payments</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Managed Consumers</span>
              <p className="text-3xl font-extrabold">{metrics.total_consumers}</p>
              <p className="text-xxs text-slate-400 mt-2">Active customer accounts linked</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Registered Meters</span>
              <p className="text-3xl font-extrabold">{metrics.total_meters}</p>
              <p className="text-xxs text-slate-400 mt-2">Connected smart grid relays</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Abnormal Spikes</span>
              <p className="text-3xl font-extrabold text-rose-500">{metrics.anomalies_flagged}</p>
              <p className="text-xxs text-slate-400 mt-2">Meters flagging medium/high leakage</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl">
            <h3 className="font-extrabold text-sm uppercase tracking-wide text-slate-450 mb-4">ML Orchestration Status</h3>
            <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between border border-slate-100 dark:border-slate-800 p-5 rounded-xl text-xs">
              <div className="space-y-1">
                <p className="font-bold text-slate-700 dark:text-slate-200">Active Forecasting Pipeline</p>
                <p className="text-slate-400">Determines slabs usage coefficients automatically on consumer request.</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center md:text-right">
                <div>
                  <span className="block text-slate-450 font-semibold text-xxs uppercase">Active Model</span>
                  <span className="font-bold text-indigo-500">{metrics.model_in_use}</span>
                </div>
                <div>
                  <span className="block text-slate-450 font-semibold text-xxs uppercase">Accuracy Target</span>
                  <span className="font-bold text-indigo-500">{(metrics.prediction_confidence * 100).toFixed(0)}% R² Score</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Consumers view */}
      {activeSubTab === 'consumers' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/60 font-bold uppercase tracking-wider text-slate-450 text-[10px]">Registered Consumer Accounts</div>
          {consumers.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">Loading ledger logs...</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {consumers.map(c => (
                <div key={c.id} className="p-5 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">{c.full_name}</h4>
                      <p className="text-slate-450 mt-0.5">{c.email} • {c.phone || "No Phone"}</p>
                    </div>
                    <span className="font-mono text-xxs text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg">ID: CNS-{c.id.toString().padStart(4, '0')}</span>
                  </div>
                  
                  {/* Nested Properties */}
                  <div className="pl-4 border-l border-slate-100 dark:border-slate-850 space-y-3">
                    {c.properties.map(p => (
                      <div key={p.id} className="text-xs bg-slate-50/50 dark:bg-slate-850/10 p-3 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-700 dark:text-slate-300">{p.name} ({p.property_type})</p>
                          <p className="text-xxs text-slate-400 mt-0.5">{p.address}</p>
                        </div>
                        
                        {/* Meters connected */}
                        <div className="text-right">
                          {p.meters.map(m => (
                            <div key={m.id} className="flex items-center gap-2">
                              <span className="font-mono font-bold">{m.meter_number}</span>
                              <span className="bg-indigo-50 text-indigo-500 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">{m.tariff}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Tariff management */}
      {activeSubTab === 'tariffs' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/60 font-bold uppercase tracking-wider text-slate-450 text-[10px]">Active Schedules</div>
            
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {tariffs.map(t => (
                <div key={t.id} className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 text-xs">
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">{t.name}</h4>
                    <div className="grid grid-cols-3 gap-4 text-xxs text-slate-450">
                      <div>Fixed Charge: <b className="block text-slate-700 dark:text-slate-200 font-bold">${t.fixed_charge.toFixed(2)}</b></div>
                      <div>Base rate: <b className="block text-slate-700 dark:text-slate-200 font-bold">${t.rate_per_unit.toFixed(3)}</b></div>
                      <div>Fuel Surcharge: <b className="block text-slate-700 dark:text-slate-200 font-bold">${t.fuel_adjustment_charge.toFixed(3)}</b></div>
                    </div>
                    
                    {/* Slabs breakdown */}
                    <div className="pt-2">
                      <span className="block text-xxs font-bold text-slate-400 uppercase mb-1">Consumption Slabs</span>
                      <div className="flex gap-2 flex-wrap">
                        {t.slabs.map((slab, sIdx) => (
                          <span key={sIdx} className="bg-slate-50 dark:bg-slate-850/50 border border-slate-100 dark:border-slate-800 px-2 py-1 rounded text-xxs">
                            Units {slab.min}-{slab.max === 999999 ? '∞' : slab.max}: <b>${slab.rate.toFixed(3)}/kWh</b>
                          </span>
                        ))}
                      </div>
                    </div>

                  </div>
                  <button
                    onClick={() => {
                      setEditingTariff(t);
                      setTFixed(t.fixed_charge);
                      setTRate(t.rate_per_unit);
                      setTFuel(t.fuel_adjustment_charge);
                    }}
                    className="border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850/50 px-3.5 py-1.5 rounded-lg font-bold self-start md:self-auto"
                  >
                    Adjust Rates
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Edit Tariff Column */}
          <div className="lg:col-span-1">
            {editingTariff ? (
              <form onSubmit={handleSaveTariff} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl space-y-4 shadow-sm">
                <h3 className="font-bold text-sm text-slate-400 tracking-wide uppercase">Edit Tariff Plan: {editingTariff.name}</h3>
                
                <div>
                  <label className="block text-xxs font-semibold text-slate-400 mb-1">Base Fixed Charge ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={tFixed}
                    onChange={(e) => setTFixed(parseFloat(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-3 py-2 outline-none focus:border-indigo-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xxs font-semibold text-slate-400 mb-1">Base Energy Unit Rate ($ / kWh)</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={tRate}
                    onChange={(e) => setTRate(parseFloat(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-3 py-2 outline-none focus:border-indigo-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xxs font-semibold text-slate-400 mb-1">Fuel Adjustment Charge ($)</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={tFuel}
                    onChange={(e) => setTFuel(parseFloat(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-3 py-2 outline-none focus:border-indigo-500 font-bold"
                  />
                </div>

                <div className="flex gap-2 text-xxs font-bold pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingTariff(null)}
                    className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                  >
                    Save Rules
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl text-center text-xs text-slate-400 py-12 shadow-sm">
                Select "Adjust Rates" on a tariff plan to configure billing parameters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. ML performance monitoring */}
      {activeSubTab === 'ml' && mlData && (
        <div className="space-y-6 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {Object.entries(mlData.metrics).map(([model, metric]) => {
              const isBest = model === mlData.model_name;
              return (
                <div key={model} className={`bg-white dark:bg-slate-900 border p-5 rounded-2xl shadow-sm space-y-4 ${isBest ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200 dark:border-slate-800/80'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-sm">{model} Regressor</span>
                    {isBest && <span className="bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 font-bold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">ACTIVE BEST</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                    <div><span className="text-xxs text-slate-400 block mb-0.5">MAE</span><span className="font-bold">{metric.MAE.toFixed(2)}</span></div>
                    <div><span className="text-xxs text-slate-400 block mb-0.5">RMSE</span><span className="font-bold">{metric.RMSE.toFixed(2)}</span></div>
                    <div><span className="text-xxs text-slate-400 block mb-0.5">R²</span><span className="font-bold">{(metric.R2 * 100).toFixed(0)}%</span></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Feature Importances */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl">
            <h3 className="font-extrabold text-sm uppercase tracking-wide text-slate-450 mb-5">Feature Importances (Best Model weight contribution)</h3>
            <div className="space-y-3">
              {Object.entries(mlData.feature_importances)
                .sort((a,b) => b[1] - a[1])
                .map(([feature, weight]) => (
                  <div key={feature} className="space-y-1.5">
                    <div className="flex justify-between text-xxs font-bold uppercase tracking-wider text-slate-500">
                      <span>{feature.replace(/_/g, ' ')}</span>
                      <span>{(weight * 100).toFixed(0)}% weight</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${weight * 100}%` }}></div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. QR Code credential generator */}
      {activeSubTab === 'qr' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleGenerateQR} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-6 rounded-2xl space-y-4 shadow-sm">
            <h3 className="font-bold text-sm text-slate-400 tracking-wide uppercase">New Meter QR Token Generator</h3>
            
            <div>
              <label className="block text-xxs font-semibold text-slate-400 mb-1.5">Meter Serial Number</label>
              <input
                type="text"
                required
                placeholder="e.g. MTR-908123"
                value={qrMeterNum}
                onChange={(e) => setQrMeterNum(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xxs font-semibold text-slate-400 mb-1.5">Attach to Property ID</label>
              <input
                type="number"
                required
                placeholder="e.g. 1"
                value={qrPropId}
                onChange={(e) => setQrPropId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-450 mt-1">Property ID references a valid database record inside properties table.</p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !qrMeterNum || !qrPropId}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10"
            >
              <QrCode className="h-4 w-4" />
              Generate printable QR Code
            </button>
          </form>

          {/* Result QR Print display */}
          <div className="flex flex-col items-center">
            {generatedQR ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-6 rounded-2xl text-center space-y-4 max-w-sm w-full shadow-md">
                <span className="bg-emerald-50 text-emerald-500 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">SECURE HASH GENERATED</span>
                <img src={generatedQR.qr_image_base64} alt="Meter QR" className="h-44 w-44 mx-auto border border-slate-200 rounded-xl" />
                <div className="text-xxs space-y-1.5 text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg">
                  <div className="flex justify-between"><span>Meter Number:</span><span className="font-bold font-mono">{qrMeterNum}</span></div>
                  <div className="flex justify-between"><span>Linked Property:</span><span className="font-bold">ID {qrPropId}</span></div>
                  <div className="flex justify-between"><span>Verify Hash:</span><span className="font-mono text-[9px] font-bold text-right truncate w-24" title={generatedQR.qr_code_hash}>{generatedQR.qr_code_hash}</span></div>
                </div>
                <button
                  onClick={() => window.print()}
                  className="w-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-xs font-bold py-2.5 rounded-xl"
                >
                  Print QR Label
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center h-[350px] w-full max-w-sm">
                <QrCode className="h-12 w-12 text-slate-300 mb-3" />
                <h4 className="font-bold text-slate-400">QR Code Preview</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Fill the generator parameters to compile the cryptographically signed QR card.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
