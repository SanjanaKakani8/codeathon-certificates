import { motion } from 'motion/react';

export default function Hero() {
  return (
    <section className="pt-48 pb-24 bg-gradient-to-br from-blue-50 via-white to-orange-50/30" id="home">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="flex-1"
          >
            <h1 className="text-7xl md:text-9xl font-serif font-black text-[#1a1a1a] tracking-tight leading-[0.8] mb-12">
              Codeathon <br />
              <span className="lg:ml-24 text-blue-600 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">2k26</span>
            </h1>
            
            <p className="text-lg text-gray-800 max-w-2xl leading-relaxed mb-10 text-balance border-l-4 border-blue-500 pl-6">
              An exciting and vibrant two-day event, hosted by Department of ECE at Annamacharya Institute of Technology & Sciences (AITS), Tirupati, on 24th and 25th March 2026. The event was meticulously organised to provide a platform for students to demonstrate their technical expertise, creativity, and leadership abilities in a competitive yet friendly environment.
            </p>

            <a 
              href="#verification"
              className="inline-block px-10 py-4 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 transition-all duration-300 transform hover:-translate-y-1 shadow-xl shadow-blue-500/20"
            >
              Download Certificate
            </a>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="flex-1 w-full"
          >
            <div className="w-full aspect-[4/3] lg:aspect-square overflow-hidden rounded-sm shadow-2xl shadow-black/10">
              <img 
                src="https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&q=80&w=2070" 
                alt="Codeathon"
                className="w-full h-full object-cover grayscale-[0.2] hover:grayscale-0 transition-all duration-700"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
