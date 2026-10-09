import React from 'react';
import { X, TrendingUp, Home, Wallet, Users, Gift, Settings, Info, Headphones } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { InvestmentProgress } from './InvestmentProgress';
import type { TabKey } from '@/components/BottomNav';

interface SideDrawerProps {
  open: boolean;
  onClose: () => void;
  activeTab: TabKey;
  onNavigate: (t: TabKey) => void;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  open,
  onClose,
  activeTab,
  onNavigate,
}) => {
  const navigate = useNavigate();

  const navItems: { key: TabKey; label: string; icon: any }[] = [
    { key: 'products', label: 'Products', icon: Home },
    { key: 'wallet', label: 'Wallet', icon: Wallet },
    { key: 'team', label: 'Team', icon: Users },
    { key: 'gift', label: 'Redeem Gift', icon: Gift },
  ];

  const handleNavigate = (key: TabKey) => {
    onNavigate(key);
    navigate(`/app/${key}`);
    onClose();
  };

  const handleSupport = () => {
    const api = (window as any).Tawk_API;
    if (api?.maximize) {
      api.maximize();
    } else {
      alert('Support chat is loading. Please try again in a moment.');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-[85%] max-w-sm bg-white border-r border-[#E8EDE8] z-50 transform transition-transform duration-300 flex flex-col ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E8EDE8] bg-gradient-to-br from-[#007A33] to-[#005A26]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center">
              <TrendingUp size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Investment Progress</p>
              <p className="text-[10px] text-white/70">Real-time tracking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#F5F7F5]">
          {/* Quick nav */}
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-wider text-[#4A5A50] font-semibold mb-2 px-1">
              Navigate
            </p>
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleNavigate(item.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                      isActive
                        ? 'bg-[#007A33] text-white shadow-sm'
                        : 'bg-white text-[#4A5A50] border border-[#E8EDE8] hover:bg-[#007A33]/5'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contact Support */}
          <div className="pt-4 mb-4">
            <p className="text-[10px] uppercase tracking-wider text-[#4A5A50] font-semibold mb-2 px-1">
              Need Help?
            </p>
            <button
              onClick={handleSupport}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#007A33] text-white text-sm font-semibold hover:bg-[#005A26] transition-all w-full shadow-sm"
            >
              <Headphones size={16} />
              Contact Support
            </button>
          </div>

          {/* Investment Progress */}
          <div className="pt-4 border-t border-[#E8EDE8]">
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-[10px] uppercase tracking-wider text-[#4A5A50] font-semibold">
                My Investments
              </p>
              <Info size={12} className="text-[#4A5A50]" />
            </div>
            <InvestmentProgress />
          </div>
        </div>
      </aside>
    </>
  );
};