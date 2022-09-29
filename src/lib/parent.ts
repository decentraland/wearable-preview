export function getParent() {
  // Check if window has parent. Usually windows that don't have a parent (ie. not an iframe) have a reference to itself under window.parent, but on certain hosts and with certain security policies it can be undefined, in which case we default to window.
  return window.parent || window
}
