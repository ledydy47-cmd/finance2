/** Scroll target into the center of its scroll container, then wait for smooth scroll to settle. */
export function scrollElementIntoViewCenter(element: Element, delayMs = 380): Promise<void> {
  return new Promise((resolve) => {
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
    window.setTimeout(resolve, delayMs)
  })
}
