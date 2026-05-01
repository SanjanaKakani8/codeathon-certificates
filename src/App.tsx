/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import Hero from './components/Hero';
import Events from './components/Events';
import CertificateVerification from './components/CertificateVerification';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  return (
    <main className="bg-white min-h-screen text-gray-900 font-sans selection:bg-blue-100">
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex justify-center items-center bg-white/90 backdrop-blur-md border-b border-gray-100 md:px-12">
        <div className="flex gap-12 text-sm font-medium text-gray-600">
          <a href="#home" className="hover:text-blue-600 transition-colors uppercase tracking-widest text-[11px] font-bold">Home</a>
          <a href="#events" className="hover:text-blue-600 transition-colors uppercase tracking-widest text-[11px] font-bold">Events</a>
          <a href="#verification" className="hover:text-blue-600 transition-colors uppercase tracking-widest text-[11px] font-bold">Download</a>
        </div>
      </nav>
      
      <Hero />
      <Events />
      <CertificateVerification />
      
      {isAdminOpen && <AdminDashboard onClose={() => setIsAdminOpen(false)} />}
      
      <footer className="py-24 bg-gray-900 text-white">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gray-800/50 p-8 rounded-2xl border border-gray-700 shadow-xl">
              <h5 className="text-blue-400 font-black mb-4 text-xl uppercase tracking-widest">Dates</h5>
              <p className="text-gray-300 text-lg font-medium">March 24–25, 2026</p>
            </div>
            
            <div className="bg-gray-800/50 p-8 rounded-2xl border border-gray-700 shadow-xl">
              <h5 className="text-orange-400 font-black mb-4 text-xl uppercase tracking-widest">Venue</h5>
              <p className="text-gray-300 text-lg font-medium text-balance">Annamacharya Institute of Technology & Sciences (AITS), Tirupati</p>
            </div>
            
            <div className="bg-gray-800/50 p-8 rounded-2xl border border-gray-700 shadow-xl">
              <h5 className="text-green-400 font-black mb-4 text-xl uppercase tracking-widest">Email Us</h5>
              <p className="text-gray-300 text-lg font-medium">codeathon2k26@gmail.com</p>
            </div>
            
            <div className="bg-gray-800/50 p-8 rounded-2xl border border-gray-700 shadow-xl">
              <h5 className="text-purple-400 font-black mb-4 text-xl uppercase tracking-widest">Help & Support</h5>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-gray-300 text-lg">
                  <span className="font-medium">K. Sanjana</span>
                  <span className="font-mono text-gray-400 bg-gray-900 px-3 py-1 rounded-md text-sm">7674009754</span>
                </div>
                <div className="flex justify-between items-center text-gray-300 text-lg">
                  <span className="font-medium">S.C. Haneesh</span>
                  <span className="font-mono text-gray-400 bg-gray-900 px-3 py-1 rounded-md text-sm">7702595719</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-24 pt-12 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-gray-500 text-sm">© 2026 Codeathon AITS Tirupati. All rights reserved.</p>
            <button 
              onClick={() => setIsAdminOpen(true)}
              className="text-gray-600 hover:text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2"
            >
              <div className="w-1 h-1 bg-gray-700 rounded-full" />
              Admin Portal
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
