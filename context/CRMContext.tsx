import React, { createContext, useContext, useState, useEffect } from 'react';
import { Contact, Tag, Suggestion } from '../types';
import { INITIAL_TAGS } from '../constants';

interface CRMContextType {
  contacts: Contact[]; // Active contacts only
  deletedContacts: Contact[]; // Contacts in trash
  tags: Tag[];
  suggestions: Suggestion[];
  addContact: (contact: Contact) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  batchUpdateContacts: (updates: { id: string, updates: Partial<Contact> }[]) => void;
  deleteContact: (id: string) => void; // Soft delete
  restoreContact: (id: string) => void;
  permanentlyDeleteContact: (id: string) => void;
  addTag: (tag: Tag) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  setSuggestions: (suggestions: Suggestion[]) => void;
  applySuggestion: (suggestion: Suggestion) => void;
  applyAllSuggestions: () => void;
  importContacts: (newContacts: Contact[]) => void;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize from LocalStorage or Start Empty
  // Changed key to 'nexus_contacts_v2' to ensure old mock data is cleared
  const [allContacts, setAllContacts] = useState<Contact[]>(() => {
    try {
      const saved = localStorage.getItem('nexus_contacts_v2');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load contacts from storage", e);
      return [];
    }
  });

  const [tags, setTags] = useState<Tag[]>(() => {
    try {
      const saved = localStorage.getItem('nexus_tags');
      return saved ? JSON.parse(saved) : INITIAL_TAGS;
    } catch (e) {
      return INITIAL_TAGS;
    }
  });

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('nexus_contacts_v2', JSON.stringify(allContacts));
  }, [allContacts]);

  useEffect(() => {
    localStorage.setItem('nexus_tags', JSON.stringify(tags));
  }, [tags]);

  // 30-Day Auto-Cleanup Effect
  useEffect(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    setAllContacts(prev => {
      let hasChanges = false;
      const cleaned = prev.filter(c => {
          if (!c.deletedAt) return true;
          const deletedDate = new Date(c.deletedAt);
          if (deletedDate <= thirtyDaysAgo) {
              hasChanges = true;
              return false; // Remove
          }
          return true;
      });
      // Only update if changes occurred to avoid loops
      if (hasChanges) return cleaned;
      return prev;
    });
  }, []);

  // Derived lists
  const contacts = allContacts.filter(c => !c.deletedAt);
  const deletedContacts = allContacts.filter(c => !!c.deletedAt).sort((a, b) => 
    new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime()
  );

  const addContact = (contact: Contact) => {
    setAllContacts(prev => [...prev, contact]);
  };

  const updateContact = (id: string, updates: Partial<Contact>) => {
    setAllContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const batchUpdateContacts = (updates: { id: string, updates: Partial<Contact> }[]) => {
    setAllContacts(prev => {
        const updateMap = new Map(updates.map(u => [u.id, u.updates]));
        return prev.map(c => {
            const up = updateMap.get(c.id);
            return up ? { ...c, ...up } : c;
        });
    });
  };

  const deleteContact = (id: string) => {
    // Soft delete: set deletedAt to current time
    setAllContacts(prev => prev.map(c => 
      c.id === id ? { ...c, deletedAt: new Date().toISOString() } : c
    ));
  };

  const restoreContact = (id: string) => {
    setAllContacts(prev => prev.map(c => 
      c.id === id ? { ...c, deletedAt: undefined } : c
    ));
  };

  const permanentlyDeleteContact = (id: string) => {
    setAllContacts(prev => {
        const filtered = prev.filter(c => c.id !== id);
        // Also remove this ID from any linkedIds in other contacts to maintain integrity
        return filtered.map(c => ({
            ...c,
            linkedIds: c.linkedIds ? c.linkedIds.filter(lid => lid !== id) : []
        }));
    });
  };

  const addTag = (tag: Tag) => {
    setTags(prev => [...prev, tag]);
  };

  const updateTag = (id: string, updates: Partial<Tag>) => {
      setTags(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }

  const deleteTag = (id: string) => {
    setTags(prev => prev.filter(t => t.id !== id));
    // Remove tag from contacts
    setAllContacts(prev => prev.map(c => ({
        ...c,
        tags: c.tags.filter(t => {
            const tagObj = tags.find(tg => tg.id === id);
            return tagObj ? t !== tagObj.name : true; 
        })
    })));
  };

  const importContacts = (newContacts: Contact[]) => {
    // Avoid duplicates by email
    const existingEmails = new Set(allContacts.map(c => c.email).filter(Boolean));
    const uniqueNew = newContacts.filter(c => !c.email || !existingEmails.has(c.email));
    setAllContacts(prev => [...prev, ...uniqueNew]);
  };

  const applyLogic = (s: Suggestion, currentContacts: Contact[], currentTags: Tag[]) => {
    const contact = currentContacts.find(c => c.id === s.contactId);
    if (!contact) return { updatedContact: null, newTags: [] };

    let updatedContact = { ...contact };
    let newTagsToAdd: Tag[] = [];

    if (s.field === 'tags' && Array.isArray(s.suggestedValue)) {
        // Tag Merging Logic
        const mergedTags = new Set(contact.tags);
        s.suggestedValue.forEach((tag: string) => mergedTags.add(tag));
        updatedContact.tags = Array.from(mergedTags);
        
        // Identify new tags to create
        s.suggestedValue.forEach((tagName: string) => {
            const exists = currentTags.some(t => t.name.toLowerCase() === tagName.toLowerCase());
            if (!exists) {
                newTagsToAdd.push({ id: `auto-${Date.now()}-${tagName}-${Math.random()}`, name: tagName, color: 'bg-indigo-100 text-indigo-800' });
            }
        });
    } else {
        // Standard Field Update (including phone)
        updatedContact = { ...updatedContact, [s.field]: s.suggestedValue };
    }
    return { updatedContact, newTagsToAdd };
  };

  const applySuggestion = (s: Suggestion) => {
    const { updatedContact, newTagsToAdd } = applyLogic(s, allContacts, tags);
    
    if (updatedContact) {
        updateContact(s.contactId, updatedContact);
        newTagsToAdd.forEach(t => addTag(t));
    }
    setSuggestions(prev => prev.filter(item => item !== s));
  };

  const applyAllSuggestions = () => {
      let tempContacts = [...allContacts];
      let tempTags = [...tags];
      
      suggestions.forEach(s => {
          const { updatedContact, newTagsToAdd } = applyLogic(s, tempContacts, tempTags);
          if (updatedContact) {
              tempContacts = tempContacts.map(c => c.id === updatedContact!.id ? updatedContact! : c);
              tempTags = [...tempTags, ...newTagsToAdd];
          }
      });

      setAllContacts(tempContacts);
      setTags(tempTags);
      setSuggestions([]);
  };

  return (
    <CRMContext.Provider value={{
      contacts,
      deletedContacts,
      tags,
      suggestions,
      addContact,
      updateContact,
      batchUpdateContacts,
      deleteContact,
      restoreContact,
      permanentlyDeleteContact,
      addTag,
      updateTag,
      deleteTag,
      setSuggestions,
      applySuggestion,
      applyAllSuggestions,
      importContacts
    }}>
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (!context) throw new Error("useCRM must be used within CRMProvider");
  return context;
};