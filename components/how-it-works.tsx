"use client"

import { useEffect, useRef, useState } from "react"

const STEPS = [
  {
    num: "01",
    icon: "\uD83D\uDCAC",
    title: "Contato pelo WhatsApp",
    desc: "Bot te chama e manda o link do site",
  },
  {
    num: "02",
    icon: "\uD83C\uDF67",
    title: "Monte seu Acai",
    desc: "Escolha tamanho, sabor, toppings passo a passo",
  },
  {
    num: "03",
    icon: "\uD83D\uDD0D",
    title: "Revise o Pedido",
    desc: "Veja o resumo completo antes de confirmar",
  },
  {
    num: "04",
    icon: "\uD83D\uDE80",
    title: "Vai pro WhatsApp",
    desc: "Resumo enviado automaticamente para a equipe",
  },
  {
    num: "05",
    icon: "\uD83D\uDCF8",
    title: "Foto na Balanca",
    desc: "Preparamos e enviamos foto com o valor final",
  },
  {
    num: "06",
    icon: "\uD83D\uDCB3",
    title: "Pague e Receba",
    desc: "Pix, dinheiro ou cartao. Delivery ou retirada!",
  },
]

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true)
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} className="relative py-24 px-4">
      <div className="mx-auto max-w-7xl">
        <h2 className="font-[var(--font-syne)] text-3xl font-extrabold text-center mb-4 sm:text-4xl">
          <span className="gradient-text">Como funciona</span>{" "}
          <span className="text-foreground">seu pedido?</span>
        </h2>
        <p className="text-center text-muted mb-12 text-base">
          Simples, rapido e transparente
        </p>

        {/* Desktop grid */}
        <div className="hidden lg:grid lg:grid-cols-6 lg:gap-4">
          {STEPS.map((step, i) => (
            <div
              key={step.num}
              className={`glass glass-hover flex flex-col items-center rounded-2xl p-6 text-center transition-all duration-500 ${
                visible ? "animate-fade-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="font-[var(--font-space-mono)] text-xs text-primary mb-3">
                {step.num}
              </span>
              <span className="text-4xl mb-3">{step.icon}</span>
              <h3 className="text-sm font-medium text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-xs text-muted leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Mobile horizontal scroll */}
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory lg:hidden -mx-4 px-4">
          {STEPS.map((step, i) => (
            <div
              key={step.num}
              className={`glass glass-hover flex min-w-[220px] flex-col items-center rounded-2xl p-6 text-center snap-center transition-all duration-500 ${
                visible ? "animate-fade-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="font-[var(--font-space-mono)] text-xs text-primary mb-3">
                {step.num}
              </span>
              <span className="text-4xl mb-3">{step.icon}</span>
              <h3 className="text-sm font-medium text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-xs text-muted leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
