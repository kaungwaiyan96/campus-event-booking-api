import { AppShell } from './components/AppShell';
import { Route, Routes } from 'react-router-dom';
import { EventDetailPage } from './routes/EventDetailPage';
import { EventsPage } from './routes/EventsPage';
import { MyBookingsPage } from './routes/MyBookingsPage';
import { ManageEventsPage } from './routes/ManageEventsPage';
import { NotFoundPage } from './routes/NotFoundPage';
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
          <Route path="/manage/events" element={<RequireRole allowedRoles={['ORGANIZER', 'ADMIN']}><ManageEventsPage /></RequireRole>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </ToastProvider>
  );
}
