import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Upload, Volume2, Trash2, Music, Bell, X, Loader2, ExternalLink, Youtube, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { isYouTubeSupported } from '@/lib/platform';
import type { AudioSettings } from '@/hooks/useAudioSettings';
import type { SpotifyPlaylist } from '@/hooks/useSpotify';

// Convert a Spotify share URL (https://open.spotify.com/playlist/ID?si=...)
// or a raw ID into a Spotify URI (spotify:playlist:ID). Returns input unchanged
// if it's already a URI or unrecognized.
function normalizeSpotifyUri(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('spotify:')) return trimmed;
  const match = trimmed.match(
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(playlist|album|track|artist|episode|show)\/([a-zA-Z0-9]+)/
  );
  if (match) return `spotify:${match[1]}:${match[2]}`;
  return trimmed;
}

interface SpotifyState {
  isConnected: boolean;
  isPremium: boolean;
  profile: { display_name: string; product: string } | null;
  playerReady: boolean;
  isLoading: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  fetchPlaylists: () => Promise<SpotifyPlaylist[]>;
}

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AudioSettings;
  onSetFocusMusic: (file: File | null) => void;
  
  onSetBreakMusic: (file: File | null) => void;
  onToggleFocusMusic: () => void;
  onToggleBreakChime: () => void;
  onToggleBreakMusic: () => void;
  onSetVolume: (volume: number) => void;
  onSetSpotifyFocusUri: (uri: string) => void;
  onSetSpotifyBreakUri: (uri: string) => void;
  onToggleUseSpotifyForFocus: () => void;
  onToggleUseSpotifyForBreak: () => void;
  onSetYouTubeFocusUrl: (url: string) => void;
  onSetYouTubeBreakUrl: (url: string) => void;
  onToggleUseYouTubeForFocus: () => void;
  onToggleUseYouTubeForBreak: () => void;
  spotify: SpotifyState;
}

interface FileUploadRowProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  file: { name: string } | null;
  enabled: boolean;
  onToggle: () => void;
  onFileSelect: (file: File | null) => void;
  accept?: string;
}

function FileUploadRow({
  label,
  description,
  icon,
  file,
  enabled,
  onToggle,
  onFileSelect,
  accept = 'audio/*',
}: FileUploadRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) onFileSelect(selectedFile);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-secondary/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
            {icon}
          </div>
          <div>
            <p className="font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="flex-1"
        >
          <Upload className="mr-2 h-4 w-4" />
          {file ? 'Replace' : 'Upload'}
        </Button>
        {file && (
          <>
            <span className="flex-1 truncate text-sm text-muted-foreground">{file.name}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onFileSelect(null)}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// Tappable list of the user's own Spotify playlists, with a "paste a link
// instead" fallback for shared/public playlists not in their library.
interface PlaylistPickerProps {
  playlists: SpotifyPlaylist[];
  loading: boolean;
  selectedUri: string;
  onSelect: (uri: string) => void;
}

function PlaylistPicker({ playlists, loading, selectedUri, onSelect }: PlaylistPickerProps) {
  const [showPaste, setShowPaste] = useState(false);
  // A selected URI that isn't one of the fetched playlists was pasted in.
  const selectedIsCustom =
    !!selectedUri && !playlists.some((p) => p.uri === selectedUri);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your playlists…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {playlists.length > 0 && (
        <div className="max-h-44 overflow-y-auto overscroll-contain rounded-lg border border-border/50">
          {playlists.map((p) => {
            const selected = p.uri === selectedUri;
            return (
              <button
                key={p.uri}
                type="button"
                onClick={() => onSelect(p.uri)}
                aria-pressed={selected}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary ${
                  selected ? 'bg-primary/15' : ''
                }`}
              >
                {p.image ? (
                  <img src={p.image} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-secondary">
                    <Music className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.name}</span>
                {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}

      {playlists.length === 0 && !showPaste && (
        <p className="text-xs text-muted-foreground">
          No playlists found. If you just reconnected, give it a moment — or paste a link below.
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowPaste((v) => !v)}
        className="self-start text-[10px] text-muted-foreground underline-offset-2 hover:underline"
      >
        {showPaste ? 'Hide link box' : 'Or paste a Spotify link instead'}
      </button>

      {(showPaste || selectedIsCustom) && (
        <Input
          placeholder="Paste Spotify link or URI"
          value={selectedUri}
          onChange={(e) => onSelect(normalizeSpotifyUri(e.target.value))}
          className="text-xs"
        />
      )}
    </div>
  );
}

export function AudioSettingsModal({
  isOpen,
  onClose,
  settings,
  onSetFocusMusic,
  
  onSetBreakMusic,
  onToggleFocusMusic,
  onToggleBreakChime,
  onToggleBreakMusic,
  onSetVolume,
  onSetSpotifyFocusUri,
  onSetSpotifyBreakUri,
  onToggleUseSpotifyForFocus,
  onToggleUseSpotifyForBreak,
  onSetYouTubeFocusUrl,
  onSetYouTubeBreakUrl,
  onToggleUseYouTubeForFocus,
  onToggleUseYouTubeForBreak,
  spotify,
}: AudioSettingsModalProps) {
  const youtubeAvailable = isYouTubeSupported();

  // Load the user's Spotify playlists once the modal is open and connected.
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const loadPlaylists = spotify.fetchPlaylists;
  useEffect(() => {
    if (!isOpen || !spotify.isConnected) return;
    let cancelled = false;
    setPlaylistsLoading(true);
    loadPlaylists()
      .then((list) => {
        if (!cancelled) setPlaylists(list);
      })
      .finally(() => {
        if (!cancelled) setPlaylistsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, spotify.isConnected, loadPlaylists]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Scroll container. Outer div is the ONLY scroller; the inner flex
              uses min-h-full so it centers the modal when short and grows past
              the viewport when tall — so the whole modal (incl. Done) is always
              reachable. This nesting is the cross-browser-safe pattern: Safari
              mishandles auto-margin centering inside an overflow flex container. */}
          <div
            className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
            onClick={onClose}
          >
          <div className="flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl sm:p-6"
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <Settings className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Audio Settings</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Volume */}
              <div className="flex flex-col gap-3 rounded-lg bg-secondary/50 p-4">
                <div className="flex items-center gap-3">
                  <Volume2 className="h-5 w-5 text-primary" />
                  <Label className="font-medium">Master Volume</Label>
                  <span className="ml-auto text-sm text-muted-foreground">
                    {Math.round(settings.volume * 100)}%
                  </span>
                </div>
                <Slider
                  value={[settings.volume * 100]}
                  onValueChange={([val]) => onSetVolume(val / 100)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Spotify */}
              <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-secondary/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1DB954]/20 text-[#1DB954]">
                      <Music className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Spotify</p>
                      <p className="text-xs text-muted-foreground">
                        {spotify.isConnected
                          ? spotify.profile
                            ? `${spotify.profile.display_name} • ${spotify.profile.product}`
                            : 'Connected'
                          : 'Premium required for playback'}
                      </p>
                    </div>
                  </div>
                  {spotify.isConnected ? (
                    <Button variant="outline" size="sm" onClick={spotify.disconnect}>
                      Disconnect
                    </Button>
                  ) : (
                    <Button size="sm" onClick={spotify.connect} disabled={spotify.isLoading}>
                      {spotify.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
                    </Button>
                  )}
                </div>

                {spotify.error && (
                  <p className="text-xs text-destructive">{spotify.error}</p>
                )}

                {spotify.isConnected && !spotify.isPremium && spotify.profile && (
                  <p className="text-xs text-destructive">
                    Spotify Premium is required to control playback from this app.
                  </p>
                )}

                {spotify.isConnected && (
                  <div className="flex flex-col gap-3 border-t border-border/50 pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs">Use Spotify for Focus</Label>
                      <Switch
                        checked={settings.useSpotifyForFocus}
                        onCheckedChange={onToggleUseSpotifyForFocus}
                      />
                    </div>
                    {settings.useSpotifyForFocus && (
                      <PlaylistPicker
                        playlists={playlists}
                        loading={playlistsLoading}
                        selectedUri={settings.spotifyFocusUri}
                        onSelect={onSetSpotifyFocusUri}
                      />
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs">Use Spotify for Break</Label>
                      <Switch
                        checked={settings.useSpotifyForBreak}
                        onCheckedChange={onToggleUseSpotifyForBreak}
                      />
                    </div>
                    {settings.useSpotifyForBreak && (
                      <PlaylistPicker
                        playlists={playlists}
                        loading={playlistsLoading}
                        selectedUri={settings.spotifyBreakUri}
                        onSelect={onSetSpotifyBreakUri}
                      />
                    )}

                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Music className="h-3 w-3" />
                      Tap a playlist for focus and for break — no copy-paste needed
                    </p>
                  </div>
                )}
              </div>

              {/* YouTube — desktop web only */}
              {youtubeAvailable && (
                <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-secondary/50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF0000]/20 text-[#FF0000]">
                      <Youtube className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">YouTube</p>
                      <p className="text-xs text-muted-foreground">Desktop only • visible mini player</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-border/50 pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs">Use YouTube for Focus</Label>
                      <Switch
                        checked={settings.useYouTubeForFocus}
                        onCheckedChange={onToggleUseYouTubeForFocus}
                      />
                    </div>
                    {(settings.useYouTubeForFocus || settings.youtubeFocusUrl) && (
                      <Input
                        placeholder="Paste YouTube link (video or playlist)"
                        value={settings.youtubeFocusUrl}
                        onChange={(e) => onSetYouTubeFocusUrl(e.target.value)}
                        className="text-xs"
                      />
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs">Use YouTube for Break</Label>
                      <Switch
                        checked={settings.useYouTubeForBreak}
                        onCheckedChange={onToggleUseYouTubeForBreak}
                      />
                    </div>
                    {(settings.useYouTubeForBreak || settings.youtubeBreakUrl) && (
                      <Input
                        placeholder="Paste YouTube link (video or playlist)"
                        value={settings.youtubeBreakUrl}
                        onChange={(e) => onSetYouTubeBreakUrl(e.target.value)}
                        className="text-xs"
                      />
                    )}

                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <ExternalLink className="h-3 w-3" />
                      Lofi livestreams, playlists, or any YouTube video URL works
                    </p>
                  </div>
                </div>
              )}

              <FileUploadRow
                label="Focus Music"
                description="Plays during focus sessions"
                icon={<Music className="h-5 w-5" />}
                file={settings.focusMusic}
                enabled={settings.focusMusicEnabled}
                onToggle={onToggleFocusMusic}
                onFileSelect={(file) => onSetFocusMusic(file)}
              />

              {/* Break chime — built-in sound, no upload */}
              <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Break Chime</p>
                    <p className="text-xs text-muted-foreground">Soft bell when a break starts</p>
                  </div>
                </div>
                <Switch checked={settings.breakChimeEnabled} onCheckedChange={onToggleBreakChime} />
              </div>

              <FileUploadRow
                label="Break Music"
                description="Plays during break time"
                icon={<Music className="h-5 w-5" />}
                file={settings.breakMusic}
                enabled={settings.breakMusicEnabled}
                onToggle={onToggleBreakMusic}
                onFileSelect={(file) => onSetBreakMusic(file)}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={onClose}>Done</Button>
            </div>
          </motion.div>
          </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
