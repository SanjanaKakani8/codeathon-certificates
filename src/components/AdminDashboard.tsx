import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  FileSpreadsheet, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ChevronRight, 
  Table as TableIcon,
  Save,
  Trash2,
  Lock,
  LogIn,
  Users,
  Activity,
  History,
  RefreshCcw,
  Sparkles
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { collection, writeBatch, doc, getCountFromServer, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

interface AdminDashboardProps {
  onClose: () => void;
}

type DataRow = Record<string, string>;

export default function AdminDashboard({ onClose }: AdminDashboardProps) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<DataRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [targetCollection, setTargetCollection] = useState<'participants' | 'coordinators' | 'events'>('participants');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ success: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const [eventOverride, setEventOverride] = useState('');
  
  // Database Counters
  const [counts, setCounts] = useState({ participants: 0, coordinators: 0, events: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [recentRecords, setRecentRecords] = useState<any[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResult(null);
    try {
      const q = query(
        collection(db, targetCollection),
        where(targetCollection === 'events' ? 'name' : 'rollNo', '==', 
              targetCollection === 'events' ? searchQuery.trim() : searchQuery.trim().toUpperCase())
      );
      const snap = await getDocs(q);
      setSearchResult(snap.docs.map(d => d.data()));
    } catch (err) {
      console.error("Search Error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchCounts = async () => {
    setIsRefreshing(true);
    try {
      const partSnap = await getCountFromServer(collection(db, 'participants'));
      const coordSnap = await getCountFromServer(collection(db, 'coordinators'));
      const eventSnap = await getCountFromServer(collection(db, 'events'));
      setCounts({
        participants: partSnap.data().count,
        coordinators: coordSnap.data().count,
        events: eventSnap.data().count
      });
      await fetchRecent();
    } catch (err) {
      console.error("Count Error:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchRecent = async () => {
    try {
      const q = query(
        collection(db, targetCollection),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const snap = await getDocs(q);
      setRecentRecords(snap.docs.map(d => d.data()));
    } catch (err) {
      console.error("Fetch Recent Error:", err);
    }
  };

  useEffect(() => {
    if (user) fetchRecent();
  }, [targetCollection]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) fetchCounts();
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(`Login Error: ${err.message}`);
    }
  };

  const handlePasteImport = () => {
    if (!rawText.trim()) return;
    Papa.parse(rawText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setData(results.data as DataRow[]);
        setHeaders(results.meta.fields || []);
        setError(null);
      },
      error: (err) => {
        setError(`Paste Error: ${err.message}`);
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'csv') {
      parseCSV(selectedFile);
    } else if (extension === 'xlsx' || extension === 'xls') {
      parseExcel(selectedFile);
    } else {
      setError('Please upload a .csv or .xlsx file');
    }
  };

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setData(results.data as DataRow[]);
        setHeaders(results.meta.fields || []);
        setFile(file);
        setError(null);
      },
      error: (err) => {
        setError(`CSV Error: ${err.message}`);
      }
    });
  };

  const parseExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as DataRow[];
        
        if (jsonData.length > 0) {
          setData(jsonData);
          setHeaders(Object.keys(jsonData[0]));
          setFile(file);
          setError(null);
        } else {
          setError('The excel file appears to be empty');
        }
      } catch (err) {
        setError('Error parsing Excel file');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (data.length === 0) return;
    setIsUploading(true);
    setUploadStatus(null);
    setError(null);
    
    try {
      const batchSize = 100; // Smaller chunks for better progress visibility
      let processed = 0;
      
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = data.slice(i, i + batchSize);
        
        chunk.forEach((row) => {
          const normalizedRow: any = {
            createdAt: new Date(),
          };
          
          Object.entries(row).forEach(([key, val]) => {
            if (!val) return;
            const lowKey = key.toLowerCase().trim();
            if (lowKey.includes('name')) normalizedRow.name = String(val).trim();
            if (lowKey.includes('email')) normalizedRow.email = String(val).trim().toLowerCase();
            if (lowKey.includes('roll') || lowKey.includes('no')) normalizedRow.rollNo = String(val).trim().toUpperCase();
            if (lowKey.includes('event')) normalizedRow.event = String(val).trim();
            if (lowKey.includes('role')) normalizedRow.role = String(val).trim();
            if (lowKey.includes('year')) normalizedRow.year = String(val).trim();
            if (lowKey.includes('branch')) normalizedRow.branch = String(val).trim();
            if (lowKey.includes('mobile')) normalizedRow.mobile = String(val).trim();
            if (lowKey.includes('college')) normalizedRow.college = String(val).trim();
            if (lowKey.includes('team')) normalizedRow.team = String(val).trim();
            if (lowKey.includes('method')) normalizedRow.paymentMethod = String(val).trim();
            if (lowKey.includes('coordinator')) normalizedRow.coordinator = String(val).trim();
            if (lowKey.includes('category')) normalizedRow.category = String(val).trim();
          });

          if (eventOverride && !normalizedRow.event && targetCollection !== 'events') {
            normalizedRow.event = eventOverride;
          }

          if (!normalizedRow.role && targetCollection !== 'events') {
            normalizedRow.role = targetCollection === 'participants' ? 'Participant' : 'Student Coordinator';
          }

          // Validation to ensure we don't upload empty docs
          const isValid = targetCollection === 'events' 
            ? !!normalizedRow.name 
            : !!(normalizedRow.name && normalizedRow.rollNo);

          if (isValid) {
            const docRef = doc(collection(db, targetCollection));
            batch.set(docRef, normalizedRow);
          }
        });
        
        await batch.commit();
        processed += chunk.length;
        setUploadStatus({ success: processed, total: data.length });
      }
      
      setLastSyncTime(new Date());
      await fetchCounts(); // Refresh counts and recent records after sync
      setData([]);
      setFile(null);
      setRawText('');
    } catch (err: any) {
      console.error("Upload Error:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, targetCollection);
      } catch (e: any) {
        setError(e.message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const progressPercent = uploadStatus ? Math.round((uploadStatus.success / uploadStatus.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
              <Lock size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Admin Console</h2>
              <p className="text-xs text-gray-400 font-medium tracking-widest uppercase">Data Management & Import</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 hover:bg-white hover:shadow-md rounded-xl transition-all text-gray-400 hover:text-gray-900"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {!user ? (
            <div className="h-full flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
                <Lock size={40} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Restricted Access</h3>
              <p className="text-gray-400 text-sm max-w-xs mb-8">Please sign in with your administrator account to manage participant data.</p>
              <button 
                onClick={handleLogin}
                className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all"
              >
                <LogIn size={18} />
                Sign in with Google
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Stats Bar */}
              <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-6 bg-blue-50 rounded-3xl flex items-center justify-between border border-blue-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                      <Users size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Participants</p>
                      <motion.p 
                        key={counts.participants}
                        initial={{ opacity: 0.5, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-2xl font-black text-blue-900"
                      >
                        {isRefreshing ? '...' : counts.participants.toLocaleString()}
                      </motion.p>
                    </div>
                  </div>
                </div>
                <div className="p-6 bg-indigo-50 rounded-3xl flex items-center justify-between border border-indigo-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Coordinators</p>
                      <motion.p 
                        key={counts.coordinators}
                        initial={{ opacity: 0.5, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-2xl font-black text-indigo-900"
                      >
                        {isRefreshing ? '...' : counts.coordinators.toLocaleString()}
                      </motion.p>
                    </div>
                  </div>
                </div>
                <div className="p-6 bg-orange-50 rounded-3xl flex items-center justify-between border border-orange-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-600 shadow-sm">
                      <TableIcon size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Events</p>
                      <motion.p 
                        key={counts.events}
                        initial={{ opacity: 0.5, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-2xl font-black text-orange-900"
                      >
                        {isRefreshing ? '...' : counts.events.toLocaleString()}
                      </motion.p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="lg:col-span-12 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Destination */}
                  <div className="md:col-span-3 space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Database Target</label>
                    <div className="flex gap-2 p-1.5 bg-gray-50 rounded-2xl border border-gray-100 max-w-xl">
                      <button 
                        onClick={() => setTargetCollection('participants')}
                        className={`flex-1 py-3 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${
                          targetCollection === 'participants' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'
                        }`}
                      >
                        Participants
                      </button>
                      <button 
                        onClick={() => setTargetCollection('coordinators')}
                        className={`flex-1 py-3 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${
                          targetCollection === 'coordinators' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'
                        }`}
                      >
                        Coordinators
                      </button>
                      <button 
                        onClick={() => setTargetCollection('events')}
                        className={`flex-1 py-3 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${
                          targetCollection === 'events' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400'
                        }`}
                      >
                        Events
                      </button>
                    </div>
                  </div>

                  {/* File */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Spreadsheet</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="group h-[54px] flex items-center justify-between px-5 bg-blue-50/50 border-2 border-dashed border-blue-200 rounded-2xl cursor-pointer hover:bg-blue-100/50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="text-blue-500" size={18} />
                        <span className="text-[10px] font-black text-blue-900 truncate max-w-[120px] uppercase tracking-widest">
                          {file ? file.name : 'Select File'}
                        </span>
                      </div>
                      <Upload className="text-blue-400" size={16} />
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv, .xlsx, .xls" />
                    </div>
                  </div>

                  {/* Paste */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Paste CSV</label>
                    <div className="relative">
                      <textarea 
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        placeholder="Paste CSV text..."
                        className="w-full h-[54px] px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-[10px] font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none uppercase tracking-widest"
                      />
                      {rawText && (
                        <button 
                          onClick={handlePasteImport}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-all"
                        >
                          <ChevronRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Default Event (Applied if missing in file)</label>
                  <input 
                    type="text"
                    value={eventOverride}
                    onChange={(e) => setEventOverride(e.target.value)}
                    placeholder="e.g. Web Development"
                    className="w-full h-[54px] px-5 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Feedback Panel */}
                <AnimatePresence mode="wait">
                  {isUploading && (
                    <motion.div 
                      key="uploading"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="p-8 bg-gray-900 rounded-[2rem] text-white overflow-hidden shadow-2xl"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                          <h4 className="text-xs font-black uppercase tracking-[0.2em]">Synchronizing Records</h4>
                        </div>
                        <span className="text-xl font-black font-mono">{progressPercent}%</span>
                      </div>
                      
                      <div className="h-4 bg-white/10 rounded-full overflow-hidden mb-4">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          className="h-full bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                        />
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                        Processing {uploadStatus?.success} of {uploadStatus?.total} records...
                      </p>
                    </motion.div>
                  )}

                  {error && (
                    <motion.div 
                      key="error"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="p-6 bg-red-50 border border-red-100 rounded-[2rem] flex items-center gap-4 text-red-600"
                    >
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-500 shadow-sm shrink-0">
                        <AlertCircle size={24} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest mb-1">Import Halted</h4>
                        <p className="text-xs font-medium opacity-80">{error}</p>
                      </div>
                    </motion.div>
                  )}

                  {!isUploading && uploadStatus && !error && (
                    <motion.div 
                      key="success"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="p-8 bg-green-600 rounded-[2.5rem] text-white shadow-2xl shadow-green-500/20 text-center relative overflow-hidden"
                    >
                      {/* Decorative burst */}
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <Sparkles size={48} />
                      </div>
                      
                      <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={40} className="text-white" />
                      </div>
                      <h4 className="text-2xl font-black uppercase tracking-tight mb-2">Sync Operational</h4>
                      <p className="text-green-100 text-sm font-medium mb-4">
                        Successfully integrated {uploadStatus.success} records into the {targetCollection} registry.
                      </p>
                      {lastSyncTime && (
                        <p className="text-[10px] text-green-200 uppercase font-black tracking-widest mb-8">
                          Last Updated: {lastSyncTime.toLocaleTimeString()}
                        </p>
                      )}
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button 
                          onClick={() => { setUploadStatus(null); setData([]); }}
                          className="px-8 py-4 bg-white text-green-700 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-50 transition-all shadow-lg"
                        >
                          Dismiss & Review
                        </button>
                        <button 
                          onClick={fetchCounts}
                          className="px-8 py-4 bg-green-700/50 text-white border border-green-400/30 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                        >
                          <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                          Force Refresh
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Data Preview */}
              {data.length > 0 && !isUploading && !uploadStatus && (
                <div className="lg:col-span-12 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TableIcon size={16} className="text-gray-400" />
                      <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">Staging Area ({data.length} records)</h3>
                    </div>
                    <button 
                      onClick={() => setData([])}
                      className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1 hover:bg-red-50 px-3 py-1 rounded-lg transition-all"
                    >
                      <Trash2 size={12} />
                      Purge
                    </button>
                  </div>
                  
                  <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm bg-gray-50/20">
                    <div className="overflow-x-auto max-h-[300px]">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr>
                            {headers.slice(0, 6).map(header => (
                              <th key={header} className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 whitespace-nowrap">{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.slice(0, 15).map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-100/50 transition-colors">
                              {headers.slice(0, 6).map(header => (
                                <td key={header} className="px-6 py-4 text-[10px] font-bold text-gray-600 border-b border-gray-50 truncate max-w-[150px]">{row[header]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {data.length > 15 && (
                      <div className="p-4 bg-white text-center text-[8px] font-black text-gray-300 uppercase tracking-[0.3em] border-t border-gray-100">
                        + {data.length - 15} more rows in buffer
                      </div>
                    )}
                  </div>

                  <div className="pt-6">
                    <button 
                      onClick={handleImport}
                      disabled={isUploading}
                      className="w-full py-6 bg-gray-900 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-[10px] flex items-center justify-center gap-4 transition-all hover:bg-black active:scale-[0.98] shadow-2xl shadow-gray-900/40"
                    >
                      <Save size={18} />
                      Finalize Database Sync
                    </button>
                  </div>
                </div>
              )}
              
              {/* Recent Activity or Empty State */}
              {!data.length && !isUploading && !uploadStatus && (
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-[3rem] bg-gray-50/20">
                    <div className="w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center shadow-sm mb-6">
                      <Database className="text-gray-100" size={32} />
                    </div>
                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-2">Ready for Ingest</h4>
                    <p className="text-[10px] text-gray-400 max-w-[180px] text-center font-medium leading-relaxed">
                      Import participant lists to enable certificate verification.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <History size={16} className="text-gray-400" />
                        <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Database Verification</h3>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative">
                          <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Enter Roll No..."
                            className="w-40 h-8 px-3 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                          />
                          <button 
                            onClick={handleSearch}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <RefreshCcw size={12} className={isSearching ? 'animate-spin' : ''} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Search Results Highlight */}
                      <AnimatePresence mode="wait">
                        {searchResult && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">System Match Found</p>
                              <button onClick={() => setSearchResult(null)}><X size={12} /></button>
                            </div>
                            {searchResult.length > 0 ? (
                              searchResult.map((r, i) => (
                                <div key={i} className="flex justify-between items-center">
                                  <div>
                                    <p className="font-black text-xs uppercase">{r.name}</p>
                                    <p className="text-[10px] font-medium opacity-80">{r.rollNo} • {r.event}</p>
                                  </div>
                                  <div className="bg-white/20 px-2 py-1 rounded text-[8px] font-black uppercase">{r.role}</div>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs font-bold">No record matching "{searchQuery}"</p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {recentRecords.length > 0 ? (
                        recentRecords.map((record, i) => (
                          <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            key={i} 
                            className="p-4 bg-white border border-gray-100 rounded-2xl flex items-center justify-between group hover:border-blue-200 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                                <Users size={14} />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-gray-900 truncate max-w-[120px]">{record.name}</p>
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{record.rollNo}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest">{record.role}</p>
                              <p className="text-[7px] text-gray-300 font-medium">Added recently</p>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <div className="py-12 border border-gray-50 rounded-3xl text-center">
                          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">No records found</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="p-6 bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Database Connection: Standard
          </div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
            Admin Auth Active
          </p>
        </div>
      </motion.div>
    </div>
  );
}
