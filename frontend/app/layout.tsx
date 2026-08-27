import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Geist_Mono } from 'next/font/google'

import './globals.css'


const ksfText = localFont({
  src: [
    {
      path: '../fonts/KSFText-Thin.woff2',
      weight: '100',
      style: 'normal',
    },
    {
      path: '../fonts/KSFText-ExtraLight.woff2',
      weight: '200',
      style: 'normal',
    },
    {
      path: '../fonts/KSFText-Light.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../fonts/KSFText-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/KSFText-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/KSFText-SemiBold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../fonts/KSFText-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../fonts/KSFText-Heavy.woff2',
      weight: '800',
      style: 'normal',
    },
  ],

  // نخلي نفس الـ variable عشان globals.css
  // وباقي المشروع ما يحتاج أي تعديل
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
      className={`${ksfText.variable} ${geistMono.variable} bg-background`}
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