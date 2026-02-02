import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Upload, Volume2, Trash2, Music, Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { AudioSettings } from '@/hooks/useAudioSettings';

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
  accept = 'audio/*'
}: FileUploadRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
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
            <span className="flex-1 truncate text-sm text-muted-foreground">
              {file.name}
            </span>
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
}: AudioSettingsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl"
          >
            {/* Header */}
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

            {/* Content */}
            <div className="flex flex-col gap-4">
              {/* Volume Slider */}
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

              {/* Focus Music */}
              <FileUploadRow
                label="Focus Music"
                description="Plays during focus sessions"
                icon={<Music className="h-5 w-5" />}
                file={settings.focusMusic}
                enabled={settings.focusMusicEnabled}
                onToggle={onToggleFocusMusic}
                onFileSelect={(file) => onSetFocusMusic(file)}
              />

              {/* Break Chime */}
              <FileUploadRow
                label="Break Chime"
                description="Plays when break starts"
                icon={<Bell className="h-5 w-5" />}
                file={settings.breakChime}
                enabled={settings.breakChimeEnabled}
                onToggle={onToggleBreakChime}
                onFileSelect={(file) => onSetBreakChime(file)}
              />

              {/* Break Music */}
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

            {/* Footer */}
            <div className="mt-6 flex justify-end">
              <Button onClick={onClose}>Done</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
