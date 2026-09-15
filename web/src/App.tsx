import { AppShell } from './components/AppShell';
import { Route, Routes } from 'react-router-dom';
import { EventDetailPage } from './routes/EventDetailPage';
import { EventsPage } from './routes/EventsPage';
import { MyBookingsPage } from './routes/MyBookingsPage';
import { RequireRole } from './auth/RequireRole';
import { ToastProvider } from './components/ToastProvider';

export function App() {
  return (
    <ToastProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<EventsPage />} />
          <Route path="/events/:eventId" element={<EventDetailPage />} />
          <Route path="/bookings" element={<RequireRole allowedRoles={['STUDENT', 'ADMIN']}><MyBookingsPage /></RequireRole>} />
        </Routes>
      </AppShell>
    </ToastProvider>
  );
}
