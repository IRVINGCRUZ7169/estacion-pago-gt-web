import { Link } from 'react-router-dom';

export default function ServiceCard({ icon, title, description, path }) {
  return (
    <Link to={path} style={styles.link}>
      <div className="card-3d" style={styles.card}>
        <div style={styles.icon}>{icon}</div>
        <h3 style={styles.title}>{title}</h3>
        <p style={styles.desc}>{description}</p>
        <div style={styles.buttonText}>Ir a {obtenerFuncion(title)}</div>
      </div>
    </Link>
  );
}

// Mapeo explícito de títulos a funciones
function obtenerFuncion(titulo) {
  const mapa = {
    'Recargas Telefónicas': 'Recargas',
    'Remesas': 'Remesas',
    'Tarjeta de Transporte': 'Transporte',
    'Pago de Servicios': 'Servicios'
  };
  return mapa[titulo] || 'Función';
}

const styles = {
  link: {
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
    height: '100%'
  },
  card: {
    backgroundColor: '#FFFFFF',
    color: '#333333',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
    textAlign: 'center',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    touchAction: 'manipulation',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    cursor: 'pointer'
  },
  icon: {
    fontSize: '2.5rem',
    marginBottom: '1rem',
    color: '#F5B027'
  },
  title: {
    fontSize: '1.3rem',
    color: '#333333',
    marginBottom: '0.5rem'
  },
  desc: {
    fontSize: '0.95rem',
    color: '#666666',
    marginBottom: '1.5rem'
  },
  buttonText: {
    backgroundColor: '#F54927',
    color: '#FFFFFF',
    padding: '0.75rem 1.25rem',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '500',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    marginTop: 'auto'
  }
};
