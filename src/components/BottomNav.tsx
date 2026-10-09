import { Package, Wallet, Gift, Users } from 'lucide-react';

export type TabKey = 'products' | 'wallet' | 'team' | 'gift';

const tabs: { key: TabKey; label: string; icon: any }[] = [
  { key: 'products', label: 'Invest', icon: Package },
  { key: 'gift', label: 'Gift', icon: Gift },
  { key: 'wallet', label: 'Wallet', icon: Wallet },
  { key: 'team', label: 'Team', icon: Users },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-[#E8EDE8] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="max-w-md mx-auto grid grid-cols-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`flex flex-col items-center justify-center gap-1 py-3 transition-all relative ${
                isActive ? 'text-[#007A33]' : 'text-[#4A5A50] hover:text-[#007A33]'
              }`}
            >
              {tab.key === 'gift' && (
                <span className="absolute top-2 right-1/4 w-1.5 h-1.5 rounded-full bg-[#00A04A] animate-pulse" />
              )}
              <Icon size={20} />
              <span className="text-[10px] font-semibold">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#007A33]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}