// frontend/src/App.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  QrCode, 
  ScanLine, 
  History, 
  MessageSquareCode, 
  ShieldCheck, 
  LogOut, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  Bell, 
  User as UserIcon,
  Zap,
  Lock,
  Mail,
  UserCheck
} from 'lucide-react';

// Import sub-pages (defined in separate modules)
import Dashboard from './pages/Dashboard';
import PropertyManager from './pages/PropertyManager';
import QRScannerPage from './pages/QRScannerPage';
import OCRMeterPage from './pages/OCRMeterPage';
import BillHistory from './pages/BillHistory';
import Chatbot from './pages/Chatbot';
import AdminPanel from './pages/AdminPanel';

// Resolves the backend API endpoint dynamically.
// In development, it defaults to the local server (http://localhost:8000/api).
// In production (e.g., Render), VITE_API_URL is supplied by the hosting service.
// This handler sanitizes and appends /api to the base URL if it's not already present.
const rawApiUrl = import.meta.env.VITE_API_URL || "";
export const API_BASE = rawApiUrl 
  ? (rawApiUrl.endsWith("/api") ? rawApiUrl : `${rawApiUrl.replace(/\/$/, "")}/api`)
  : "/api";
import { supabase } from './utils/supabaseClient';

// Authentication Context
interface UserProfile {
  id: number;
  email: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  tax_id: string | null;
}

interface AuthContextType {
  token: string | null;
  user: UserProfile | null;
  login: (token: string, role: string) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

// Property Context
export interface Meter {
  id: number;
  meter_number: string;
  status: string;
  connection_type: string;
  tariff_name: string;
  latest_bill_amount: number;
  latest_bill_status: string;
}

export interface Property {
  id: number;
  name: string;
  property_type: string;
  address: string;
  meters: Meter[];
}

interface PropertyContextType {
  properties: Property[];
  activeProperty: Property | null;
  activeMeter: Meter | null;
  setActiveProperty: (p: Property) => void;
  setActiveMeter: (m: Meter) => void;
  fetchProperties: () => Promise<void>;
  isLoading: boolean;
}

export const PropertyContext = createContext<PropertyContextType | null>(null);

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [activeProperty, setActiveProperty] = useState<Property | null>(null);
  const [activeMeter, setActiveMeter] = useState<Meter | null>(null);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<{id: number, title: string, text: string, time: string, read: boolean}[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Set initial theme class
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Auth fetch user profile
  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setUser(null);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        logout();
      }
    } catch {
      logout();
    }
  };

  // Fetch consumer properties
  const fetchProperties = async (selectPropertyId?: number, selectMeterId?: number) => {
    if (!token || !user || user.role === 'admin') return;
    setPropertiesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/properties`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data: Property[] = await res.json();
        setProperties(data);
        if (data.length > 0) {
          // Find property to select based on parameters, previous selection, or fallback to first
          let active = data[0];
          if (selectPropertyId) {
            const found = data.find(p => p.id === selectPropertyId);
            if (found) active = found;
          } else if (activeProperty) {
            const matched = data.find(p => p.id === activeProperty.id);
            if (matched) active = matched;
          }
          setActiveProperty(active);
          
          if (active.meters && active.meters.length > 0) {
            let activeM = active.meters[0];
            if (selectMeterId) {
              const mFound = active.meters.find(m => m.id === selectMeterId);
              if (mFound) activeM = mFound;
            } else if (activeMeter) {
              const mMatched = active.meters.find(m => m.id === activeMeter.id);
              if (mMatched) activeM = mMatched;
            }
            setActiveMeter(activeM);
          } else {
            setActiveMeter(null);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPropertiesLoading(false);
    }
  };

  useEffect(() => {
    if (token && user) {
      fetchProperties();
      // Generate some default alerts
      setNotifications([
        {
          id: 1,
          title: "Statement Ready",
          text: "Your bill for May 2026 is generated and ready to pay.",
          time: "2 hours ago",
          read: false
        },
        {
          id: 2,
          title: "Abnormal Leakage Alert",
          text: "Notice: Anomaly analysis detected high standby currents on Shop meter.",
          time: "1 day ago",
          read: false
        }
      ]);
    }
  }, [token, user]);

  const login = (jwtToken: string, role: string) => {
    localStorage.setItem("token", jwtToken);
    setToken(jwtToken);
    setActiveTab(role === 'admin' ? 'admin' : 'dashboard');
  };

  const logout = () => {
    supabase.auth.signOut().catch(() => {});
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setProperties([]);
    setActiveProperty(null);
    setActiveMeter(null);
  };

  // Toggle dynamic subpages
  const renderPage = () => {
    if (user?.role === 'admin') {
      return <AdminPanel />;
    }
    
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'properties':
        return <PropertyManager />;
      case 'qr-scanner':
        return <QRScannerPage onSuccess={(pId, mId) => {
          fetchProperties(pId, mId);
          setActiveTab('dashboard');
        }} />;
      case 'ocr-meter':
        return <OCRMeterPage onSuccess={() => {
          fetchProperties();
          setActiveTab('dashboard');
        }} />;
      case 'bill-history':
        return <BillHistory />;
      case 'chatbot':
        return <Chatbot />;
      case 'admin':
        if (user?.role === 'admin') return <AdminPanel />;
        return <Dashboard />;
      default:
        return <Dashboard />;
    }
  };

  // Auth Portal View
  if (!token) {
    return (
      <AuthContext.Provider value={{ token, user, login, logout, refreshUser: fetchUser }}>
        <AuthPortal login={login} theme={theme} setTheme={setTheme} />
      </AuthContext.Provider>
    );
  }

  const sidebarItems = user?.role === 'admin' ? [
    { id: 'admin', label: 'Admin Panel', icon: ShieldCheck }
  ] : [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'properties', label: 'Properties', icon: Building2 },
    { id: 'qr-scanner', label: 'QR Scan Meter', icon: QrCode },
    { id: 'ocr-meter', label: 'OCR Bill Input', icon: ScanLine },
    { id: 'bill-history', label: 'Bill History', icon: History },
    { id: 'chatbot', label: 'AI Assistant', icon: MessageSquareCode },
  ];

  return (
    <AuthContext.Provider value={{ token, user, login, logout, refreshUser: fetchUser }}>
      <PropertyContext.Provider value={{
        properties,
        activeProperty,
        activeMeter,
        setActiveProperty: (p) => {
          setActiveProperty(p);
          if (p.meters && p.meters.length > 0) {
            setActiveMeter(p.meters[0]);
          } else {
            setActiveMeter(null);
          }
        },
        setActiveMeter,
        fetchProperties,
        isLoading: propertiesLoading
      }}>
        <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
          
          {/* Mobile Header */}
          <header className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30">
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-indigo-500 fill-indigo-500" />
              <span className="font-extrabold text-lg bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">SmartCurrent</span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </header>

          {/* Navigation Sidebar */}
          <aside className={`
            fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:flex lg:flex-col
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          `}>
            {/* Sidebar Logo */}
            <div className="p-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Zap className="h-7 w-7 text-indigo-500 fill-indigo-500" />
                <span className="font-extrabold text-xl bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">SmartCurrent</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Property Selector for Consumers */}
            {user?.role !== 'admin' && properties.length > 0 && (
              <div className="p-4 border-b border-slate-100 dark:border-slate-800/60">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Selected Connection</label>
                <select 
                  value={activeProperty?.id || ""} 
                  onChange={(e) => {
                    const matched = properties.find(p => p.id === parseInt(e.target.value));
                    if (matched) {
                      setActiveProperty(matched);
                      if (matched.meters && matched.meters.length > 0) {
                        setActiveMeter(matched.meters[0]);
                      }
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                >
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.property_type})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Menu Items */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {sidebarItems.map(item => {
                const IconComp = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-150
                      ${isActive 
                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' 
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'}
                    `}
                  >
                    <IconComp className="h-5 w-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Profile Bar */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-indigo-100 dark:bg-indigo-900/60 p-2.5 rounded-xl">
                  <UserIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold truncate">{user?.full_name || user?.email}</p>
                  <p className="text-xs text-slate-400 truncate uppercase font-bold tracking-wider">{user?.role}</p>
                </div>
              </div>
              
              <button 
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:text-rose-400 py-2.5 rounded-xl text-xs font-semibold transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </aside>

          {/* Main Area */}
          <main className="flex-1 flex flex-col min-h-0 overflow-x-hidden">
            {/* Top Toolbar */}
            <header className="hidden lg:flex items-center justify-between p-5 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/40 z-20">
              <h1 className="text-xl font-bold capitalize">{activeTab.replace('-', ' ')} Overview</h1>
              
              <div className="flex items-center gap-4">
                {/* Theme Toggle */}
                <button 
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl"
                  title="Toggle Dark/Light Mode"
                >
                  {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>

                {/* Notifications Bell */}
                <div className="relative">
                  <button 
                    onClick={() => setIsNotifOpen(!isNotifOpen)}
                    className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl relative"
                  >
                    <Bell className="h-5 w-5" />
                    {notifications.some(n => !n.read) && (
                      <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-800"></span>
                    )}
                  </button>
                  
                  {isNotifOpen && (
                    <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl p-4 z-50">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-sm">Notifications</span>
                        <button 
                          onClick={() => {
                            setNotifications(notifications.map(n => ({...n, read: true})));
                          }} 
                          className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold"
                        >
                          Mark all read
                        </button>
                      </div>
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {notifications.map(n => (
                          <div key={n.id} className={`p-2.5 rounded-lg text-xs border ${n.read ? 'bg-slate-50 border-slate-100 dark:bg-slate-800/20 dark:border-slate-800/40' : 'bg-indigo-50/40 border-indigo-100 dark:bg-indigo-950/10 dark:border-indigo-900/30'}`}>
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold">{n.title}</span>
                              <span className="text-[10px] text-slate-400">{n.time}</span>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{n.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Screen Content Wrapper */}
            <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
              {renderPage()}
            </div>
          </main>
        </div>
      </PropertyContext.Provider>
    </AuthContext.Provider>
  );
}

// Authentication Portal Component
interface AuthPortalProps {
  login: (token: string, role: string) => void;
  theme: string;
  setTheme: (t: string) => void;
}

function AuthPortal({ login, theme, setTheme }: AuthPortalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const switchMode = (m: 'login' | 'register' | 'forgot') => {
    setMode(m);
    setMessage(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setPhone('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsLoading(true);

    if (mode === 'forgot') {
      try {
        const res = await fetch(`${API_BASE}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (res.ok) {
          setMessage({ type: 'success', text: data.message });
        } else {
          setMessage({ type: 'error', text: data.detail || 'Email not found' });
        }
      } catch (err: any) {
        console.error("Forgot password error:", err);
        setMessage({ type: 'error', text: `Backend connection error: ${err.message || 'Server is offline.'}` });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setMessage({ type: 'error', text: 'Passwords do not match.' });
        setIsLoading(false);
        return;
      }
      if (password.length < 8) {
        setMessage({ type: 'error', text: 'Password must be at least 8 characters.' });
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName, phone: phone || null })
        });
        const data = await res.json();
        if (res.ok) {
          login(data.access_token, data.role);
        } else {
          setMessage({ type: 'error', text: data.detail || 'Registration failed' });
        }
      } catch (err: any) {
        console.error("Registration error:", err);
        setMessage({ type: 'error', text: `Backend connection error: ${err.message || 'Server is offline. Start the FastAPI server first.'}` });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Login
    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });
      const data = await res.json();
      if (res.ok) {
        login(data.access_token, data.role);
      } else {
        setMessage({ type: 'error', text: data.detail || 'Incorrect email or password.' });
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setMessage({ type: 'error', text: `Backend connection error: ${err.message || 'Server is offline. Start the FastAPI server first.'}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setMessage(null);
    setIsLoading(true);
    try {
      // Use local backend Google simulation (no Supabase OAuth config required)
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'google-demo-token-' + Date.now(),
          email: 'customer@smartbill.com',
          full_name: 'Google User'
        })
      });
      const data = await res.json();
      if (res.ok) {
        login(data.access_token, data.role);
      } else {
        setMessage({ type: 'error', text: data.detail || 'Google Sign-In failed.' });
      }
    } catch (err: any) {
      console.error("Google Sign-In error:", err);
      setMessage({ type: 'error', text: `Backend connection error: ${err.message || 'Server is offline. Start the FastAPI server first.'}` });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 relative overflow-hidden px-4 py-10">
      {/* Background neon glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none"></div>

      {/* Theme toggle */}
      <div className="absolute top-6 right-6">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700/50"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>

      <div className="w-full max-w-md bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8 relative">

        {/* Logo & Title */}
        <div className="flex flex-col items-center mb-7">
          <div className="bg-indigo-500 p-3.5 rounded-2xl mb-4 shadow-lg shadow-indigo-500/30">
            <Zap className="h-8 w-8 text-white fill-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            {mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Create Account' : 'Reset Password'}
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 text-center leading-relaxed">
            {mode === 'login'
              ? 'Sign in to manage your electricity usage & bills'
              : mode === 'register'
              ? 'Register as a new customer to get started'
              : 'Enter your email to receive a reset link'}
          </p>
        </div>

        {/* Login / Register Tabs */}
        {mode !== 'forgot' && (
          <div className="flex bg-slate-900/60 p-1 rounded-xl mb-6 border border-slate-700/40">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${mode === 'login' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${mode === 'register' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Register
            </button>
          </div>
        )}

        {/* Alert Messages */}
        {message && (
          <div className={`p-3.5 rounded-xl text-xs mb-5 border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
            {message.text}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Registration-only fields */}
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2">Full Name</label>
                <div className="relative">
                  <UserCheck className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2">Phone <span className="text-slate-500 normal-case font-normal">(optional)</span></label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-500" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Password (not shown for forgot) */}
          {mode !== 'forgot' && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Password</label>
                {mode === 'login' && (
                  <button type="button" onClick={() => switchMode('forgot')} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-colors"
                />
              </div>
            </div>
          )}

          {/* Confirm Password (register only) */}
          {mode === 'register' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-colors"
                />
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl text-sm transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50 mt-2"
          >
            {isLoading
              ? 'Please wait...'
              : mode === 'login'
              ? 'Sign In to Dashboard'
              : mode === 'register'
              ? 'Create My Account'
              : 'Send Reset Link'}
          </button>
        </form>

        {/* Divider + Google button */}
        {mode !== 'forgot' && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700/60"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-slate-800/40 px-3 text-slate-500 backdrop-blur-sm">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              type="button"
              className="w-full bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/50 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-3 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28-0.96,2.37-2.04,3.1v2.58h3.3c1.93-1.78,3.04-4.4,3.04-7.38c0-0.68-0.06-1.34-0.18-2.0z" fill="#4285F4" />
                <path d="M12,20.7c2.43,0,4.47-0.8,5.96-2.2l-3.3-2.58c-0.92,0.62-2.1,0.98-3.36,0.98c-2.38,0-4.4-1.6-5.12-3.78H2.76v2.66c1.5,2.98,4.58,4.92,8.24,4.92z" fill="#34A853" />
                <path d="M6.88,13.12A5.19,5.19,0,0,1,6.6,12A5.19,5.19,0,0,1,6.88,10.88V8.22H2.76A8.72,8.72,0,0,0,1.8,12c0,1.38,0.32,2.7,0.96,3.88l4.12-2.76z" fill="#FBBC05" />
                <path d="M12,6.9c1.32,0,2.5,0.46,3.44,1.36l2.58-2.58C16.47,4.36,14.43,3.3,12,3.3c-3.66,0-6.74,1.94-8.24,4.92l4.12,2.66c0.72-2.18,2.74-3.78,5.12-3.78z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
          </>
        )}

        {/* Bottom nav link */}
        <div className="mt-7 text-center text-xs text-slate-500">
          {mode === 'forgot' ? (
            <button onClick={() => switchMode('login')} className="text-indigo-400 hover:text-indigo-300 font-semibold">← Back to Sign In</button>
          ) : mode === 'login' ? (
            <span>Don't have an account?{' '}
              <button onClick={() => switchMode('register')} className="text-indigo-400 hover:text-indigo-300 font-semibold">Create one here</button>
            </span>
          ) : (
            <span>Already have an account?{' '}
              <button onClick={() => switchMode('login')} className="text-indigo-400 hover:text-indigo-300 font-semibold">Sign in</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

