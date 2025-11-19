// ===== حل متقدم إضافي للتشغيل في الخلفية =====

class EnhancedBackgroundAudio {
  constructor() {
    this.wakeLock = null;
    this.keepAliveTimer = null;
    this.audioContext = null;
    this.silentOscillator = null;
    this.isEnabled = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async enable() {
    if (this.isEnabled) return;
    
    console.log('🎵 تفعيل التشغيل المحسّن في الخلفية...');
    
    // 1. Audio Context
    this.initAudioContext();
    
    // 2. Wake Lock
    await this.enableWakeLock();
    
    // 3. Keep Alive مع إعادة الاتصال
    this.startSmartKeepAlive();
    
    // 4. مراقبة الشبكة
    this.monitorNetwork();
    
    // 5. معالجة تغيير الرؤية المحسّنة
    this.setupVisibilityHandler();
    
    // 6. منع توقف المتصفح
    this.preventBrowserPause();
    
    this.isEnabled = true;
    console.log('✅ التشغيل المحسّن في الخلفية مفعّل');
  }

  initAudioContext() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioContextClass();
      }
      
      // Oscillator صامت
      if (!this.silentOscillator) {
        this.silentOscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        this.silentOscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        gainNode.gain.value = 0.00001;
        this.silentOscillator.frequency.value = 20;
        this.silentOscillator.start();
      }
      
      // استئناف تلقائي عند التعليق
      this.audioContext.addEventListener('statechange', () => {
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume();
        }
      });
      
      console.log('✅ Audio Context محسّن مفعّل');
    } catch (err) {
      console.warn('⚠️ Audio Context error:', err);
    }
  }

  async enableWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('✅ Wake Lock مفعّل');
        
        this.wakeLock.addEventListener('release', async () => {
          console.log('⚠️ Wake Lock released - إعادة التفعيل...');
          if (this.isEnabled) {
            await new Promise(resolve => setTimeout(resolve, 500));
            await this.enableWakeLock();
          }
        });
      }
    } catch (err) {
      console.warn('⚠️ Wake Lock error:', err);
    }
  }

  startSmartKeepAlive() {
    if (this.keepAliveTimer) return;
    
    this.keepAliveTimer = setInterval(() => {
      // 1. Ping الخادم
      if (window.socket && window.socket.connected) {
        window.socket.emit('ping');
        this.reconnectAttempts = 0;
      } else if (window.socket && this.reconnectAttempts < this.maxReconnectAttempts) {
        console.log('🔄 محاولة إعادة الاتصال...');
        window.socket.connect();
        this.reconnectAttempts++;
      }
      
      // 2. تحديث Media Session
      if ('mediaSession' in navigator && window.isPlaying) {
        navigator.mediaSession.playbackState = 'playing';
      }
      
      // 3. Audio Context
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      
      // 4. فحص حالة المشغل
      if (window.player && window.isPlaying && window.isPlayerReady) {
        try {
          const state = window.player.getPlayerState();
          if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING) {
            console.log('🔄 إعادة تشغيل - الحالة:', state);
            window.player.playVideo();
          }
        } catch (err) {
          console.warn('⚠️ Player check error:', err);
        }
      }
    }, 2000); // كل ثانيتين
    
    console.log('✅ Smart Keep Alive مفعّل');
  }

  monitorNetwork() {
    if ('connection' in navigator) {
      navigator.connection.addEventListener('change', () => {
        console.log('🌐 تغيير في الشبكة:', navigator.connection.effectiveType);
        
        // إعادة الاتصال عند عودة الشبكة
        if (window.socket && !window.socket.connected) {
          window.socket.connect();
        }
      });
    }
    
    // مراقبة الاتصال بالإنترنت
    window.addEventListener('online', () => {
      console.log('🌐 عودة الاتصال بالإنترنت');
      if (window.socket && !window.socket.connected) {
        window.socket.connect();
      }
    });
    
    window.addEventListener('offline', () => {
      console.log('⚠️ انقطاع الاتصال بالإنترنت');
    });
  }

  setupVisibilityHandler() {
    document.addEventListener('visibilitychange', async () => {
      if (document.hidden) {
        console.log('📱 الخلفية - تفعيل الحماية القصوى');
        
        // محاولات متعددة لإعادة التشغيل
        const retryPlayback = async (attempts = 3) => {
          for (let i = 0; i < attempts; i++) {
            await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
            
            if (window.player && window.isPlaying && window.isPlayerReady) {
              try {
                const state = window.player.getPlayerState();
                if (state !== YT.PlayerState.PLAYING) {
                  console.log(`🔄 محاولة ${i + 1} لإعادة التشغيل`);
                  window.player.playVideo();
                }
              } catch (err) {
                console.warn('⚠️ Retry error:', err);
              }
            }
          }
        };
        
        retryPlayback();
        
        // تأكيد Audio Context
        if (this.audioContext && this.audioContext.state === 'suspended') {
          this.audioContext.resume();
        }
      } else {
        console.log('📱 المقدمة - تحديث الحالة');
        
        // إعادة تفعيل Wake Lock
        if (!this.wakeLock || this.wakeLock.released) {
          await this.enableWakeLock();
        }
        
        // التحقق من حالة التشغيل
        if (window.player && window.isPlaying && window.isPlayerReady) {
          const state = window.player.getPlayerState();
          if (state !== YT.PlayerState.PLAYING) {
            window.player.playVideo();
          }
        }
      }
    });
  }

  preventBrowserPause() {
    // فيديو صامت مخفي
    const video = document.createElement('video');
    video.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAu1tZGF0AAACrQYF//+p3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1NSByMjkwMSA3ZDBmZjIyIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxOCAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAD2WIhAAV/78dAAAAwUGaAQAB//+p';
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(video);
    
    video.play().catch(e => console.log('Silent video:', e));
    
    // Audio صامت إضافي
    const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    audio.loop = true;
    audio.volume = 0.01;
    audio.play().catch(e => console.log('Silent audio:', e));
  }

  disable() {
    this.isEnabled = false;
    
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
    
    if (this.silentOscillator) {
      this.silentOscillator.stop();
      this.silentOscillator = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    console.log('⏹️ التشغيل المحسّن في الخلفية متوقف');
  }
}

// إنشاء نسخة عامة
window.enhancedBackgroundAudio = new EnhancedBackgroundAudio();

// تفعيل تلقائي عند أول تفاعل
const enableOnInteraction = () => {
  window.enhancedBackgroundAudio.enable();
  document.removeEventListener('click', enableOnInteraction);
  document.removeEventListener('touchstart', enableOnInteraction);
};

document.addEventListener('click', enableOnInteraction, { once: true });
document.addEventListener('touchstart', enableOnInteraction, { once: true });

console.log('✅ Enhanced Background Audio جاهز');
