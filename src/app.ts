import express from 'express';
import cors from 'cors';
import eventRoutes from './routes/event.routes';
import bookingRoutes from './routes/booking.routes';
import { authRoutes, userRoutes } from './routes/auth.routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/events-api/v1/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Member 1 Authentication & User routes
app.use('/events-api/v1/auth', authRoutes);
app.use('/events-api/v1/users', userRoutes);

// Member 2 Core domain routes
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
