"use client"

import { ChevronDown } from "lucide-react"

export function Hero() {
  const scrollToWizard = () => {
    document.getElementById("wizard")?.scrollIntoView({ behavior: "smooth" })
  }
  const scrollToMenu = () => {
    document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-20">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16">
        {/* Left content */}
        <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted backdrop-blur-sm">
            <span className="text-cyan">{"*"}</span>
            Brejo-MA - Feito na hora
          </span>

          <h1 className="font-[var(--font-syne)] text-5xl font-extrabold leading-tight tracking-tight text-balance sm:text-6xl lg:text-7xl">
            <span className="gradient-text">O Acai</span>
            <br />
            <span className="gradient-text">Mais Premium</span>
            <br />
            <span className="text-foreground">da Cidade</span>
          </h1>

          <p className="mt-6 max-w-lg text-lg text-muted text-pretty">
            Montado por voce. Pesado na balanca. Foto antes de pagar.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={scrollToWizard}
              className="btn-shimmer rounded-full bg-gradient-to-r from-primary to-primary-glow px-8 py-4 text-base font-medium text-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
            >
              Montar Meu Acai Agora
            </button>
            <button
              onClick={scrollToMenu}
              className="rounded-full border border-border px-8 py-4 text-base font-medium text-muted transition-all hover:border-muted hover:text-foreground"
            >
              Ver Cardapio
            </button>
          </div>
        </div>

        {/* Right side - floating visual */}
        <div className="relative flex flex-1 items-center justify-center">
          <div className="absolute h-64 w-64 rounded-full bg-primary/20 blur-[80px]" />
          <span
            className="relative text-[120px] sm:text-[160px] lg:text-[200px]"
            style={{ animation: "float 3s ease-in-out infinite" }}
          >
            {"\uD83C\uDF67"}
          </span>
          {/* Orbiting ingredients */}
          {[
            { emoji: "\uD83C\uDF53", delay: "0s", radius: "100px", size: "text-3xl" },
            { emoji: "\uD83C\uDF4C", delay: "1s", radius: "120px", size: "text-2xl" },
            { emoji: "\uD83C\uDF47", delay: "2s", radius: "90px", size: "text-2xl" },
            { emoji: "\uD83E\uDD5D", delay: "3s", radius: "110px", size: "text-xl" },
            { emoji: "\uD83C\uDF6B", delay: "4s", radius: "130px", size: "text-xl" },
            { emoji: "\u2728", delay: "5s", radius: "80px", size: "text-lg" },
          ].map((item, i) => (
            <span
              key={i}
              className={`absolute ${item.size}`}
              style={{
                ["--orbit-radius" as string]: item.radius,
                animation: `orbit 12s linear infinite`,
                animationDelay: item.delay,
              }}
            >
              {item.emoji}
            </span>
          ))}
        </div>
      </div>

      {/* Info cards */}
      <div className="mx-auto mt-16 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { icon: "\u2696\uFE0F", title: "Preco por peso", desc: "R$ 70/kg" },
          { icon: "\uD83D\uDCF8", title: "Foto na balanca", desc: "Antes de pagar" },
          { icon: "\uD83D\uDEF5", title: "Delivery", desc: "A partir de R$ 5" },
        ].map((card) => (
          <div
            key={card.title}
            className="glass glass-hover flex items-center gap-4 rounded-2xl p-5 transition-all duration-200"
          >
            <span className="text-3xl">{card.icon}</span>
            <div>
              <p className="text-sm font-medium text-foreground">{card.title}</p>
              <p className="font-[var(--font-space-mono)] text-xs text-muted">
                {card.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Scroll indicator */}
      <div
        className="mt-12 mb-8 flex flex-col items-center gap-2 text-muted"
        style={{ animation: "bounce-scroll 2s ease-in-out infinite" }}
      >
        <span className="text-xs">Descubra mais</span>
        <ChevronDown className="h-4 w-4" />
      </div>
    </section>
  )
}
