
import React, { useContext, useMemo } from 'react';
import { View, CompanyInfo } from '../types';
import { Home, Package, Truck, Archive, Landmark, ReceiptText, LogOut, ChevronLeft, ChevronRight, Users, Settings } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Logo from './Logo';

interface SidebarProps {
  currentView: View;
  setView: (view: View) => void;
  isSidebarOpen: boolean;
  companyInfo: CompanyInfo;
  viewOrder?: string[];
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, isSidebarOpen, companyInfo, viewOrder, isCollapsed, setIsCollapsed }) => {
  const { currentUser, logout } = useContext(AuthContext);
  const { t, dir } = useLanguage();

  const allNavItems: { view: View; label: string; icon: React.FC<LucideProps>; requiredPermission?: (permissions: typeof currentUser.permissions) => boolean }[] = useMemo(() => [
    { view: 'dashboard', label: t('dashboard'), icon: Home },
    { view: 'orders', label: t('orders'), icon: Package, requiredPermission: p => p.orders.view },
    { view: 'billing', label: t('billing'), icon: ReceiptText, requiredPermission: p => p.billing.view },
    { view: 'delivery', label: t('delivery'), icon: Landmark, requiredPermission: p => p.delivery.view },
    { view: 'storage', label: t('storage'), icon: Archive, requiredPermission: p => p.storage.view },
    { view: 'shipments', label: t('shipments'), icon: Truck, requiredPermission: p => p.shipments.view },
    { view: 'clients', label: t('clients'), icon: Users, requiredPermission: p => p.clients.view },
    { view: 'settings', label: t('settings'), icon: Settings, requiredPermission: p => p.canAccessSettings },
  ], [t]);

  const orderedNavItems = useMemo(() => {
      if (!viewOrder || viewOrder.length === 0) return allNavItems;

      // 1. Items in the viewOrder (filtered to remove clients/settings if present in user prefs, if we want them separate)
      // Actually, let's just respect the order provided
      const ordered = viewOrder
        .map(viewId => allNavItems.find(item => item.view === viewId))
        .filter(Boolean) as typeof allNavItems;
      
      // 2. Items NOT in the viewOrder (append to end)
      const remaining = allNavItems.filter(item => !viewOrder.includes(item.view));
      
      return [...ordered, ...remaining];
  }, [viewOrder, allNavItems]);
  
  const filteredNavItems = orderedNavItems.filter(item => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (!item.requiredPermission) return true;
    return item.requiredPermission(currentUser.permissions);
  });

  const labelVisibilityClass = isCollapsed 
    ? 'opacity-100 w-auto md:opacity-0 md:w-0 md:hidden' 
    : 'opacity-100';

  const logoSizeClass = isCollapsed 
    ? 'h-8' 
    : 'h-10';

  const isRtl = dir === 'rtl';

  return (
    <aside className={`
        fixed inset-y-0 ${isRtl ? 'right-0' : 'left-0'} z-40 
        md:relative md:z-0
        bg-white dark:bg-slate-900 ${isRtl ? 'border-l' : 'border-r'} border-gray-200 dark:border-slate-800 
        flex flex-col 
        transform transition-all duration-300 ease-in-out 
        shadow-2xl md:shadow-none 
        h-full
        ${isSidebarOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full md:translate-x-0' : '-translate-x-full md:translate-x-0')}
        ${isCollapsed ? 'md:w-20' : 'md:w-64'}
        w-[240px] md:flex-shrink-0
    `}>
      
      {/* Branding Area */}
      <div className={`flex items-center justify-center h-20 border-b border-gray-100 dark:border-slate-800 flex-shrink-0 bg-gradient-to-b from-gray-50 to-white dark:from-slate-900 dark:to-slate-900 transition-all duration-300 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        <div className="flex flex-col items-center gap-2 w-full overflow-hidden">
             {companyInfo.logo ? (
                <img src={companyInfo.logo} alt="Company Logo" className={`object-contain max-w-full transition-all duration-300 ${logoSizeClass}`} />
            ) : (
                <div className={`flex items-center gap-2 transition-all duration-300 ${isCollapsed ? 'justify-center' : ''}`}>
                    <Logo className="w-8 h-8 flex-shrink-0" />
                    <span className={`text-lg font-black text-slate-800 dark:text-white tracking-tight whitespace-nowrap transition-opacity duration-200 ${labelVisibilityClass}`}>
                        {companyInfo.name || "Fast Comand"}
                    </span>
                </div>
            )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-2 custom-scrollbar overflow-x-hidden">
        {filteredNavItems.map((item) => {
            const isActive = currentView === item.view;
            return (
                <button
                    key={item.view}
                    onClick={() => setView(item.view)}
                    title={isCollapsed ? item.label : ''}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 font-bold text-sm group relative
                        ${isActive
                            ? 'bg-primary text-white shadow-md shadow-primary/20'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary dark:hover:text-primary-light'
                        }
                        ${isCollapsed ? 'md:justify-center' : ''}
                    `}
                >
                    <item.icon className={`transition-colors flex-shrink-0 ${isActive ? 'text-white' : 'group-hover:text-primary dark:group-hover:text-primary-light'}`} size={20} strokeWidth={isActive ? 2.5 : 2} />
                    <span className={`whitespace-nowrap transition-all duration-200 ${labelVisibilityClass}`}>{item.label}</span>
                    {isActive && !isCollapsed && <div className={`w-1.5 h-1.5 bg-white rounded-full opacity-75 hidden md:block ${isRtl ? 'mr-auto' : 'ml-auto'}`}></div>}
                </button>
            )
        })}
      </nav>

      {/* Collapse Toggle (Desktop Only) */}
      <div className="hidden md:flex justify-center p-2 border-t border-gray-100 dark:border-slate-800">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 hover:text-primary transition-colors"
          >
              {isCollapsed ? (isRtl ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>) : (isRtl ? <ChevronLeft size={18}/> : <ChevronRight size={18}/>)}
          </button>
      </div>

      {/* User Profile / Logout Area */}
      <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900">
        <button 
            onClick={logout}
            title={isCollapsed ? t('logout') : ""}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 group font-bold text-sm ${isCollapsed ? 'md:justify-center' : ''}`}
        >
            <LogOut size={20} className={`transition-transform flex-shrink-0 ${isRtl ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`}/>
            <span className={`whitespace-nowrap transition-all duration-200 ${labelVisibilityClass}`}>{t('logout')}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
