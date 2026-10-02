#!/bin/bash
# RaagaX Real Screenshot Capturing Utility via ADB
# Automatically captures real screenshots from your connected Android device
# and places them directly into website/public/ for the portfolio showcase.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEST_DIR="$PROJECT_ROOT/website/public"

mkdir -p "$DEST_DIR"

echo "🔍 Checking for connected Android devices via ADB..."
DEVICE_COUNT=$(adb devices | grep -v "List of devices" | grep -v "^$" | grep "device" | wc -l | tr -d ' ')

if [ "$DEVICE_COUNT" -eq "0" ]; then
    echo "⚠️  No Android device detected with 'device' status."
    echo "👉 Please ensure:"
    echo "   1. Your Android phone is connected via USB cable (or Wireless ADB)."
    echo "   2. 'USB Debugging' is enabled in Developer Options."
    echo "   3. You have tapped 'Allow USB Debugging' on your phone's screen."
    echo ""
    echo "Current adb status:"
    adb devices -l
    exit 1
fi

DEVICE_NAME=$(adb devices | grep "device$" | head -n 1 | awk '{print $1}')
echo "✅ Device connected: $DEVICE_NAME"

SCREEN_NAME="${1:-nowplaying}"
TARGET_FILE="$DEST_DIR/real_${SCREEN_NAME}.png"

echo "📸 Capturing high-resolution screen to $TARGET_FILE ..."
adb exec-out screencap -p > "$TARGET_FILE"

FILE_SIZE=$(ls -lh "$TARGET_FILE" | awk '{print $5}')
echo "🎉 Successfully captured: $TARGET_FILE ($FILE_SIZE)"
echo "💡 To capture another screen, open it on your phone and run:"
echo "   ./scripts/capture_screenshots.sh <explore|library|lyrics|jam|settings>"
