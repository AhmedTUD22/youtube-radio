// ===== مشغل صوتي بديل يعمل في الخلفية =====

class BackgroundAudioPlayer {
  constructor() {
    this.audio = new Audio();
    this.isReady = false;
    this.isPlaying = false;
    this.currentVideoId = null;
    this.duration = 0;
    this.onStateChange = null;
    this.onReady = null;
    
    this.setupAudio();
  }
  
  setupAudio() {
    // إعدادات الصوت
    this.audio.preload = 'auto';
    this.audio.volume = 0.7;
    
    // الأحداث
    this.audio.addEventListener('loadedmetadata', () => {
      this.duration = this.audio.duration;
      this.isReady = true;
      if (this.onReady) this.onReady();
    });
    
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      if (this.onStateChange) this.onStateChange({ data: 1 }); // PLAYING
      this.updateMediaSession();
    });
    
    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      if (this.onStateChange) this.onStateChange({ data: 2 }); // PAUSED
    });
    
    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      if (this.onStateChange) this.onStateChange({ data: 0 }); // ENDED
    });
    
    this.audio.addEventListener('error', (e) => {
      console.error('خطأ في تحميل الصوت:', e);
      // محاولة إعادة التحميل
      setTimeout(() => {
        if (this.currentVideoId) {
          this.loadVideoById(this.currentVideoId);
        }
      }, 2000);
    });
    
    // منع التوقف في الخلفية
    this.audio.addEventListener('suspend', () => {
      console.log('محاولة منع التوقف');
      if (this.isPlaying) {
        this.audio.play().catch(e => console.log('خطأ في إعادة التشغيل:', e));
      }
    });
  }
  
  async loadVideoById(videoId) {
    this.currentVideoId = videoId;
    
    try {
      // الحصول على رابط الصوت من YouTube
      const audioUrl = await this.getAudioUrl(videoId);
      
      if (audioUrl) {
        this.audio.src = audioUrl;
        this.audio.load();
        
        // تشغيل تلقائي
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log('خطأ في التشغيل التلقائي:', error);
          });
        }
      }
    } catch (error) {
      console.error('خطأ في تحميل الفيديو:', error);
    }
  }
  
  async getAudioUrl(videoId) {
    try {
      // استخدام API بديل للحصول على رابط الصوت
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
      const html = await response.text();
      
      // البحث عن رابط الصوت في HTML
      // هذا حل مؤقت - في الإنتاج استخدم API مخصص
      
      // حل بديل: استخدام iframe مخفي
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`;
    } catch (error) {
      console.error('خطأ في الحصول على رابط الصوت:', error);
      return null;
    }
  }
  
  playVideo() {
    if (this.audio.paused) {
      this.audio.play().catch(e => console.log('خطأ في التشغيل:', e));
    }
  }
  
  pauseVideo() {
    if (!this.audio.paused) {
      this.audio.pause();
    }
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
    if (this.audio.paused) return 2; // PAUSED
    return -1; // UNSTARTED
  }
  
  updateMediaSession() {
    if ('mediaSession' in navigator && currentVideoData) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentVideoData.title || 'راديو يوتيوب',
        artist: currentVideoData.channel || 'قناة يوتيوب',
        album: 'راديو يوتيوب',
        artwork: [
          { src: currentVideoData.thumbnail, sizes: '96x96', type: 'image/jpg' },
          { src: currentVideoData.thumbnail, sizes: '128x128', type: 'image/jpg' },
          { src: currentVideoData.thumbnail, sizes: '192x192', type: 'image/jpg' },
          { src: currentVideoData.thumbnail, sizes: '256x256', type: 'image/jpg' },
          { src: currentVideoData.thumbnail, sizes: '384x384', type: 'image/jpg' },
          { src: currentVideoData.thumbnail, sizes: '512x512', type: 'image/jpg' }
        ]
      });
      
      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
    }
  }
}

// تصدير المشغل
window.BackgroundAudioPlayer = BackgroundAudioPlayer;

console.log('✅ مشغل الصوت الخلفي جاهز');
