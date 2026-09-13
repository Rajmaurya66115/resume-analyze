// Builds a fingerprint from signals that survive an app reinstall
// (screen/hardware characteristics, timezone, canvas rendering quirks)
// rather than from anything stored in app storage — app storage is exactly
// what a reinstall wipes, so it can't be the basis for abuse prevention.
// The raw string is sent to the server, which hashes it; we never decide
// "free tokens used" on the client.

function getCanvasSignature() {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('resume-analyzer-fp', 2, 2);
    return canvas.toDataURL();
  } catch {
    return 'no-canvas';
  }
}

export function getDeviceFingerprint() {
  const signals = [
    navigator.userAgent,
    navigator.hardwareConcurrency || 'na',
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    getCanvasSignature(),
  ];
  return signals.join('|');
}
