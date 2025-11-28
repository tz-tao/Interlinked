import React, { useState } from 'react';
import { CRMProvider, useCRM } from './context/CRMContext';
import { Sidebar } from './components/Sidebar';
import { ContactList } from './components/ContactList';
import { ContactDetail } from './components/ContactDetail';
import { GraphView } from './components/GraphView';
import { TagManager } from './components/TagManager';
import { SmartAssistant } from './components/SmartAssistant';
import { Importer } from './components/Importer';
import { TrashView } from './components/TrashView';
import { Menu, ArrowLeft } from 'lucide-react';
import { GraphState } from './types';

import { generateText } from "./services/api";


interface DashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  graphState: GraphState;
  setGraphState: React.Dispatch<React.SetStateAction<GraphState>>;
  previousTab: string | null;
}

const DashboardContent: React.FC<DashboardProps> = ({ activeTab, setActiveTab, graphState, setGraphState, previousTab }) => {
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const handleGraphNodeClick = (id: string) => {
    setSelectedContactId(id);
    setActiveTab('contacts');
  };

  const handleBackToGraph = () => {
    setActiveTab('graph');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'graph':
        return (
          <GraphView
            onNodeClick={handleGraphNodeClick}
            graphState={graphState}
            setGraphState={setGraphState}
          />
        );
      case 'tags':
        return <TagManager />;
      case 'suggestions':
        return <SmartAssistant />;
      case 'import':
        return <Importer />;
      case 'trash':
        return <TrashView />;
      case 'contacts':
      default:
        return (
          <div className="flex h-full relative">
            <div className={`${selectedContactId ? 'hidden md:block' : 'block'} w-full md:w-96 h-full`}>
              <ContactList onSelectContact={setSelectedContactId} />
            </div>
            <div className={`${!selectedContactId ? 'hidden md:block' : 'block'} flex-1 h-full bg-white relative`}>
              <ContactDetail contactId={selectedContactId} onClose={() => setSelectedContactId(null)} />

              {/* Back to Graph Button */}
              {previousTab === 'graph' && (
                <div className="absolute bottom-6 right-6 z-50">
                  <button
                    onClick={handleBackToGraph}
                    className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all font-semibold"
                  >
                    <ArrowLeft size={18} />
                    Back to Network Graph
                  </button>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 h-full bg-white overflow-hidden relative">
      {renderContent()}
    </div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('contacts');
  const [previousTab, setPreviousTab] = useState<string | null>(null);

  const [out, setOut] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function testGemini() {
    try {
      setLoading(true);
      const r = await generateText("Say hi in one sentence.");
      setOut(r.text);
    } finally {
      setLoading(false);
    }
  }
  // Lifted Graph State
  const [graphState, setGraphState] = useState<GraphState>({
    searchTerm: '',
    dimension: 'company',
    customDimensionInput: '',
    customMappings: {},
    currentClusterIndex: 0
  });

  // Intercept tab changes to track history
  const handleTabChange = (tab: string) => {
    if (activeTab === 'graph' && tab === 'contacts') {
      setPreviousTab('graph');
    } else if (tab !== 'contacts') {
      setPreviousTab(null);
    }
    setActiveTab(tab);
  };

  return (
    <CRMProvider>
      <div className="flex h-screen w-screen bg-slate-50 overflow-hidden font-sans">
        <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} />

        <div className="flex flex-col flex-1 h-full overflow-hidden">
          {/* quick test bar */}
          <div className="px-4 py-2 border-b bg-white flex items-center gap-3">
            <button
              onClick={testGemini}
              disabled={loading}
              className="px-3 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50"
            >
              {loading ? "Testing..." : "Test Gemini via backend"}
            </button>

            {out && (
              <div className="text-sm text-slate-700 truncate">
                {out}
              </div>
            )}
          </div>

          <main className="flex-1 h-full overflow-hidden relative">
            <DashboardContent
              activeTab={activeTab}
              setActiveTab={handleTabChange}
              graphState={graphState}
              setGraphState={setGraphState}
              previousTab={previousTab}
            />
          </main>
        </div>
      </div>
    </CRMProvider>
  );

}
export default App;
