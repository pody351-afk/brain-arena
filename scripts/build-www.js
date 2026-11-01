// بيجمّع ملفات اللعبة (من غير السيرفر والاختبارات) في مجلد www اللي بيتحط جوه تطبيق iOS.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const out = path.join(root, "www");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ["index.html", "privacy.html", "support.html"]) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const d of ["css", "js"]) fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
const n = (function count(p) { return fs.readdirSync(p, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? count(path.join(p, e.name)) : 1), 0); })(out);
console.log("www جاهز:", n, "ملف");
