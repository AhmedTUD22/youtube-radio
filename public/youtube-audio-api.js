// ===== حل نهائي شامل لمشكلة التوقف في الخلفية =====

class BackgroundPlaybackManager {
  constructor() {
    this.wakeLock = null;
    this.keepAliveInterval = null;
    this.audioContext = null;
    this.silentNode = null;
    this.isActive = false;
    this.visibilityCheckInterval = null;
  }

  async init() {
    console.log('🎵 تهيئة نظام التشغيل في الخلفية...');
    
    // 1. إنشاء Audio Context للحفاظ على Audio Focus
    this.initAudioContext();
    
    // 2. تفعيل Wake Lock
    await this.requestWakeLock();
    
    // 3. بدء Keep Alive
    this.startKeepAlive();
    
    // 4. مراقبة حالة الرؤية
    this.monitorVisibility();
    
    // 5. منع توقف المتصفح
    this.preventBrowserSleep();
    
    this.isActive = true;
    console.log('✅ نظام التشغيل في الخلفية جاهز');
  }

  initAudioContext() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      
      // إنشاء oscillator صامت للحفاظ على Audio Context نشطاً
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // صوت منخفض جداً (غير مسموع تماماً)
      gainNode.gain.value = 0.00001;
      oscillator.frequency.value = 20;
      
      oscillator.start();
      this.silentNode = oscillator;
      
      console.log('✅ Audio Context مفعّل');
    } catch (err) {
      console.warn('⚠️ Audio Context غير مدعوم:', err);
    }
  }

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('✅ Wake Lock مفعّل');
        
        this.wakeLock.addEventListener('release', () => {
          console.log('⚠️ Wake Lock تم إلغاؤه - إعادة التفعيل...');
          if (this.isActive) {
            setTimeout(() => this.requestWakeLock(), 1000);
          }
        });
      }
    } catch (err) {
      console.warn('⚠️ Wake Lock غير متاح:', err);
    }
  }

  startKeepAlive() {
    if (this.keepAliveInterval) return;
    
    this.keepAliveInterval = setInterval(() => {
      // 1. إرسال ping للخادم
      if (window.socket && window.socket.connected) {
        window.socket.emit('ping');
      }
      
      // 2. تحديث Media Session
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = window.isPlaying ? 'playing' : 'paused';
      }
      
      // 3. إبقاء Audio Context نشطاً
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(e => console.log('Resume error:', e));
      }
      
      // 4. التحقق من حالة المشغل
      if (window.player && window.isPlaying) {
        const state = window.player.getPlayerState();
        if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING) {
          console.log('🔄 إعادة تشغيل تلقائي');
          window.player.playVideo();
        }
      }
    }, 3000);
    
    console.log('✅ Keep Alive مفعّل');
  }

  monitorVisibility() {
    document.addEventListener('visibilitychange', async () => {
      if (document.hidden) {
        console.log('📱 التطبيق في الخلفية - الحفاظ على التشغيل');
        
        // إعادة تشغيل فوري إذا توقف
        if (window.player && window.isPlaying) {
          setTimeout(() => {
            const state = window.player.getPlayerState();
            if (state !== YT.PlayerState.PLAYING) {
              window.player.playVideo();
            }
          }, 100);
          
          // فحص إضافي بعد ثانية
          setTimeout(() => {
            const state = window.player.getPlayerState();
            if (state !== YT.PlayerState.PLAYING) {
              window.player.playVideo();
            }
          }, 1000);
        }
        
        // تأكيد Audio Context
        if (this.audioContext && this.audioContext.state === 'suspended') {
          this.audioContext.resume();
        }
      } else {
        console.log('📱 التطبيق في المقدمة');
        
        // إعادة تفعيل Wake Lock
        if (!this.wakeLock || this.wakeLock.released) {
          await this.requestWakeLock();
        }
      }
    });
  }

  preventBrowserSleep() {
    // إنشاء فيديو صامت مخفي
    const video = document.createElement('video');
    video.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAu1tZGF0AAACrQYF//+p3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1NSByMjkwMSA3ZDBmZjIyIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxOCAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAD2WIhAAV/78dAAAAwUGaAQAB//+p';
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.style.display = 'none';
    video.style.position = 'fixed';
    video.style.top = '-9999px';
    document.body.appendChild(video);
    
    video.play().catch(e => console.log('Silent video error:', e));
    
    console.log('✅ منع النوم مفعّل');
  }

  async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('✅ إذن الإشعارات ممنوح');
        return true;
      }
    }
    return false;
  }

  destroy() {
    this.isActive = false;
    
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    
    if (this.visibilityCheckInterval) {
      clearInterval(this.visibilityCheckInterval);
      this.visibilityCheckInterval = null;
    }
    
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
    
    if (this.silentNode) {
      this.silentNode.stop();
      this.silentNode = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    console.log('⏹️ نظام التشغيل في الخلفية متوقف');
  }
}

// إنشاء مدير التشغيل في الخلفية
window.backgroundPlaybackManager = new BackgroundPlaybackManager();

// تفعيل تلقائي عند تحميل الصفحة
window.addEventListener('load', () => {
  // الانتظار لتفاعل المستخدم الأول
  const enableOnFirstInteraction = () => {
    window.backgroundPlaybackManager.init();
    window.backgroundPlaybackManager.requestNotificationPermission();
    
    // إزالة المستمع بعد التفعيل
    document.removeEventListener('click', enableOnFirstInteraction);
    document.removeEventListener('touchstart', enableOnFirstInteraction);
  };
  
  document.addEventListener('click', enableOnFirstInteraction, { once: true });
  document.addEventListener('touchstart', enableOnFirstInteraction, { once: true });
});

console.log('✅ نظام التشغيل في الخلفية محمّل وجاهز');
