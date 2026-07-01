// frontend/src/pages/PropertyManager.tsx
import React, { useContext, useState } from 'react';
import { 
  Building, 
  MapPin, 
  Cpu, 
  Layers, 
  Plus, 
  FolderPlus, 
  Activity,
  Trash2,
  FileCheck
} from 'lucide-react';
import { PropertyContext, AuthContext, API_BASE } from '../App';

export default function PropertyManager() {
  const auth = useContext(AuthContext);
  const propCtx = useContext(PropertyContext);
  
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showAddMeter, setShowAddMeter] = useState<number | null>(null);
  
  // New Property Form State
  const [pName, setPName] = useState("");
  const [pAddress, setPAddress] = useState("");
  const [pType, setPType] = useState("Residential");
  
  // New Meter Form State
  const [mMeterNum, setMMeterNum] = useState("");
  const [mPhase, setMPhase] = useState("single-phase");
  const [mTariff, setMTariff] = useState("Residential Standard");

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  const handleAddPropertySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/properties`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth?.token}`
        },
        body: JSON.stringify({
          name: pName,
          address: pAddress,
          property_type: pType
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Property "${data.name}" added successfully.` });
        setPName("");
        setPAddress("");
        setShowAddProperty(false);
        if (propCtx) await propCtx.fetchProperties();
      } else {
        setMessage({ type: 'error', text: data.detail || "Error creating property" });
      }
    } catch {
      setMessage({ type: 'error', text: "Server offline." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMeterSubmit = async (e: React.FormEvent, propId: number) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/properties/${propId}/meters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth?.token}`
        },
        body: JSON.stringify({
          meter_number: mMeterNum,
          connection_type: mPhase,
          tariff_plan_name: mTariff
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Meter ${data.meter.meter_number} registered successfully.` });
        setMMeterNum("");
        setShowAddMeter(null);
        if (propCtx) await propCtx.fetchProperties();
      } else {
        setMessage({ type: 'error', text: data.detail || "Error registering meter" });
      }
    } catch {
      setMessage({ type: 'error', text: "Server offline." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Notifications banner */}
      {message && (
        <div className={`p-4 rounded-xl text-xs border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
          {message.text}
        </div>
      )}

      {/* Title & Actions Bar */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80">
        <div>
          <h2 className="text-xl font-bold">Property Connections</h2>
          <p className="text-xs text-slate-400 mt-1">Manage multiple connection properties and register digital meters.</p>
        </div>
        <button 
          onClick={() => setShowAddProperty(!showAddProperty)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-indigo-600/10"
        >
          <FolderPlus className="h-4 w-4" />
          Add Connection Property
        </button>
      </div>

      {/* Add Property Form Block */}
      {showAddProperty && (
        <form onSubmit={handleAddPropertySubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl space-y-4 max-w-xl">
          <h3 className="font-bold text-sm text-slate-400 tracking-wide uppercase">New Property Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Property Designation</label>
              <input
                type="text"
                required
                placeholder="e.g. Home Apartment, Shop Retail"
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Property Type</label>
              <select
                value={pType}
                onChange={(e) => setPType(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
              >
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Industrial">Industrial</option>
                <option value="Agricultural">Agricultural</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Street Address</label>
            <textarea
              required
              rows={2}
              placeholder="Full location address..."
              value={pAddress}
              onChange={(e) => setPAddress(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-2 text-xs font-bold pt-2">
            <button 
              type="button" 
              onClick={() => setShowAddProperty(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
            >
              Save Property
            </button>
          </div>
        </form>
      )}

      {/* Properties List */}
      <div className="space-y-4">
        {propCtx?.properties.map(p => (
          <div key={p.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/60">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-xl">
                  <Building className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-base">{p.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {p.address}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {p.property_type}
                </span>
                <button 
                  onClick={() => setShowAddMeter(showAddMeter === p.id ? null : p.id)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Meter
                </button>
              </div>
            </div>

            {/* Meters List inside Property */}
            <div className="mt-4">
              <h4 className="text-xxs font-bold text-slate-400 uppercase tracking-wider mb-3">Registered Digital Meters</h4>
              {p.meters.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No electricity meters associated yet. Click "Add Meter" to setup.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {p.meters.map(m => (
                    <div key={m.id} className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">{m.meter_number}</span>
                        <div className="flex items-center gap-1.5">
                          <div className={`h-2 w-2 rounded-full ${m.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></div>
                          <span className="text-[10px] text-slate-400 capitalize">{m.status}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xxs text-slate-400 pt-1">
                        <div>
                          <span className="block font-semibold">Tariff Schedule:</span>
                          <span className="text-slate-600 dark:text-slate-300 font-bold">{m.tariff_name}</span>
                        </div>
                        <div>
                          <span className="block font-semibold">Connection:</span>
                          <span className="text-slate-600 dark:text-slate-300 font-bold capitalize">{m.connection_type}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Meter Dropdown Form */}
            {showAddMeter === p.id && (
              <form onSubmit={(e) => handleAddMeterSubmit(e, p.id)} className="mt-4 p-4 border border-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-xl space-y-3.5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Register Meter connection</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xxs font-semibold text-slate-400 mb-1">Meter Serial Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. MTR-982734"
                      value={mMeterNum}
                      onChange={(e) => setMMeterNum(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xxs font-semibold text-slate-400 mb-1">Phase Type</label>
                    <select
                      value={mPhase}
                      onChange={(e) => setMPhase(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                    >
                      <option value="single-phase">Single-Phase</option>
                      <option value="three-phase">Three-Phase</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xxs font-semibold text-slate-400 mb-1">Assigned Tariff Plan</label>
                    <select
                      value={mTariff}
                      onChange={(e) => setMTariff(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                    >
                      <option value="Residential Standard">Residential Standard</option>
                      <option value="Commercial Standard">Commercial Standard</option>
                      <option value="Industrial Premium">Industrial Premium</option>
                      <option value="Agricultural Standard">Agricultural Standard</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 text-xxs font-bold">
                  <button 
                    type="button" 
                    onClick={() => setShowAddMeter(null)}
                    className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                  >
                    Register connection
                  </button>
                </div>
              </form>
            )}

          </div>
        ))}
      </div>

    </div>
  );
}
