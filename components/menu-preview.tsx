"use client"

import { useState, useRef, useEffect } from "react"
import { ACAI, GELATOS, FRUTAS, COMPLEMENTOS_P1, COMPLEMENTOS_P2, CALDAS, TAMANHOS } from "@/lib/data"

const TABS = ["Acai Base", "Gelatos", "Frutas", "Complementos", "Caldas"]

const TAB_CONTENT: Record<string, { items: { nome: string; badge?: string; emoji?: string }[] }> = {
  "Acai Base": {
    items: ACAI.map((a) => ({
      nome: a.nome,
      badge: a.badge ? `${a.badgeIcon} ${a.badge}` : undefined,
      emoji: "\uD83C\uDF67",
    })),
  },
  Gelatos: {
    items: [
      ...GELATOS.Tradicionais.map((g) => ({ nome: g, badge: "Tradicionais", emoji: "\uD83C\uDF66" })),
      ...GELATOS["Cremes Especiais"].map((g) => ({ nome: g, badge: "Cremes Especiais", emoji: "\uD83C\uDF66" })),
    ],
  },
  Frutas: {
    items: FRUTAS.map((f) => ({ nome: f.nome, emoji: f.emoji })),
  },
  Complementos: {
    items: [...COMPLEMENTOS_P1, ...COMPLEMENTOS_P2].map((c) => ({ nome: c, emoji: "\uD83C\uDF6C" })),
  },
  Caldas: {
    items: CALDAS.map((c) => ({ nome: c.nome, emoji: c.emoji })),
  },
}

export function MenuPreview() {
  const [activeTab, setActiveTab] = useState(TABS[0])
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true)
      },
      { threshold: 0.1 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  const content = TAB_CONTENT[activeTab]

  return (
    <section id="menu" ref={sectionRef} className="relative py-24 px-4">
      <div className="mx-auto max-w-7xl">
        <h2 className="font-[var(--font-syne)] text-3xl font-extrabold text-center mb-4 sm:text-4xl">
          <span className="gradient-text">Tudo que voce pode colocar</span>{" "}
          <span className="text-foreground">no seu acai</span>
        </h2>
        <p className="text-center text-muted mb-10 text-base">
          Explore nosso cardapio completo
        </p>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="glass inline-flex rounded-full p-1 gap-1 overflow-x-auto max-w-full">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === tab
                    ? "bg-primary text-foreground shadow-lg shadow-primary/25"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {content.items.map((item, i) => (
            <div
              key={`${activeTab}-${item.nome}`}
              className={`glass glass-hover flex flex-col items-center rounded-2xl p-5 text-center transition-all duration-300 cursor-default ${
                visible ? "animate-fade-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="text-3xl mb-3">{item.emoji}</span>
              <p className="text-sm font-medium text-foreground mb-1">{item.nome}</p>
              {item.badge && (
                <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary-glow">
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Sizes row */}
        <h3 className="font-[var(--font-syne)] text-xl font-bold text-center mt-16 mb-6 text-foreground">
          Tamanhos disponiveis
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {TAMANHOS.map((t, i) => (
            <div
              key={t.nome}
              className={`glass glass-hover flex flex-col items-center rounded-2xl p-4 text-center transition-all duration-300 ${
                visible ? "animate-fade-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="text-2xl mb-2">{t.emoji}</span>
              <p className="text-xs font-medium text-foreground">{t.nome}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
