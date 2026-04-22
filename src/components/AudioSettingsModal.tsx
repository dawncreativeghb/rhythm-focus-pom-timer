import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Upload, Volume2, Trash2, Music, Bell, X, Loader2, ExternalLink, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { isYouTubeSupported } from '@/lib/platform';
import type { AudioSettings } from '@/hooks/useAudioSettings';

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
}

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AudioSettings;
  onSetFocusMusic: (file: File | null) => void;
  onSetBreakChime: (file: File | null) => void;
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

export function AudioSettingsModal({
  isOpen,
  onClose,
  settings,
  onSetFocusMusic,
  onSetBreakChime,
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

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[85dvh] max-w-md -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl bg-card p-5 shadow-xl sm:p-6"
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
                      <Input
                        placeholder="Paste Spotify link or URI"
                        value={settings.spotifyFocusUri}
                        onChange={(e) => onSetSpotifyFocusUri(normalizeSpotifyUri(e.target.value))}
                        className="text-xs"
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
                      <Input
                        placeholder="Paste Spotify link or URI"
                        value={settings.spotifyBreakUri}
                        onChange={(e) => onSetSpotifyBreakUri(normalizeSpotifyUri(e.target.value))}
                        className="text-xs"
                      />
                    )}

                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <ExternalLink className="h-3 w-3" />
                      Paste any Spotify share link — we'll convert it automatically
                    </p>
                  </div>
                )}
              </div>

              <FileUploadRow
                label="Focus Music"
                description="Plays during focus sessions"
                icon={<Music className="h-5 w-5" />}
                file={settings.focusMusic}
                enabled={settings.focusMusicEnabled}
                onToggle={onToggleFocusMusic}
                onFileSelect={(file) => onSetFocusMusic(file)}
              />

              <FileUploadRow
                label="Break Chime"
                description="Plays when break starts"
                icon={<Bell className="h-5 w-5" />}
                file={settings.breakChime}
                enabled={settings.breakChimeEnabled}
                onToggle={onToggleBreakChime}
                onFileSelect={(file) => onSetBreakChime(file)}
              />

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
        </>
      )}
    </AnimatePresence>
  );
}
