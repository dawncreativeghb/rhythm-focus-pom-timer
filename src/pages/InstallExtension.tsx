import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InstallExtension() {
  const download = () => {
    fetch('/rhythm-flow-extension.zip')
      .then((res) => {
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'rhythm-flow-extension.zip';
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((err) => alert(err.message));
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col gap-8 px-6 py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to timer
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary">
          <Chrome className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Chrome Extension</h1>
        <p className="text-muted-foreground">
          Run Rhythm Flow as a popup in any Chromium browser — Chrome, Edge, Brave, Arc, Opera. The
          timer keeps running in the background even when the popup is closed.
        </p>
      </header>

      <Button onClick={download} size="lg" className="self-start gap-2">
        <Download className="h-5 w-5" /> Download extension (.zip)
      </Button>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Install in 4 steps</h2>
        <ol className="flex flex-col gap-3 text-sm">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              1
            </span>
            <span>Unzip the downloaded file.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              2
            </span>
            <span>
              Open <code className="rounded bg-secondary px-1.5 py-0.5">chrome://extensions</code>{' '}
              in your browser.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              3
            </span>
            <span>
              Enable <strong>Developer mode</strong> (toggle in the top-right).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              4
            </span>
            <span>
              Click <strong>Load unpacked</strong> and select the unzipped folder.
            </span>
          </li>
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          Pin the extension from the puzzle-piece menu so it's one click away in your toolbar.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-2 text-lg font-semibold">What's included</h2>
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          <li>• 25/5/30 minute focus + break cycles, long break after 4 sessions</li>
          <li>• Background timer with desktop notifications when sessions end</li>
          <li>• Quick "Open full app" button for Spotify + uploaded music features</li>
        </ul>
      </section>
    </main>
  );
}
