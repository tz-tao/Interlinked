import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { Filter, User, Trash2, Check, X } from 'lucide-react';

interface ContactListProps {
  onSelectContact: (id: string) => void;
}

export const ContactList: React.FC<ContactListProps> = ({ onSelectContact }) => {
  const { contacts, deleteContact } = useCRM();
  const [filter, setFilter] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filtered = contacts.filter(c => {
    const term = filter.toLowerCase();
    return c.name.toLowerCase().includes(term) || 
           c.company.toLowerCase().includes(term) ||
           c.role.toLowerCase().includes(term) ||
           (c.industry && c.industry.toLowerCase().includes(term)) ||
           c.tags.some(t => t.toLowerCase().includes(term));
  });

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      setDeleteConfirmId(id);
      // Auto cancel after 3s
      setTimeout(() => {
          setDeleteConfirmId(prev => prev === id ? null : prev);
      }, 3000);
  };

  const handleConfirmDelete = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      deleteContact(id);
      setDeleteConfirmId(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDeleteConfirmId(null);
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Contacts</h2>
        <div className="relative">
          <input 
            type="text"
            placeholder="Filter people, companies, roles..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Filter className="absolute left-3 top-2.5 text-slate-400" size={16} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
           <div className="p-8 text-center text-slate-400 text-sm">No contacts found.</div> 
        ) : (
            filtered.map(contact => (
            <div 
                key={contact.id}
                onClick={() => onSelectContact(contact.id)}
                className="flex items-center gap-3 p-4 hover:bg-slate-50 cursor-pointer border-b border-slate-100 transition-colors group relative"
            >
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
                    {contact.avatarUrl ? (
                        <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" />
                    ) : (
                        <User size={20} className="text-indigo-600" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">{contact.name}</h3>
                    <p className="text-xs text-slate-500 truncate">{contact.role} {contact.company && `@ ${contact.company}`}</p>
                    {contact.industry && <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">{contact.industry}</p>}
                </div>
                
                {/* Delete Shortcut */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                    {deleteConfirmId === contact.id ? (
                        <div className="flex bg-red-100 rounded-full p-1 animate-in fade-in slide-in-from-right-4">
                            <button 
                                onClick={(e) => handleConfirmDelete(e, contact.id)}
                                className="p-1.5 text-red-600 hover:bg-red-200 rounded-full"
                                title="Confirm"
                            >
                                <Check size={14} />
                            </button>
                            <button 
                                onClick={handleCancelDelete}
                                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full"
                                title="Cancel"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <button 
                            type="button"
                            onClick={(e) => handleDeleteClick(e, contact.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                            title="Move to Trash"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>
            ))
        )}
      </div>
    </div>
  );
};