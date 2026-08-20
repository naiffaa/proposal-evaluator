import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Geist_Mono } from 'next/font/google'

import './globals.css'


const ksfDisplay = localFont({
  src: [
    {
      path: '../fonts/KSFdisplay-Thin.woff2',
      weight: '100',
      style: 'normal',
    },
    {
      path: '../fonts/KSFdisplay-ExtraLight.woff2',
      weight: '200',
      style: 'normal',
    },
    {
      path: '../fonts/KSFdisplay-Light.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../fonts/KSFdisplay-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/KSFdisplay-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/KSFdisplay-SemiBold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../fonts/KSFdisplay-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../fonts/KSFdisplay-Heavy.woff2',
      weight: '800',
      style: 'normal',
    },
  ],

  // نخلي نفس اسم الـ CSS variable الحالي
  // عشان globals.css وباقي المشروع ما يحتاجون تعديل.
  variable: '--font-ksf-text',

  display: 'swap',
})


const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})


export const metadata: Metadata = {
  title: 'KSF Proposal Evaluation Portal',

  description:
    'Evaluate RFP responses, compare vendors, identify compliance risks, and make informed procurement decisions with AI-assisted analysis.',

  icons: {
    icon: '/images/ksf-logo.png',
    shortcut: '/images/ksf-logo.png',
    apple: '/images/ksf-logo.png',
  },
}


export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#161f56',
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${ksfDisplay.variable} ${geistMono.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        {children}

        {process.env.NODE_ENV === 'production' && (
          <Analytics />
        )}
      </body>
    </html>
  )
}