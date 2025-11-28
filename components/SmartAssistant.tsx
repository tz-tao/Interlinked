import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { analyzeContactsForSuggestions, generateAutoTags } from '../services/geminiService';
import { Sparkles, Check, X, Loader2, Tag as TagIcon, Zap, CheckCircle } from 'lucide-react';

export const SmartAssistant: React.FC = () => {
  const { contacts, suggestions, setSuggestions, applySuggestion, applyAllSuggestions } = useCRM();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'tags'>('profile');

  const runAnalysis = async () => {
    setLoading(true);
    setActiveTab('profile');
    const newSuggestions = await analyzeContactsForSuggestions(contacts);
    setSuggestions(newSuggestions);
    setLoading(false);
  };

  const runAutoTagging = async () => {
      setLoading(true);
      setActiveTab('tags');
      const newSuggestions = await generateAutoTags(contacts);
      setSuggestions(newSuggestions);
      setLoading(false);
  };

  // Filter suggestions based on type
  const profileSuggestions = suggestions.filter(s => s.field !== 'tags');
  const tagSuggestions = suggestions.filter(s => s.field === 'tags');
  
  const displayedSuggestions = activeTab === 'profile' ? profileSuggestions : tagSuggestions;

  return (
    <div className="h-full bg-slate-50 p-6 flex flex-col">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="text-amber-500" /> Smart Assistant
        </h2>
        <p className="text-sm text-slate-500 mt-1">
            Gemini identifies missing info and suggests updates based on your network patterns.
        </p>

        <div className="flex gap-4 mt-6">
            <button 
                onClick={runAnalysis} 
                disabled={loading}
                className={`flex-1 px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-sm border ${activeTab === 'profile' ? 'bg-amber-50 border-amber-200 text-amber-800 ring-2 ring-amber-500/20' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
                {loading && activeTab === 'profile' ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                Find Missing Info
            </button>
            <button 
                onClick={runAutoTagging} 
                disabled={loading}
                className={`flex-1 px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-sm border ${activeTab === 'tags' ? 'bg-indigo-50 border-indigo-200 text-indigo-800 ring-2 ring-indigo-500/20' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
                {loading && activeTab === 'tags' ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                Auto-Categorize (Tags)
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                {activeTab === 'profile' ? 'Profile Improvements' : 'Tag Suggestions'} ({displayedSuggestions.length})
            </h3>
            {displayedSuggestions.length > 0 && (
                <button 
                    onClick={applyAllSuggestions}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                >
                    <CheckCircle size={14} /> Accept All
                </button>
            )}
        </div>

        <div className="space-y-4">
            {displayedSuggestions.length === 0 && !loading && (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                    <p className="text-slate-400">No {activeTab} suggestions pending.</p>
                    <p className="text-xs text-slate-400 mt-2">Run an analysis to clean up your data or auto-tag your contacts.</p>
                </div>
            )}
            
            {loading && (
                <div className="text-center py-20">
                    <Loader2 className="animate-spin mx-auto text-indigo-500 mb-2" size={32}/>
                    <p className="text-slate-500 text-sm">Analyzing contacts...</p>
                </div>
            )}

            {displayedSuggestions.map((suggestion, idx) => {
                const contact = contacts.find(c => c.id === suggestion.contactId);
                if (!contact) return null;

                const isTagSuggestion = suggestion.field === 'tags';

                return (
                    <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4 animate-in fade-in slide-in-from-bottom-4">
                        <div className={`p-2.5 rounded-lg shrink-0 ${isTagSuggestion ? 'bg-purple-100 text-purple-600' : 'bg-amber-100 text-amber-600'}`}>
                            {isTagSuggestion ? <TagIcon size={20} /> : <Sparkles size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <h4 className="text-sm font-bold text-slate-800 truncate">
                                    {isTagSuggestion ? `Add tags to ${contact.name}` : `Update ${contact.name}'s ${suggestion.field}`}
                                </h4>
                            </div>
                        
                            <p className="text-xs text-slate-500 mt-1 mb-3 italic">"{suggestion.reason}"</p>
                            
                            {isTagSuggestion ? (
                                <div className="flex flex-wrap gap-2">
                                    {(suggestion.suggestedValue as string[]).map(tag => (
                                        <span key={tag} className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold border border-green-200">
                                            + {tag}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 text-sm bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <div className="text-slate-400 line-through decoration-red-400 text-xs uppercase tracking-wide">
                                        {suggestion.currentValue || "EMPTY"}
                                    </div>
                                    <div className="text-slate-300">→</div>
                                    <div className="font-semibold text-green-600">
                                        {suggestion.suggestedValue}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                            <button 
                                onClick={() => applySuggestion(suggestion)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-green-50 text-green-600 rounded-full transition-colors border border-transparent hover:border-green-200"
                                title="Accept"
                            >
                                <Check size={18} />
                            </button>
                            <button 
                                onClick={() => setSuggestions(suggestions.filter(s => s !== suggestion))}
                                className="w-8 h-8 flex items-center justify-center hover:bg-red-50 text-red-400 rounded-full transition-colors border border-transparent hover:border-red-200"
                                title="Reject"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};