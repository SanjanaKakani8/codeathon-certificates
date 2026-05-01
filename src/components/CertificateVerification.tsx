import { useState, FormEvent, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Download, AlertCircle, Users, User, Trophy, Award, Star, ArrowRight, ArrowLeft, ListChecks } from 'lucide-react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

type UserType = 'Participant' | 'Coordinator' | null;
type ParticipantRole = 'Winner' | 'Runner up' | 'Participant' | null;

export default function CertificateVerification() {
  const [events, setEvents] = useState<string[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const q = query(collection(db, 'events'), orderBy('name'));
        const snapshot = await getDocs(q);
        const eventList = snapshot.docs.map(doc => doc.data().name as string);
        if (eventList.length > 0) {
          setEvents(eventList);
        } else {
          // Fallback if DB is empty
          setEvents(['Web Development', 'Crack the Code', 'Hackathon', 'Circuitron', 'Tech Quiz', 'Presentation']);
        }
      } catch (err) {
        console.error('Error fetching events:', err);
        try {
          handleFirestoreError(err, OperationType.LIST, 'events');
        } catch (e) {
          // Internal logging done
        }
        setEvents(['Web Development', 'Crack the Code', 'Hackathon', 'Circuitron', 'Tech Quiz', 'Presentation']);
      } finally {
        setIsLoadingEvents(false);
      }
    };
    fetchEvents();
  }, []);

  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState<UserType>(null);
  const [participantRole, setParticipantRole] = useState<ParticipantRole>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    rollNo: '',
  });
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<'success' | 'not-found' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifiedData, setVerifiedData] = useState<any>(null);
  const certificateRef = useRef<HTMLDivElement>(null);

  const resetForm = () => {
    setStep(1);
    setUserType(null);
    setParticipantRole(null);
    setSelectedEvent(null);
    setFormData({ name: '', email: '', rollNo: '' });
    setResult(null);
    setError(null);
    setVerifiedData(null);
  };

  const handleNext = () => {
    if (step === 1) {
      if (userType === 'Coordinator') {
        setStep(2); // Coordinator goes to final details (step 2/2)
      } else if (userType === 'Participant') {
        setStep(2); // Participant goes to role selection (step 2/4)
      }
    } else if (step === 2 && userType === 'Participant' && participantRole) {
      setStep(3); // Participant goes to event selection (step 3/4)
    } else if (step === 3 && selectedEvent) {
      setStep(4); // Participant goes to final details (step 4/4)
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setResult(null);
    }
  };

  const handleDownload = async () => {
    if (!certificateRef.current) return;
    
    setIsVerifying(true); // Reuse state for loading
    try {
      // Use higher scale for better PDF quality
      const canvas = await html2canvas(certificateRef.current, {
        scale: 3, 
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 1000, // Fixed width for consistent output
        height: 700,
        onclone: (clonedDoc) => {
          const certificateEl = clonedDoc.getElementById('certificate-to-capture');
          
          if (certificateEl instanceof HTMLElement) {
            certificateEl.style.boxShadow = 'none';
            
            // Aggressively remove Tailwind classes that might resolve to oklch from children
            const allElements = certificateEl.getElementsByTagName('*');
            for (let i = 0; i < allElements.length; i++) {
              const element = allElements[i] as HTMLElement;
              
              // Filter out oklch-prone classes
              const classesToRemove: string[] = [];
              element.classList.forEach(cls => {
                if (/^(bg|text|border|ring|shadow|outline)-(blue|gray|slate|indigo|orange|yellow|red|green|sky|violet|fuchsia|pink|rose|emerald|cyan|amber|lime|teal|neutral|zinc|stone)-[0-9]+(\/[0-9]+)?$/.test(cls)) {
                  classesToRemove.push(cls);
                }
              });
              
              classesToRemove.forEach(cls => element.classList.remove(cls));
            }
            
            // Final safety: remove all style tags that might have oklch
            // since we have inline styles on our certificate elements
            const styleTags = clonedDoc.getElementsByTagName('style');
            for (let i = styleTags.length - 1; i >= 0; i--) {
              if (styleTags[i].innerHTML.includes('oklch')) {
                styleTags[i].remove();
              }
            }
            
            const linkTags = clonedDoc.getElementsByTagName('link');
            for (let i = linkTags.length - 1; i >= 0; i--) {
              if (linkTags[i].rel === 'stylesheet') {
                linkTags[i].remove();
              }
            }
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [1000, 700],
        hotfixes: ['px_scaling']
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, 1000, 700);
      pdf.save(`Certificate-${formData.name.replace(/\s+/g, '-')}.pdf`);
    } catch (err) {
      console.error('Download failed:', err);
      // Detailed error logging for debugging
      if (err instanceof Error) {
        console.error('Error message:', err.message);
      }
      alert('Failed to generate PDF. This often happens due to unsupported browser modern CSS features. Try using a different browser if the error persists.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setResult(null);

    const path = userType === 'Coordinator' ? 'coordinators' : 'participants';
    
    try {
      let constraints: any[] = [
        where('rollNo', '==', formData.rollNo.trim().toUpperCase()),
      ];

      // Both types require name check
      if (formData.name) {
        constraints.push(where('name', '==', formData.name.trim()));
      }

      // ONLY Participants require event check
      if (userType === 'Participant') {
        if (selectedEvent) {
          constraints.push(where('event', '==', selectedEvent));
        } else {
          setError('Please select an event');
          setIsVerifying(false);
          return;
        }
      }

      const q = query(
        collection(db, path),
        ...constraints,
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docData = querySnapshot.docs[0].data();
        setVerifiedData(docData);
        // Sync the participant role from DB to show the correct certificate
        if (userType === 'Participant' && docData.role) {
          setParticipantRole(docData.role as ParticipantRole);
        }
        setResult('success');
      } else {
        setResult('not-found');
      }
    } catch (err) {
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.LIST, userType === 'Coordinator' ? 'coordinators' : 'participants');
      } catch (e) {
        // Logged
      }
      setResult('error');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <section className="py-32 bg-slate-50 relative overflow-hidden" id="verification">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden opacity-40">
        <motion.div 
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-24 -left-24 w-96 h-96 bg-blue-100 rounded-full blur-3xl" 
        />
        <motion.div 
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -40, 0],
            y: [0, 60, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
          className="absolute top-1/2 -right-48 w-80 h-80 bg-indigo-100 rounded-full blur-3xl" 
        />
        <motion.div 
          animate={{
            scale: [1, 1.1, 1],
            x: [0, 30, 0],
            y: [0, -40, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          className="absolute bottom-0 left-1/4 w-64 h-64 bg-orange-50 rounded-full blur-3xl" 
        />
      </div>

      <div className="container mx-auto px-6 max-w-2xl relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-6xl font-serif font-black text-gray-900 mb-4 tracking-tight">Generate <span className="text-blue-600">Certificate</span></h2>
          <p className="text-gray-600 text-sm leading-relaxed max-w-xl mx-auto">
            Complete the steps below to verify your participation and download your official Codeathon 2k26 certificate.
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] p-8 md:p-12 border border-white shadow-2xl shadow-blue-500/5 transition-all duration-300">
          <AnimatePresence mode="wait">
            {/* Step 1: Identify */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center mb-8">
                  <span className="inline-block px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-[0.3em] rounded-full mb-4">Step 01/04</span>
                  <h3 className="text-2xl font-black text-gray-900">Choose one</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => setUserType('Participant')}
                    className={`p-8 rounded-3xl border-2 transition-all group flex flex-col items-center gap-4 ${
                      userType === 'Participant'
                        ? 'border-blue-600 bg-blue-50 shadow-xl shadow-blue-500/10'
                        : 'border-gray-100 bg-white hover:border-blue-200'
                    }`}
                  >
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                      userType === 'Participant' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500'
                    }`}>
                      <Users size={32} />
                    </div>
                    <div className="text-center">
                      <span className={`block font-black text-lg transition-colors ${userType === 'Participant' ? 'text-blue-900' : 'text-gray-600'}`}>Participant</span>
                      <span className="text-xs text-gray-400 font-medium">Winner, Runner up, or Attendee</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setUserType('Coordinator')}
                    className={`p-8 rounded-3xl border-2 transition-all group flex flex-col items-center gap-4 ${
                      userType === 'Coordinator'
                        ? 'border-indigo-600 bg-indigo-50 shadow-xl shadow-indigo-500/10'
                        : 'border-gray-100 bg-white hover:border-indigo-200'
                    }`}
                  >
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                      userType === 'Coordinator' ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
                    }`}>
                      <User size={32} />
                    </div>
                    <div className="text-center">
                      <span className={`block font-black text-lg transition-colors ${userType === 'Coordinator' ? 'text-indigo-900' : 'text-gray-600'}`}>Coordinator</span>
                      <span className="text-xs text-gray-400 font-medium">Student Event Coordinator</span>
                    </div>
                  </button>
                </div>

                <button
                  disabled={!userType}
                  onClick={handleNext}
                  className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all enabled:hover:bg-black enabled:active:scale-[0.98] disabled:opacity-30"
                >
                  Next Step
                  <ArrowRight size={16} />
                </button>
              </motion.div>
            )}

            {/* Step 2: Participant Role Selection */}
            {step === 2 && userType === 'Participant' && (
              <motion.div
                key="step2p"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center mb-8">
                  <span className="inline-block px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-[0.3em] rounded-full mb-4">Step 02/04</span>
                  <h3 className="text-2xl font-black text-gray-900">Choose your role</h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {[
                    { id: 'Winner', icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-50' },
                    { id: 'Runner up', icon: Award, color: 'text-slate-400', bg: 'bg-slate-50' },
                    { id: 'Participant', icon: Star, color: 'text-blue-500', bg: 'bg-blue-50' }
                  ].map((r) => {
                    const Icon = r.icon;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setParticipantRole(r.id as ParticipantRole)}
                        className={`p-6 rounded-2xl border-2 transition-all flex items-center gap-6 text-left ${
                          participantRole === r.id
                            ? 'border-blue-600 bg-blue-50 shadow-lg'
                            : 'border-gray-100 bg-white hover:border-blue-200'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${r.bg} ${r.color}`}>
                          <Icon size={24} />
                        </div>
                        <div>
                          <span className={`block font-black text-lg ${participantRole === r.id ? 'text-blue-900' : 'text-gray-900'}`}>{r.id}</span>
                          <span className="text-xs text-gray-400">Position achieved in the event</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    onClick={handleBack}
                    className="flex-1 py-5 border-2 border-gray-100 text-gray-400 rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all hover:bg-gray-50 active:scale-[0.98]"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                  <button
                    disabled={!participantRole}
                    onClick={handleNext}
                    className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all enabled:hover:bg-blue-700 enabled:active:scale-[0.98] disabled:opacity-30"
                  >
                    Next Step
                    <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Event Selection */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center mb-8">
                  <span className="inline-block px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-[0.3em] rounded-full mb-4">Step 03/04</span>
                  <h3 className="text-2xl font-black text-gray-900">Select Event</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {isLoadingEvents ? (
                    <div className="col-span-2 py-8 text-center text-gray-400 animate-pulse font-bold uppercase tracking-widest text-xs">Loading Events...</div>
                  ) : (
                    events.map((evt) => (
                      <button
                        key={evt}
                        onClick={() => setSelectedEvent(evt)}
                        className={`p-4 rounded-xl border-2 transition-all font-bold text-sm tracking-tight text-left flex items-center gap-3 ${
                          selectedEvent === evt
                            ? 'border-blue-600 bg-blue-600 text-white shadow-lg'
                            : 'border-gray-50 bg-gray-50/50 text-gray-600 hover:border-blue-200'
                        }`}
                      >
                        <ListChecks size={18} className={selectedEvent === evt ? 'text-blue-200' : 'text-gray-300'} />
                        {evt}
                      </button>
                    ))
                  )}
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    onClick={handleBack}
                    className="flex-1 py-5 border-2 border-gray-100 text-gray-400 rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all hover:bg-gray-50 active:scale-[0.98]"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                  <button
                    disabled={!selectedEvent}
                    onClick={handleNext}
                    className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all enabled:hover:bg-blue-700 enabled:active:scale-[0.98] disabled:opacity-30"
                  >
                    Next Step
                    <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2/4: Final Details Form (Coordinator) or Step 4 (Participant) */}
            {((step === 2 && userType === 'Coordinator') || (step === 4 && userType === 'Participant')) && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {!result ? (
                  <>
                    <div className="text-center mb-8">
                      <span className="inline-block px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-[0.3em] rounded-full mb-4">
                        Step {userType === 'Coordinator' ? '02/02' : '04/04'}
                      </span>
                      <h3 className="text-2xl font-black text-gray-900">Verify Details</h3>
                      {userType === 'Participant' && (
                        <p className="text-xs text-gray-400 mt-2 font-medium">
                          {participantRole} / {selectedEvent}
                        </p>
                      )}
                    </div>

                    <form onSubmit={handleVerify} className="space-y-4">
                      <div className="space-y-4">
                        <input
                          type="text"
                          required
                          placeholder="Full Name"
                          className="w-full bg-gray-50/50 border border-gray-100 p-5 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all rounded-2xl shadow-sm focus:scale-[1.01] hover:bg-white"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                        <input
                          type="email"
                          required
                          placeholder="Email Address"
                          className="w-full bg-gray-50/50 border border-gray-100 p-5 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all rounded-2xl shadow-sm focus:scale-[1.01] hover:bg-white"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                        <input
                          type="text"
                          required
                          placeholder="Roll Number"
                          className="w-full bg-gray-50/50 border border-gray-100 p-5 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all rounded-2xl shadow-sm focus:scale-[1.01] hover:bg-white"
                          value={formData.rollNo}
                          onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                        />
                      </div>

                      <AnimatePresence>
                        {error && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold flex items-center gap-2"
                          >
                            <AlertCircle size={16} />
                            {error}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      <div className="flex gap-4 pt-4">
                        <button
                          type="button"
                          onClick={handleBack}
                          className="flex-1 py-5 border-2 border-gray-100 text-gray-400 rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all hover:bg-gray-50 active:scale-[0.98]"
                        >
                          <ArrowLeft size={16} />
                        </button>
                        <button
                          type="submit"
                          disabled={isVerifying}
                          className="flex-[4] py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-blue-500/25 active:scale-[0.98] disabled:opacity-30"
                        >
                          {isVerifying ? 'Processing...' : 'GENERATE CERTIFICATE'}
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    {result === 'success' ? (
                      <div className="space-y-8">
                        {/* Certificate Wrapper for proper scaling on mobile */}
                        <div className="w-full overflow-x-auto pb-6 custom-scrollbar">
                          <div className="min-w-[1050px] flex justify-center p-4">
                            <div 
                              id="certificate-to-capture"
                              ref={certificateRef}
                              style={{ backgroundColor: '#ffffff', boxShadow: 'none' }}
                              className="relative w-[1000px] h-[700px] overflow-hidden"
                            >
                              <div className="text-center p-20 py-32" style={{ backgroundColor: '#ffffff' }}>
                                <motion.div
                                  initial={{ scale: 0.9, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                                  className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8"
                                >
                                  <Award size={48} strokeWidth={1.5} />
                                </motion.div>
                                <h4 style={{ color: '#111827' }} className="text-4xl font-serif font-black mb-4 tracking-tight">Insert Certificate Template</h4>
                                <p style={{ color: '#6b7280' }} className="text-lg max-w-md mx-auto leading-relaxed">
                                  The previous templates have been removed. You can now add your custom design here.
                                </p>
                                <div style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }} className="mt-12 p-6 rounded-2xl border text-left mx-auto max-w-sm">
                                  <p style={{ color: '#94a3b8' }} className="text-[10px] font-black uppercase tracking-widest mb-2">Available Props:</p>
                                  <code style={{ color: '#2563eb' }} className="text-[11px] font-mono block space-y-1">
                                    <div>• Name: {formData.name}</div>
                                    <div>• Email: {formData.email}</div>
                                    <div>• Roll: {formData.rollNo}</div>
                                    <div>• Type: {userType}</div>
                                    {userType === 'Participant' && (
                                      <>
                                        <div>• Event: {selectedEvent}</div>
                                        <div>• Role: {participantRole}</div>
                                      </>
                                    )}
                                  </code>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-8 flex flex-col items-center">
                          <button 
                            onClick={handleDownload}
                            style={{ backgroundColor: '#2563eb' }}
                            className="group relative px-12 py-5 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-2xl hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-4 overflow-hidden"
                          >
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            <Download size={20} className="relative z-10" />
                            <span className="relative z-10">Download Certificate</span>
                          </button>
                          
                          <button 
                            onClick={resetForm}
                            className="mt-6 text-gray-400 font-bold uppercase tracking-widest text-[10px] hover:text-blue-600 transition-colors flex items-center gap-2"
                          >
                            <ListChecks size={14} />
                            Generate Another Certificate
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                          <AlertCircle size={48} strokeWidth={1.5} />
                        </div>
                        <div>
                          <h4 className="text-3xl font-black text-gray-900 mb-2">Not Found</h4>
                          <p className="text-gray-500 text-sm">We couldn't find a record with these details.</p>
                        </div>
                        <button 
                          onClick={() => setResult(null)}
                          className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs"
                        >
                          Try Again
                        </button>
                        <button 
                          onClick={resetForm}
                          className="block mx-auto text-gray-400 font-bold uppercase tracking-widest text-[10px] hover:text-blue-600 transition-colors"
                        >
                          Back to Start
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-3 mt-12">
          {[1, 2, 3, 4].map((s) => {
            const isActive = s === step;
            const isCompleted = s < step;
            // For Coordinator, max steps is 2, but we show 4 dots? Let's just adjust dots logic
            if (userType === 'Coordinator' && s > 2) return null;
            
            return (
              <div 
                key={s}
                className={`h-1.5 transition-all duration-500 rounded-full ${
                  isActive ? 'w-8 bg-blue-600' : isCompleted ? 'w-4 bg-blue-200' : 'w-4 bg-gray-200'
                }`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
