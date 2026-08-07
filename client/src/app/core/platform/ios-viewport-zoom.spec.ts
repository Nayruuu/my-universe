import { installIosViewportZoomGuard, isIosBrowser } from './ios-viewport-zoom';

const IPHONE = {
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  maxTouchPoints: 5,
};

describe('verrouillage du zoom de page iOS', () => {
  it('reconnaît les appareils iOS nommés et les iPad avec agent utilisateur desktop', () => {
    expect(isIosBrowser(IPHONE)).toBe(true);
    expect(
      isIosBrowser({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it('ne confond pas un Mac ou Android avec iOS', () => {
    expect(
      isIosBrowser({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15',
        maxTouchPoints: 0,
      }),
    ).toBe(false);
    expect(
      isIosBrowser({
        userAgent: 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140 Mobile',
        maxTouchPoints: 5,
      }),
    ).toBe(false);
  });

  it('laisse les autres navigateurs inchangés', () => {
    const documentRef = createDocumentWithViewport();
    const viewport = readViewport(documentRef);
    const originalContent = viewport.content;
    const dispose = installIosViewportZoomGuard(documentRef, {
      userAgent: 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140 Mobile',
      maxTouchPoints: 5,
    });
    const gesture = createGestureEvent('gesturestart');

    expect(documentRef.dispatchEvent(gesture)).toBe(true);
    expect(gesture.defaultPrevented).toBe(false);
    expect(viewport.content).toBe(originalContent);
    expect(dispose()).toBeUndefined();
  });

  it('bloque les gestes Safari, verrouille le viewport, puis restaure les deux', () => {
    const documentRef = createDocumentWithViewport();
    const viewport = readViewport(documentRef);
    const originalContent = viewport.content;
    const dispose = installIosViewportZoomGuard(documentRef, IPHONE);

    expect(viewport.content).toBe(`${originalContent}, maximum-scale=1, user-scalable=no`);
    for (const eventName of ['gesturestart', 'gesturechange', 'gestureend']) {
      const gesture = createGestureEvent(eventName);

      expect(documentRef.dispatchEvent(gesture)).toBe(false);
      expect(gesture.defaultPrevented).toBe(true);
    }

    dispose();
    const gestureAfterDispose = createGestureEvent('gesturestart');

    expect(documentRef.dispatchEvent(gestureAfterDispose)).toBe(true);
    expect(gestureAfterDispose.defaultPrevented).toBe(false);
    expect(viewport.content).toBe(originalContent);
  });

  it('bloque encore le geste lorsque le document ne possède pas de meta viewport', () => {
    const documentRef = document.implementation.createHTMLDocument('sans viewport');
    const dispose = installIosViewportZoomGuard(documentRef, IPHONE);
    const gesture = createGestureEvent('gesturestart');

    expect(documentRef.dispatchEvent(gesture)).toBe(false);
    expect(dispose()).toBeUndefined();
  });
});

function createDocumentWithViewport(): Document {
  const documentRef = document.implementation.createHTMLDocument('viewport iOS');
  const viewport = documentRef.createElement('meta');

  viewport.name = 'viewport';
  viewport.content =
    'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content';
  documentRef.head.append(viewport);

  return documentRef;
}

function readViewport(documentRef: Document): HTMLMetaElement {
  const viewport = documentRef.querySelector<HTMLMetaElement>('meta[name="viewport"]');

  expect(viewport).not.toBeNull();

  return viewport!;
}

function createGestureEvent(type: string): Event {
  return new Event(type, { cancelable: true });
}
