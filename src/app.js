const express = require('express');
const cors = require('cors');

const pool = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const shelterRoutes = require('./routes/shelterRoutes');
const adminRoutes = require('./routes/adminRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const messageRoutes = require('./routes/messageRoutes');
const petRoutes = require('./routes/petRoutes');
const activityRoutes = require('./routes/activityRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Base health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'StayPaw API is running',
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/shelters', shelterRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/pets', petRoutes);
app.use('/api/v1/activities', activityRoutes);

app.get('/api/v1/health/database', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');

    res.json({
      success: true,
      message: 'Database connected successfully',
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    console.error('Database connection error:', error);

    res.status(500).json({
      success: false,
      message: 'Database connection failed',
    });
  }
});

const PORT = process.env.PORT || 8080;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`StayPaw API running on port ${PORT}`);
  });
}

module.exports = app;