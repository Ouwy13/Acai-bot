"use client"

import { useState, useEffect } from "react"
import { isOpen } from "@/lib/data"

export function Header() {
  const [open, setOpen] = useState(true)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    setOpen(isOpen())
    const interval = setInterval(() => setOpen(isOpen()), 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])

  const scrollToWizard = () => {
    document.getElementById("wizard")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
          ? "glass border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-8">
        <span className="font-[var(--font-syne)] text-xl font-extrabold tracking-tight gradient-text">
          Espaco Acai
        </span>

        <div className="flex items-center gap-3">
          <span
            className={`hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium sm:flex ${
              open
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                open ? "bg-emerald-400" : "bg-red-400"
              }`}
              style={{ animation: "pulse-dot 2s ease-in-out infinite" }}
            />
            {open ? "Aberto Agora" : "Fechado"}
          </span>

          <button
            onClick={scrollToWizard}
            className="btn-shimmer rounded-full bg-primary px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-primary-glow hover:shadow-lg hover:shadow-primary/25"
          >
            Montar Pedido
          </button>
        </div>
      </div>
    </header>
  )
}
