import express from 'express';
import cors from 'cors';
import eventRoutes from './routes/event.routes';
import bookingRoutes from './routes/booking.routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/events-api/v1/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount Member 2 core domain routes
app.use('/events-api/v1/events', eventRoutes);
app.use('/events-api/v1/bookings', bookingRoutes);

// Catch-all 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found.`,
    },
  });
});

// Shared Global Centralized Error Handler
app.use(errorHandler);

export default app;
