import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav style={{ background: '#50C878', padding: '1rem' }}>
      <h2 style={{ color: 'white' }}>Estación de Pago GT</h2>
      <div style={{ marginTop: '0.5rem' }}>
        <Link to="/" style={{ marginRight: '1rem' }}>Inicio</Link>
        <Link to="/recarga" style={{ marginRight: '1rem' }}>Recarga</Link>
      </div>
    </nav>
  );
}
