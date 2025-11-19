// ===== YouTube Audio API - حل متقدم للتشغيل في الخلفية =====

class YouTubeAudioPlayer {
  constructor() {
    this.iframe = null;
    this.player = null;
    this.isReady = false;
    this.callbacks = {
      onReady: null,
      onStateChange: null
    };
    
    this.init();
  }
  
  init() {
    // إنشاء iframe مخفي
    this.iframe = document.createElement('iframe');
    this.iframe.style.display = 'none';
    this.iframe.allow = 'autoplay; encrypted-media';
    this.iframe.setAttribute('allowfullscreen', '');
    document.body.appendChild(this.iframe);
    
    // تحميل YouTube API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      
      window.onYouTubeIframeAPIReady = () => {
        this.createPlayer();
      };
    } else {
      this.createPlayer();
    }
  }
  
  createPlayer() {
    this.player = new YT.Player(this.iframe, {
      height: '0',
      width: '0',
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        enablejsapi: 1,
        origin: window.location.origin
      },
      events: {
        onReady: (event) => {
          this.isReady = true;
          this.player.setVolume(70);
          
          // تفعيل التشغيل في الخلفية
          this.enableBackgroundPlayback();
          
          if (this.callbacks.onReady) {
            this.callbacks.onReady(event);
          }
        },
        onStateChange: (event) => {
          if (this.callbacks.onStateChange) {
            this.callbacks.onStateChange(event);
          }
          
          // الحفاظ على التشغيل في الخلفية
          if (event.data === YT.PlayerState.PLAYING) {
            this.maintainPlayback();
          }
        }
      }
    });
  }
  
  enableBackgroundPlayback() {
    // 1. منع توقف الفيديو عند الخلفية
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isPlaying) {
        // إعادة التشغيل بعد 100ms
        setTimeout(() => {
          if (this.player && this.player.getPlayerState() !== YT.PlayerState.PLAYING) {
            this.player.playVideo();
          }
        }, 100);
      }
    });
    
    // 2. منع النوم
    this.preventSleep();
    
    // 3. Keep Alive
    this.startKeepAlive();
  }
  
  preventSleep() {
    // إنشاء فيديو صامت للحفاظ على التشغيل
    const silentVideo = document.createElement('video');
    silentVideo.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAu1tZGF0AAACrQYF//+p3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1NSByMjkwMSA3ZDBmZjIyIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxOCAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAD2WIhAAV/78dAAAAwUGaAQAB//+p');
    silentVideo.loop = true;
    silentVideo.muted = true;
    silentVideo.play().catch(e => console.log('Silent video error:', e));
  }
  
  maintainPlayback() {
    // فحص دوري للتأكد من استمرار التشغيل
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    
    this.keepAliveInterval = setInterval(() => {
      if (this.isPlaying && this.player) {
        const state = this.player.getPlayerState();
        if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING) {
          console.log('إعادة تشغيل تلقائي');
          this.player.playVideo();
        }
      }
    }, 3000);
  }
  
  startKeepAlive() {
    setInterval(() => {
      // ping للحفاظ على الاتصال
      if (this.player && this.isPlaying) {
        const time = this.player.getCurrentTime();
        // مجرد قراءة الوقت للحفاظ على النشاط
      }
    }, 5000);
  }
  
  // واجهة متوافقة مع YouTube API
  loadVideoById(videoId) {
    const audioUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // استخدام iframe مخفي مع autoplay
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&playsinline=1&controls=0&modestbranding=1&rel=0&origin=${window.location.origin}`;
    
    if (this.player && this.player.loadVideoById) {
      this.player.loadVideoById(videoId);
    }
  }
  
  playVideo() {
    this.audio.play().catch(e => {
      console.log('خطأ في التشغيل:', e);
      // محاولة مع تفاعل المستخدم
      document.addEventListener('click', () => {
        this.audio.play();
      }, { once: true });
    });
  }
  
  pauseVideo() {
    this.audio.pause();
  }
  
  stopVideo() {
    this.audio.pause();
    this.audio.currentTime = 0;
  }
  
  seekTo(seconds) {
    this.audio.currentTime = seconds;
  }
  
  getCurrentTime() {
    return this.audio.currentTime;
  }
  
  getDuration() {
    return this.audio.duration || 0;
  }
  
  setVolume(volume) {
    this.audio.volume = volume / 100;
  }
  
  getVolume() {
    return this.audio.volume * 100;
  }
  
  mute() {
    this.audio.muted = true;
  }
  
  unMute() {
    this.audio.muted = false;
  }
  
  isMuted() {
    return this.audio.muted;
  }
  
  setPlaybackRate(rate) {
    this.audio.playbackRate = rate;
  }
  
  getPlayerState() {
    if (this.audio.ended) return 0; // ENDED
    if (!this.audio.paused) return 1; // PLAYING
    if (this.audio.paused && this.audio.currentTime > 0) return 2; // PAUSED
    return -1; // UNSTARTED
  }
  
  updateMediaSession() {
    if ('mediaSession' in navigator && window.currentVideoData) {
      const videoData = window.currentVideoData;
      
      navigator.mediaSession.metadata = new MediaMetadata({
        title: videoData.title || 'راديو يوتيوب',
        artist: videoData.channel || 'قناة يوتيوب',
        album: 'راديو يوتيوب',
        artwork: [
          { src: videoData.thumbnail, sizes: '96x96', type: 'image/jpg' },
          { src: videoData.thumbnail, sizes: '128x128', type: 'image/jpg' },
          { src: videoData.thumbnail, sizes: '192x192', type: 'image/jpg' },
          { src: videoData.thumbnail, sizes: '256x256', type: 'image/jpg' },
          { src: videoData.thumbnail, sizes: '384x384', type: 'image/jpg' },
          { src: videoData.thumbnail, sizes: '512x512', type: 'image/jpg' }
        ]
      });
      
      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
      
      // أزرار التحكم
      navigator.mediaSession.setActionHandler('play', () => this.playVideo());
      navigator.mediaSession.setActionHandler('pause', () => this.pauseVideo());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.seekTo(0));
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (window.socket) window.socket.emit('skipVideo');
      });
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        this.seekTo(Math.max(0, this.getCurrentTime() - 10));
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        this.seekTo(Math.min(this.getDuration(), this.getCurrentTime() + 10));
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime) this.seekTo(details.seekTime);
      });
    }
  }
}

// Constants متوافقة مع YouTube API
window.YT = window.YT || {};
window.YT.PlayerState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5
};

console.log('✅ YouTube Audio API جاهز');
