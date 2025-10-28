const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/recharge', (req, res) => {
  const { phone, amount, carrier } = req.body;
  console.log(`Recarga: ${carrier} - ${phone} - Q${amount}`);
  res.json({ message: `Se recargaron Q${amount} a ${phone} en ${carrier}` });
});

app.listen(3000, () => console.log('Servidor backend activo en http://localhost:3000'));
