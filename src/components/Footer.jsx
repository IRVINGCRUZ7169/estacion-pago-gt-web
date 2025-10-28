export default function Footer() {
  return (
    <footer style={styles.footer}>
      <div><strong>Usuario:</strong> Luis Rubén</div>
      <div><strong>Ubicación:</strong> Ciudad de Guatemala</div>
      <div><strong>Estado:</strong> Activo</div>
    </footer>
  );
}

const styles = {
  footer: {
    marginTop: '2rem',
    padding: '1rem',
    backgroundColor: '#F0F0F0',
    textAlign: 'center',
    fontSize: '0.9rem',
    color: '#555'
  }
};
