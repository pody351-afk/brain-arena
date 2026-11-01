# بيجمّع كل الترجمات في js/i18n-en.js. التشغيل: python3 scripts/i18n/build.py
import json, sys, os
here = os.path.dirname(__file__); sys.path.insert(0, here)
root = os.path.join(here, '..', '..')
from en_a import EN as A
from en_b import EN as B
from en_c import EN_EXTRA
from en_d import EN_D, EN_FIX
ks = list(json.load(open(os.path.join(here, 'keys_v1.json'), encoding='utf8'))) if os.path.exists(os.path.join(here, 'keys_v1.json')) else None
if ks is None: sys.exit('محتاج /tmp/strings_old.json (الترتيب القديم للمفاتيح)')
EN = {**A, **B}; EN[179] = "reverse"; EN[358] = "square"; EN[372] = "meaning"; EN[104] = "Friends{}"
SKIP = {6,7,8,9,32,178,302,329,394,181,259,212,306,293,311,312,356,376,379}
out = {ks[i]: EN[i] for i in sorted(EN) if i not in SKIP}
out.update(EN_EXTRA)
out.update({"اللغة": "Language", "العربية / English": "العربية / English"})
out.update(EN_D); out.update(EN_FIX)
js = ("/* i18n-en.js — الترجمة الإنجليزية. المفتاح هو النص العربي زي ما هو في الكود، والـ {} مكان القيمة المتغيّرة ({!} = تتنسخ من غير ترجمة).\n"
      "   مفيش حاجة هنا بتأثر على وضع العربي. لو نص جديد اتضاف في الكود، tests/i18n.test.js بيكشف إنه ناقص ترجمة. */\n\"use strict\";\nconst I18N_EN = "
      + json.dumps(out, ensure_ascii=False, indent=0) + ";\n")
open(os.path.join(root, 'js', 'i18n-en.js'), 'w', encoding='utf8').write(js); print(len(out), 'ترجمة')
