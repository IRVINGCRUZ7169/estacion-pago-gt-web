import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Recarga() {
  const [numero, setNumero] = useState('');
  const [segundosRestantes, setSegundosRestantes] = useState(60);
  const [operatorMap, setOperatorMap] = useState({});
  const [hoveredKey, setHoveredKey] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const countdown = setInterval(() => {
      setSegundosRestantes((prev) => {
        if (prev <= 1) {
          clearInterval(countdown);
          navigate('/', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [navigate]);

  // Load operator mapping from external config at runtime. File is served from /config/operators.json
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch('/config/operators.json', { cache: 'no-cache' });
        if (!resp.ok) return;
        const json = await resp.json();
        if (mounted && json && typeof json === 'object') setOperatorMap(json);
      } catch (e) {
        // ignore — fallback to builtin mapping
        console.warn('Could not load operator mapping config:', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const reiniciarTimer = () => setSegundosRestantes(60);

  const agregarDigito = (digito) => {
    if (isSubmitting) return; // prevent input while submitting
    if (numero.length < 8) {
      setNumero((prev) => prev + digito);
      reiniciarTimer();
    }
  };

  const borrarDigito = () => {
    if (isSubmitting) return;
    setNumero((prev) => prev.slice(0, -1));
    reiniciarTimer();
  };

  const continuar = async () => {
    if (numero.length !== 8) {
      alert('Debes ingresar 8 dígitos');
      return;
    }

    if (isSubmitting) return; // prevent double submit
    setIsSubmitting(true);

    const consulta = { telefono: numero };
    localStorage.setItem('consulta', JSON.stringify(consulta));

    // Set a 60s timeout for the API call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch('/api/operador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consulta),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const respuesta = await response.json();
      localStorage.setItem('respuesta', JSON.stringify(respuesta));

      // Determine operadorId from the API response.
      // Prefer the `body` field if present (proxy may return an object like { body: ... }),
      // otherwise fall back to the known field `ObtieneOperadorTelefonoResult` or the raw value.
      let bodyValue;
      if (respuesta && typeof respuesta === 'object' && Object.prototype.hasOwnProperty.call(respuesta, 'body')) {
        bodyValue = respuesta.body;
      } else if (respuesta && typeof respuesta === 'object' && Object.prototype.hasOwnProperty.call(respuesta, 'ObtieneOperadorTelefonoResult')) {
        bodyValue = respuesta.ObtieneOperadorTelefonoResult;
      } else {
        bodyValue = respuesta;
      }

      const operadorId = String(bodyValue);
      // Prefer operatorMap loaded from /public/config/operators.json; fallback to built-in mapping
      let operadorNombre = 'Desconocido';
      if (operatorMap && operatorMap[operadorId]) {
        operadorNombre = operatorMap[operadorId];
      } else if (operadorId === '1') operadorNombre = 'CLARO';
      else if (operadorId === '3') operadorNombre = 'TIGO';

      alert(`Número: ${consulta.telefono}\nOperador: ${operadorNombre}`);
      // success: allow UI to proceed
      setIsSubmitting(false);
      navigate('/', { replace: true });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        alert('La consulta tardó más de 60 segundos. Intenta nuevamente.');
      } else {
        alert('Error al consultar el operador. Intenta nuevamente.');
      }
      // allow retry after an error
      setIsSubmitting(false);
      navigate('/', { replace: true });
    }
  };

  const botones = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    'Borrar', '0', 'Continuar'
  ];

  return (
    <div style={styles.wrapper}>
      <div style={styles.modal}>
        <h2 style={styles.title}>Recarga Telefónica</h2>
        <p style={styles.subtitle}>Recarga saldo para cualquier operadora.</p>
        <input
          type="text"
          value={numero}
          readOnly
          placeholder="Ingresa 8 dígitos"
          style={styles.input}
        />
        <div style={styles.grid}>
          {botones.map((btn, i) => {
            const isContinue = btn === 'Continuar';
            const isDelete = btn === 'Borrar';
            const baseStyle = isContinue ? styles.continuar : isDelete ? styles.borrar : styles.boton;
            const hovered = hoveredKey === btn;
            const computedStyle = {
              ...baseStyle,
              ...(hovered ? styles.hovered : {}),
              ...(isContinue && isSubmitting ? styles.disabled : {})
            };
            return (
              <button
                key={i}
                style={computedStyle}
                onMouseEnter={() => setHoveredKey(btn)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={() => {
                  if (isContinue) {
                    if (!isSubmitting) continuar();
                  } else if (isDelete) {
                    if (!isSubmitting) borrarDigito();
                  } else {
                    if (!isSubmitting) agregarDigito(btn);
                  }
                }}
                disabled={isContinue && isSubmitting}
              >
                {btn}
              </button>
            );
          })}
        </div>
        <p style={styles.timer}>Tiempo restante: {segundosRestantes} segundos</p>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    height: '100vh',
    backgroundColor: '#F5F5F5',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1rem'
  },
  modal: {
    backgroundColor: '#FFFFFF',
    padding: '2rem',
    borderRadius: '16px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
    maxWidth: '400px',
    width: '100%',
    textAlign: 'center'
  },
  title: {
    fontSize: '1.8rem',
    color: '#F54927',
    marginBottom: '0.5rem'
  },
  subtitle: {
    fontSize: '1rem',
    color: '#666',
    marginBottom: '1rem'
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    fontSize: '1.5rem',
    textAlign: 'center',
    border: '2px solid #F54927',
    borderRadius: '8px',
    marginBottom: '1.5rem',
    backgroundColor: '#FDFDFD',
    color: '#333'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem'
  },
  boton: {
    padding: '1rem',
    fontSize: '1.5rem',
    backgroundColor: '#F5F5F5',
    border: '1px solid #DDD',
    borderRadius: '12px',
    cursor: 'pointer',
    touchAction: 'manipulation',
    color: '#000'
  },
  borrar: {
    padding: '1rem',
    fontSize: '1rem',
    backgroundColor: '#F5B027',
    border: 'none',
    borderRadius: '12px',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  continuar: {
    padding: '1rem',
    fontSize: '1rem',
    backgroundColor: '#F54927',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  hovered: {
    boxShadow: '0 6px 20px rgba(245,73,39,0.35)',
    transform: 'translateY(-2px)'
  },
  disabled: {
    opacity: 0.6,
    cursor: 'not-allowed'
  },
  timer: {
    marginTop: '1.5rem',
    fontSize: '0.95rem',
    color: '#999',
    fontStyle: 'italic'
  }
};
