// ===== حل فعال للتشغيل في الخلفية =====

let wakeLock = null;
let keepAliveInterval = null;

// تفعيل Wake Lock
async function enableWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('✅ Wake Lock مفعّل');
      
      wakeLock.addEventListener('release', () => {
        console.log('Wake Lock تم إلغاؤه');
        wakeLock = null;
      });
    }
  } catch (err) {
    console.log('Wake Lock غير متاح');
  }
}

// Keep Alive للحفاظ على التشغيل
function startKeepAlive() {
  if (keepAliveInterval) return;
  
  keepAliveInterval = setInterval(() => {
    // تحديث Media Session
    if ('mediaSession' in navigator && window.isPlaying) {
      navigator.mediaSession.playbackState = 'playing';
    }
    
    // فحص حالة المشغل وإعادة التشغيل إذا توقف
    if (window.player && window.isPlaying && window.isPlayerReady) {
      try {
        const state = window.player.getPlayerState();
        if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING) {
          console.log('🔄 إعادة تشغيل');
          window.player.playVideo();
        }
      } catch (err) {
        // تجاهل الأخطاء
      }
    }
  }, 5000); // كل 5 ثواني
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// معالجة تغيير الرؤية
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) {
    console.log('📱 في الخلفية - تفعيل الحماية');
    startKeepAlive();
    
    // محاولة إعادة التشغيل
    if (window.player && window.isPlaying && window.isPlayerReady) {
      setTimeout(() => {
        try {
          window.player.playVideo();
        } catch (err) {
          // تجاهل
        }
      }, 100);
    }
  } else {
    console.log('📱 في المقدمة');
    if (!wakeLock) {
      await enableWakeLock();
    }
  }
});

// تفعيل عند أول تفاعل
document.addEventListener('click', () => {
  enableWakeLock();
  startKeepAlive();
}, { once: true });

// تصدير الوظائف
window.backgroundAudio = {
  start: () => {
    enableWakeLock();
    startKeepAlive();
  },
  stop: () => {
    stopKeepAlive();
    if (wakeLock) {
      wakeLock.release();
      wakeLock = null;
    }
  }
};

console.log('✅ نظام التشغيل في الخلفية جاهز');
