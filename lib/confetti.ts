export async function fireCelebrationConfetti() {
  const confetti = (await import("canvas-confetti")).default

  const duration = 2200
  const end = Date.now() + duration

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
      colors: ["#f9a8d4", "#fbcfe8", "#fda4af", "#fde68a", "#c4b5fd"],
    })
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
      colors: ["#f9a8d4", "#fbcfe8", "#fda4af", "#fde68a", "#c4b5fd"],
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  }

  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#f9a8d4", "#fbcfe8", "#fda4af", "#fde68a", "#c4b5fd"],
  })

  frame()
}
