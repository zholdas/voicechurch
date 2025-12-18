import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Broadcast from './pages/Broadcast';
import Listen from './pages/Listen';
import JoinRoom from './pages/JoinRoom';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/broadcast" element={<Broadcast />} />
        <Route path="/room/:roomId" element={<Listen />} />
        <Route path="/room/:roomId/broadcast" element={<Broadcast />} />
      </Routes>
    </BrowserRouter>
  );
}
