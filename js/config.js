/* config.js — إعدادات بتتغيّر من غير ما تلمس الكود.
   ONLINE_SERVER: لينك سيرفر اللعب الأونلاين (wss://...). فاضي = اللعب الأونلاين مقفول ومكتوب إن السيرفر لسه مش شغال.
   للتجربة: ممكن تحط ?server=ws://localhost:8787 في آخر لينك اللعبة. مفيش هنا أي كلمة سر. */
"use strict";
const ONLINE_SERVER = "wss://mal3ab-server.onrender.com"; // سيرفر Render المجاني (خطة Free)
// لينك اللعبة اللي بيتبعت في رسايل الدعوة (جوه تطبيق iOS الـ location بيبقى capacitor:// ومينفعش يتبعت)
const SHARE_URL = "https://pody351-afk.github.io/brain-arena/";
