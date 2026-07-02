require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./db/database');
const router = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));


app.use('/api', router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running at http://localhost:3000");
});