// بيطلّع لقطات المتجر (iPhone 6.9"/6.7": 1290x2796) من اللعبة الحقيقية ومعاها سيرفر محلي فيه لاعبين تجريبيين للترتيب.
// التشغيل: node scripts/store-screenshots.js   (محتاج playwright وNode 22). في GitHub Actions بيتشغّل من workflow "screenshots"
const path = require("path"), fs = require("fs"), os = require("os");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "appstore", "screenshots"); fs.mkdirSync(OUT, { recursive: true });
const RAW = fs.mkdtempSync(path.join(os.tmpdir(), "raw-"));
process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "shots-")), "data.json");
const { chromium } = require("playwright");
const { server } = require(path.join(ROOT, "server", "server.js"));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hex = n => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
const BOTS = [["نور", 5200], ["عمر", 4300], ["هبة", 3900], ["ياسين", 3100], ["مريم", 2800], ["كريم", 2200], ["سلمى", 1700], ["زياد", 1100]];

async function seedBots(port) {
  for (const [name, score] of BOTS) {
    const ws = new WebSocket("ws://127.0.0.1:" + port);
    await new Promise(r => { ws.onopen = r; });
    await sleep(60);
    ws.send(JSON.stringify({ t: "s_auth", id: hex(16), secret: hex(32), name }));
    await sleep(80);
    ws.send(JSON.stringify({ t: "s_submit", game: "pop", score })); ws.send(JSON.stringify({ t: "s_submit", game: "speed", score: Math.round(score / 90) }));
    await sleep(80); ws.close();
  }
}


// عبارات لقطات المتجر (لازم تثير الفضول): [اسم اللقطة, عربي, English]
const CAPS = [
  ["01-home", "حدّي مخك.. وغلّب صحابك!", "Challenge your brain. Beat your friends!"],
  ["03-pop", "فرقع الحلويات.. واصنع قنابل", "Pop the candies. Build bombs."],
  ["04-word", "كوّن كلمات قبل ما الوقت يخلص", "Build words before time runs out"],
  ["02-levels", "110 مستوى وزعماء مستنيينك", "110 levels and bosses waiting for you"],
  ["05-online", "العب مع صاحبك لايف", "Race a friend, live"],
  ["06-leaderboard", "اطلع على قمة الترتيب", "Climb to the top of the leaderboard"],
];
const frame = (img, cap, rtl) => `<!doctype html><html dir="${rtl ? "rtl" : "ltr"}"><body style="margin:0;width:1290px;height:2796px;overflow:hidden;position:relative;
  background:radial-gradient(circle at 50% 18%,#7a49e0 0,#3a2370 38%,#150c26 80%);font-family:'Lalezar','Cairo',system-ui,sans-serif">
  <div style="position:absolute;inset:0;opacity:.12;background:repeating-conic-gradient(from 0deg at 50% 22%,#fff 0 6deg,transparent 6deg 18deg)"></div>
  <div style="position:absolute;top:120px;left:70px;right:70px;text-align:center;color:#ffd54a;font-size:${rtl ? 128 : 112}px;line-height:1.15;text-shadow:0 8px 0 #7a4a00,0 18px 40px #0008">${cap}</div>
  <div style="position:absolute;left:150px;top:560px;width:990px;border-radius:110px;padding:22px;background:#0d0719;box-shadow:0 40px 120px #000a,0 0 0 6px #5a3da0">
    <img src="data:image/png;base64,${img}" style="width:100%;display:block;border-radius:90px"></div>
  </body></html>`;

async function capture(browser, locale, port, dirname) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, locale });
  const page = await ctx.newPage(); page.on("pageerror", e => console.log("خطأ في الصفحة:", e.message));
  await page.goto("file://" + path.join(ROOT, "index.html") + "?server=" + encodeURIComponent("ws://127.0.0.1:" + port));
  await page.waitForTimeout(1500); // الخطوط
  const raw = path.join(RAW, dirname); fs.mkdirSync(raw, { recursive: true });
  const shot = async (name, wait = 500) => { await sleep(wait); await page.screenshot({ path: path.join(raw, name + ".png") }); };
  const name = locale.startsWith("ar") ? "أحمد" : "Ahmed";
  await page.evaluate(n => {
    store.set("name", n);
    const P = __mal3ab.Progress, L = __mal3ab.LEVELS;
    for (let i = 0; i < 14; i++) P.applyResult(L[i], "demo" + i, { won: true, stars: i % 3 === 1 ? 2 : 3, score: 400 + i * 30 });
    P.data.best.speed = 62; P.data.best.pop = 3400; P.data.best.mem = 1500; P.data.best.word = 620; P.save();
    __mal3ab.goHome();
  }, name);
  await shot("01-home", 800);
  await page.evaluate(() => __mal3ab.App.show("map")); await shot("02-levels");
  await page.evaluate(() => __mal3ab.openGame("pop")); await shot("03-pop", 900);
  await page.evaluate(() => { __mal3ab.goHome(); __mal3ab.openGame("word"); }); await shot("04-word", 900);
  await page.evaluate(() => { __mal3ab.goHome(); __mal3ab.App.show("online"); }); await shot("05-online");
  await page.evaluate(() => { __mal3ab.goHome(); __mal3ab.App.show("social"); }); await sleep(300);
  await page.fill("#scName", name); await page.tap("#scJoin"); await page.waitForSelector("#scCode"); await page.waitForSelector(".sc-list li", { timeout: 15000 });
  await shot("06-leaderboard", 800);
  await ctx.close();
  // التركيب: عبارة + إطار موبايل
  const outDir = path.join(OUT, dirname); fs.mkdirSync(outDir, { recursive: true });
  const cctx = await browser.newContext({ viewport: { width: 1290, height: 2796 }, deviceScaleFactor: 1 });
  const cp = await cctx.newPage();
  for (const [file, ar, en] of CAPS) {
    const b64 = fs.readFileSync(path.join(raw, file + ".png")).toString("base64");
    await cp.setContent(frame(b64, dirname === "ar" ? ar : en, dirname === "ar")); await cp.waitForTimeout(400);
    await cp.screenshot({ path: path.join(outDir, file + ".png") }); console.log("لقطة:", dirname + "/" + file);
  }
  await cctx.close();
}

(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const port = server.address().port; await seedBots(port);
  const browser = await chromium.launch();
  await capture(browser, "ar-EG", port, "ar");
  await capture(browser, "en-US", port, "en");
  // بانر ترويجي 1200x630 (مشاركة على السوشيال)
  const icon = fs.readFileSync(path.join(ROOT, "assets", "icon-only.png")).toString("base64");
  const ph = fs.readFileSync(path.join(RAW, "en", "01-home.png")).toString("base64");
  const pctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 }); const pp = await pctx.newPage();
  await pp.setContent(`<body style="margin:0;width:1200px;height:630px;overflow:hidden;position:relative;background:radial-gradient(circle at 25% 40%,#7a49e0 0,#34205f 45%,#150c26 85%);font-family:'Lalezar','Cairo',system-ui,sans-serif;color:#fff">
    <img src="data:image/png;base64,${icon}" style="position:absolute;left:70px;top:70px;width:200px;border-radius:46px;box-shadow:0 14px 40px #000a">
    <div style="position:absolute;left:70px;top:300px;font-size:92px;line-height:1;color:#ffd54a;text-shadow:0 6px 0 #7a4a00">Brain Arena</div>
    <div style="position:absolute;left:70px;top:410px;font-size:64px;line-height:1">ملعب المخ</div>
    <div style="position:absolute;left:70px;top:510px;font-size:30px;font-family:system-ui;font-weight:700;opacity:.9">Challenge your brain. Beat your friends.</div>
    <div style="position:absolute;right:70px;top:60px;width:300px;border-radius:44px;padding:10px;background:#0d0719;box-shadow:0 30px 80px #000a,0 0 0 4px #5a3da0;transform:rotate(6deg)"><img src="data:image/png;base64,${ph}" style="width:100%;display:block;border-radius:36px"></div></body>`);
  await pp.waitForTimeout(500);
  const promo = path.join(ROOT, "appstore", "promo"); fs.mkdirSync(promo, { recursive: true });
  await pp.screenshot({ path: path.join(promo, "banner-1200x630.png") });
  await browser.close(); server.close();
  console.log(fs.readdirSync(OUT, { recursive: true }).join("\n")); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
