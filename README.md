# ملعب المخ — Brain Arena

لعبة ذكاء للموبايل والكمبيوتر. HTML + CSS + JavaScript من غير مكتبات.

## الملفات
- `index.html` — هيكل الصفحة
- `css/app.css` — التصميم
- `js/core.js` — أدوات مشتركة (صوت، اهتزاز، مؤثرات، تخزين، الإعدادات)
- `js/progress.js` — النجوم والـ XP والرتب والحفظ
- `js/levels.js` — العوالم والـ 100 مستوى (بيانات بس: تضيف مستوى بسطر)
- `js/games/speed.js` · `pop.js` · `mem.js` — الألعاب التلاتة
- `js/app.js` — الشاشات والتنقل وتشغيل المستويات والزعماء

## التشغيل
افتح `index.html` في أي متصفح (الملفات لازم تفضل في نفس الفولدرات)، أو من اللينك المنشور.

## الاختبارات
```
npm i playwright
node tests/test.js            # اللعب الحر والشاشات (57)
node tests/levels.test.js     # المستويات والتقدّم والزعماء وقابلية الحل (53)
node tests/meta.test.js       # التحدي اليومي والمهام والإنجازات (63)
node tests/word.test.js       # لعبة «كوّن كلمة» وعالم الكلمات (58)
node tests/online.test.js     # اللعب الأونلاين: سيرفر + لاعبين حقيقيين (50)
node tests/calibrate-pop.js   # أداة: تقترح أهداف مراحل فرقع بالمحاكاة
```

## النسخ
`backups/` + تاريخ git. كل نسخة مستقرة ليها tag (`v1-stable`، `v1.1-stable`، `v1.2-stable`). التغييرات في `CHANGELOG.md`.

## سيرفر اللعب الأونلاين
- الكود في `server/` ومن غير مكتبات: `cd server && node server.js` (البورت الافتراضي 8787).
- للتجربة على الجهاز: افتح اللعبة بـ `?server=ws://localhost:8787` في آخر اللينك.
- التشغيل على النت: Render بيقرا `render.yaml`. بعد ما يشتغل، حط اللينك (`wss://...onrender.com`) في `js/config.js`.
