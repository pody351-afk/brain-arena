# بيستخرج كل النصوص العربية من الكود (للترجمة واختبار التغطية). الناتج: strings.json
import re, json, glob, sys
AR = re.compile(r'[؀-ۿ]')
def lex(src):
    """بيرجّع النصوص اللي جوه "" و'' و`` (القوالب بتتحوّل لـ {} بدل ${...})."""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c == '/' and src[i:i+2] == '//':
            j = src.find('\n', i); i = n if j < 0 else j; continue
        if c == '/' and src[i:i+2] == '/*':
            j = src.find('*/', i + 2); i = n if j < 0 else j + 2; continue
        if c in '"\'`':
            q = c; i += 1; buf = []
            while i < n and src[i] != q:
                if src[i] == '\\' and i + 1 < n:
                    buf.append(src[i+1] if src[i+1] not in 'n' else '\n'); i += 2; continue
                if q == '`' and src[i:i+2] == '${':
                    d, i = 1, i + 2; st = i
                    while i < n and d:
                        if src[i] == '{': d += 1
                        elif src[i] == '}': d -= 1
                        i += 1
                    out.extend(lex(src[st:i-1]))   # النصوص اللي جوه التعبير نفسه
                    buf.append('{}'); continue
                buf.append(src[i]); i += 1
            i += 1; out.append(''.join(buf)); continue
        i += 1
    return out
ATTR = re.compile(r'(?:aria-label|placeholder|title|alt)="([^"]*)"')
def segs(text):
    # لو النص فيه HTML: القيم اللي في خصائص زي aria-label وplaceholder بتتاخد الأول، وبعدين بنقسم عند الوسوم
    out = [m.group(1).strip() for m in ATTR.finditer(text) if AR.search(m.group(1))]
    parts = re.split(r'<[^>]*>', text)
    return out + [p.strip() for p in parts if AR.search(p)]
found = {}
for f in ['js/app.js','js/core.js','js/levels.js','js/meta.js','js/online.js','js/progress.js','js/social.js','js/games/mem.js','js/games/pop.js','js/games/speed.js','js/games/word.js']:
    for s in lex(open(f, encoding='utf8').read()):
        if not AR.search(s): continue
        for p in segs(s): found.setdefault(p, set()).add(f)
html = open('index.html', encoding='utf8').read()
html = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html, flags=re.S)
for m in re.finditer(r'(?:aria-label|placeholder|title|alt|content)="([^"]*)"', html):
    if AR.search(m.group(1)): found.setdefault(m.group(1).strip(), set()).add('index.html')
for t in re.split(r'<[^>]*>', html):
    if AR.search(t): found.setdefault(re.sub(r'\s+', ' ', t).strip(), set()).add('index.html')
res = sorted(found)
json.dump({k: sorted(found[k]) for k in res}, open('strings.json', 'w', encoding='utf8'), ensure_ascii=False, indent=0)
print(len(res), 'نص')
