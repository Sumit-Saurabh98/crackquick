/** Minimal typings for the YouTube IFrame Player API (https://developers.google.com/youtube/iframe_api_reference). */
declare namespace YT {
  interface PlayerEvent {
    target: Player;
    data: number;
  }
  interface PlayerOptions {
    width?: number | string;
    height?: number | string;
    videoId?: string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (e: PlayerEvent) => void;
      onStateChange?: (e: PlayerEvent) => void;
      onError?: (e: PlayerEvent) => void;
    };
  }
  class Player {
    constructor(el: HTMLElement | string, options: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    nextVideo(): void;
    previousVideo(): void;
    getPlayerState(): number;
    getPlaylist(): string[] | null;
    getPlaylistIndex(): number;
    getVideoData(): { title?: string; author?: string };
    destroy(): void;
  }
}

interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
