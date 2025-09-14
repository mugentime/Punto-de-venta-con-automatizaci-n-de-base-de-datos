const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.get('/', (req, res) => res.redirect('/online'));
app.get('/online', (req, res) => res.sendFile(__dirname + '/conejo_negro_online.html'));
app.get('/api/health', (req, res) => res.json({status: 'ok'}));

app.listen(port, () => console.log('Emergency server running on', port));