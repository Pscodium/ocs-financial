'use client'

import { useEffect } from 'react'

function isIOSDevice() {
  if (typeof navigator === 'undefined') {
    return false
  }

  const userAgent = navigator.userAgent
  const platform = navigator.platform
  const isTouchMac = platform === 'MacIntel' && navigator.maxTouchPoints > 1

  return /iPad|iPhone|iPod/i.test(userAgent) || isTouchMac
}

function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') {
    return false
  }

  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }

  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true
}

function findHorizontalScrollableAncestor(target: EventTarget | null) {
  let current = target instanceof HTMLElement ? target : null

  while (current && current !== document.body) {
    const style = window.getComputedStyle(current)
    const canScrollByStyle = style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'overlay'
    const canScrollBySize = current.scrollWidth > current.clientWidth + 1

    if (canScrollByStyle && canScrollBySize) {
      return current
    }

    current = current.parentElement
  }

  return null
}

function canElementScrollInDirection(element: HTMLElement, deltaX: number) {
  if (deltaX < 0) {
    return element.scrollLeft + element.clientWidth < element.scrollWidth - 1
  }

  if (deltaX > 0) {
    return element.scrollLeft > 0
  }

  return false
}

export function IOSBounceGuard() {
  useEffect(() => {
    const shouldActivate = isIOSDevice() && isStandaloneDisplayMode()

    if (!shouldActivate) {
      return
    }

    document.documentElement.classList.add('ios-bounce-guard')

    let startX = 0
    let startY = 0

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) {
        return
      }

      startX = touch.clientX
      startY = touch.clientY
    }

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) {
        return
      }

      const deltaX = touch.clientX - startX
      const deltaY = touch.clientY - startY

      if (Math.abs(deltaX) <= Math.abs(deltaY)) {
        return
      }

      const scrollableAncestor = findHorizontalScrollableAncestor(event.target)
      if (scrollableAncestor && canElementScrollInDirection(scrollableAncestor, deltaX)) {
        return
      }

      event.preventDefault()
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.documentElement.classList.remove('ios-bounce-guard')
    }
  }, [])

  return null
}
