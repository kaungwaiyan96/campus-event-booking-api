import { AppShell } from './components/AppShell';
import { Route, Routes } from 'react-router-dom';
import { EventDetailPage } from './routes/EventDetailPage';
import { EventsPage } from './routes/EventsPage';

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<EventsPage />} />
        <Route path="/events/:eventId" element={<EventDetailPage />} />
      </Routes>
    </AppShell>
  );
}
