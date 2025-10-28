import ServiceCard from '../components/ServiceCard';
import Footer from '../components/Footer';
import { FaMobileAlt, FaPaperPlane, FaBus, FaFileInvoice } from 'react-icons/fa';
import { useEffect, useState } from 'react';

export default function Home() {
  const date = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  // real-time clock
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('es-ES'));

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-ES'));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <h1 style={styles.title}>Estación de Pago</h1>
        <p style={styles.subtitle}>Innovando la experiencia de usuario</p>
        <p style={styles.datetime}>{date} — {time}</p>
      </header>

      <main style={styles.main}>
        <div style={styles.grid}>
          <ServiceCard
            icon={<FaMobileAlt />}
            title="Recargas Telefónicas"
            description="Recarga saldo para cualquier operador"
            path="/recarga"
          />
          <ServiceCard
            icon={<FaPaperPlane />}
            title="Remesas"
            description="Envía y recibe dinero de forma segura"
            path="/construccion"
          />
          <ServiceCard
            icon={<FaBus />}
            title="Tarjeta de Transporte"
            description="Recarga tu tarjeta para el transporte público"
            path="/construccion"
          />
          <ServiceCard
            icon={<FaFileInvoice />}
            title="Pago de Servicios"
            description="Paga tus facturas de luz, agua, etc."
            path="/construccion"
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#F5F5F5',
    padding: '1rem',
    boxSizing: 'border-box'
  },
  header: {
    textAlign: 'center',
    padding: '2rem 1rem'
  },
  title: {
    fontSize: '2.5rem',
    color: '#F54927'
  },
  subtitle: {
    fontStyle: 'italic',
    color: '#F5B027',
    fontSize: '1.2rem'
  },
  datetime: {
    fontSize: '1rem',
    color: '#333333',
    marginTop: '0.5rem'
  },
  main: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '2rem',
    width: '100%',
    maxWidth: '1200px',
    padding: '1rem'
  }
};
