// frontend/src/pages/BillHistory.tsx
import React, { useContext, useEffect, useState } from 'react';
import { 
  History, 
  Search, 
  Download, 
  CreditCard, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  FileText,
  X,
  CreditCard as CardIcon
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PropertyContext, AuthContext, API_BASE } from '../App';

interface Bill {
  id: number;
  meter_id: number;
  meter_number: string;
  property_name: string;
  bill_date: string;
  due_date: string;
  units_consumed: number;
  bill_amount: number;
  payment_status: string;
}

export default function BillHistory() {
  const auth = useContext(AuthContext);
  const propCtx = useContext(PropertyContext);

  const [bills, setBills] = useState<Bill[]>([]);
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const [isLoading, setIsLoading] = useState(false);
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [payMethod, setPayMethod] = useState("UPI");
  const [isPaying, setIsPaying] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  const activeMeter = propCtx?.activeMeter;

  useEffect(() => {
    if (auth?.token) {
      fetchBills();
    }
  }, [activeMeter, auth?.token]);

  useEffect(() => {
    applyFilters();
  }, [bills, searchTerm, statusFilter]);

  const fetchBills = async () => {
    setIsLoading(true);
    try {
      // Query parameters
      let url = `${API_BASE}/billing/bills`;
      if (activeMeter?.id) {
        url += `?meter_id=${activeMeter.id}`;
      }
      
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${auth?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBills(data);
      }
    } catch {
      console.error("Unable to load statement logs");
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let temp = [...bills];
    
    // Status filter
    if (statusFilter !== "all") {
      temp = temp.filter(b => b.payment_status === statusFilter);
    }

    // Search filter
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      temp = temp.filter(b => 
        b.property_name.toLowerCase().includes(term) ||
        b.meter_number.toLowerCase().includes(term) ||
        new Date(b.bill_date).toLocaleDateString(undefined, {month: 'long', year: 'numeric'}).toLowerCase().includes(term)
      );
    }

    setFilteredBills(temp);
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;
    setIsPaying(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}/billing/pay/${payingBill.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth?.token}`
        },
        body: JSON.stringify({ payment_method: payMethod })
      });
      
      const data = await res.json();
      if (res.ok) {
        // Success payment confetti!
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        
        setMessage({ type: 'success', text: `Payment of $${payingBill.bill_amount} for bill ref #${payingBill.id} was processed successfully.` });
        setPayingBill(null);
        fetchBills(); // Reload
      } else {
        setMessage({ type: 'error', text: data.detail || "Error processing payment transaction." });
      }
    } catch {
      setMessage({ type: 'error', text: "Server disconnect." });
    } finally {
      setIsPaying(false);
    }
  };

  const handleDownloadPDF = async (billId: number, billDateStr: string) => {
    try {
      const res = await fetch(`${API_BASE}/billing/bills/${billId}/pdf`, {
        headers: { "Authorization": `Bearer ${auth?.token}` }
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smart_bill_${billDateStr.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        alert("Error creating PDF document. Make sure database seeder was loaded.");
      }
    } catch (err) {
      alert("Error compiling statement PDF binary.");
    }
  };

  return (
    <div className="space-y-6">
      
      {message && (
        <div className={`p-4 rounded-xl text-xs border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
          {message.text}
        </div>
      )}

      {/* Header bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80">
        <h2 className="text-xl font-bold">Billing & Statements</h2>
        <p className="text-xs text-slate-400 mt-1">Review historical bills, reconcile transaction details, and download official PDF statements.</p>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by month, property, or meter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filter Tab buttons */}
        <div className="flex gap-2">
          {["all", "paid", "unpaid"].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`
                px-4 py-2 rounded-xl text-xs font-bold capitalize transition-colors
                ${statusFilter === status 
                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/10' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}
              `}
            >
              {status} Bills
            </button>
          ))}
        </div>

      </div>

      {/* Table list */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">Querying billing ledger...</div>
        ) : filteredBills.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <History className="h-10 w-10 text-slate-300 mb-2" />
            <h4 className="font-bold text-slate-400">No matching bills on record</h4>
            <p className="text-xs text-slate-400 mt-1">Try refining search parameters or sync property records.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/60 font-bold uppercase tracking-wider text-slate-400">
                  <th className="p-4">Reference ID</th>
                  <th className="p-4">Billing Month</th>
                  <th className="p-4">Property / Meter</th>
                  <th className="p-4">Units Consumed</th>
                  <th className="p-4">Gross Due</th>
                  <th className="p-4">Payment Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {filteredBills.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20">
                    <td className="p-4 font-mono font-bold text-slate-500 dark:text-slate-400">BIL-{b.id.toString().padStart(5, '0')}</td>
                    <td className="p-4 font-bold text-slate-700 dark:text-slate-200">
                      {new Date(b.bill_date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-700 dark:text-slate-200">{b.property_name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{b.meter_number}</p>
                    </td>
                    <td className="p-4 font-bold">{b.units_consumed.toFixed(1)} kWh</td>
                    <td className="p-4 font-extrabold text-sm text-slate-800 dark:text-white">${b.bill_amount.toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] ${
                        b.payment_status === 'paid' 
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' 
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                      }`}>
                        {b.payment_status === 'paid' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {b.payment_status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {b.payment_status === 'unpaid' && (
                        <button
                          onClick={() => setPayingBill(b)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-3 rounded-lg flex inline-items items-center gap-1 transition-colors shadow-sm"
                        >
                          <CreditCard className="h-3.5 w-3.5" /> Pay Now
                        </button>
                      )}
                      <button
                        onClick={() => handleDownloadPDF(b.id, b.bill_date)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-850 dark:hover:bg-slate-700 dark:text-slate-200 font-bold py-1.5 px-3 rounded-lg flex inline-items items-center gap-1 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" /> Statement
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Processing Modal */}
      {payingBill && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-5 relative">
            <button 
              onClick={() => setPayingBill(null)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 dark:text-white">Pay Electricity Bill</h3>
                <p className="text-xxs text-slate-400">Statement: {new Date(payingBill.bill_date).toLocaleDateString(undefined, {month:'long', year:'numeric'})}</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Property:</span><span className="font-bold">{payingBill.property_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Billing Units:</span><span className="font-bold">{payingBill.units_consumed.toFixed(1)} kWh</span></div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700/60 pt-2"><span className="font-bold">Total Gross Amount:</span><span className="font-extrabold text-sm text-indigo-500">${payingBill.bill_amount.toFixed(2)}</span></div>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-4">
              <div>
                <label className="block text-xxs font-semibold text-slate-400 uppercase mb-2">Select Payment Method</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {["UPI", "Credit Card", "Net Banking", "Wallet"].map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPayMethod(method)}
                      className={`
                        py-3 px-3 border rounded-xl flex items-center justify-center gap-2 font-bold transition-all
                        ${payMethod === method 
                          ? 'border-indigo-500 bg-indigo-50/20 text-indigo-500 dark:bg-indigo-950/20' 
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'}
                      `}
                    >
                      <CardIcon className="h-4 w-4" />
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isPaying}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl text-xs shadow-lg shadow-indigo-600/10"
              >
                {isPaying ? "Authorizing Funds..." : `Process Payment $${payingBill.bill_amount}`}
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
