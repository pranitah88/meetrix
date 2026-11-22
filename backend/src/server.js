const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/meetings',      require('./routes/meetings'));
app.use('/api/tasks',         require('./routes/tasks'));
app.use('/api/insights',      require('./routes/insights'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/ai',            require('./routes/ai'));
app.use('/api/search',        require('./routes/search'));
app.use('/api/analytics',     require('./routes/analytics'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Serve frontend static web app
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`  Meetrix API running on http://localhost:${PORT}`);
    console.log(`  Health Check: http://localhost:${PORT}/api/health`);
    console.log(`=================================================\n`);
  });
}

startServer();
