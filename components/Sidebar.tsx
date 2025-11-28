import React from 'react';
import { Users, Share2, Sparkles, Tag, Database, Trash2 } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'graph', label: 'Network Graph', icon: Share2 },
    { id: 'suggestions', label: 'Smart AI', icon: Sparkles },
    { id: 'tags', label: 'Tags', icon: Tag },
    { id: 'import', label: 'Import', icon: Database },
  ];

  return (
    <div className="w-20 md:w-64 bg-slate-900 h-full flex flex-col text-slate-300 shrink-0 transition-all duration-300">
      <div className="p-6 flex items-center justify-center md:justify-start gap-3">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div>
        <span className="text-xl font-bold text-white hidden md:block">Interlinked</span>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === item.id 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={20} />
            <span className="hidden md:block font-medium">{item.label}</span>
          </button>
        ))}

        <div className="border-t border-slate-800 my-2 pt-2">
            <button
                onClick={() => setActiveTab('trash')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'trash' 
                    ? 'bg-red-900/50 text-red-200' 
                    : 'hover:bg-slate-800 hover:text-white'
                }`}
            >
                <Trash2 size={20} />
                <span className="hidden md:block font-medium">Trash</span>
            </button>
        </div>
      </nav>
    </div>
  );
};