import { AppShell } from './components/AppShell';

export function App() {
  return (
    <AppShell>
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">University community</p>
        <h1 id="page-title">Discover campus events</h1>
        <p>Find lectures, activities, and gatherings across campus.</p>
      </section>
    </AppShell>
  );
}
