import { motion } from 'motion/react';
import { Braces, Boxes } from 'lucide-react';

const eventCategories = [
  {
    title: 'Development Events',
    icon: Braces,
    items: ['Web Development', 'Crack the Code', 'Hackathon'],
    color: 'blue'
  },
  {
    title: 'Competitive Events',
    icon: Boxes,
    items: ['Circuitron', 'Tech Quiz', 'Presentation'],
    color: 'orange'
  }
];

export default function Events() {
  return (
    <section className="py-32 bg-gray-50" id="events">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {eventCategories.map((category, index) => (
            <motion.div
              key={category.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2 }}
              viewport={{ once: true }}
              className={`p-12 md:p-16 rounded-3xl shadow-xl shadow-black/5 border flex flex-col items-center text-center transition-all duration-500 hover:scale-[1.02] ${
                category.color === 'blue' 
                  ? 'bg-blue-50/50 border-blue-100 hover:shadow-blue-200/40' 
                  : 'bg-orange-50/50 border-orange-100 hover:shadow-orange-200/40'
              }`}
            >
              <div className={`w-24 h-24 rounded-2xl flex items-center justify-center mb-10 border shadow-inner ${
                category.color === 'blue'
                  ? 'bg-blue-600 border-blue-400 text-white'
                  : 'bg-orange-500 border-orange-400 text-white'
              }`}>
                <category.icon size={48} strokeWidth={1} />
              </div>
              <h4 className={`text-4xl font-serif font-black mb-8 tracking-tight ${
                category.color === 'blue' ? 'text-blue-900' : 'text-orange-900'
              }`}>
                {category.title}
              </h4>
              <ul className="space-y-5">
                {category.items.map((item) => (
                  <li key={item} className="flex items-center justify-center gap-3 text-xl text-gray-700 font-semibold group">
                    <span className={`w-2.5 h-2.5 rounded-full transition-opacity group-hover:opacity-100 opacity-60 ${
                      category.color === 'blue' ? 'bg-blue-500' : 'bg-orange-500'
                    }`} />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
