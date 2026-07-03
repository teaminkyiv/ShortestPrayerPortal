import {ClerkProvider} from '@clerk/nextjs';
import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'Testimony Admin Panel',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <ClerkProvider>
          {children}
          {/* Remove role="alert" from Next.js route announcer so it doesn't
          conflict with page-level alert regions in Playwright/ARIA queries.
          Uses MutationObserver to catch the element whenever it is added. */}
          <Script id="fix-route-announcer" strategy="afterInteractive">{`
          (function() {
          function patchEl(el) {
          if (el) el.removeAttribute('role')
          }
          function scan() {
          // App Router: element is inside shadow root of <next-route-announcer>
          var host = document.querySelector('next-route-announcer')
          if (host && host.shadowRoot) {
          patchEl(host.shadowRoot.getElementById('__next-route-announcer__'))
          }
          // Pages Router: element is directly in body
          patchEl(document.getElementById('__next-route-announcer__'))
          }
          scan()
          new MutationObserver(scan).observe(document.body, { childList: true, subtree: true })
          })()
          `}</Script>
        </ClerkProvider>
      </body>
    </html>
  )
}