import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import all of your high-fidelity pages
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Marketplace from './pages/Marketplace';
import MyDNA from './pages/MyDNA';
import Teaching from './pages/Teaching';
import Learning from './pages/Learning';
import SessionDetail from './pages/SessionDetail';
import Wallet from './pages/Wallet';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Support from './pages/Support';
import Messages from './pages/Messages';
import SessionsLog from './pages/SessionsLog';
import LiveSession from './pages/LiveSession';

function App() {
  return (
    <Router>
      <Routes>
        {/* The Front Door */}
        <Route path="/" element={<Auth />} />
        
        {/* Main Application Hubs */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/mydna" element={<MyDNA />} />
        <Route path="/teaching" element={<Teaching />} />
        <Route path="/learning" element={<Learning />} />
        <Route path="/messages" element={<Messages />} />
        
        {/* Detail, Logging & Utility Pages */}
        <Route path="/session-detail" element={<SessionDetail />} />
        <Route path="/live-session" element={<LiveSession />} />
        <Route path="/sessions-log" element={<SessionsLog />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/profile/:id" element={<Profile />} />
        
        {/* User Preferences & Help */}
        <Route path="/settings" element={<Settings />} />
        <Route path="/support" element={<Support />} />
      </Routes>
    </Router>
  );
}

export default App;