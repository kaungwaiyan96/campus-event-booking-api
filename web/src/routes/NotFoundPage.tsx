import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="not-found-page" aria-labelledby="not-found-title">
      <p className="eyebrow">Campus Events</p>
      <h1 id="not-found-title">Page not found</h1>
      <p>The page you requested is not available. You can return to the campus event listing.</p>
      <Link className="text-link" to="/">Browse events</Link>
    </section>
  );
}
