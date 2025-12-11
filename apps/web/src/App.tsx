import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Broadcast from './pages/Broadcast';
import Listen from './pages/Listen';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/broadcast" element={<Broadcast />} />
        <Route path="/room/:roomId" element={<Listen />} />
      </Routes>
    </BrowserRouter>
  );
}
