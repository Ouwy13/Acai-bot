import type { Metadata, Viewport } from "next"
import { DM_Sans, Syne, Space_Mono } from "next/font/google"
import "./globals.css"

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-sans",
})

const syne = Syne({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-syne",
})

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-space-mono",
})

export const metadata: Metadata = {
  title: "Espaco Acai & Gelatos | Monte seu Acai Premium",
  description:
    "O acai mais premium de Brejo-MA. Monte seu pedido passo a passo e envie pelo WhatsApp. Preco por peso, foto na balanca antes de pagar.",
  keywords: ["acai", "gelatos", "delivery", "Brejo-MA", "WhatsApp"],
}

export const viewport: Viewport = {
  themeColor: "#050508",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${dmSans.variable} ${syne.variable} ${spaceMono.variable}`}>
      <body className="bg-background text-foreground font-sans antialiased min-h-screen overflow-x-hidden">
        <div className="glow-purple" />
        <div className="glow-cyan" />
        {children}
      </body>
    </html>
  )
}
