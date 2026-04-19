import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Support = () => {
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
          <h1 className="text-4xl font-light tracking-tight mb-3">Support</h1>
          <p className="text-muted-foreground">
            Need help with Rhythm Focus? We're here.
          </p>
        </header>

        <div className="space-y-8 text-base leading-relaxed">
          <section>
            <h2 className="text-xl font-medium mb-3">Get in touch</h2>
            <p className="text-muted-foreground">
              Email us anytime at{" "}
              <a
                href="mailto:hello@dawncreative.com"
                className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
              >
                hello@dawncreative.com
              </a>
              . We typically reply within 1–2 business days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">Frequently asked questions</h2>

            <div className="space-y-6 mt-4">
              <div>
                <h3 className="font-medium mb-2">How does the Pomodoro timer work?</h3>
                <p className="text-muted-foreground">
                  Rhythm Focus uses the classic 25/5 Pomodoro sequence: 25 minutes of
                  focused work, followed by a 5-minute break. After every four focus
                  sessions, you'll get a longer 30-minute break to fully reset.
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-2">Do I need a Spotify account?</h3>
                <p className="text-muted-foreground">
                  No — Rhythm Focus works perfectly without one. If you do connect
                  Spotify, you can play your own focus playlists during sessions. A
                  Spotify Premium account is required for in-app playback control.
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-2">Why isn't my Spotify playing?</h3>
                <p className="text-muted-foreground">
                  Spotify playback requires an active Premium subscription and at
                  least one Spotify device (phone, desktop app, or web player) to be
                  open. Try opening Spotify on any device, then reconnecting from
                  the audio settings.
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-2">Where is my data stored?</h3>
                <p className="text-muted-foreground">
                  All your settings and session data live on your device only. We
                  don't have servers tracking your usage. See our{" "}
                  <Link
                    to="/privacy"
                    className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
                  >
                    Privacy Policy
                  </Link>{" "}
                  for details.
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-2">Can I customize the timer lengths?</h3>
                <p className="text-muted-foreground">
                  The current version uses the research-backed default 25/5/30
                  sequence. Custom intervals are on our roadmap for a future update.
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-2">
                  Will you support Apple Music or other services?
                </h3>
                <p className="text-muted-foreground">
                  Apple Music support is on our roadmap. Have another service you'd
                  love to see? Email us — we read every request.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-medium mb-3">Feature requests &amp; feedback</h2>
            <p className="text-muted-foreground">
              We build Rhythm Focus for people who care about deep work. If you have
              ideas, frustrations, or feedback, please share them. Your input shapes
              what we build next.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
};

export default Support;
