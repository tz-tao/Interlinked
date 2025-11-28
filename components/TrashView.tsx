import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { Trash2, RefreshCw, AlertTriangle, User, Check, X } from 'lucide-react';

export const TrashView: React.FC = () => {
  const { deletedContacts, restoreContact, permanentlyDeleteContact } = useCRM();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const getDaysRemaining = (deletedAt?: string) => {
    if (!deletedAt) return 30;
    const deletedDate = new Date(deletedAt);
    const expirationDate = new Date(deletedDate);
    expirationDate.setDate(deletedDate.getDate() + 30);
    
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const handlePermanentDelete = (id: string) => {
      permanentlyDeleteContact(id);
      setConfirmId(null);
  };

  return (
    <div className="h-full bg-slate-50 p-8 flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Trash2 className="text-red-500" /> Recently Deleted
        </h2>
        <p className="text-sm text-slate-500 mt-1">
            Contacts are stored here for 30 days before being permanently removed.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {deletedContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                <Trash2 size={48} className="mb-4 opacity-20" />
                <p>Trash is empty.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 gap-4">
                {deletedContacts.map(contact => (
                    <div key={contact.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center grayscale opacity-70">
                                {contact.avatarUrl ? <img src={contact.avatarUrl} alt="" className="w-full h-full rounded-full object-cover"/> : <User size={20}/>}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-700 line-through decoration-slate-400">{contact.name}</h3>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded flex items-center gap-1">
                                        <AlertTriangle size={10} />
                                        {getDaysRemaining(contact.deletedAt)} days remaining
                                    </span>
                                    <span className="text-slate-400">
                                        Deleted on {new Date(contact.deletedAt!).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <button 
                                onClick={() => restoreContact(contact.id)}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors text-sm font-medium"
                            >
                                <RefreshCw size={16} /> Restore
                            </button>
                            
                            {confirmId === contact.id ? (
                                <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2">
                                    <button 
                                        onClick={() => handlePermanentDelete(contact.id)}
                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
                                    >
                                        <Check size={16} /> Confirm
                                    </button>
                                    <button 
                                        onClick={() => setConfirmId(null)}
                                        className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setConfirmId(contact.id)}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-transparent rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                                >
                                    <Trash2 size={16} /> Delete Forever
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};