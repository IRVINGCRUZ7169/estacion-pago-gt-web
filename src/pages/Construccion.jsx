import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Construccion() {
  const navigate = useNavigate();
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 5000);
    const redirectTimer = setTimeout(() => navigate('/', { replace: true }), 6000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(redirectTimer);
    };
  }, [navigate]);

  return (
    <div style={{ ...styles.wrapper, opacity: fadeOut ? 0 : 1, transition: 'opacity 1s ease-in-out' }}>
      <div style={styles.card}>
        <img
          src="/construccion-bg.png"
          alt="Ilustración en construcción"
          style={styles.image}
        />
        <h2 style={styles.title}>Funcionalidad en construcción</h2>
        <p style={styles.text}>
          Estamos trabajando para ofrecerte esta opción muy pronto. Nuestro equipo está afinando los últimos detalles para garantizarte una experiencia segura y eficiente.
        </p>
        <p style={styles.footer}>Redirigiendo en 6 segundos…</p>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    height: '100vh',
    width: '100%',
    backgroundColor: '#F5F5F5',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1rem',
    boxSizing: 'border-box'
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: '2rem',
    borderRadius: '16px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
    maxWidth: '600px',
    width: '100%',
    textAlign: 'center'
  },
  image: {
    width: '100%',
    maxWidth: '300px',
    marginBottom: '1.5rem'
  },
  title: {
    fontSize: '1.8rem',
    color: '#F54927',
    marginBottom: '1rem'
  },
  text: {
    fontSize: '1rem',
    color: '#666666',
    marginBottom: '1.5rem'
  },
  footer: {
    fontStyle: 'italic',
    color: '#999999'
  }
};
