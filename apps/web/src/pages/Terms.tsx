import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Terms() {
  useEffect(() => {
    const id = 'termly-jssdk';
    if (document.getElementById(id)) return;
    const js = document.createElement('script');
    js.id = id;
    js.src = 'https://app.termly.io/embed-policy.min.js';
    document.body.appendChild(js);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/">
            <img src="/logo.svg" alt="WordBeacon" className="h-8" />
          </Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div
          data-id="a9c60c53-d854-4de7-afd1-1a952f875621"
          data-type="iframe"
          // @ts-expect-error termly embed attribute
          name="termly-embed"
        />
      </main>
    </div>
  );
}
