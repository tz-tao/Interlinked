import React, { useState, useEffect, useRef } from 'react';
import { useCRM } from '../context/CRMContext';
import { Contact, Tag } from '../types';
import { Mail, MapPin, Briefcase, Calendar, X, Edit2, Tag as TagIcon, Factory, Trash2, AlertTriangle, Phone, Search } from 'lucide-react';

interface ContactDetailProps {
  contactId: string | null;
  onClose: () => void;
}

export const ContactDetail: React.FC<ContactDetailProps> = ({ contactId, onClose }) => {
  const { contacts, updateContact, deleteContact, tags, addTag } = useCRM();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Contact>>({});
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  
  // Tag Search State
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

  const contact = contacts.find(c => c.id === contactId);

  // Auto-close if contact ceases to exist (e.g. deleted)
  useEffect(() => {
      if (!contact && contactId) {
          onClose();
      }
  }, [contact, contactId, onClose]);

  useEffect(() => {
    if (contact) {
        setEditForm(contact);
        setIsEditing(false);
        setIsConfirmingDelete(false);
        setIsAddingTag(false);
        setTagSearch('');
    }
  }, [contact]);

  useEffect(() => {
      if (isAddingTag && tagInputRef.current) {
          tagInputRef.current.focus();
      }
  }, [isAddingTag]);

  if (!contact) return (
      <div className="flex-1 flex items-center justify-center text-slate-400 bg-white h-full">
          Select a contact to view details
      </div>
  );

  const handleSave = () => {
    if (contactId) {
        updateContact(contactId, editForm);
        setIsEditing(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!contactId) return;

      if (isConfirmingDelete) {
          deleteContact(contactId);
          onClose(); // Force close immediately
      } else {
          setIsConfirmingDelete(true);
          // Auto-reset after 3 seconds if not confirmed
          setTimeout(() => setIsConfirmingDelete(false), 3000);
      }
  };

  const toggleTag = (tagName: string) => {
      if (!contactId) return;
      const currentTags = contact.tags || [];
      const newTags = currentTags.includes(tagName) 
        ? currentTags.filter(t => t !== tagName)
        : [...currentTags, tagName];
      updateContact(contactId, { tags: newTags });
  };

  const handleAddTagSelect = (tagName: string) => {
      toggleTag(tagName);
      setTagSearch('');
      setIsAddingTag(false);
  };

  // Filter unwanted system tags from display
  const visibleTags = (contact.tags || []).filter(t => 
      !t.startsWith('Imported on') && t !== 'myContacts'
  );

  const availableTags = tags.filter(t => 
      t.name.toLowerCase().includes(tagSearch.toLowerCase()) && 
      !contact.tags.includes(t.name)
  );

  return (
    <div className="flex-1 h-full overflow-y-auto bg-white p-6 relative">
      <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-500 md:hidden">
        <X size={20} />
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 mb-8 items-start">
         <div className="w-24 h-24 rounded-2xl bg-slate-200 overflow-hidden shadow-sm shrink-0">
             <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" />
         </div>
         <div className="flex-1 w-full">
             <div className="flex justify-between items-start">
                {isEditing ? (
                    <input 
                        className="text-2xl font-bold text-slate-900 border-b border-indigo-300 focus:outline-none w-full" 
                        value={editForm.name} 
                        onChange={e => setEditForm({...editForm, name: e.target.value})}
                    />
                ) : (
                    <h1 className="text-2xl font-bold text-slate-900">{contact.name}</h1>
                )}
                <div className="flex gap-2">
                    <button 
                        type="button"
                        onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                        className="text-indigo-600 text-sm font-medium hover:text-indigo-800 p-2 hover:bg-indigo-50 rounded transition-colors"
                        title={isEditing ? "Save" : "Edit"}
                    >
                        {isEditing ? "Save" : <Edit2 size={16} />}
                    </button>
                    {!isEditing && (
                        <button 
                            type="button"
                            onClick={handleDeleteClick}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                                isConfirmingDelete 
                                ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' 
                                : 'text-red-600 hover:bg-red-50 border-transparent hover:border-red-100'
                            }`}
                            title="Delete Contact"
                        >
                            {isConfirmingDelete ? <AlertTriangle size={16} /> : <Trash2 size={16} />}
                            {isConfirmingDelete ? "Confirm Delete?" : "Delete"}
                        </button>
                    )}
                </div>
             </div>
             
             <div className="mt-2 space-y-2 text-slate-600">
                <div className="flex items-center gap-2">
                    <Briefcase size={16} className="text-slate-400" />
                    {isEditing ? (
                        <div className="flex gap-2 w-full">
                            <input 
                                className="border rounded px-2 py-1 text-sm w-1/2" 
                                value={editForm.role} 
                                onChange={e => setEditForm({...editForm, role: e.target.value})} 
                                placeholder="Role"
                            />
                            <input 
                                className="border rounded px-2 py-1 text-sm w-1/2" 
                                value={editForm.company} 
                                onChange={e => setEditForm({...editForm, company: e.target.value})} 
                                placeholder="Company"
                            />
                        </div>
                    ) : (
                        <span>{contact.role} {contact.company && `at ${contact.company}`}</span>
                    )}
                </div>
                 <div className="flex items-center gap-2">
                    <Factory size={16} className="text-slate-400" />
                    {isEditing ? (
                         <input 
                         className="border rounded px-2 py-1 text-sm w-full" 
                         value={editForm.industry} 
                         onChange={e => setEditForm({...editForm, industry: e.target.value})} 
                         placeholder="Industry (e.g. Technology)"
                     />
                    ) : (
                        <span className={contact.industry ? "" : "text-slate-400 italic"}>{contact.industry || "No Industry Set"}</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-slate-400" />
                    {isEditing ? (
                         <input 
                         className="border rounded px-2 py-1 text-sm w-full" 
                         value={editForm.location} 
                         onChange={e => setEditForm({...editForm, location: e.target.value})} 
                         placeholder="Location"
                     />
                    ) : (
                        <span>{contact.location || "Unknown Location"}</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Mail size={16} className="text-slate-400" />
                    {isEditing ? (
                         <input 
                         className="border rounded px-2 py-1 text-sm w-full" 
                         value={editForm.email} 
                         onChange={e => setEditForm({...editForm, email: e.target.value})} 
                         placeholder="Email"
                     />
                    ) : (
                        <a href={`mailto:${contact.email}`} className="text-indigo-600 hover:underline">{contact.email}</a>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Phone size={16} className="text-slate-400" />
                    {isEditing ? (
                         <input 
                         className="border rounded px-2 py-1 text-sm w-full" 
                         value={editForm.phone} 
                         onChange={e => setEditForm({...editForm, phone: e.target.value})} 
                         placeholder="Phone"
                     />
                    ) : (
                        <span className="text-slate-700">{contact.phone || "No phone number"}</span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Calendar size={14} />
                    <span>Last contacted: {new Date(contact.lastContacted).toLocaleDateString()}</span>
                </div>
             </div>
         </div>
      </div>

      {/* Tags */}
      <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <TagIcon size={14}/> Tags
          </h3>
          <div className="flex flex-wrap gap-2">
              {visibleTags.map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                      {tag}
                      <button onClick={() => toggleTag(tag)} className="hover:text-indigo-900"><X size={12}/></button>
                  </span>
              ))}
              
              {/* Search Pill for Adding Tags */}
              <div className="relative group">
                 {isAddingTag ? (
                     <div className="relative">
                         <input 
                             ref={tagInputRef}
                             type="text"
                             className="px-3 py-1 rounded-full text-xs font-medium bg-white border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-32"
                             value={tagSearch}
                             onChange={e => setTagSearch(e.target.value)}
                             onBlur={() => setTimeout(() => setIsAddingTag(false), 200)}
                             placeholder="Search..."
                         />
                         {tagSearch && availableTags.length > 0 && (
                             <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 shadow-xl rounded-lg z-20 py-1 max-h-40 overflow-y-auto">
                                 {availableTags.map(t => (
                                     <button
                                         key={t.id}
                                         className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700"
                                         onMouseDown={(e) => {
                                             e.preventDefault(); // Prevent blur before click
                                             handleAddTagSelect(t.name);
                                         }}
                                     >
                                         {t.name}
                                     </button>
                                 ))}
                             </div>
                         )}
                     </div>
                 ) : (
                    <button 
                        onClick={() => setIsAddingTag(true)}
                        className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 flex items-center gap-1 transition-colors"
                    >
                        <Search size={10} /> Add Tag
                    </button>
                 )}
              </div>
          </div>
      </div>

      {/* Notes */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Notes</h3>
        {isEditing ? (
            <textarea 
                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]"
                value={editForm.notes}
                onChange={e => setEditForm({...editForm, notes: e.target.value})}
            />
        ) : (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                {contact.notes || "No notes yet."}
            </div>
        )}
      </div>

    </div>
  );
};