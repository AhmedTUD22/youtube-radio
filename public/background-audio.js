// ===== حل بسيط وفعال للتشغيل في الخلفية =====

let wakeLock = null;

// تفعيل Wake Lock عند بدء التشغيل
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

// إعادة تفعيل عند العودة للصفحة
document.addEventListener('visibilitychange', async () => {
  if (!document.hidden && wakeLock === null) {
    await enableWakeLock();
  }
});

// تفعيل عند أول تفاعل
document.addEventListener('click', enableWakeLock, { once: true });

console.log('✅ نظام التشغيل في الخلفية جاهز');
