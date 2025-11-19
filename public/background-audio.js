// ===== حل مشكلة التوقف في الخلفية =====

// 1. منع النوم والحفاظ على الاتصال
let wakeLockSentinel = null;
let keepAliveInterval = null;
let audioContext = null;
let silentAudio = null;

// 2. إنشاء Audio Context للحفاظ على التشغيل
function initBackgroundAudio() {
  try {
    // إنشاء Audio Context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // إنشاء صوت صامت للحفاظ على Audio Focus
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // صوت منخفض جداً (غير مسموع)
    gainNode.gain.value = 0.001;
    oscillator.frequency.value = 20; // تردد منخفض جداً
    
    oscillator.start();
    
    console.log('✅ Audio Context مفعّل للتشغيل في الخلفية');
    
    return oscillator;
  } catch (err) {
    console.log('⚠️ Audio Context غير مدعوم:', err);
    return null;
  }
}

// 3. Wake Lock API - منع قفل الشاشة
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      console.log('✅ Wake Lock مفعّل');
      
      wakeLockSentinel.addEventListener('release', () => {
        console.log('⚠️ Wake Lock تم إلغاؤه');
      });
      
      return true;
    }
  } catch (err) {
    console.log('⚠️ Wake Lock غير متاح:', err);
  }
  return false;
}

// 4. إعادة تفعيل Wake Lock عند العودة
document.addEventListener('visibilitychange', async () => {
  if (wakeLockSentinel !== null && document.visibilityState === 'visible') {
    await requestWakeLock();
  }
});

// 5. Keep Alive - إبقاء الاتصال حياً
function startKeepAlive() {
  if (keepAliveInterval) return;
  
  keepAliveInterval = setInterval(() => {
    // إرسال ping للخادم
    if (socket && socket.connected) {
      socket.emit('ping');
    }
    
    // تحديث Media Session
    if ('mediaSession' in navigator && navigator.mediaSession.playbackState) {
      navigator.mediaSession.playbackState = 'playing';
    }
    
    // إبقاء Audio Context نشطاً
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  }, 5000); // كل 5 ثواني
  
  console.log('✅ Keep Alive مفعّل');
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('⏸️ Keep Alive متوقف');
  }
}

// 6. منع التوقف التلقائي
function preventAutoStop() {
  // منع النوم
  if ('wakeLock' in navigator) {
    requestWakeLock();
  }
  
  // تفعيل Audio Context
  if (!audioContext) {
    silentAudio = initBackgroundAudio();
  }
  
  // تفعيل Keep Alive
  startKeepAlive();
  
  // منع توقف الفيديو عند الخلفية
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  console.log('✅ جميع حلول التشغيل في الخلفية مفعّلة');
}

// 7. معالجة تغيير الرؤية
function handleVisibilityChange() {
  if (document.hidden) {
    console.log('📱 التطبيق في الخلفية - الحفاظ على التشغيل');
    
    // إعادة تشغيل إذا توقف
    if (isPlayerReady && isPlaying && player.getPlayerState() !== YT.PlayerState.PLAYING) {
      setTimeout(() => {
        player.playVideo();
      }, 100);
    }
    
    // تأكيد Audio Context
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  } else {
    console.log('📱 التطبيق في المقدمة');
    
    // إعادة تفعيل Wake Lock
    requestWakeLock();
  }
}

// 8. تفعيل عند بدء التشغيل
function enableBackgroundPlayback() {
  preventAutoStop();
  
  // طلب إذن الإشعارات (مهم للتشغيل في الخلفية)
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log('✅ إذن الإشعارات ممنوح');
      }
    });
  }
  
  // تفعيل Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      console.log('✅ Service Worker جاهز للتشغيل في الخلفية');
    });
  }
}

// 9. تنظيف عند الإيقاف
function disableBackgroundPlayback() {
  stopKeepAlive();
  
  if (wakeLockSentinel) {
    wakeLockSentinel.release();
    wakeLockSentinel = null;
  }
  
  if (silentAudio) {
    silentAudio.stop();
    silentAudio = null;
  }
  
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  
  console.log('⏹️ التشغيل في الخلفية متوقف');
}

// 10. تصدير الوظائف
window.backgroundAudio = {
  enable: enableBackgroundPlayback,
  disable: disableBackgroundPlayback,
  requestWakeLock: requestWakeLock
};

console.log('✅ وحدة التشغيل في الخلفية جاهزة');
