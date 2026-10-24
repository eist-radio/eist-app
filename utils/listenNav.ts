// Lets LiveNowIndicator (outside the Pager tree) ask the Pager to swipe back to Listen.
type Fn = () => void;

let scrollToListen: Fn | null = null;

export function registerListenScroll(fn: Fn | null) {
  scrollToListen = fn;
}

export function requestListen() {
  scrollToListen?.();
}
