const IOS_DEVICE_PATTERN = /\b(?:iPad|iPhone|iPod)\b/u;
const IOS_GESTURE_EVENTS = ['gesturestart', 'gesturechange', 'gestureend'] as const;

export interface BrowserIdentity {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
}

export function isIosBrowser(identity: BrowserIdentity): boolean {
  const namedIosDevice = IOS_DEVICE_PATTERN.test(identity.userAgent);
  const desktopClassIpad = identity.userAgent.includes('Macintosh') && identity.maxTouchPoints > 1;

  return namedIosDevice || desktopClassIpad;
}

export function installIosViewportZoomGuard(
  documentRef: Document,
  identity: BrowserIdentity,
): () => void {
  if (!isIosBrowser(identity)) {
    return () => undefined;
  }

  const restoreViewport = lockViewportScale(documentRef);
  const preventPageZoom = (event: Event): void => event.preventDefault();
  const listenerOptions = { passive: false } as const;

  for (const eventName of IOS_GESTURE_EVENTS) {
    documentRef.addEventListener(eventName, preventPageZoom, listenerOptions);
  }

  return () => {
    for (const eventName of IOS_GESTURE_EVENTS) {
      documentRef.removeEventListener(eventName, preventPageZoom, false);
    }
    restoreViewport();
  };
}

function lockViewportScale(documentRef: Document): () => void {
  const viewport = documentRef.querySelector<HTMLMetaElement>('meta[name="viewport"]');

  if (!viewport) {
    return () => undefined;
  }

  const originalContent = viewport.content;

  viewport.content = `${originalContent}, maximum-scale=1, user-scalable=no`;

  return () => {
    viewport.content = originalContent;
  };
}
