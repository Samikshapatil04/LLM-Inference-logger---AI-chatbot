import { useState } from 'react';
import './index.css';
import Sidebar        from './components/Sidebar.jsx';
import ChatPage       from './pages/ChatPage.jsx';
import DashboardPage  from './pages/DashboardPage.jsx';
import LogsPage       from './pages/LogsPage.jsx';
import SettingsModal  from './components/SettingsModal.jsx';
import { getApiKey }  from './lib/api.js';

export default function App() {
  const [page,           setPage]          = useState('chat');
  const [activeConvId,   setActiveConvId]  = useState(null);
  const [showSettings,   setShowSettings]  = useState(!getApiKey());
  const [sidebarRefresh, setSidebarRefresh]= useState(0);

  const refreshSidebar = () => setSidebarRefresh(n => n + 1);

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar
        page={page}           setPage={setPage}
        activeConvId={activeConvId} setActiveConvId={setActiveConvId}
        onSettings={() => setShowSettings(true)}
        refreshKey={sidebarRefresh}
        onRefresh={refreshSidebar}
      />
      <main style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {page === 'chat'      && (
          <ChatPage
            activeConvId={activeConvId}
            setActiveConvId={setActiveConvId}
            onConversationChange={refreshSidebar}
          />
        )}
        {page === 'dashboard' && <DashboardPage />}
        {page === 'logs'      && <LogsPage />}
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
