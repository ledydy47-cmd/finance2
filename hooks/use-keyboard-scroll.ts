"use client"

import { useEffect, useRef, useState } from "react"

export function useKeyboardScrollIntoView<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const scrollTarget = () => {
      window.setTimeout(() => {
        element.scrollIntoView({ block: "center", behavior: "smooth" })
      }, 320)
    }

    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) {
        scrollTarget()
      }
    }

    element.addEventListener("focusin", onFocusIn)

    const viewport = window.visualViewport
    const onViewportResize = () => {
      if (!viewport) return
      const active = document.activeElement
      if (
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLInputElement
      ) {
        scrollTarget()
      }
    }

    viewport?.addEventListener("resize", onViewportResize)

    return () => {
      element.removeEventListener("focusin", onFocusIn)
      viewport?.removeEventListener("resize", onViewportResize)
    }
  }, [])

  return ref
}
