import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { Tag } from '../types';
import { Plus, X, Tag as TagIcon, Users, Search, Trash2, User } from 'lucide-react';

export const TagManager: React.FC = () => {
  const { tags, contacts, addTag, deleteTag, updateContact } = useCRM();
  const [newTagName, setNewTagName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    const newTag = {
        id: `t-${Date.now()}`,
        name: newTagName,
        color: 'bg-indigo-100 text-indigo-800' // Default color
    };
    addTag(newTag);
    setNewTagName('');
    setIsCreating(false);
    setSelectedTag(newTag);
  };

  const handleDeleteTag = (id: string) => {
      deleteTag(id);
      if (selectedTag?.id === id) setSelectedTag(null);
  };

  const contactsWithSelectedTag = selectedTag 
    ? contacts.filter(c => c.tags.includes(selectedTag.name)) 
    : [];

  const searchResults = selectedTag && memberSearch
    ? contacts.filter(c => 
        !c.tags.includes(selectedTag.name) && 
        c.name.toLowerCase().includes(memberSearch.toLowerCase())
      )
    : [];

  const toggleContactTag = (contactId: string, tagName: string) => {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;
      
      const newTags = contact.tags.includes(tagName) 
        ? contact.tags.filter(t => t !== tagName)
        : [...contact.tags, tagName];
      
      updateContact(contactId, { tags: newTags });
      setMemberSearch(''); // Clear search after adding
  };

  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  return (
    <div className="flex h-full bg-slate-50">
        {/* Left: Tag Sidebar */}
        <div className="w-72 bg-white border-r border-slate-200 flex flex-col h-full">
            <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <TagIcon className="text-indigo-600" size={20} /> Tags
                    </h2>
                    <button 
                        onClick={() => setIsCreating(!isCreating)}
                        className={`p-1.5 rounded-md transition-colors ${isCreating ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-500'}`}
                        title="Create New Tag"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                {isCreating && (
                    <div className="mb-3 flex gap-2 animate-in slide-in-from-top-2">
                        <input 
                            type="text" 
                            autoFocus
                            className="flex-1 bg-white border border-indigo-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Tag Name..."
                            value={newTagName}
                            onChange={e => setNewTagName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                        />
                        <button 
                            onClick={handleAddTag}
                            disabled={!newTagName.trim()}
                            className="bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors text-xs font-bold"
                        >
                            Save
                        </button>
                    </div>
                )}

                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <input 
                        type="text" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                        placeholder="Search tags..."
                        value={tagSearch}
                        onChange={e => setTagSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {filteredTags.length === 0 ? (
                    <div className="text-center text-xs text-slate-400 py-4">
                        {tagSearch ? 'No matching tags' : 'No tags found'}
                    </div>
                ) : (
                    filteredTags.map(tag => (
                        <div 
                            key={tag.id}
                            onClick={() => setSelectedTag(tag)}
                            className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                                selectedTag?.id === tag.id 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                                : 'hover:bg-slate-50 text-slate-600 border-transparent'
                            } border`}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <TagIcon size={16} className={`shrink-0 ${selectedTag?.id === tag.id ? 'fill-current' : 'text-slate-400'}`} />
                                <span className="text-sm font-medium truncate">{tag.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-100 shrink-0">
                                {contacts.filter(c => c.tags.includes(tag.name)).length}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Right: Tag Details & Members */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {selectedTag ? (
                <>
                    {/* Header */}
                    <div className="bg-white border-b border-slate-200 px-8 py-6 flex justify-between items-start shadow-sm z-10">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-2xl font-bold text-slate-900">{selectedTag.name}</h1>
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded uppercase tracking-wide">Active</span>
                            </div>
                            <p className="text-slate-500 text-sm">Manage contacts assigned to this group.</p>
                        </div>
                        <button 
                            onClick={() => handleDeleteTag(selectedTag.id)}
                            className="flex items-center gap-2 text-red-500 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                        >
                            <Trash2 size={16} /> Delete Tag
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8">
                        {/* Search & Add Bar */}
                        <div className="max-w-2xl mb-10 relative">
                             <label className="block text-sm font-medium text-slate-700 mb-2">Add people to {selectedTag.name}</label>
                             <div className="relative">
                                <div className="absolute left-3 top-3 text-slate-400">
                                    <Search size={18} />
                                </div>
                                <input 
                                    type="text" 
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    placeholder="Search contacts by name to add..."
                                    value={memberSearch}
                                    onChange={e => setMemberSearch(e.target.value)}
                                />
                                {memberSearch && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-20 max-h-60 overflow-y-auto">
                                        {searchResults.length > 0 ? searchResults.map(c => (
                                            <button 
                                                key={c.id}
                                                onClick={() => toggleContactTag(c.id, selectedTag.name)}
                                                className="w-full text-left flex items-center gap-3 p-3 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0"
                                            >
                                                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                                                    {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="w-full h-full rounded-full object-cover"/> : <User size={14}/>}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-slate-800">{c.name}</div>
                                                    <div className="text-xs text-slate-500">{c.role}</div>
                                                </div>
                                                <div className="ml-auto text-indigo-600">
                                                    <Plus size={16} />
                                                </div>
                                            </button>
                                        )) : (
                                            <div className="p-4 text-center text-sm text-slate-400">No matching contacts found.</div>
                                        )}
                                    </div>
                                )}
                             </div>
                        </div>

                        {/* Members Grid */}
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Users size={20} className="text-slate-400"/> Members ({contactsWithSelectedTag.length})
                        </h3>
                        
                        {contactsWithSelectedTag.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {contactsWithSelectedTag.map(c => (
                                    <div key={c.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-300 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 shrink-0 overflow-hidden">
                                                <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-semibold text-slate-800 truncate">{c.name}</h4>
                                                <p className="text-xs text-slate-500 truncate">{c.company || c.role || 'No details'}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => toggleContactTag(c.id, selectedTag.name)}
                                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Remove from tag"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-slate-100 rounded-xl p-8 text-center border border-dashed border-slate-300">
                                <p className="text-slate-500 mb-2">No members in this tag yet.</p>
                                <p className="text-xs text-slate-400">Use the search bar above to add people.</p>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <TagIcon size={32} className="opacity-50" />
                    </div>
                    <p className="text-lg font-medium text-slate-600">Select a tag to manage</p>
                    <p className="text-sm">Or create a new one from the sidebar.</p>
                </div>
            )}
        </div>
    </div>
  );
};