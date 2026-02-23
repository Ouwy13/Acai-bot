"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown } from "lucide-react"
import { FAQ_ITEMS, WHATSAPP } from "@/lib/data"

export function PricingFaq() {
  const [openItem, setOpenItem] = useState<number | null>(null)
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

  return (
    <section ref={sectionRef} className="relative py-24 px-4">
      <div className="mx-auto max-w-7xl">
        <h2 className="font-[var(--font-syne)] text-3xl font-extrabold text-center mb-4 sm:text-4xl">
          <span className="gradient-text">Entenda como funciona</span>{" "}
          <span className="text-foreground">o preco</span>
        </h2>

        <div className="mx-auto mt-12 flex max-w-5xl flex-col gap-8 lg:flex-row">
          {/* Left explanation */}
          <div
            className={`flex-1 transition-all duration-500 ${visible ? "animate-fade-up" : "opacity-0"}`}
          >
            <p className="text-muted leading-relaxed mb-6">
              Aqui no Espaco Acai, o valor do seu pedido e calculado pelo{" "}
              <span className="text-foreground font-medium">peso final na balanca</span>.
              Voce escolhe o tamanho, monta do seu jeito, e a gente pesa antes de cobrar.
            </p>
            <p className="text-muted leading-relaxed mb-6">
              Enviamos uma{" "}
              <span className="text-foreground font-medium">foto na balanca</span> com o
              valor exato antes de voce pagar. Total transparencia!
            </p>
            <div className="glass rounded-2xl p-6 flex items-center gap-6">
              <div>
                <p className="font-[var(--font-space-mono)] text-2xl font-bold text-foreground">
                  R$ 70/kg
                </p>
                <p className="text-xs text-muted mt-1">Preco base por quilo</p>
              </div>
              <div className="h-12 w-px bg-border" />
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <span className="text-2xl">{"\uD83D\uDCF8"}</span> Foto antes de pagar
                </p>
                <p className="text-xs text-muted mt-1">Transparencia total</p>
              </div>
            </div>
          </div>

          {/* Right FAQ */}
          <div className="flex-1">
            <div className="flex flex-col gap-2">
              {FAQ_ITEMS.map((item, i) => (
                <div
                  key={i}
                  className={`glass rounded-xl overflow-hidden transition-all duration-300 ${
                    visible ? "animate-fade-up" : "opacity-0"
                  }`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <button
                    onClick={() => setOpenItem(openItem === i ? null : i)}
                    className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-card-hover"
                  >
                    <span className="flex items-center gap-3 text-sm font-medium text-foreground">
                      <span className="text-lg">{item.icon}</span>
                      {item.pergunta}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted transition-transform duration-200 ${
                        openItem === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      openItem === i ? "max-h-60 pb-4" : "max-h-0"
                    }`}
                  >
                    <p className="px-4 text-sm text-muted leading-relaxed">
                      {item.resposta}
                    </p>
                    {i === FAQ_ITEMS.length - 1 && (
                      <a
                        href={`https://wa.me/${WHATSAPP}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mx-4 mt-3 inline-flex items-center gap-2 rounded-full bg-whatsapp/10 px-4 py-2 text-xs font-medium text-whatsapp transition-colors hover:bg-whatsapp/20"
                      >
                        Falar pelo WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
