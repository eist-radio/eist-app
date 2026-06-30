// Bridge so the frozen LiveNowIndicator (rendered inside every PageScaffold,
// outside the Pager's React tree) can ask the Pager to swipe back to the Listen
// page. The Pager registers a callback on mount; the indicator requests it on tap.
type Fn = () => void;

let scrollToListen: Fn | null = null;

export function registerListenScroll(fn: Fn | null) {
  scrollToListen = fn;
}

export function requestListen() {
  scrollToListen?.();
}
