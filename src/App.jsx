import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Recarga from './pages/Recarga';
import Remesas from './pages/Remesas';
import Transporte from './pages/Transporte';
import Servicios from './pages/Servicios';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/recarga" element={<Recarga />} />
      <Route path="/remesas" element={<Remesas />} />
      <Route path="/transporte" element={<Transporte />} />
      <Route path="/servicios" element={<Servicios />} />
    </Routes>
  );
}
