/**
 * Configurações centrais do chatbot
 * Versão: 2.5.1 - Prompt 8
 * 
 * Prompt 7:
 * - Novos estados: ESCOLHA_ENTREGA, ESCOLHA_TAXA, AGUARDANDO_RETIRADA
 * - Sistema de taxas de entrega por região
 * - Suporte a delivery e retirada no local
 */

module.exports = {
  // Horário de funcionamento
  HORARIO: {
    ABERTURA: 16, // 16h
    FECHAMENTO: 22.5, // 22h30
  },

  // Palavra-chave para teste fora do horário
  PALAVRA_TESTE: 'testacai',

  // NF1 - Palavra-chave para parar o fluxo
  PALAVRA_PARAR: 'stopacai',

  // Timeouts (em milissegundos) - T7
  TIMEOUTS: {
    PADRAO: 10 * 60 * 1000, // 10 minutos - etapas iniciais
    PREPARO: 35 * 60 * 1000, // 35 minutos - etapa de preparo
    PAGAMENTO: 10 * 60 * 1000, // 10 minutos - etapa de pagamento (só avisa admin)
    SUPORTE: 20 * 60 * 1000, // 20 minutos - aguardando resposta do funcionário
    PIX_COMPROVANTE: 5 * 60 * 1000, // A4 - 5 minutos aguardando comprovante Pix
    FORMA_PAGAMENTO: 5 * 60 * 1000, // A5 - 5 minutos aguardando forma de pagamento
  },

  // Timeout de inatividade (compatibilidade)
  TIMEOUT_INATIVIDADE: 10 * 60 * 1000,

  // NF3 - Número do admin para receber resumos (ÚNICA VARIÁVEL - altere aqui!)
  ADMIN_NUMBER: '559870278100@c.us',

  // Chave Pix
  CHAVE_PIX: '38424116000120',

  // Preço base
  PRECO_BASE: {
    KG: 70,
    DESCRICAO: '1kg = R$ 70',
  },

  // Endereço da loja
  ENDERECO: 'Avenida Sabino Câmara – Posto IC, Brejo-MA',

  // Prompt 7 - Taxas de entrega por região
  TAXAS_ENTREGA: {
    1: { regiao: 'Centro', valor: 5.00 },
    2: { regiao: 'Arredores', valor: 7.00 },
    3: { regiao: 'Zé Gomes', valor: 10.00 },
  },

  // Estados do fluxo
  ESTADOS: {
    // Inicial
    FORA_DO_HORARIO: 'FORA_DO_HORARIO',
    
    // Identificação
    BOAS_VINDAS: 'BOAS_VINDAS',
    CONFIRMA_NOME: 'CONFIRMA_NOME',
    EXPLICA_FUNCIONAMENTO: 'EXPLICA_FUNCIONAMENTO',
    
    // Prompt 7 - Estado para exibir taxas de entrega
    EXIBE_TAXAS: 'EXIBE_TAXAS',
    
    // FAQ
    FAQ_MENU: 'FAQ_MENU',
    FAQ_ANSWER: 'FAQ_ANSWER',
    FAQ_NEXT: 'FAQ_NEXT',
    FAQ_SUPPORT_WAIT: 'FAQ_SUPPORT_WAIT',
    CONGELADO_SUPORTE: 'CONGELADO_SUPORTE', // T6 - Bot mudo até cliente digitar 0
    
    // Montagem do pedido
    BUILD_START: 'BUILD_START',
    BUILD_SIZE: 'BUILD_SIZE',
    BUILD_ACAI: 'BUILD_ACAI',
    BUILD_GELATOS: 'BUILD_GELATOS',
    BUILD_FRUTAS: 'BUILD_FRUTAS',
    BUILD_COMPLEMENTOS: 'BUILD_COMPLEMENTOS',
    BUILD_COMPLEMENTOS_P2: 'BUILD_COMPLEMENTOS_P2',
    BUILD_CALDAS: 'BUILD_CALDAS',
    
    // Finalização e revisão
    ADD_MORE: 'ADD_MORE',
    REVIEW: 'REVIEW',
    REVIEW_EDIT_ACAI: 'REVIEW_EDIT_ACAI',       // I6 - Escolher qual açaí editar
    REVIEW_EDIT_CATEGORIA: 'REVIEW_EDIT_CATEGORIA', // I6 - Escolher categoria para editar
    REVIEW_ALTERAR_NOME: 'REVIEW_ALTERAR_NOME', // I6 - Alterar nome do cliente
    
    // Prompt 7 - Escolha de entrega (delivery ou retirada)
    ESCOLHA_ENTREGA: 'ESCOLHA_ENTREGA',
    
    // Prompt 7 - Escolha de taxa (delivery)
    ESCOLHA_TAXA: 'ESCOLHA_TAXA',
    ENDERECO_DELIVERY: 'ENDERECO_DELIVERY',
    CONFIRMA_ENDERECO_DELIVERY: 'CONFIRMA_ENDERECO_DELIVERY',
    SELECIONA_REGIAO: 'SELECIONA_REGIAO',
    
    // Preparo e espera
    PREPARE: 'PREPARE',
    ESPERA_PREPARO: 'ESPERA_PREPARO', // T6 - Bot mudo até funcionário enviar m1
    
    // Fluxo p2 - Pagamento (ETAPA 9)
    PAGAMENTO: 'PAGAMENTO',
    PAGAMENTO_PIX: 'PAGAMENTO_PIX', // ETAPA 9.1
    AGUARDANDO_OK_ADMIN: 'AGUARDANDO_OK_ADMIN', // T3 - Aguardando "Ok 👍" do funcionário
    PAGAMENTO_DINHEIRO: 'PAGAMENTO_DINHEIRO', // ETAPA 9.2
    PAGAMENTO_DINHEIRO_TROCO: 'PAGAMENTO_DINHEIRO_TROCO',
    PAGAMENTO_CARTAO: 'PAGAMENTO_CARTAO', // ETAPA 9.3
    ESPERA_PAGAMENTO: 'ESPERA_PAGAMENTO', // A5 - Modo silencioso aguardando forma de pagamento
    
    // Endereço (mantido para compatibilidade com fluxo Pix confirmado)
    ENDERECO_CLIENTE: 'ENDERECO_CLIENTE',
    CONFIRMA_ENDERECO: 'CONFIRMA_ENDERECO',
    
    // Prompt 7 - Aguardando retirada no local
    AGUARDANDO_RETIRADA: 'AGUARDANDO_RETIRADA',
    
    // Confirmação e agradecimento (ETAPAS 11 e 12)
    CONFIRMACAO_FINAL: 'CONFIRMACAO_FINAL',
    AGRADECIMENTO: 'AGRADECIMENTO',
    
    // Cliente retornante
    RETURNING_CUSTOMER_MENU: 'RETURNING_CUSTOMER_MENU',
  },

  // Mensagem padrão para áudio - T5 (I5 - Prompt 3)
  MENSAGEM_AUDIO: `Desculpa, eu sou um assistente automático e não consigo ouvir áudios no momento 😕🎧`,

  // A3 - Mensagem adicional de áudio em SUPORTE
  MENSAGEM_AUDIO_SUPORTE: `Porfavor me envie com texto, que um atendente vai te responder ✅`,

  // Mensagem padrão para múltiplas mensagens separadas - E2
  MENSAGEM_MULTIPLAS_SEPARADAS: `Entendi 😊
Para eu registrar certinho, envie tudo em uma única mensagem neste formato: *1,3,5*
Se quiser apenas uma opção, envie só o número, ex.: *1*`,

  // E1 - Mensagem para endereço sem vírgulas
  // Prompt 8 - Atualizado para exigir 3 partes mínimas
  MENSAGEM_ENDERECO_SEM_VIRGULAS: `Para eu registrar certinho, me envie seu endereço separado por vírgulas 🤔
Preciso de pelo menos: *Bairro, Rua, Número*
Exemplo: *Centro, Rua das Flores, 123*`,

  // NF1 - Mensagem de encerramento stopacai
  MENSAGEM_STOPACAI: `Atendimento encerrado ✅
Quando quiser pedir novamente, é só me chamar por aqui 🍧💜`,

  // Padrões de mensagens do funcionário - T2 (Prompt 4: novo padrão m1)
  PADROES: {
    M1_LINHA1: 'Prontinho ✅🍧',
    // Prompt 4: detectar "Valor do pedido:" em vez de "Valor total do pedido:"
    M1_VALOR_REGEX: /Valor do pedido:\s*R\$\s*([\d.,]+)/i,
    OK_ADMIN: 'Ok 👍',
    DIGITAR_ZERO: '👉 Digite 0 para montarmos seu pedido 🍧',
  },

  // Delay para simulação de digitação (em ms) - I9
  TYPING_DELAY: {
    PADRAO: 1500,            // Delay padrão
    PAGAMENTO: 3000,         // Forma de pagamento
    CONFIRMACAO_FINAL: 5000, // Confirmação final (maior)
  },

  // I1 (Prompt 5) - Janela de tempo para juntar mensagens iniciais (20 segundos)
  TEMPO_ESPERA_INICIAL: 20000, // 20 segundos

  // I2 (Prompt 5) - Janela de tempo para suporte (30 segundos)
  TEMPO_ESPERA_SUPORTE: 30000, // 30000ms = 30 segundos

  // T8 - Janela anti-duplicação (em ms)
  ANTI_DUPLICACAO_JANELA: 5000, // Aumentado para evitar duplicações
};
