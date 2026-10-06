import { create } from 'zustand';
import { iosAudio } from '@/lib/iosAudio';

export type AccentColor = 'blue' | 'purple' | 'green' | 'amber' | 'cyan' | 'rose';
export type FontFamily = 'sf-pro' | 'inter' | 'geist' | 'jetbrains' | 'new-york';

interface UIState {
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  controlCenterOpen: boolean;
  soundEnabled: boolean;
  accentColor: AccentColor;
  fontFamily: FontFamily;
  confidenceThreshold: number; // 0 - 100
  vectorTopK: number; // 1 - 20
  
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleControlCenter: () => void;
  setControlCenterOpen: (open: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setAccentColor: (color: AccentColor) => void;
  setFontFamily: (font: FontFamily) => void;
  setConfidenceThreshold: (val: number) => void;
  setVectorTopK: (val: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  commandPaletteOpen: false,
  controlCenterOpen: false,
  soundEnabled: typeof window !== 'undefined' ? (localStorage.getItem('quorum_sound_enabled') !== 'false') : true,
  accentColor: typeof window !== 'undefined' ? (localStorage.getItem('quorum_accent') as AccentColor || 'blue') : 'blue',
  fontFamily: typeof window !== 'undefined' ? (localStorage.getItem('quorum_font') as FontFamily || 'sf-pro') : 'sf-pro',
  confidenceThreshold: 85,
  vectorTopK: 8,

  toggleSidebar: () => {
    iosAudio.playTap();
    set((s) => ({ sidebarOpen: !s.sidebarOpen }));
  },
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  
  toggleCommandPalette: () => {
    iosAudio.playPop();
    set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen }));
  },
  setCommandPaletteOpen: (open: boolean) => {
    if (open) iosAudio.playPop();
    set({ commandPaletteOpen: open });
  },

  toggleControlCenter: () => {
    iosAudio.playPop();
    set((s) => ({ controlCenterOpen: !s.controlCenterOpen }));
  },
  setControlCenterOpen: (open: boolean) => {
    if (open) iosAudio.playPop();
    set({ controlCenterOpen: open });
  },

  setSoundEnabled: (enabled: boolean) => {
    iosAudio.setEnabled(enabled);
    if (enabled) iosAudio.playSuccess();
    set({ soundEnabled: enabled });
  },

  setAccentColor: (accentColor: AccentColor) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('quorum_accent', accentColor);
      document.documentElement.setAttribute('data-accent', accentColor);
    }
    iosAudio.playSwitch(true);
    set({ accentColor });
  },

  setFontFamily: (fontFamily: FontFamily) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('quorum_font', fontFamily);
      document.documentElement.setAttribute('data-font', fontFamily);
    }
    iosAudio.playTap();
    set({ fontFamily });
  },

  setConfidenceThreshold: (confidenceThreshold: number) => {
    set({ confidenceThreshold });
  },

  setVectorTopK: (vectorTopK: number) => {
    set({ vectorTopK });
  },
}));
