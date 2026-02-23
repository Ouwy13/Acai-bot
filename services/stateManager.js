/**
 * Gerenciador de estados das sessões
 * Versão: 2.5.0 - Prompt 7
 * 
 * Armazena estado atual, timeout e dados temporários
 * 
 * Prompt 7:
 * - Novos dados de sessão: formaEntrega, regiaoEntrega, taxaEntrega
 * - Novos estados congelados: AGUARDANDO_RETIRADA
 * - Suporte a delivery e retirada no local
 */

const { ESTADOS, TIMEOUTS, ANTI_DUPLICACAO_JANELA, TEMPO_ESPERA_INICIAL, TEMPO_ESPERA_SUPORTE } = require('../config/constants');

class StateManager {
  constructor() {
    // Armazena sessões em memória
    // { telefone: { estado, dados, timeout, ultimaMensagem, ... } }
    this.sessions = new Map();
    
    // T8 - Anti-duplicação: armazena IDs de mensagens processadas
    this.mensagensProcessadas = new Map();
    
    // I1 - Mensagens pendentes para juntar no início
    this.mensagensPendentes = new Map();
    
    // I1 - Anti-duplicação por estado (evita aberturas duplicadas)
    this.estadosRespondidos = new Map();
    
    // I2 - Mensagens de suporte pendentes (janela de 1 minuto)
    this.mensagensSuportePendentes = new Map();
    
    // E2 - Última escolha numérica parcial por telefone
    this.escolhasParciais = new Map();

    // A4 - Timers de Pix comprovante
    this.timersPixComprovante = new Map();

    // A5 - Timers de forma de pagamento
    this.timersFormaPagamento = new Map();

    // A5 - Flag de alerta já enviado ao admin (por ciclo)
    this.alertasPagamentoEnviados = new Map();
  }

  /**
   * Inicia nova sessão
   * Prompt 7 - Adicionados campos: formaEntrega, regiaoEntrega, taxaEntrega, enderecoDelivery
   */
  iniciarSessao(telefone, estado = ESTADOS.BOAS_VINDAS) {
    this.sessions.set(telefone, {
      estado,
      modoTeste: false, // v2.5.7 - Flag para modo teste (testacai)
      dados: {
        carrinho: [], // Array de açaís
        acaiAtual: null, // Açaí sendo montado
        valor: null, // Valor do pedido (recebido via m1)
        endereco: null, // Endereço do cliente
        troco: null, // Valor do troco (se dinheiro)
        formaPagamento: null, // pix, dinheiro, cartao, na_retirada
        comprovanteRecebido: false, // Se recebeu comprovante Pix
        clienteNovo: true, // Se é cliente novo ou antigo
        modoEdicao: false, // E1 - Se está editando item (não refazer ciclo)
        categoriaEditando: null, // E1 - Qual categoria está editando
        // Prompt 7 - Novos campos para delivery/retirada
        formaEntrega: null, // 'delivery' ou 'retirada'
        regiaoEntrega: null, // 'Centro', 'Arredores' ou 'Zé Gomes'
        taxaEntrega: null, // Valor numérico da taxa
        enderecoDelivery: null, // Endereço para delivery
        pagamentoRetiradaExplicado: false,
      },
      timeout: null,
      timeoutCallback: null, // Callback para timeout personalizado
      ultimaMensagem: Date.now(),
      mensagensRecebidas: 0,
      audioAvisado: false, // T5 - Se já avisou sobre áudio nesta etapa
      ultimaPergunta: null, // Para repetir pergunta após áudio
      suporteConfirmado: false, // I2 - Se já enviou confirmação de suporte
    });
    
    this.resetTimeout(telefone);
    return this.sessions.get(telefone);
  }

  /**
   * Busca sessão existente
   */
  getSessao(telefone) {
    return this.sessions.get(telefone) || null;
  }

  /**
   * Define estado da sessão
   */
  setEstado(telefone, estado) {
    const sessao = this.sessions.get(telefone);
    if (sessao) {
      sessao.estado = estado;
      sessao.ultimaMensagem = Date.now();
      sessao.audioAvisado = false; // Reset flag de áudio ao mudar de estado
      this.resetTimeout(telefone);
    }
  }

  /**
   * Busca estado atual
   */
  getEstado(telefone) {
    const sessao = this.sessions.get(telefone);
    return sessao ? sessao.estado : null;
  }

  /**
   * Atualiza dados da sessão
   */
  setDados(telefone, chave, valor) {
    const sessao = this.sessions.get(telefone);
    if (sessao) {
      sessao.dados[chave] = valor;
      sessao.ultimaMensagem = Date.now();
      this.resetTimeout(telefone);
    }
  }

  /**
   * Busca dados da sessão
   */
  getDados(telefone, chave = null) {
    const sessao = this.sessions.get(telefone);
    if (!sessao) return null;
    
    return chave ? sessao.dados[chave] : sessao.dados;
  }

  /**
   * NF1 - Encerra sessão (usado por stopacai)
   */
  encerrarSessao(telefone) {
    const sessao = this.sessions.get(telefone);
    if (sessao) {
      if (sessao.timeout) {
        clearTimeout(sessao.timeout);
      }
    }
    
    // Limpa dados de suporte pendentes
    this.cancelarSuportePendente(telefone);
    
    // Limpa estado respondido
    this.estadosRespondidos.delete(telefone);

    // Limpa timers de Pix e Pagamento
    this.cancelarTimerPixComprovante(telefone);
    this.cancelarTimerFormaPagamento(telefone);
    
    this.sessions.delete(telefone);
  }

  /**
   * T7 - Retorna o timeout apropriado para o estado atual
   * Prompt 7 - Inclui novos estados
   */
  getTimeoutParaEstado(estado) {
    // Estados de preparo/espera
    if (estado === ESTADOS.ESPERA_PREPARO || estado === ESTADOS.PREPARE) {
      return TIMEOUTS.PREPARO;
    }
    
    // Estados de pagamento
    if ([
      ESTADOS.PAGAMENTO,
      ESTADOS.PAGAMENTO_PIX,
      ESTADOS.AGUARDANDO_OK_ADMIN,
      ESTADOS.PAGAMENTO_DINHEIRO,
      ESTADOS.PAGAMENTO_DINHEIRO_TROCO,
      ESTADOS.PAGAMENTO_CARTAO,
      ESTADOS.ESPERA_PAGAMENTO, // A5
    ].includes(estado)) {
      return TIMEOUTS.PAGAMENTO;
    }
    
    // Estados congelados (suporte)
    if (estado === ESTADOS.CONGELADO_SUPORTE) {
      return TIMEOUTS.SUPORTE;
    }
    
    // Padrão: 10 minutos
    return TIMEOUTS.PADRAO;
  }

  /**
   * T7 - Reseta timeout de inatividade com valor apropriado
   */
  resetTimeout(telefone, callback = null) {
    const sessao = this.sessions.get(telefone);
    if (!sessao) return;

    // Limpa timeout anterior
    if (sessao.timeout) {
      clearTimeout(sessao.timeout);
    }

    const tempoTimeout = this.getTimeoutParaEstado(sessao.estado);
    
    // Armazena callback personalizado se fornecido
    if (callback) {
      sessao.timeoutCallback = callback;
    }

    // Define novo timeout
    sessao.timeout = setTimeout(() => {
      const estado = sessao.estado;
      
      // Se tem callback personalizado, executa
      if (sessao.timeoutCallback) {
        sessao.timeoutCallback(telefone, estado);
      }
      
      console.log(`⏰ Timeout (${tempoTimeout/60000}min): Sessão de ${telefone} - Estado: ${estado}`);
      
      // A5 - Estado ESPERA_PAGAMENTO nunca encerra automaticamente
      if (estado === ESTADOS.ESPERA_PAGAMENTO) {
        console.log(`⏰ Cliente em ESPERA_PAGAMENTO - aguardando resposta ou stopacai`);
        return;
      }
      
      // Timeout de pagamento não encerra sessão, apenas avisa admin
      if ([
        ESTADOS.PAGAMENTO,
        ESTADOS.PAGAMENTO_PIX,
        ESTADOS.AGUARDANDO_OK_ADMIN,
        ESTADOS.PAGAMENTO_DINHEIRO,
        ESTADOS.PAGAMENTO_DINHEIRO_TROCO,
        ESTADOS.PAGAMENTO_CARTAO
      ].includes(estado)) {
        // Não encerra, continua aguardando
        console.log(`⏰ Cliente em estado de pagamento - aguardando intervenção do funcionário`);
        return;
      }
      
      // Demais estados: encerra sessão
      this.encerrarSessao(telefone);
    }, tempoTimeout);
  }

  /**
   * T6 - Verifica se o estado atual é congelado (bot mudo)
   * A5 - Inclui ESPERA_PAGAMENTO
   * Prompt 7 - Inclui AGUARDANDO_RETIRADA
   */
  isEstadoCongelado(estado) {
          return estado === ESTADOS.CONGELADO_SUPORTE || 
            estado === ESTADOS.PAGAMENTO_PIX ||
            estado === ESTADOS.ESPERA_PREPARO ||
            estado === ESTADOS.ESPERA_PAGAMENTO ||
            estado === ESTADOS.AGUARDANDO_OK_ADMIN ||
            estado === ESTADOS.AGUARDANDO_RETIRADA;
  }

  /**
   * T5 - Marca que já avisou sobre áudio nesta etapa
   */
  setAudioAvisado(telefone, avisado = true) {
    const sessao = this.sessions.get(telefone);
    if (sessao) {
      sessao.audioAvisado = avisado;
    }
  }

  /**
   * T5 - Verifica se já avisou sobre áudio
   */
  getAudioAvisado(telefone) {
    const sessao = this.sessions.get(telefone);
    return sessao ? sessao.audioAvisado : false;
  }

  /**
   * T5 - Salva última pergunta para repetir após áudio
   */
  setUltimaPergunta(telefone, pergunta) {
    const sessao = this.sessions.get(telefone);
    if (sessao) {
      sessao.ultimaPergunta = pergunta;
    }
  }

  /**
   * T5 - Recupera última pergunta
   */
  getUltimaPergunta(telefone) {
    const sessao = this.sessions.get(telefone);
    return sessao ? sessao.ultimaPergunta : null;
  }

  /**
   * T8 - Verifica se mensagem já foi processada (anti-duplicação)
   */
  isMensagemDuplicada(msgId) {
    const agora = Date.now();
    
    // Limpa mensagens antigas (mais de ANTI_DUPLICACAO_JANELA ms)
    for (const [id, timestamp] of this.mensagensProcessadas.entries()) {
      if (agora - timestamp > ANTI_DUPLICACAO_JANELA) {
        this.mensagensProcessadas.delete(id);
      }
    }
    
    // Verifica se já processou
    if (this.mensagensProcessadas.has(msgId)) {
      return true;
    }
    
    // Marca como processada
    this.mensagensProcessadas.set(msgId, agora);
    return false;
  }

  /**
   * Incrementa contador de mensagens recebidas
   */
  incrementarMensagens(telefone) {
    const sessao = this.sessions.get(telefone);
    if (sessao) {
      sessao.mensagensRecebidas++;
    }
  }

  /**
   * Busca contador de mensagens
   */
  getMensagensRecebidas(telefone) {
    const sessao = this.sessions.get(telefone);
    return sessao ? sessao.mensagensRecebidas : 0;
  }

  // ===============================================
  // A4 (PROMPT 6) - TIMER PIX COMPROVANTE (5 MINUTOS)
  // ===============================================

  /**
   * A4 - Inicia timer de 5 minutos para comprovante Pix
   */
  iniciarTimerPixComprovante(telefone, callback) {
    // Cancela timer anterior se existir
    this.cancelarTimerPixComprovante(telefone);

    const timer = setTimeout(() => {
      this.timersPixComprovante.delete(telefone);
      if (callback) {
        callback(telefone);
      }
    }, TIMEOUTS.PIX_COMPROVANTE);

    this.timersPixComprovante.set(telefone, timer);
  }

  /**
   * A4 - Cancela timer de Pix comprovante
   */
  cancelarTimerPixComprovante(telefone) {
    const timer = this.timersPixComprovante.get(telefone);
    if (timer) {
      clearTimeout(timer);
      this.timersPixComprovante.delete(telefone);
    }
  }

  // ===============================================
  // A5 (PROMPT 6) - TIMER FORMA DE PAGAMENTO (5 MINUTOS)
  // ===============================================

  /**
   * A5 - Inicia timer de 5 minutos para forma de pagamento
   */
  iniciarTimerFormaPagamento(telefone, callback) {
    // Cancela timer anterior se existir
    this.cancelarTimerFormaPagamento(telefone);
    
    // Reseta flag de alerta
    this.alertasPagamentoEnviados.delete(telefone);

    const timer = setTimeout(() => {
      this.timersFormaPagamento.delete(telefone);
      if (callback) {
        callback(telefone);
      }
    }, TIMEOUTS.FORMA_PAGAMENTO);

    this.timersFormaPagamento.set(telefone, timer);
  }

  /**
   * A5 - Cancela timer de forma de pagamento
   */
  cancelarTimerFormaPagamento(telefone) {
    const timer = this.timersFormaPagamento.get(telefone);
    if (timer) {
      clearTimeout(timer);
      this.timersFormaPagamento.delete(telefone);
    }
  }

  /**
   * A5 - Verifica se já enviou alerta de pagamento para admin
   */
  jaEnviouAlertaPagamento(telefone) {
    return this.alertasPagamentoEnviados.get(telefone) || false;
  }

  /**
   * A5 - Marca que enviou alerta de pagamento
   */
  marcarAlertaPagamentoEnviado(telefone) {
    this.alertasPagamentoEnviados.set(telefone, true);
  }

  // ===============================================
  // I2 (PROMPT 4) - SUPORTE COM JANELA DE 1 MINUTO
  // ===============================================

  /**
   * I2 - Adiciona mensagem de dúvida para suporte (janela de 1 minuto)
   * Aguarda 1 minuto para juntar todas as mensagens antes de enviar
   */
  adicionarMensagemSuporte(telefone, mensagem, callback) {
    const pendente = this.mensagensSuportePendentes.get(telefone);
    
    if (pendente) {
      // Já tem mensagens pendentes, adiciona à lista
      pendente.mensagens.push(mensagem);
      // Não reinicia o timer - mantém o tempo original
      return true;
    }
    
    // Primeira mensagem - inicia janela de 1 minuto
    const novoPendente = {
      mensagens: [mensagem],
      timeout: setTimeout(() => {
        // Tempo se passou - executa callback
        const dados = this.mensagensSuportePendentes.get(telefone);
        this.mensagensSuportePendentes.delete(telefone);
        
        if (dados && callback) {
          // Junta todas as mensagens
          const todasMensagens = dados.mensagens.join('\n');
          callback(todasMensagens);
        }
      }, TEMPO_ESPERA_SUPORTE)
    };
    
    this.mensagensSuportePendentes.set(telefone, novoPendente);
    return false; // Primeira mensagem
  }

  /**
   * I2 - Verifica se há mensagens de suporte pendentes
   */
  temSuportePendente(telefone) {
    return this.mensagensSuportePendentes.has(telefone);
  }

  /**
   * I2 - Cancela mensagens de suporte pendentes
   */
  cancelarSuportePendente(telefone) {
    const pendente = this.mensagensSuportePendentes.get(telefone);
    if (pendente) {
      clearTimeout(pendente.timeout);
      this.mensagensSuportePendentes.delete(telefone);
    }
  }

  // ===============================================
  // I1 (PROMPT 4) - ANTI-DUPLICAÇÃO DE ABERTURAS
  // ===============================================

  /**
   * I1 - Verifica se já respondeu abertura para este telefone/estado
   */
  jaRespondeuAbertura(telefone, estado) {
    const chave = `${telefone}:${estado}`;
    const agora = Date.now();
    
    // Limpa entradas antigas (mais de 30 segundos)
    for (const [key, timestamp] of this.estadosRespondidos.entries()) {
      if (agora - timestamp > 30000) {
        this.estadosRespondidos.delete(key);
      }
    }
    
    return this.estadosRespondidos.has(chave);
  }

  /**
   * I1 - Marca que respondeu abertura
   */
  marcarAberturaRespondida(telefone, estado) {
    const chave = `${telefone}:${estado}`;
    this.estadosRespondidos.set(chave, Date.now());
  }

  /**
   * I1 - Registra mensagem pendente para juntar (delay inicial maior)
   * Retorna true se deve aguardar mais mensagens
   */
  registrarMensagemPendente(telefone, mensagem, callback) {
    const pendente = this.mensagensPendentes.get(telefone);
    
    if (pendente) {
      // Já tem mensagem pendente, adiciona à lista
      pendente.mensagens.push(mensagem);
      // Não precisa criar novo timeout, usa o existente
      return true;
    }
    
    // Primeira mensagem - cria entrada pendente
    const novaPendente = {
      mensagens: [mensagem],
      timeout: setTimeout(() => {
        // Tempo expirou, executa callback com mensagens juntadas
        const dados = this.mensagensPendentes.get(telefone);
        this.mensagensPendentes.delete(telefone);
        
        if (dados && callback) {
          callback(dados.mensagens);
        }
      }, TEMPO_ESPERA_INICIAL) // 20 segundos
    };
    
    this.mensagensPendentes.set(telefone, novaPendente);
    return true;
  }

  /**
   * I1 - Verifica se há mensagens pendentes para um telefone
   */
  temMensagensPendentes(telefone) {
    return this.mensagensPendentes.has(telefone);
  }

  /**
   * I1 - Cancela mensagens pendentes
   */
  cancelarMensagensPendentes(telefone) {
    const pendente = this.mensagensPendentes.get(telefone);
    if (pendente) {
      clearTimeout(pendente.timeout);
      this.mensagensPendentes.delete(telefone);
    }
  }

  // ===============================================
  // MONTAGEM DO PEDIDO
  // ===============================================

  /**
   * Inicia montagem de novo açaí
   */
  iniciarAcai(telefone, numeroAcai) {
    const sessao = this.sessions.get(telefone);
    if (sessao) {
      sessao.dados.acaiAtual = {
        numero: numeroAcai,
        tamanho: null,
        acai: [],
        gelatos: [],
        frutas: [],
        complementos: [],
        caldas: [],
      };
    }
  }

  /**
   * Finaliza montagem do açaí atual e adiciona ao carrinho
   */
  finalizarAcai(telefone) {
    const sessao = this.sessions.get(telefone);
    if (sessao && sessao.dados.acaiAtual) {
      sessao.dados.carrinho.push(sessao.dados.acaiAtual);
      sessao.dados.acaiAtual = null;
    }
  }

  /**
   * Limpa carrinho
   */
  limparCarrinho(telefone) {
    const sessao = this.sessions.get(telefone);
    if (sessao) {
      sessao.dados.carrinho = [];
      sessao.dados.acaiAtual = null;
    }
  }

  // ===============================================
  // A1 (PROMPT 6) - MODO EDIÇÃO (SEM 0/V)
  // ===============================================

  /**
   * A1/E1 - Ativa modo edição
   */
  ativarModoEdicao(telefone, categoria) {
    const sessao = this.sessions.get(telefone);
    if (sessao) {
      sessao.dados.modoEdicao = true;
      sessao.dados.categoriaEditando = categoria;
    }
  }

  /**
   * A1/E1 - Desativa modo edição
   */
  desativarModoEdicao(telefone) {
    const sessao = this.sessions.get(telefone);
    if (sessao) {
      sessao.dados.modoEdicao = false;
      sessao.dados.categoriaEditando = null;
    }
  }

  /**
   * A1/E1 - Verifica se está em modo edição
   */
  estaModoEdicao(telefone) {
    const sessao = this.sessions.get(telefone);
    return sessao ? sessao.dados.modoEdicao : false;
  }

  /**
   * A1/E1 - Retorna categoria sendo editada
   */
  getCategoriaEditando(telefone) {
    const sessao = this.sessions.get(telefone);
    return sessao ? sessao.dados.categoriaEditando : null;
  }

  // ===============================================
  // v2.5.7 - MODO TESTE (testacai)
  // ===============================================

  /**
   * v2.5.7 - Define se a sessão está em modo teste
   */
  setModoTeste(telefone, valor = true) {
    const sessao = this.sessions.get(telefone);
    if (sessao) {
      sessao.modoTeste = valor;
    }
  }

  /**
   * v2.5.7 - Verifica se a sessão está em modo teste
   */
  getModoTeste(telefone) {
    const sessao = this.sessions.get(telefone);
    return sessao ? sessao.modoTeste : false;
  }

  // ===============================================
  // E2 - DETECÇÃO DE MÚLTIPLAS MENSAGENS SEPARADAS
  // ===============================================

  /**
   * E2 - Registra escolha parcial (número único)
   * Retorna true se detectou padrão de múltiplas mensagens
   */
  registrarEscolhaParcial(telefone, numero) {
    const agora = Date.now();
    const parcial = this.escolhasParciais.get(telefone);
    
    // Janela de 10 segundos para considerar como múltiplas mensagens separadas
    const JANELA_MS = 10000;
    
    if (parcial && (agora - parcial.timestamp) < JANELA_MS) {
      // Detectou padrão de múltiplas mensagens separadas
      parcial.numeros.push(numero);
      parcial.timestamp = agora;
      return true;
    }
    
    // Nova sequência
    this.escolhasParciais.set(telefone, {
      numeros: [numero],
      timestamp: agora
    });
    
    return false;
  }

  /**
   * E2 - Limpa escolhas parciais
   */
  limparEscolhasParciais(telefone) {
    this.escolhasParciais.delete(telefone);
  }

  /**
   * E2 - Verifica se a mensagem é apenas um número único
   */
  ehNumeroUnico(mensagem) {
    const limpo = mensagem.trim();
    return /^\d+$/.test(limpo);
  }
}

module.exports = new StateManager();
