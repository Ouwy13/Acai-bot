export const TAMANHOS = [
  { nome: "Marmita 300ml", emoji: "\uD83C\uDF71", tipo: "Marmita" },
  { nome: "Marmita 500ml", emoji: "\uD83C\uDF71", tipo: "Marmita" },
  { nome: "Marmita 700ml", emoji: "\uD83C\uDF71", tipo: "Marmita" },
  { nome: "Copo 300ml", emoji: "\uD83E\uDD64", tipo: "Copo" },
  { nome: "Copo 400ml", emoji: "\uD83E\uDD64", tipo: "Copo" },
  { nome: "Copo 500ml", emoji: "\uD83E\uDD64", tipo: "Copo" },
]

export const ACAI = [
  { nome: "Acai Master", badge: "Mais Pedido", badgeIcon: "\u2B50" },
  { nome: "Acai Fit", badge: "Fit", badgeIcon: "\uD83D\uDC9A" },
  { nome: "Creme de Maracuja" },
  { nome: "Creme de Morango" },
  { nome: "Creme de Cupuacu" },
  { nome: "Creme de Bacuri" },
]

export const GELATOS = {
  Tradicionais: ["Flocos", "Creme com Passas", "Chocobelga", "Unicornio"],
  "Cremes Especiais": [
    "Creme de Ovomaltine",
    "Creme de Oreo",
    "Creme de Ninho",
  ],
}

export const FRUTAS = [
  { nome: "Banana", emoji: "\uD83C\uDF4C" },
  { nome: "Morango", emoji: "\uD83C\uDF53" },
  { nome: "Kiwi", emoji: "\uD83E\uDD5D" },
  { nome: "Uva", emoji: "\uD83C\uDF47" },
]

export const COMPLEMENTOS_P1 = [
  "Cereja em Calda",
  "Morango em Calda",
  "Doce de Leite",
  "Nutella",
  "Marshmallow",
  "Tapioca",
  "Flocos",
  "M&M",
]

export const COMPLEMENTOS_P2 = [
  "Fine Amora",
  "Fine Banana",
  "Fine Dentadura",
  "Jujuba",
  "Bala de Gelatina",
  "Cookies Branco",
]

export const CALDAS = [
  { nome: "Pistache", emoji: "\uD83D\uDFE2", color: "from-emerald-500/20 to-emerald-900/10" },
  { nome: "Magica", emoji: "\u2728", color: "from-amber-500/20 to-amber-900/10" },
  { nome: "Magica ao Leite", emoji: "\uD83C\uDF6B", color: "from-amber-700/20 to-amber-950/10" },
]

export const TAXAS: Record<number, { regiao: string; valor: number }> = {
  1: { regiao: "Centro", valor: 5.0 },
  2: { regiao: "Arredores", valor: 7.0 },
  3: { regiao: "Ze Gomes", valor: 10.0 },
}

export const FAQ_ITEMS = [
  {
    pergunta: "Como e calculado o valor?",
    icon: "\uD83D\uDCB0",
    resposta:
      "O valor e calculado pelo peso final na balanca. O preco exato depende de quanto o acai ficou no final.",
  },
  {
    pergunta: "Voces enviam foto na balanca?",
    icon: "\uD83E\uDD33",
    resposta:
      "Sim! Depois que voce montar, a gente prepara e envia a foto do acai na balanca com o valor.",
  },
  {
    pergunta: "Por que o preco nao e fixo?",
    icon: "\uD83C\uDF67",
    resposta:
      "O tamanho ajuda na montagem, mas o valor final nao e por tamanho e sim pelo peso.",
  },
  {
    pergunta: "Quanto tempo leva?",
    icon: "\u23F1\uFE0F",
    resposta:
      "O tempo varia conforme a fila do momento. Assim que finalizar a montagem, ja encaminhamos pra pesar e te enviamos a foto.",
  },
  {
    pergunta: "Posso mudar depois de montar?",
    icon: "\uD83E\uDDFE",
    resposta:
      "Se quiser mudar algo, altere logo na montagem. Depois de montado e pesado, nao pode ser alterado.",
  },
  {
    pergunta: "Como funciona a taxa de entrega?",
    icon: "\uD83D\uDEF5",
    resposta:
      "Centro R$5, Arredores R$7, Ze Gomes R$10. A taxa e somada ao valor do seu pedido no final. Se preferir, pode fazer retirada no local sem taxa!",
  },
  {
    pergunta: "Posso fazer retirada no local?",
    icon: "\uD83C\uDFEA",
    resposta:
      "Sim! Voce pode escolher retirada no estabelecimento. Nosso endereco: Avenida Sabino Camara - Posto IC, Brejo-MA.",
  },
  {
    pergunta: "Quero falar com um atendente",
    icon: "\uD83D\uDC69\u200D\uD83D\uDCBB",
    resposta:
      "Clique no botao abaixo para falar diretamente pelo WhatsApp com nossa equipe.",
  },
]

export const WHATSAPP = "5598970278100"
export const PIX_KEY = "38424116000120"
export const ENDERECO = "Avenida Sabino Camara - Posto IC, Brejo-MA"

export const STEP_LABELS = [
  "Nome",
  "Tamanho",
  "Acai",
  "Gelato",
  "Frutas",
  "Complementos",
  "Calda",
  "Entrega",
  "Pagamento",
  "Resumo",
]

export type OrderState = {
  customerName: string
  size: string | null
  acai: string | null
  gelato: string | null
  frutas: string[]
  complementos: string[]
  calda: string | null
  deliveryType: "delivery" | "retirada" | null
  region: number | null
  address: string
  payment: "pix" | "dinheiro" | "cartao" | null
  troco: string
}

export const initialOrder: OrderState = {
  customerName: "",
  size: null,
  acai: null,
  gelato: null,
  frutas: [],
  complementos: [],
  calda: null,
  deliveryType: null,
  region: null,
  address: "",
  payment: null,
  troco: "",
}

export function buildWhatsAppMessage(order: OrderState): string {
  const region = order.region ? TAXAS[order.region] : null
  let msg = `\uD83C\uDF67 *PEDIDO \u2014 ${order.customerName}*\n`
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`
  msg += `\uD83D\uDCE6 *Tamanho:* ${order.size}\n`
  msg += `\uD83C\uDF67 *Acai:* ${order.acai}\n`
  msg += `\uD83C\uDF66 *Gelato:* ${order.gelato || "Nenhum"}\n`
  msg += `\uD83C\uDF53 *Frutas:* ${order.frutas.length ? order.frutas.join(", ") : "Nenhuma"}\n`
  msg += `\uD83C\uDF6C *Complementos:* ${order.complementos.length ? order.complementos.join(", ") : "Nenhum"}\n`
  msg += `\uD83C\uDF6F *Calda:* ${order.calda || "Nenhuma"}\n`
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`
  if (order.deliveryType === "delivery") {
    msg += `\uD83D\uDEF5 *Entrega:* Delivery\n`
    msg += `\uD83D\uDCCD *Regiao:* ${region?.regiao} (+R$ ${region?.valor.toFixed(2)})\n`
    msg += `\uD83C\uDFE0 *Endereco:* ${order.address}\n`
  } else {
    msg += `\uD83C\uDFEA *Entrega:* Retirada no local\n`
  }
  msg += `\uD83D\uDCB3 *Pagamento:* ${
    order.payment === "pix"
      ? "Pix"
      : order.payment === "dinheiro"
        ? `Dinheiro${order.troco ? ` (troco para R$ ${order.troco})` : ""}`
        : "Cartao"
  }\n`
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`
  msg += `\u2696\uFE0F Aguardo a foto na balanca com o valor!`
  return encodeURIComponent(msg)
}

export function isOpen(): boolean {
  const now = new Date()
  const fortaleza = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Fortaleza" })
  )
  const hours = fortaleza.getHours() + fortaleza.getMinutes() / 60
  return hours >= 9 && hours <= 22.5
}
