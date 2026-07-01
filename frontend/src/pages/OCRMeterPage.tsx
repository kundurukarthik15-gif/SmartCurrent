// frontend/src/pages/OCRMeterPage.tsx
import React, { useContext, useState } from 'react';
import { 
  ScanLine, 
  Upload, 
  HelpCircle, 
  AlertTriangle,
  Layers,
  CheckCircle2,
  FileDigit,
  Wrench,
  Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PropertyContext, AuthContext, API_BASE } from '../App';

interface OCRMeterPageProps {
  onSuccess: () => void;
}

export default function OCRMeterPage({ onSuccess }: OCRMeterPageProps) {
  const auth = useContext(AuthContext);
  const propCtx = useContext(PropertyContext);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState("");
  const [ocrResult, setOcrResult] = useState<{reading: number, method: string} | null>(null);
  const [manualReading, setManualReading] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  const activeMeter = propCtx?.activeMeter;
  const activeProperty = propCtx?.activeProperty;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setOcrResult(null);
      setMessage(null);
    }
  };

  const handleSimulateOCR = (presetVal: number, filenameHint: string) => {
    setMessage(null);
    setOcrResult(null);
    setPreviewUrl("https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=300&auto=format&fit=crop");
    setIsProcessing(true);
    
    // Simulate multi-step processing logs
    const logs = [
      "Uploading digital image file...",
      "Converting color spaces & applying binarization threshold filter...",
      "Detecting region of interest (ROI) & digit boundaries...",
      "Executing character segmentation matrix...",
      "Decoding digits via neural network engine..."
    ];

    logs.forEach((log, index) => {
      setTimeout(() => {
        setProcessStep(log);
        if (index === logs.length - 1) {
          setTimeout(() => {
            setIsProcessing(false);
            setOcrResult({ reading: presetVal, method: "OCR Extraction" });
            setManualReading(presetVal.toString());
          }, 600);
        }
      }, 500 * (index + 1));
    });
  };

  const handleRunOCR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !activeMeter) return;
    
    setIsProcessing(true);
    setOcrResult(null);
    setMessage(null);
    setProcessStep("Uploading image file directly to FastAPI...");

    try {
      const formData = new FormData();
      formData.append("meter_number", activeMeter.meter_number);
      formData.append("file", file);

      // Timeout simulation log changes
      const t = setTimeout(() => {
        setProcessStep("FastAPI received payload. Preprocessing character grid...");
      }, 1000);

      const res = await fetch(`${API_BASE}/ocr/scan-meter`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${auth?.token}` },
        body: formData
      });
      
      clearTimeout(t);
      const data = await res.json();
      
      if (res.ok) {
        setIsProcessing(false);
        setOcrResult({
          reading: data.extracted_reading,
          method: data.method === 'ocr' ? 'Tesseract OCR engine' : 'Deterministic Simulation fallback'
        });
        setManualReading(data.extracted_reading.toString());
      } else {
        setIsProcessing(false);
        setMessage({ type: 'error', text: data.detail || "Error executing OCR." });
      }
    } catch {
      setIsProcessing(false);
      setMessage({ type: 'error', text: "Server connection timeout. Falling back." });
    }
  };

  const handleSubmitReading = async () => {
    if (!activeMeter || !manualReading) return;
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}/billing/submit-reading`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth?.token}`
        },
        body: JSON.stringify({
          meter_id: activeMeter.id,
          cumulative_reading: parseFloat(manualReading)
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Success celebration
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.8 }
        });
        
        setMessage({ 
          type: 'success', 
          text: data.message || `Reading of ${manualReading} kWh successfully saved. Bill generated.` 
        });
        setOcrResult(null);
        setFile(null);
        setPreviewUrl(null);
        
        // Wait 1.5 seconds to show the success message, then redirect/refresh
        setTimeout(() => {
          onSuccess(); // Refresh properties and switch tab
        }, 1500);
      } else {
        setMessage({ type: 'error', text: data.detail || "Error recording billing parameters." });
      }
    } catch (err) {
      setMessage({ type: 'error', text: "Error contacting billing controller." });
    } finally {
      setIsLoading(false);
    }
  };

  if (!activeProperty || !activeMeter) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl">
        <ScanLine className="h-16 w-16 text-indigo-500 fill-indigo-500/20 mb-4 animate-pulse-slow" />
        <h2 className="text-xl font-bold mb-2">No Active Connections Found</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-4">Please add a property and sync a meter before running OCR scans.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {message && (
        <div className={`p-4 rounded-xl text-xs border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80">
        <h2 className="text-xl font-bold">OCR Meter Reading scanner</h2>
        <p className="text-xs text-slate-400 mt-1">Upload a photo of your electricity meter. Our character scanner will extract the numerical register values.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Upload Box */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl flex flex-col">
          <h3 className="font-extrabold text-sm tracking-wide uppercase text-slate-400 mb-5">Upload Meter Display Photo</h3>
          
          <form onSubmit={handleRunOCR} className="space-y-4 flex-1 flex flex-col">
            
            <div className="flex items-center gap-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl mb-2">
              <span className="font-semibold text-slate-400">Target Connection:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{activeProperty.name} (Meter: {activeMeter.meter_number})</span>
            </div>

            {/* Drag Drop Area */}
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-colors rounded-2xl flex-1 flex flex-col items-center justify-center p-6 text-center cursor-pointer relative min-h-[220px]">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              {previewUrl ? (
                <div className="space-y-3 relative z-10 w-full">
                  <img src={previewUrl} alt="Preview" className="h-32 mx-auto rounded-lg object-cover shadow-md" />
                  <p className="text-xxs text-slate-400">{file?.name || "Uploaded image"}</p>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-slate-400 mb-2" />
                  <p className="text-xs font-bold text-slate-500">Drag & drop photo here or click to browse</p>
                  <p className="text-[10px] text-slate-400 mt-1">Supports PNG, JPG, JPEG up to 10MB</p>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={!file || isProcessing}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 disabled:opacity-40"
            >
              <ScanLine className="h-4 w-4" />
              Analyze Photo with OCR
            </button>
          </form>

          {/* Simulation Block */}
          <div className="mt-5 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl space-y-2">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Simulate OCR Scan Presets</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSimulateOCR(12680.5, "meter_reading_12680.jpg")}
                className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold py-2 px-3 rounded-lg text-left"
              >
                Residential Mock Reading: <b className="block text-indigo-500">12680.5 kWh</b>
              </button>
              <button
                type="button"
                onClick={() => handleSimulateOCR(48560.2, "meter_reading_48560.jpg")}
                className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold py-2 px-3 rounded-lg text-left"
              >
                Commercial Mock Reading: <b className="block text-indigo-500">48560.2 kWh</b>
              </button>
            </div>
          </div>

        </div>

        {/* Processing Logs / Extraction Results */}
        <div className="space-y-4">
          
          {isProcessing && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center min-h-[300px]">
              <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
              <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-200">Processing Digital Image</h4>
              <p className="text-xs text-indigo-500 mt-2 font-mono">{processStep}</p>
            </div>
          )}

          {!isProcessing && ocrResult && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-6">
              
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/60">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-xl">
                  <FileDigit className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm">OCR Analysis Finished</h3>
                  <p className="text-[10px] text-slate-400">Extracted using: {ocrResult.method}</p>
                </div>
              </div>

              {/* Numerical Display */}
              <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="text-xxs font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Extracted Register Value</span>
                <span className="text-4xl font-black font-mono text-slate-800 dark:text-white tracking-widest">{ocrResult.reading.toFixed(1)} <b className="text-lg font-sans text-slate-400">kWh</b></span>
              </div>

              {/* Warning */}
              <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40 p-4 rounded-xl flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-400/80">
                  <b>Verification required:</b> Shadows or dust can affect scanner precision. Verify that the number above exactly matches your physical meter display before committing.
                </p>
              </div>

              {/* Edit Panel */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Wrench className="h-4 w-4" /> Manual Validation Control
                </h4>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.1"
                    value={manualReading}
                    onChange={(e) => setManualReading(e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleSubmitReading}
                    disabled={isLoading || !manualReading}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-600/10"
                  >
                    {isLoading ? "Recording..." : "Verify & Commit"}
                  </button>
                </div>
              </div>

            </div>
          )}

          {!isProcessing && !ocrResult && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center h-[350px]">
              <ScanLine className="h-12 w-12 text-slate-300 mb-3" />
              <h4 className="font-bold text-slate-400">Awaiting character extraction</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                Upload a photo or select an OCR Simulation Preset to scan the register dial automatically.
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
