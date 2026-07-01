// frontend/src/pages/QRScannerPage.tsx
import React, { useContext, useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Scan,
  ShieldCheck,
  AlertCircle,
  Building,
  User,
  FileCheck,
  CheckCircle2,
  Upload,
  Camera,
  CameraOff,
  RefreshCw,
  Eye,
  Zap
} from 'lucide-react';
import { AuthContext, API_BASE } from '../App';
import { Html5Qrcode } from 'html5-qrcode';

interface MeterQR {
  meter_id: number;
  meter_number: string;
  qr_code_hash: string;
  status: string;
  connection_type: string;
  property_name: string;
  property_type: string;
  qr_image: string;
}

interface QRVerifyResponse {
  status: string;
  meter_id: number;
  meter_number: string;
  connection_type: string;
  status_state: string;
  property: { id: number; name: string; property_type: string; address: string };
  consumer: { id: number; full_name: string; phone: string };
  tariff_plan: { name: string; fixed_charge: number; rate_per_unit: number; fuel_adjustment_charge: number };
}

interface QRScannerPageProps {
  onSuccess: (propertyId?: number, meterId?: number) => void;
}

export default function QRScannerPage({ onSuccess }: QRScannerPageProps) {
  const auth = useContext(AuthContext);

  const [myMeters, setMyMeters] = useState<MeterQR[]>([]);
  const [metersLoading, setMetersLoading] = useState(true);
  const [selectedMeter, setSelectedMeter] = useState<MeterQR | null>(null);

  // Sample seeded QR codes — these always exist in the database
  const SAMPLE_QRS = [
    { hash: 'VERIFY-MTR-HOME', label: 'Home Apartment', meter: 'MTR-893018', type: 'Residential' },
    { hash: 'VERIFY-MTR-SHOP', label: 'Retail Shop', meter: 'MTR-284920', type: 'Commercial' },
  ];
  const [sampleQRImages, setSampleQRImages] = useState<any[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<QRVerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [manualHash, setManualHash] = useState('');
  const [activeTab, setActiveTab] = useState<'my-meters' | 'camera' | 'upload' | 'manual'>('my-meters');

  const html5QrRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = 'qr-live-camera-div';

  // Load user's own meters with QR images
  useEffect(() => {
    fetchMyMeters();
    fetchSampleQRImages();
  }, []);

  const fetchSampleQRImages = async () => {
    setSamplesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/qr/sample-codes`, {
        headers: { Authorization: `Bearer ${auth?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSampleQRImages(data);
      }
    } catch (e) {
      console.error('Failed to load sample codes:', e);
    } finally {
      setSamplesLoading(false);
    }
  };

  const fetchMyMeters = async () => {
    setMetersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/qr/my-meters`, {
        headers: { Authorization: `Bearer ${auth?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyMeters(data);
      }
    } catch (e) {
      console.error('Failed to load meters:', e);
    } finally {
      setMetersLoading(false);
    }
  };

  const handleVerify = async (hash: string) => {
    if (!hash.trim()) return;
    setIsVerifying(true);
    setError(null);
    setScanResult(null);

    try {
      const res = await fetch(`${API_BASE}/qr/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth?.token}`
        },
        body: JSON.stringify({ qr_code_hash: hash.trim() })
      });

      const data = await res.json();
      if (res.ok) {
        setScanResult(data);
        // Refresh properties in parent and navigate to dashboard
        setTimeout(() => {
          onSuccess(data.property?.id, data.meter_id);
        }, 2000);
      } else {
        setError(data.detail || 'QR code not found in the system. Please scan a valid meter QR code.');
      }
    } catch {
      setError('Cannot connect to backend. Make sure the FastAPI server is running.');
    } finally {
      setIsVerifying(false);
    }
  };

  const startCamera = async () => {
    setIsScanning(true);
    setError(null);
    setScanResult(null);

    // Wait for the div to render
    await new Promise(r => setTimeout(r, 150));

    try {
      const scanner = new Html5Qrcode(scannerDivId);
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 15 },
        (decodedText) => {
          stopCamera();
          handleVerify(decodedText);
        },
        () => {} // Suppress per-frame errors
      );
    } catch (err: any) {
      console.error('Camera error:', err);
      setError('Camera access failed. Grant camera permission in your browser and try again.');
      setIsScanning(false);
    }
  };

  const stopCamera = async () => {
    try {
      if (html5QrRef.current) {
        await html5QrRef.current.stop();
        html5QrRef.current = null;
      }
    } catch (e) {
      console.error(e);
    }
    setIsScanning(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setScanResult(null);
    setIsVerifying(true);

    // Create a hidden div for the file scanner
    let tempDiv = document.getElementById('qr-file-scan-hidden');
    if (!tempDiv) {
      tempDiv = document.createElement('div');
      tempDiv.id = 'qr-file-scan-hidden';
      tempDiv.style.position = 'fixed';
      tempDiv.style.width = '300px';
      tempDiv.style.height = '300px';
      tempDiv.style.opacity = '0';
      tempDiv.style.pointerEvents = 'none';
      tempDiv.style.zIndex = '-999';
      document.body.appendChild(tempDiv);
    }

    try {
      const scanner = new Html5Qrcode('qr-file-scan-hidden');
      const result = await scanner.scanFile(file, false);
      await scanner.clear();
      handleVerify(result);
    } catch (err) {
      setIsVerifying(false);
      setError('Could not decode QR code from image. Make sure the image is clear, well-lit and shows the full QR code.');
    }

    // Reset file input
    e.target.value = '';
  };

  const ResultPanel = () => {
    if (error) {
      return (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-5 rounded-2xl flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-rose-800 dark:text-rose-400 text-sm">Verification Failed</h4>
            <p className="text-xs text-rose-700 dark:text-rose-400/80 leading-relaxed mt-1">{error}</p>
          </div>
        </div>
      );
    }

    if (isVerifying) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 h-[200px]">
          <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-400">Verifying QR code...</p>
        </div>
      );
    }

    if (scanResult) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-emerald-500">Meter Verified ✓</h3>
              <p className="text-xs text-slate-400">Redirecting to dashboard...</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl space-y-1.5">
              <p className="text-slate-400 font-semibold uppercase text-[10px]">Meter</p>
              <p className="font-mono font-bold">{scanResult.meter_number}</p>
              <p className="capitalize text-slate-500">{scanResult.connection_type}</p>
              <span className="inline-block bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize">{scanResult.status_state}</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl space-y-1.5">
              <p className="text-slate-400 font-semibold uppercase text-[10px]">Property</p>
              <p className="font-bold">{scanResult.property?.name}</p>
              <p className="text-slate-500">{scanResult.property?.property_type}</p>
              <p className="text-[10px] text-slate-400 truncate">{scanResult.property?.address}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl space-y-1.5">
              <p className="text-slate-400 font-semibold uppercase text-[10px]">Consumer</p>
              <p className="font-bold">{scanResult.consumer?.full_name}</p>
              <p className="text-slate-500">{scanResult.consumer?.phone}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl space-y-1.5">
              <p className="text-slate-400 font-semibold uppercase text-[10px]">Tariff Plan</p>
              <p className="font-bold">{scanResult.tariff_plan?.name}</p>
              <p className="text-slate-500">${scanResult.tariff_plan?.rate_per_unit?.toFixed(3)}/kWh</p>
              <p className="text-slate-500">Base: ${scanResult.tariff_plan?.fixed_charge?.toFixed(2)}</p>
            </div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-500/20 p-3.5 rounded-xl text-xs flex items-center justify-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            METER SYNCED — Dashboard updating...
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex items-center gap-4">
        <div className="p-3 bg-indigo-500/10 rounded-xl">
          <QrCode className="h-6 w-6 text-indigo-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold">QR Meter Scanner</h2>
          <p className="text-xs text-slate-400 mt-0.5">Scan your electricity meter QR code to verify and link it to your account.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left: Scan Methods */}
        <div className="lg:col-span-2 space-y-4">

          {/* Tab Switcher */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-2 grid grid-cols-4 gap-1">
            {[
              { id: 'my-meters', label: 'My QRs', icon: Eye },
              { id: 'camera', label: 'Camera', icon: Camera },
              { id: 'upload', label: 'Upload', icon: Upload },
              { id: 'manual', label: 'Manual', icon: Zap },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  if (activeTab === 'camera' && isScanning) stopCamera();
                  setActiveTab(id as any);
                  setError(null);
                }}
                className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-[10px] font-bold transition-all ${
                  activeTab === id
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* My Meters Tab */}
          {activeTab === 'my-meters' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Your Meter QR Codes</h3>
                <button onClick={() => { fetchMyMeters(); fetchSampleQRImages(); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                  <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </div>

              {/* User's own meters */}
              {metersLoading ? (
                <div className="flex items-center justify-center py-4 gap-2 text-slate-400">
                  <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs">Loading meters...</span>
                </div>
              ) : myMeters.length > 0 ? (
                <div className="space-y-3">
                  {myMeters.map((meter) => (
                    <div
                      key={meter.meter_id}
                      className={`border rounded-xl p-3 cursor-pointer transition-all ${
                        selectedMeter?.meter_id === meter.meter_id
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                      }`}
                      onClick={() => setSelectedMeter(selectedMeter?.meter_id === meter.meter_id ? null : meter)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-bold">{meter.property_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{meter.meter_number}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          meter.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>{meter.status}</span>
                      </div>

                      {selectedMeter?.meter_id === meter.meter_id && (
                        <div className="mt-3 space-y-3">
                          <div className="bg-white border border-slate-200 rounded-xl p-3 flex justify-center">
                            <img src={meter.qr_image} alt={`QR for ${meter.meter_number}`} className="w-40 h-40 object-contain" />
                          </div>
                          <p className="text-[10px] text-slate-400 text-center">Scan this QR with camera or click verify</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleVerify(meter.qr_code_hash); }}
                            disabled={isVerifying}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                          >
                            {isVerifying ? 'Verifying...' : '✓ Verify This Meter'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {/* ─── SAMPLE / DEMO QR CODES ─── */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Demo Sample QR Codes</span>
                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/30 text-indigo-500 px-1.5 py-0.5 rounded font-bold">Pre-seeded</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                  These are real QR codes from the database. Click <b>Verify</b> or scan them with the <b>Camera / Upload</b> tab.
                </p>

                {samplesLoading ? (
                  <div className="flex items-center justify-center py-4 gap-2 text-slate-400">
                    <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs">Loading sample QR codes...</span>
                  </div>
                ) : sampleQRImages.length === 0 ? (
                  /* Fallback: show clickable hash text if backend images failed */
                  <div className="space-y-2">
                    {[
                      { hash: 'VERIFY-MTR-HOME', label: 'Home Apartment', meter: 'MTR-893018' },
                      { hash: 'VERIFY-MTR-SHOP', label: 'Retail Shop', meter: 'MTR-284920' },
                    ].map(s => (
                      <div key={s.hash} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold">{s.label}</p>
                          <p className="text-[10px] font-mono text-slate-400">{s.meter}</p>
                        </div>
                        <button
                          onClick={() => handleVerify(s.hash)}
                          disabled={isVerifying}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          Verify
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sampleQRImages.map((sample: any) => (
                      <div key={sample.hash} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold">{sample.property_name}</p>
                            <p className="text-[10px] font-mono text-slate-400">{sample.meter_number}</p>
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-semibold">{sample.property_type}</span>
                          </div>
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 px-2 py-0.5 rounded-full font-bold capitalize">{sample.status}</span>
                        </div>

                        {/* Real QR Image from backend */}
                        <div className="bg-white rounded-xl p-4 flex justify-center border border-slate-100">
                          <img
                            src={sample.qr_image}
                            alt={`QR Code for ${sample.property_name}`}
                            className="w-48 h-48 object-contain"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleVerify(sample.hash)}
                            disabled={isVerifying}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                          >
                            {isVerifying ? 'Verifying...' : '✓ Verify Meter'}
                          </button>
                          <a
                            href={sample.qr_image}
                            download={`${sample.meter_number}_QR.png`}
                            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold px-3 py-2.5 rounded-xl transition-colors"
                            title="Download QR Code"
                          >
                            ↓
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Camera Tab */}
          {activeTab === 'camera' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Camera Scan</h3>

              {/* Camera viewport */}
              <div className="relative w-full aspect-square bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center">
                {isScanning ? (
                  <>
                    <div id={scannerDivId} className="absolute inset-0 w-full h-full" />
                    {/* Corner guides */}
                    <div className="absolute inset-8 border-2 border-dashed border-indigo-500/50 rounded-xl pointer-events-none z-10">
                      <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-indigo-400 rounded-tl" />
                      <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-indigo-400 rounded-tr" />
                      <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-indigo-400 rounded-bl" />
                      <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-indigo-400 rounded-br" />
                    </div>
                    {/* Scan line */}
                    <div className="absolute left-8 right-8 h-0.5 bg-indigo-500 shadow-[0_0_8px_2px_rgba(99,102,241,0.6)] animate-bounce z-10 pointer-events-none" />
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-600">
                    <Camera className="h-12 w-12" />
                    <p className="text-xs font-semibold">Camera not started</p>
                  </div>
                )}
              </div>

              {isScanning ? (
                <button
                  onClick={stopCamera}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <CameraOff className="h-4 w-4" /> Stop Camera
                </button>
              ) : (
                <button
                  onClick={startCamera}
                  disabled={isVerifying}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" /> Start Camera Scan
                </button>
              )}
              <p className="text-[10px] text-slate-400 text-center">Point your camera at the QR code on the electricity meter</p>
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Upload QR Image</h3>

              <label className="block w-full border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 rounded-xl p-8 text-center cursor-pointer transition-colors group">
                <Upload className="h-10 w-10 mx-auto mb-3 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                <p className="text-sm font-bold text-slate-500 group-hover:text-indigo-500">Click to upload QR image</p>
                <p className="text-[11px] text-slate-400 mt-1">PNG, JPG, JPEG — clear and well-lit</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {isVerifying && (
                <div className="flex items-center justify-center gap-2 py-3 text-indigo-500">
                  <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold">Scanning image...</span>
                </div>
              )}
            </div>
          )}

          {/* Manual Hash Tab */}
          {activeTab === 'manual' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Enter QR Hash Manually</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Type or paste the cryptographic hash printed on your meter or from the admin panel.
              </p>
              <textarea
                value={manualHash}
                onChange={e => setManualHash(e.target.value)}
                placeholder="e.g. VERIFY-MTR-HOME-XXXX"
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono outline-none focus:border-indigo-500 resize-none"
              />
              <button
                onClick={() => handleVerify(manualHash)}
                disabled={isVerifying || !manualHash.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isVerifying ? (
                  <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verifying...</>
                ) : (
                  <><Scan className="h-4 w-4" /> Verify Hash</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right: Result Panel */}
        <div className="lg:col-span-3 space-y-4">
          <ResultPanel />

          {!scanResult && !error && !isVerifying && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
              <QrCode className="h-14 w-14 text-slate-300 dark:text-slate-700 mb-4" />
              <h4 className="font-bold text-slate-500 dark:text-slate-400 text-base">Awaiting QR Scan</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-2 leading-relaxed">
                Select <b>My QRs</b> to view and verify your registered meter QR codes instantly,
                or use <b>Camera</b> / <b>Upload</b> to scan a physical meter.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-xs text-[11px]">
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl text-center">
                  <Eye className="h-5 w-5 mx-auto mb-1 text-indigo-500" />
                  <p className="font-semibold">My QRs</p>
                  <p className="text-slate-400 mt-0.5">View registered meters</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl text-center">
                  <Camera className="h-5 w-5 mx-auto mb-1 text-indigo-500" />
                  <p className="font-semibold">Camera</p>
                  <p className="text-slate-400 mt-0.5">Scan physical meter</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
