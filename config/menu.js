module.exports = {
  // Tamanhos disponíveis
  TAMANHOS: [
    { id: 1, nome: 'Marmita 300ml' },
    { id: 2, nome: 'Marmita 500ml' },
    { id: 3, nome: 'Marmita 700ml' },
    { id: 4, nome: 'Copo 300ml' },
    { id: 5, nome: 'Copo 400ml' },
    { id: 6, nome: 'Copo 500ml' },
  ],

  // Sabores de açaí
  ACAI: [
    { id: 1, nome: 'Açaí Master' },
    { id: 2, nome: 'Açaí Fit' },
    { id: 3, nome: 'Creme de Maracujá' },
    { id: 4, nome: 'Creme de Morango' },
    { id: 5, nome: 'Creme de Cupuaçu' },
    { id: 6, nome: 'Creme de Bacuri' },
  ],

  // Gelatos e sorvetes
  GELATOS: [
    { id: 1, nome: 'Flocos', categoria: 'Tradicionais' },
    { id: 2, nome: 'Creme com Passas', categoria: 'Tradicionais' },
    { id: 3, nome: 'Chocobelga', categoria: 'Tradicionais' },
    { id: 4, nome: 'Unicórnio', categoria: 'Tradicionais' },
    { id: 5, nome: 'Creme de Ovomaltine', categoria: 'Cremes especiais' },
    { id: 6, nome: 'Creme de Oreo', categoria: 'Cremes especiais' },
    { id: 7, nome: 'Creme de Ninho', categoria: 'Cremes especiais' },
  ],

  // Frutas
  FRUTAS: [
    { id: 1, nome: 'Banana' },
    { id: 2, nome: 'Morango' },
    { id: 3, nome: 'Kiwi' },
    { id: 4, nome: 'Uva' },
  ],

  // Complementos (Parte 1)
  COMPLEMENTOS_P1: [
    { id: 1, nome: 'Cereja em Calda' },
    { id: 2, nome: 'Morango em Calda' },
    { id: 3, nome: 'Doce de Leite' },
    { id: 4, nome: 'Nutella' },
    { id: 5, nome: 'Marshmallow' },
    { id: 6, nome: 'Tapioca' },
    { id: 7, nome: 'Flocos' },
    { id: 8, nome: 'M&M' },
  ],

  // Complementos (Parte 2)
  COMPLEMENTOS_P2: [
    { id: 9, nome: 'Fine Amora' },
    { id: 10, nome: 'Fine Banana' },
    { id: 11, nome: 'Fine Dentadura' },
    { id: 12, nome: 'Jujuba' },
    { id: 13, nome: 'Bala de Gelatina' },
    { id: 14, nome: 'Cookies Branco' },
  ],

  // Caldas
  CALDAS: [
    { id: 1, nome: 'Pistache' },
    { id: 2, nome: 'Mágica' },
    { id: 3, nome: 'Mágica ao Leite' },
  ],

  // FAQ - Perguntas frequentes (Prompt 7 - atualizado com novas perguntas 6, 7, 8)
  FAQ: [
    {
      id: 1,
      pergunta: '💰 Como é calculado o valor?',
      resposta: 'Aqui o valor é calculado pelo peso final na balança. O preço exato depende de quanto o açaí ficou no final',
    },
    {
      id: 2,
      pergunta: '🤳 Vocês enviam foto na balança?',
      resposta: 'Sim ✅ Depois que você montar, a gente prepara e envia a foto do açaí na balança com o valor 📸',
    },
    {
      id: 3,
      pergunta: '🍧 Por que o preço não é fixo?',
      resposta: 'O tamanho ajuda na montagem, mas o valor final não é por tamanho e sim pelo peso',
    },
    {
      id: 4,
      pergunta: '⏱️ Quanto tempo leva?',
      resposta: 'O tempo varia conforme a fila do momento ⏱️ Assim que finalizar a montagem, já encaminhamos pra pesar e te enviamos a foto',
    },
    {
      id: 5,
      pergunta: '🧾 Posso mudar depois de montar?',
      resposta: 'Se quiser mudar algo, altere logo na montagem ✍️ Depois de montado e pesado, não pode ser alterado',
    },
    {
      id: 6,
      pergunta: '🛵 Como funciona a taxa de entrega?',
      resposta: `📍 TAXA DE ENTREGA
Cobramos uma taxa de acordo com o local:
* Centro: R$ 5,00
* Arredores: R$ 7,00
* Zé Gomes: R$ 10,00
A taxa é somada ao valor do seu pedido no final.
✅ Se preferir, você pode fazer retirada no local sem taxa!`,
    },
    {
      id: 7,
      pergunta: '🏪 Posso fazer retirada no local?',
      resposta: `Sim! Você pode escolher fazer retirada no estabelecimento.
📍 Nosso endereço:
Avenida Sabino Câmara – Posto IC, Brejo-MA`,
    },
    {
      id: 8,
      pergunta: '👩‍💻 Quero falar com um atendente (suporte)',
      resposta: 'Perfeito, {Nome}! 🤝\nMe envie sua dúvida em texto, por favor, que um atendente vai te responder ✅',
    },
  ],
};
