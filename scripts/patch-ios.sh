#!/usr/bin/env bash
# بيتنادى بعد "cap add ios": إعدادات لازمة للمتجر. (بيشتغل على macOS بس لأنه بيستخدم PlistBuddy)
set -euo pipefail
PLIST="ios/App/App/Info.plist"
PB=/usr/libexec/PlistBuddy
set_key() { "$PB" -c "Set :$1 $2" "$PLIST" 2>/dev/null || "$PB" -c "Add :$1 $3 $2" "$PLIST"; }
set_key ITSAppUsesNonExemptEncryption false bool       # التطبيق بيستخدم HTTPS/WSS العادي بس (معفي)، فمفيش سؤال التشفير كل مرة
set_key CFBundleDisplayName "ملعب المخ" string
set_key UIStatusBarStyle UIStatusBarStyleLightContent string
set_key UIViewControllerBasedStatusBarAppearance false bool
# iPhone بس (من غير iPad) عشان ما نحتاجش لقطات iPad
sed -i '' 's/TARGETED_DEVICE_FAMILY = "1,2";/TARGETED_DEVICE_FAMILY = 1;/g' ios/App/App.xcodeproj/project.pbxproj
echo "patch-ios تمام"
