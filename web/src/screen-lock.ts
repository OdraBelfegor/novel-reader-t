// The wake lock sentinel.
let wakeLock: WakeLockSentinel | null = null;
let onRelease = () => {
  if (wakeLock === null) return;
  console.log('Screen Wake Lock released:', wakeLock.released);
};

export function onReleaseWakeLock(cb: () => void) {
  onRelease = cb;
}

// Function that attempts to request a screen wake lock.
export async function requestWakeLock() {
  if (wakeLock !== null) return;
  try {
    wakeLock = await navigator.wakeLock.request();

    wakeLock.addEventListener('release', () => onRelease());

    console.log('Requested screen wake lock; Screen Wake Lock released:', wakeLock.released);
  } catch (err: any) {
    console.error(`${err.name}, ${err.message}`);
  }
}

export async function releaseWakeLock() {
  if (wakeLock === null) return;
  try {
    await wakeLock.release();
  } catch (err: any) {
    console.error(`${err.name}, ${err.message}`);
  }

  wakeLock = null;
}

export default {
  requestWakeLock,
  releaseWakeLock,
  onRelease: onReleaseWakeLock,
  get wakeLock() {
    return wakeLock;
  },
};
