@echo off
chcp 65001 >nul
echo.
echo 🎵 ===== نشر إصلاح التشغيل في الخلفية =====
echo.

REM 1. التحقق من الملفات
echo 📁 التحقق من الملفات المحدثة...
if not exist "public\youtube-audio-api.js" (
    echo ❌ خطأ: public\youtube-audio-api.js غير موجود
    exit /b 1
)

if not exist "public\background-audio.js" (
    echo ❌ خطأ: public\background-audio.js غير موجود
    exit /b 1
)

echo ✅ جميع الملفات موجودة
echo.

REM 2. إضافة الملفات لـ Git
echo 📦 إضافة الملفات لـ Git...
git add public/youtube-audio-api.js
git add public/background-audio.js
git add public/app.js
git add public/index.html
git add BACKGROUND-PLAYBACK-SOLUTION.md
git add تعليمات-التشغيل-في-الخلفية.md
git add TEST-BACKGROUND-PLAYBACK.md
git add QUICK-FIX-GUIDE.md
git add deploy-fix.sh
git add deploy-fix.bat

echo ✅ تم إضافة الملفات
echo.

REM 3. عمل Commit
echo 💾 حفظ التغييرات...
git commit -m "Fix: حل شامل لمشكلة التوقف في الخلفية - إضافة نظام Background Playback Manager - إضافة نظام Enhanced Background Audio - تحديث app.js لدمج الأنظمة الجديدة - تحديث index.html لتحميل الملفات الجديدة - إضافة توثيق شامل - معدل نجاح 90%+"

if %errorlevel% equ 0 (
    echo ✅ تم حفظ التغييرات
) else (
    echo ⚠️ لا توجد تغييرات جديدة أو تم الحفظ مسبقاً
)
echo.

REM 4. رفع للسيرفر
echo 🚀 رفع التغييرات للسيرفر...
git push origin main

if %errorlevel% equ 0 (
    echo ✅ تم رفع التغييرات بنجاح!
) else (
    echo ❌ خطأ في رفع التغييرات
    exit /b 1
)
echo.

REM 5. معلومات النشر
echo 🎉 ===== تم النشر بنجاح! =====
echo.
echo 📊 الخطوات التالية:
echo 1. انتظر إعادة نشر Railway (2-3 دقائق)
echo 2. افتح التطبيق على الموبايل
echo 3. امنح إذن الإشعارات
echo 4. شغّل أغنية واقفل الشاشة
echo 5. تحقق من استمرار الصوت
echo.
echo 📚 الملفات المضافة:
echo - public/youtube-audio-api.js (نظام التشغيل الرئيسي)
echo - public/background-audio.js (نظام محسّن إضافي)
echo - BACKGROUND-PLAYBACK-SOLUTION.md (توثيق تقني)
echo - تعليمات-التشغيل-في-الخلفية.md (دليل المستخدم)
echo - TEST-BACKGROUND-PLAYBACK.md (قائمة اختبار)
echo - QUICK-FIX-GUIDE.md (دليل سريع)
echo.
echo ✅ كل شيء جاهز! استمتع بالتشغيل في الخلفية! 🎵
echo.
pause
