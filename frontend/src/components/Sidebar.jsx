import { Home, Heart, Mail } from 'lucide-react';

const NAV = [
  { icon: Home,  label: 'Home',      active: true  },
  { icon: Heart, label: 'Liked',     active: false },
  { icon: Mail,  label: 'Messages',  active: false },
];

export default function Sidebar() {
  return (
    <>
      {/* Logo */}
      <span className="font-pixel text-2xl leading-none select-none">G</span>

      {/* Nav icons */}
      <div className="flex flex-col items-center gap-7 mt-4">
        {NAV.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            title={label}
            className={`transition-transform hover:scale-110 ${active ? 'text-black' : 'text-gray-400 hover:text-black'}`}
          >
            <Icon fill={active ? 'currentColor' : 'none'} size={26} strokeWidth={1.8} />
          </button>
        ))}
      </div>
    </>
  );
}
