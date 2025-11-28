import React, { useRef, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { parseCSV, SCOPES, parseGoogleContact } from '../services/googleContacts';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

declare const google: any;

export const Importer: React.FC = () => {
  const { importContacts } = useCRM();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const contacts = parseCSV(text);
        importContacts(contacts);
        setStatus('success');
        setMsg(`Successfully imported ${contacts.length} contacts.`);
      } catch (err) {
        setStatus('error');
        setMsg("Failed to parse CSV. Ensure it has headers like 'Name', 'Email', etc.");
      }
    };
    reader.readAsText(file);
  };

  // Google OAuth 2.0 Token Model (Client-side)
  const handleGoogleImport = () => {
    // Check if the Google client library is loaded
    if (typeof google === 'undefined') {
        setStatus('error');
        setMsg("Google Identity Services script not loaded.");
        return;
    }

    try {
        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: 'YOUR_GOOGLE_CLIENT_ID', // In a real app, this comes from ENV. We handle the error gracefully if invalid.
            scope: SCOPES,
            callback: async (response: any) => {
                if (response.error) {
                    setStatus('error');
                    setMsg(`Google Auth Error: ${response.error}`);
                    return;
                }
                
                // Fetch contacts using the access token
                try {
                    const res = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,organizations,addresses,photos', {
                        headers: {
                            'Authorization': `Bearer ${response.access_token}`
                        }
                    });
                    
                    if (!res.ok) throw new Error('Failed to fetch people');
                    
                    const data = await res.json();
                    if (data.connections) {
                        const contacts = data.connections.map(parseGoogleContact);
                        importContacts(contacts);
                        setStatus('success');
                        setMsg(`Synced ${contacts.length} contacts from Google.`);
                    } else {
                        setStatus('idle');
                        setMsg("No contacts found in this account.");
                    }
                } catch (apiErr) {
                    console.error(apiErr);
                    setStatus('error');
                    setMsg("Failed to call People API. (Did you replace the Client ID?)");
                }
            },
        });
        tokenClient.requestAccessToken();
    } catch (e) {
        // Fallback for demo
        setStatus('error');
        setMsg("Google Sign-In configuration missing. Please use CSV Import for this demo.");
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Import Data</h1>
        <p className="text-slate-500 mb-10">Bring your network into Nexus. We support CSV and Google Contacts.</p>

        <div className="grid md:grid-cols-2 gap-8">
            {/* CSV Card */}
            <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-500 transition-colors flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 mb-4">
                    <FileText size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Upload CSV</h3>
                <p className="text-sm text-slate-500 mb-6">Standard CSV with Name, Email, Company, Role columns.</p>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".csv"
                    onChange={handleFileUpload}
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
                >
                    Select File
                </button>
            </div>

            {/* Google Card */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-green-500"></div>
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-4">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Sync Google Contacts</h3>
                <p className="text-sm text-slate-500 mb-6">Authenticate to pull contacts, avatars, and details directly.</p>
                <button 
                    onClick={handleGoogleImport}
                    className="bg-white border border-slate-300 text-slate-700 px-6 py-2 rounded-lg font-medium hover:bg-slate-50 transition"
                >
                    Connect Google
                </button>
            </div>
        </div>

        {status !== 'idle' && (
            <div className={`mt-8 p-4 rounded-lg flex items-center gap-3 ${status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {status === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                <span>{msg}</span>
            </div>
        )}
    </div>
  );
};
