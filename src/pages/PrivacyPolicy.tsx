import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
  const lastUpdated = "April 19, 2026";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <article className="mx-auto max-w-2xl px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </Link>

        <header className="mb-10">
          <h1 className="text-4xl font-light tracking-tight mb-3">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </header>

        <div className="space-y-8 text-base leading-relaxed">
          <section>
            <h2 className="text-xl font-medium mb-3">Overview</h2>
            <p className="text-muted-foreground">
              Rhythm Focus ("we," "our," or "the app") is a Pomodoro timer
              designed with privacy at its core. We believe your focus time is
              yours alone — we collect as little data as possible.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">What we collect</h2>
            <p className="text-muted-foreground mb-3">
              <strong className="text-foreground">Nothing personal by default.</strong>{" "}
              Rhythm Focus does not require an account, does not track you across
              apps, and does not collect analytics about your usage.
            </p>
            <p className="text-muted-foreground">
              Your timer settings, audio preferences, and session data are stored
              locally on your device only.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">Spotify integration (optional)</h2>
            <p className="text-muted-foreground mb-3">
              Rhythm Focus uses the official Spotify Web API and Web Playback SDK
              under Spotify's{" "}
              <a
                href="https://developer.spotify.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
              >
                Developer Terms
              </a>
              . If you choose to connect your Spotify account, here's exactly what happens:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">Scopes we request:</strong>{" "}
                <code className="text-xs">streaming</code>,{" "}
                <code className="text-xs">user-read-email</code>,{" "}
                <code className="text-xs">user-read-private</code>,{" "}
                <code className="text-xs">user-modify-playback-state</code>,{" "}
                <code className="text-xs">user-read-playback-state</code> — only what's
                needed to play your chosen playlist during sessions.
              </li>
              <li>
                Your Spotify access and refresh tokens are stored only in your
                browser's local storage on your device. They are never sent to or
                stored on our servers.
              </li>
              <li>
                We never read, store, or share your listening history, library,
                playlists' contents, or personal Spotify data beyond your display
                name and account type (used to show "Connected as …" and to verify
                Premium status).
              </li>
              <li>
                Spotify data is never shared with third parties, advertisers, or
                analytics services.
              </li>
              <li>
                You can disconnect Spotify at any time from the audio settings
                panel — this clears all stored tokens immediately. You can also
                revoke access directly from your{" "}
                <a
                  href="https://www.spotify.com/account/apps/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
                >
                  Spotify account apps page
                </a>
                .
              </li>
              <li>
                Spotify is the data controller for your Spotify account data —
                see{" "}
                <a
                  href="https://www.spotify.com/legal/privacy-policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
                >
                  Spotify's Privacy Policy
                </a>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">Data sharing</h2>
            <p className="text-muted-foreground">
              We do not sell, rent, or share your data with anyone. Period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">Children's privacy</h2>
            <p className="text-muted-foreground">
              Rhythm Focus is suitable for all ages and does not knowingly collect
              data from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">Changes to this policy</h2>
            <p className="text-muted-foreground">
              If we update this policy, we'll revise the "Last updated" date above.
              Material changes will be communicated through an in-app notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">Contact</h2>
            <p className="text-muted-foreground">
              Questions about this policy? Email{" "}
              <a
                href="mailto:hello@dawncreative.com"
                className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
              >
                hello@dawncreative.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  );
};

export default PrivacyPolicy;
