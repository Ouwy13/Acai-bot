/**
 * Processador de mensagens e lógica de estados
 * Versão: 2.5.4 - Prompt 10
 * 
 * Implementa todos os fluxos do chatbot
 * 
 * Prompt 7:
 * - Nova abordagem para cliente que desistiu (sem pedidos)
 * - Explicação do funcionamento com opção de taxas
 * - FAQ atualizado (8 perguntas)
 * - Nova etapa ESCOLHA_ENTREGA (delivery/retirada)
 * - Nova etapa ESCOLHA_TAXA (endereço + região)
 * - Mensagem de espera com versões delivery/retirada
 * - Pagamento com opção "Na retirada"
 * - Nova etapa AGUARDANDO_RETIRADA
 * - Correção do agradecimento para clientes antigos
 * 
 * Prompt 8:
 * - Proteção contra undefined em validacao.opcoes[0]
 * - Validação rigorosa de inputs (só números, vírgulas e espaços)
 * - Confirmação de endereço em todos os fluxos de delivery
 * - Validação de endereço com 3 partes mínimas (Bairro, Rua, Número)
 * - Agradecimento baseado na contagem de pedidos no BD
 * 
 * Prompt 9:
 * - Salvar endereço no BD após confirmação no delivery
 * - Mensagem de desistência + fluxo automático (cardápio + explicação)
 * - Não envia aviso ao admin quando cliente com nome registrado desiste
 * - Integrar região+taxa na confirmação de endereço (clientes com histórico)
 * - Pular seleção de região quando endereço+região+taxa já confirmados
 * 
 * Prompt 10 (v2.5.4) - CORREÇÕES CRÍTICAS:
 * - Verificação de horário OBRIGATÓRIA para TODOS os clientes (novos e antigos)
 * - Timezone forçado para America/Fortaleza (Brejo-MA)
 * - Reconhecimento de cliente melhorado com logs detalhados
 * - Verificação de horário removida de iniciarAtendimento() (agora em processar())
 */

const { ESTADOS, ADMIN_NUMBER, ADMIN_NUMBERS, ENTREGADOR_NUMBER, ENTREGADOR_NUMBERS, IGNORED_NUMBERS, PRECO_BASE, ENDERECO, CHAVE_PIX, PADROES, MENSAGEM_AUDIO, MENSAGEM_AUDIO_SUPORTE, MENSAGEM_MULTIPLAS_SEPARADAS, MENSAGEM_ENDERECO_SEM_VIRGULAS, MENSAGEM_STOPACAI, TYPING_DELAY, TAXAS_ENTREGA } = require('../config/constants');
const MENU = require('../config/menu');
const Validator = require('./validator');
const Helpers = require('../utils/helpers');
const Logger = require('../utils/logger');
const stateManager = require('./stateManager');
const database = require('./database');
const { MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

class MessageHandler {
  constructor(client) {
    this.client = client;
  }

  _getAdminNumbers() {
    if (Array.isArray(ADMIN_NUMBERS) && ADMIN_NUMBERS.length > 0) return ADMIN_NUMBERS;
    return ADMIN_NUMBER ? [ADMIN_NUMBER] : [];
  }

  _getEntregadorNumbers() {
    if (Array.isArray(ENTREGADOR_NUMBERS) && ENTREGADOR_NUMBERS.length > 0) return ENTREGADOR_NUMBERS;
    return ENTREGADOR_NUMBER ? [ENTREGADOR_NUMBER] : [];
  }

  _isIgnoredNumber(telefone) {
    const lista = Array.isArray(IGNORED_NUMBERS) ? IGNORED_NUMBERS : [];
    return lista.includes(telefone);
  }

  async enviarParaAdmins(conteudo, opcoes = null) {
    const numeros = this._getAdminNumbers();
    for (const num of numeros) {
      try {
        if (opcoes) {
          await this.client.sendMessage(num, conteudo, opcoes);
        } else {
          await this.client.sendMessage(num, conteudo);
        }
      } catch (e) {
        Logger.error(`Erro ao enviar mensagem para admin ${num}`, e);
      }
    }
  }

  async enviarParaEntregadores(mensagem) {
    const numeros = this._getEntregadorNumbers();
    for (const num of numeros) {
      try {
        await this.client.sendMessage(num, mensagem);
      } catch (e) {
        Logger.error(`Erro ao enviar mensagem para entregador ${num}`, e);
      }
    }
  }

  async formatarTelefoneParaAdmin(telefone) {
    try {
      if (!telefone) return Helpers.limparTelefoneParaAdmin(telefone);

      // Caso normal @c.us
      if (telefone.includes('@c.us')) {
        return Helpers.limparTelefoneParaAdmin(telefone);
      }

      // Caso @lid: tenta resolver o contato real
      const contato = await this.client.getContactById(telefone);
      const numero = contato?.number || contato?.id?.user;
      if (numero) {
        return numero;
      }
    } catch (e) {
      // Fallback silencioso
    }

    return Helpers.limparTelefoneParaAdmin(telefone);
  }

  /**
   * T1 - Processa mensagem do funcionário (fromMe === true)
   */
  async processarMensagemFuncionario(msg) {
    const telefone = msg.to; // Destino da mensagem (cliente)
    const mensagem = msg.body.trim();
    const sessao = stateManager.getSessao(telefone);

    // NF1 - Verifica se admin enviou stopacai
    if (Helpers.ehComandoParar(mensagem)) {
      Logger.info(`[FUNCIONÁRIO] Admin enviou stopacai para ${telefone}`);
      
      if (sessao) {
        stateManager.encerrarSessao(telefone);
        Logger.info(`[FUNCIONÁRIO] Sessão encerrada por stopacai do admin`);
      }
      return true;
    }

    if (!sessao) {
      Logger.info(`[FUNCIONÁRIO] Mensagem para ${telefone} - Sem sessão ativa`);
      return false;
    }

    const estado = sessao.estado;
    Logger.log('FUNCIONÁRIO', Helpers.formatarTelefone(telefone), null, estado, `Mensagem: "${mensagem}"`);

    // T2 - Detectar m1 com valor (Prontinho ✅🍧 + Valor do pedido: R$ {valor})
    if (this.detectarM1(mensagem)) {
      const valor = this.extrairValorM1(mensagem);
      
      if (valor && estado === ESTADOS.ESPERA_PREPARO) {
        stateManager.setDados(telefone, 'valor', valor);
        Logger.info(`[FUNCIONÁRIO] Valor recebido do funcionário: R$ ${valor}`);
        
        // Avança para ETAPA 9 - Forma de pagamento
        stateManager.setEstado(telefone, ESTADOS.PAGAMENTO);
        
        // Busca a mensagem original do cliente para responder
        const chat = await this.client.getChatById(telefone);
        await this.enviarMensagemPagamento(chat, telefone);
        
        return true;
      }
    }

    // T3 - Detectar "Ok 👍" para validar comprovante Pix
    if (mensagem === PADROES.OK_ADMIN && estado === ESTADOS.AGUARDANDO_OK_ADMIN) {
      Logger.info(`[FUNCIONÁRIO] Ok recebido para comprovante Pix`);
      
      // Cancela timer de Pix
      stateManager.cancelarTimerPixComprovante(telefone);
      
      // Prompt 7 - Verifica forma de entrega para decidir próximo passo
      const formaEntrega = stateManager.getDados(telefone, 'formaEntrega');
      
      if (formaEntrega === 'retirada') {
        // Retirada: vai para AGUARDANDO_RETIRADA
        stateManager.setEstado(telefone, ESTADOS.AGUARDANDO_RETIRADA);
        await this.enviarMensagemAguardandoRetirada(telefone);
      } else if (formaEntrega === 'delivery') {
        // Delivery: vai para confirmação final
        stateManager.setEstado(telefone, ESTADOS.CONFIRMACAO_FINAL);
        const chat = await this.client.getChatById(telefone);
        await this.enviarMensagemConfirmacaoFinalChat(chat, telefone);
      } else {
        // Fallback: comportamento antigo (endereço)
        stateManager.setEstado(telefone, ESTADOS.ENDERECO_CLIENTE);
        await this.enviarMensagemEnderecoCliente(telefone);
      }
      
      return true;
    }

    // Mensagem rápida "👉 Digite 0..." é apenas informativa
    if (mensagem.includes(PADROES.DIGITAR_ZERO)) {
      Logger.info(`[FUNCIONÁRIO] Mensagem informativa enviada ao cliente`);
      return true;
    }

    return false;
  }

  /**
   * T2 - Detecta padrão m1 (mensagem com valor)
   */
  detectarM1(mensagem) {
    return mensagem.includes(PADROES.M1_LINHA1) && PADROES.M1_VALOR_REGEX.test(mensagem);
  }

  /**
   * T2 - Extrai valor de m1
   */
  extrairValorM1(mensagem) {
    const match = mensagem.match(PADROES.M1_VALOR_REGEX);
    if (match) {
      let valor = match[1].replace(',', '.');
      return parseFloat(valor);
    }
    return null;
  }

  /**
   * T5 / A3 - Processa mensagem de áudio
   * A3 - Em PREPARO e SUPORTE não repete pergunta
   */
  async processarAudio(msg, telefone) {
    const sessao = stateManager.getSessao(telefone);
    if (!sessao) return false;

    const estado = sessao.estado;

    // Verifica se já avisou sobre áudio nesta etapa
    if (!stateManager.getAudioAvisado(telefone)) {
      // Envia mensagem padrão de áudio
      await this.enviarMensagemComTyping(msg, MENSAGEM_AUDIO);
      stateManager.setAudioAvisado(telefone, true);

      // A3 - Em SUPORTE adiciona mensagem extra
      if (estado === ESTADOS.FAQ_SUPPORT_WAIT || estado === ESTADOS.CONGELADO_SUPORTE) {
        await Helpers.sleep(500);
        await this.enviarMensagemComTyping(msg, MENSAGEM_AUDIO_SUPORTE);
      }
    }

    // A3 - Em PREPARO e SUPORTE, NÃO repete a última pergunta
    if (estado === ESTADOS.ESPERA_PREPARO || 
        estado === ESTADOS.PREPARE ||
        estado === ESTADOS.FAQ_SUPPORT_WAIT ||
        estado === ESTADOS.CONGELADO_SUPORTE ||
        estado === ESTADOS.PAGAMENTO_PIX ||
        estado === ESTADOS.AGUARDANDO_OK_ADMIN ||
        estado === ESTADOS.AGUARDANDO_RETIRADA) {
      // Apenas retorna sem repetir pergunta
      return true;
    }

    // Repete a última pergunta (estados normais)
    const ultimaPergunta = stateManager.getUltimaPergunta(telefone);
    if (ultimaPergunta) {
      await Helpers.sleep(1000);
      await this.enviarMensagemComTyping(msg, ultimaPergunta);
    }

    return true;
  }

  /**
   * T3 - Processa comprovante de mídia (Pix)
   */
  async processarComprovanteMidia(msg, telefone) {
    const sessao = stateManager.getSessao(telefone);
    if (!sessao || sessao.estado !== ESTADOS.PAGAMENTO_PIX) return false;

    const cliente = database.getCliente(telefone);
    
    // Marca comprovante como recebido
    stateManager.setDados(telefone, 'comprovanteRecebido', true);
    
    // A4 - Cancela timer de Pix comprovante
    stateManager.cancelarTimerPixComprovante(telefone);
    
    // Notifica admin com telefone formatado (E2)
    try {
      const telefoneAdmin = await this.formatarTelefoneParaAdmin(telefone);
      const resumo = `💰 *COMPROVANTE PIX RECEBIDO*\n` +
        `👤 *Cliente:* ${cliente.nome_completo}\n` +
        `📞 *Telefone:* ${telefoneAdmin}\n` +
        `💵 *Valor:* R$ ${stateManager.getDados(telefone, 'valor')}\n` +
        `⏳ Aguardando confirmação (responda "Ok 👍" para aprovar)`;
      
      await this.enviarParaAdmins(resumo);
      
      // Encaminha a mídia para o admin também
      if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        if (media) {
          await this.enviarParaAdmins(media, { caption: `Comprovante de ${cliente.primeiro_nome}` });
        }
      }
    } catch (erro) {
      Logger.error('Erro ao encaminhar comprovante para admin', erro);
    }

    // Muda para estado aguardando Ok do admin
    stateManager.setEstado(telefone, ESTADOS.AGUARDANDO_OK_ADMIN);
    
      await this.enviarMensagemComTyping(msg,
        `Seu comprovante já foi recebido ✅\nAguarde só um instante enquanto confirmamos o pagamento ⌛`
      );

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.PAGAMENTO_PIX,
      'Comprovante Pix recebido e encaminhado para admin'
    );

    return true;
  }

  /**
   * Processa mensagem recebida
   * v2.5.4 - CORREÇÃO CRÍTICA: Verificação de horário OBRIGATÓRIA para TODOS os clientes
   */
  async processar(msg, isFromMe = false, isAudio = false, hasMedia = false, mediaType = null) {
    const telefone = isFromMe ? msg.to : msg.from;
    const mensagem = (msg.body || '').trim();

    // Ignora números configurados
    if (!isFromMe && this._isIgnoredNumber(telefone)) {
      return;
    }
    
    // T8 - Anti-duplicação
    const msgId = msg?.id?._serialized;
    if (msgId && stateManager.isMensagemDuplicada(msgId)) {
      Logger.info(`[ANTI-DUP] Mensagem duplicada ignorada: ${msgId}`);
      return;
    }

    // T1 - Mensagem do funcionário
    if (isFromMe) {
      await this.processarMensagemFuncionario(msg);
      return;
    }

    // NF1 - Verifica se cliente enviou stopacai
    if (mensagem && Helpers.ehComandoParar(mensagem)) {
      await this.processarStopAcai(msg, telefone);
      return;
    }

    // ============================================================
    // v2.5.4 - VERIFICAÇÃO DE HORÁRIO OBRIGATÓRIA PARA TODOS
    // Executa ANTES de qualquer lógica de sessão ou cliente
    // Exceção: palavra-chave "testacai" permite acesso fora do horário
    // v2.5.7 - CORREÇÃO: Modo teste persiste durante toda a sessão
    // ============================================================
    const sessao = stateManager.getSessao(telefone);
    const cliente = database.getCliente(telefone);
    const estado = stateManager.getEstado(telefone);
    
    // Log de debug para identificar tipo de cliente
    console.log(`\n[HORÁRIO CHECK] ============================================`);
    console.log(`[HORÁRIO CHECK] Telefone: ${telefone}`);
    console.log(`[HORÁRIO CHECK] Tem sessão ativa: ${sessao ? 'SIM' : 'NÃO'}`);
    console.log(`[HORÁRIO CHECK] Estado atual: ${estado || 'NENHUM'}`);
    console.log(`[HORÁRIO CHECK] É cliente no BD: ${cliente ? 'SIM' : 'NÃO'}`);
    console.log(`[HORÁRIO CHECK] Mensagem: "${mensagem}"`);
    console.log(`[HORÁRIO CHECK] É modo teste (mensagem): ${Helpers.ehModoTeste(mensagem)}`);
    
    // v2.5.7 - Verifica se sessão está em modo teste
    const sessaoEmModoTeste = stateManager.getModoTeste(telefone);
    console.log(`[HORÁRIO CHECK] Sessão em modo teste: ${sessaoEmModoTeste ? 'SIM' : 'NÃO'}`);
    
    // Verifica se está fora do horário E não é modo teste
    const foraDoHorario = !Helpers.dentroDoHorario();
    const ehTeste = Helpers.ehModoTeste(mensagem);
    
    // v2.5.7 - CORREÇÃO: Se sessão já está em modo teste, permite continuar
    if (foraDoHorario && !ehTeste && !sessaoEmModoTeste) {
      // FORA DO HORÁRIO - Bloqueia TODOS os clientes (novos e antigos)
      
      // Se já respondeu abertura recentemente, não responde de novo
      if (stateManager.jaRespondeuAbertura(telefone, 'FORA_HORARIO')) {
        console.log(`[HORÁRIO CHECK] Já respondeu fora do horário - ignorando`);
        console.log(`[HORÁRIO CHECK] ============================================\n`);
        return;
      }
      
      // Encerra qualquer sessão ativa existente
      if (sessao) {
        console.log(`[HORÁRIO CHECK] ⚠️ CLIENTE ANTIGO TENTANDO ACESSAR FORA DO HORÁRIO`);
        console.log(`[HORÁRIO CHECK] Encerrando sessão existente...`);
        stateManager.encerrarSessao(telefone);
      }
      
      // Marca que respondeu e inicia nova sessão no estado FORA_DO_HORARIO
      stateManager.marcarAberturaRespondida(telefone, 'FORA_HORARIO');
      stateManager.iniciarSessao(telefone, ESTADOS.FORA_DO_HORARIO);
      
      await this.enviarMensagemComTyping(msg, this.getMensagemForaDoHorario());
      
      Logger.log(
        'ENVIADA',
        Helpers.formatarTelefone(telefone),
        cliente?.primeiro_nome || null,
        ESTADOS.FORA_DO_HORARIO,
        `BLOQUEADO - Fora do horário (cliente ${cliente ? 'EXISTENTE' : 'NOVO'})`
      );
      
      console.log(`[HORÁRIO CHECK] ❌ BLOQUEADO - Mensagem de fora do horário enviada`);
      console.log(`[HORÁRIO CHECK] ============================================\n`);
      return;
    }
    
    console.log(`[HORÁRIO CHECK] ✅ Horário OK ou modo teste - continuando fluxo`);
    console.log(`[HORÁRIO CHECK] ============================================\n`);
    // ============================================================
    // FIM DA VERIFICAÇÃO DE HORÁRIO
    // ============================================================

    // Incrementa contador de mensagens
    if (sessao) {
      stateManager.incrementarMensagens(telefone);
    }

    Logger.log(
      'RECEBIDA',
      Helpers.formatarTelefone(telefone),
      cliente?.primeiro_nome || '(desconhecido)',
      estado || 'SEM_ESTADO',
      `Mensagem: "${mensagem}" | Áudio: ${isAudio} | Mídia: ${hasMedia}`
    );

    // T5/A3 - Tratamento de áudio
    if (isAudio && sessao) {
      await this.processarAudio(msg, telefone);
      return;
    }

    // T3 - Tratamento de comprovante de mídia (imagem/PDF)
    if (hasMedia && (mediaType === 'image' || mediaType === 'document') && sessao) {
      if (sessao.estado === ESTADOS.PAGAMENTO_PIX) {
        await this.processarComprovanteMidia(msg, telefone);
        return;
      }
    }

    // T6/A5 - Estados congelados
    if (sessao && stateManager.isEstadoCongelado(estado)) {
      await this.processarEstadoCongelado(msg, telefone, mensagem, estado);
      return;
    }

    // Verifica se há sessão ativa
    if (!sessao) {
      // Nova interação
      return this.iniciarAtendimento(msg, telefone, mensagem);
    }

    // Processa baseado no estado atual
    await this.processarEstado(msg, telefone, mensagem, estado);
  }

  /**
   * NF1 - Processa comando stopacai do cliente
   */
  async processarStopAcai(msg, telefone) {
    const cliente = database.getCliente(telefone);
    const sessao = stateManager.getSessao(telefone);

    // Encerra sessão atual imediatamente
    if (sessao) {
      stateManager.encerrarSessao(telefone);
    }

    // Verifica se é cliente com nome registrado (sem último_pedido)
    const temNomeRegistrado = cliente && cliente.primeiro_nome && !cliente.ultimo_pedido;
    
    if (temNomeRegistrado) {
      // Cliente com nome registrado desistiu
      // Apenas envia mensagem de encerramento e NÃO reinicia fluxo
      await this.enviarMensagemComTyping(msg, MENSAGEM_STOPACAI);

      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        'STOPACAI_DESISTENCIA',
        'Cliente com nome registrado encerrou - sem aviso ao admin, sem reiniciar fluxo'
      );
    } else if (cliente && cliente.primeiro_nome) {
      // Cliente novo que informou nome mas ainda não completou pedido
      // Também apenas encerra sem reiniciar
      await this.enviarMensagemComTyping(msg, MENSAGEM_STOPACAI);

      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        'STOPACAI_DURANTE_FLUXO',
        'Cliente encerrou durante fluxo - sem aviso ao admin, sem reiniciar'
      );
    } else {
      // Cliente novo (sem nome) ou desconhecido
      await this.enviarMensagemComTyping(msg, MENSAGEM_STOPACAI);

      // Avisa admin (só para clientes sem nome registrado)
      try {
        const telefoneAdmin = await this.formatarTelefoneParaAdmin(telefone);
        const aviso = `🛑 *ATENDIMENTO ENCERRADO PELO CLIENTE*\n` +
          `👤 *Cliente:* ${cliente?.nome_completo || 'Desconhecido'}\n` +
          `📞 *Telefone:* ${telefoneAdmin}`;
        
        await this.enviarParaAdmins(aviso);
      } catch (erro) {
        Logger.error('Erro ao avisar admin sobre stopacai', erro);
      }

      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente?.primeiro_nome,
        'STOPACAI',
        'Atendimento encerrado pelo cliente via stopacai - admin avisado'
      );
    }
  }

  /**
   * T6/A5 - Processa estados congelados
   * Prompt 7 - Inclui AGUARDANDO_RETIRADA
   */

  /**
   * Prompt 9 - Envia mensagem de desistência para cliente com nome registrado
   * Cliente desistiu antes do resumo ir para o admin
   * Não envia mensagem para o admin
   */
  async enviarMensagemDesistencia(msg, telefone) {
    const cliente = database.getCliente(telefone);
    
    // Só envia se cliente tem nome registrado e não tem último_pedido
    if (!cliente || !cliente.primeiro_nome || cliente.ultimo_pedido) {
      return;
    }

    const saudacao = Helpers.saudacaoDoDia();
    
    const mensagem = `Olá, *${saudacao} ${cliente.primeiro_nome}!* 😍🍧
Que bom ver você de volta no *Espaço Açaí & Gelatos* 💜
Dessa vez vamos montar seu pedido?`;

    await this.enviarMensagemComTyping(msg, mensagem);

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      'DESISTENCIA',
      'Cliente desistiu de fazer pedido (nome registrado)'
    );
  }

    async processarEstadoCongelado(msg, telefone, mensagem, estado) {
    const cliente = database.getCliente(telefone);

    // Se estiver aguardando comprovante ou aguardando ok do admin, fica mudo
    if (estado === ESTADOS.PAGAMENTO_PIX || estado === ESTADOS.AGUARDANDO_OK_ADMIN) {
      return;
    }

    // Prompt 7 - Aguardando retirada: fica mudo
    if (estado === ESTADOS.AGUARDANDO_RETIRADA) {
      return;
    }

    if (estado === ESTADOS.CONGELADO_SUPORTE) {
      // Só sai quando cliente digitar 0
      if (mensagem === '0') {
        stateManager.setEstado(telefone, ESTADOS.BUILD_START);
        await this.processarBuildStart(msg, telefone);
        
        Logger.log(
          'OPERAÇÃO',
          Helpers.formatarTelefone(telefone),
          cliente?.primeiro_nome,
          ESTADOS.CONGELADO_SUPORTE,
          'Cliente saiu do suporte digitando 0'
        );
      }
      // Bot fica mudo para qualquer outra mensagem
      return;
    }

    if (estado === ESTADOS.ESPERA_PREPARO) {
      // Bot responde apenas uma vez se cliente perguntar
      const sessao = stateManager.getSessao(telefone);
      if (!sessao.respondeuEspera) {
        await this.enviarMensagemComTyping(msg, 
          `✅ Estamos preparando seu pedido, só um instante por favor ⌛🍧`
        );
        sessao.respondeuEspera = true;
      }
      // Bot fica mudo depois
      return;
    }

    // A5 - Estado ESPERA_PAGAMENTO (silencioso, mas captura forma de pagamento)
    if (estado === ESTADOS.ESPERA_PAGAMENTO) {
      // Verifica se cliente enviou forma de pagamento
      const formaEntrega = stateManager.getDados(telefone, 'formaEntrega');
      const formaPagamento = this.detectarFormaPagamento(mensagem, formaEntrega);
      
      if (formaPagamento) {
        // Cancela timer e flag
        stateManager.cancelarTimerFormaPagamento(telefone);
        
        // Sai do modo silencioso e processa normalmente
        stateManager.setEstado(telefone, ESTADOS.PAGAMENTO);
        await this.processarPagamento(msg, telefone, mensagem);
        
        Logger.log(
          'OPERAÇÃO',
          Helpers.formatarTelefone(telefone),
          cliente?.primeiro_nome,
          ESTADOS.ESPERA_PAGAMENTO,
          `Cliente respondeu forma de pagamento: ${formaPagamento} - saindo do modo silencioso`
        );
      }
      // Se não for forma de pagamento, fica mudo
      return;
    }
  }

  /**
   * A5 - Detecta forma de pagamento na mensagem
   * Prompt 7 - Aceita opção 4 (na retirada) quando forma de entrega é retirada
   */
  detectarFormaPagamento(mensagem, formaEntrega = null) {
    const msg = mensagem.toLowerCase().trim();
    
    if (msg === '1' || msg.includes('pix')) return 'pix';
    if (msg === '2' || msg.includes('dinheiro')) return 'dinheiro';
    if (msg === '3' || msg.includes('cartão') || msg.includes('cartao')) return 'cartao';
    if (formaEntrega === 'retirada' && (msg === '4' || msg.includes('retirada'))) return 'na_retirada';
    
    return null;
  }

  /**
   * Inicia atendimento (primeira interação)
   * Prompt 7 - Nova abordagem para cliente que desistiu (tem nome mas sem pedido)
   * Prompt 10 - Logs detalhados para debug da 3ª via
   * v2.5.4 - Verificação de horário REMOVIDA daqui (feita em processar())
   * v2.5.4 - CORREÇÃO reconhecimento de cliente melhorado
   */
  async iniciarAtendimento(msg, telefone, mensagem) {
    // I1 - Verifica se já respondeu abertura recentemente
    // v2.5.4: Horário já verificado em processar(), aqui só marca ABERTURA
    if (stateManager.jaRespondeuAbertura(telefone, 'ABERTURA')) {
      Logger.info(`[I1] Abertura já respondida para ${telefone}, ignorando`);
      return;
    }

    // v2.5.4 - REMOVIDO: Verificação de horário (agora feita em processar())
    // Isso garante que a verificação de horário é feita ANTES de chegar aqui

    // I1 - Marca que respondeu abertura
    stateManager.marcarAberturaRespondida(telefone, 'ABERTURA');

    // ============================================================
    // v2.5.4 - RECONHECIMENTO DE CLIENTE MELHORADO
    // Busca cliente no BD pelo telefone
    // ============================================================
    const clienteExistente = database.getCliente(telefone);
    const isClienteAntigo = database.isClienteAntigo(telefone);
    const temPedido = database.temPedidoAnterior(telefone);
    
    // ====== DEBUG DE RECONHECIMENTO DE CLIENTE ======
    console.log('\n=================================================================');
    console.log('[RECONHECIMENTO] 🔍 Verificando tipo de cliente no BD');
    console.log(`[RECONHECIMENTO] Telefone: ${telefone}`);
    console.log(`[RECONHECIMENTO] ----------------------------------------`);
    
    if (clienteExistente) {
      console.log(`[RECONHECIMENTO] ✅ CLIENTE ENCONTRADO NO BD!`);
      console.log(`[RECONHECIMENTO] -> primeiro_nome: "${clienteExistente.primeiro_nome || '(vazio)'}"`);
      console.log(`[RECONHECIMENTO] -> nome_completo: "${clienteExistente.nome_completo || '(vazio)'}"`);
      console.log(`[RECONHECIMENTO] -> endereco: "${clienteExistente.endereco || '(vazio)'}"`);
      console.log(`[RECONHECIMENTO] -> ultimo_pedido: ${clienteExistente.ultimo_pedido ? 'TEM PEDIDO ✅' : 'SEM PEDIDO ❌'}`);
      console.log(`[RECONHECIMENTO] -> pedidos_confirmados: ${clienteExistente.pedidos_confirmados || 0}`);
      
      if (clienteExistente.ultimo_pedido) {
        console.log(`[RECONHECIMENTO] -> ultimo_pedido.data: ${clienteExistente.ultimo_pedido.data || 'N/A'}`);
        console.log(`[RECONHECIMENTO] -> ultimo_pedido.carrinho: ${clienteExistente.ultimo_pedido.carrinho?.length || 0} itens`);
      }
    } else {
      console.log(`[RECONHECIMENTO] ❌ CLIENTE NÃO ENCONTRADO NO BD`);
    }
    
    console.log(`[RECONHECIMENTO] ----------------------------------------`);
    console.log(`[RECONHECIMENTO] isClienteAntigo(): ${isClienteAntigo}`);
    console.log(`[RECONHECIMENTO] temPedidoAnterior(): ${temPedido}`);
    
    // ============================================================
    // CONDIÇÕES PARA RECONHECIMENTO (ORDEM IMPORTA!)
    // ============================================================
    // CONDIÇÃO 1: Cliente antigo COM último pedido → Menu de repetir/montar
    // CONDIÇÃO 2: Cliente tem nome MAS NÃO tem ultimo_pedido (3ª via - desistiu)
    // CONDIÇÃO 3: Cliente completamente novo (sem dados no BD)
    
    const temNome = clienteExistente && clienteExistente.primeiro_nome && clienteExistente.primeiro_nome.trim() !== '';
    const cond1 = temNome && temPedido;
    const cond2 = temNome && !temPedido;
    const cond3 = !temNome;
    
    console.log(`[RECONHECIMENTO] ----------------------------------------`);
    console.log(`[RECONHECIMENTO] temNome: ${temNome}`);
    console.log(`[RECONHECIMENTO] CONDIÇÃO 1 (Cliente com nome + pedido): ${cond1} ${cond1 ? '← APLICÁVEL' : ''}`);
    console.log(`[RECONHECIMENTO] CONDIÇÃO 2 (3ª VIA - nome sem pedido): ${cond2} ${cond2 ? '← APLICÁVEL' : ''}`);
    console.log(`[RECONHECIMENTO] CONDIÇÃO 3 (Cliente novo): ${cond3} ${cond3 ? '← APLICÁVEL' : ''}`);
    console.log('=================================================================\n');
    // ====== FIM DEBUG ======
    
    // CONDIÇÃO 1: Cliente antigo COM último pedido → Menu de repetir/montar
    if (cond1) {
      // E3 - Cliente antigo (existe no BD com pedido anterior)
      console.log('[FLUXO] >>> Entrando na VIA 1: Cliente antigo com pedido');
      const sessao = stateManager.iniciarSessao(telefone, ESTADOS.RETURNING_CUSTOMER_MENU);
      sessao.dados.clienteNovo = false;
      await this.enviarMensagemBoasVindasRetornante(msg, clienteExistente.primeiro_nome);
      
      Logger.log(
        'ENVIADA',
        Helpers.formatarTelefone(telefone),
        clienteExistente.primeiro_nome,
        'VIA_1_CLIENTE_ANTIGO',
        'Menu de repetir/montar enviado'
      );
      
    // CONDIÇÃO 2 (3ª VIA): Cliente tem nome MAS NÃO tem ultimo_pedido
    // Isso acontece quando cliente desistiu antes de completar o pedido
    } else if (cond2) {
      // 3ª VIA - Cliente que desistiu (tem nome mas SEM pedido anterior)
      console.log('[FLUXO] >>> Entrando na VIA 3: Cliente com nome mas SEM pedido (desistiu)');
      
      // Fluxo automático: boas-vindas + cardápio + explicação
      const sessao = stateManager.iniciarSessao(telefone, ESTADOS.EXPLICA_FUNCIONAMENTO);
      sessao.dados.clienteNovo = false;
      
      const saudacao = Helpers.saudacaoDoDia();
      
      // Envia mensagem de boas-vindas personalizada para 3ª via
      const msg3Via = `Olá, *${saudacao} ${clienteExistente.primeiro_nome}!* 😍🍧\nQue bom ver você de volta no *Espaço Açaí & Gelatos* 💜\nDessa vez vamos montar seu pedido?`;
      console.log(`[3A_VIA] Enviando mensagem: ${msg3Via.substring(0, 50)}...`);
      
      await this.enviarMensagemComTyping(msg, msg3Via);
      
      Logger.log(
        'ENVIADA',
        Helpers.formatarTelefone(telefone),
        clienteExistente.primeiro_nome,
        '3A_VIA',
        'Enviada mensagem de boas-vindas para cliente 3ª via (nome sem ultimo_pedido)'
      );
      
      // Continua automaticamente com o cardápio
      console.log('[3A_VIA] Enviando cardápio...');
      await Helpers.sleep(1500);
      await this.enviarCardapio(msg);
      
      console.log('[3A_VIA] Enviando explicação do funcionamento...');
      await Helpers.sleep(1000);
      await this.enviarMensagemExplicaFuncionamento(msg, clienteExistente.primeiro_nome);
      
      Logger.log(
        'ENVIADA',
        Helpers.formatarTelefone(telefone),
        clienteExistente.primeiro_nome,
        'EXPLICA_FUNCIONAMENTO',
        'Cardápio enviado automaticamente para cliente 3ª via'
      );
      
    // CONDIÇÃO 3: Cliente completamente novo (sem dados no BD)
    } else {
      // Cliente novo
      console.log('[FLUXO] >>> Entrando na VIA 2: Cliente completamente novo');
      stateManager.iniciarSessao(telefone, ESTADOS.BOAS_VINDAS);
      await this.enviarMensagemBoasVindas(msg);
      
      Logger.log(
        'ENVIADA',
        Helpers.formatarTelefone(telefone),
        null,
        'VIA_2_CLIENTE_NOVO',
        'Solicitado nome do cliente'
      );
    }
  }

  /**
   * Processa estado atual
   * Prompt 7 - Adicionados novos estados
   */
  async processarEstado(msg, telefone, mensagem, estado) {
    switch (estado) {
      case ESTADOS.FORA_DO_HORARIO:
        await this.processarForaDoHorario(msg, telefone, mensagem);
        break;

      case ESTADOS.BOAS_VINDAS:
        await this.processarBoasVindas(msg, telefone, mensagem);
        break;

      case ESTADOS.CONFIRMA_NOME:
        await this.processarConfirmaNome(msg, telefone);
        break;

      case ESTADOS.EXPLICA_FUNCIONAMENTO:
        await this.processarExplicaFuncionamento(msg, telefone, mensagem);
        break;

      // Prompt 7 - Estado para exibir taxas
      case ESTADOS.EXIBE_TAXAS:
        await this.processarExibeTaxas(msg, telefone, mensagem);
        break;

      case ESTADOS.RETURNING_CUSTOMER_MENU:
        await this.processarMenuClienteRetornante(msg, telefone, mensagem);
        break;

      // FAQ
      case ESTADOS.FAQ_MENU:
        await this.processarFAQMenu(msg, telefone, mensagem);
        break;

      case ESTADOS.FAQ_ANSWER:
        await this.processarFAQAnswer(msg, telefone, mensagem);
        break;

      case ESTADOS.FAQ_NEXT:
        await this.processarFAQNext(msg, telefone, mensagem);
        break;

      case ESTADOS.FAQ_SUPPORT_WAIT:
        await this.processarFAQSupport(msg, telefone, mensagem);
        break;

      // Montagem do pedido
      case ESTADOS.BUILD_START:
        await this.processarBuildStart(msg, telefone);
        break;

      case ESTADOS.BUILD_SIZE:
        await this.processarBuildSize(msg, telefone, mensagem);
        break;

      case ESTADOS.BUILD_ACAI:
        await this.processarBuildAcai(msg, telefone, mensagem);
        break;

      case ESTADOS.BUILD_GELATOS:
        await this.processarBuildGelatos(msg, telefone, mensagem);
        break;

      case ESTADOS.BUILD_FRUTAS:
        await this.processarBuildFrutas(msg, telefone, mensagem);
        break;

      case ESTADOS.BUILD_COMPLEMENTOS:
        await this.processarBuildComplementosP1(msg, telefone, mensagem);
        break;

      case ESTADOS.BUILD_COMPLEMENTOS_P2:
        await this.processarBuildComplementosP2(msg, telefone, mensagem);
        break;

      case ESTADOS.BUILD_CALDAS:
        await this.processarBuildCaldas(msg, telefone, mensagem);
        break;

      case ESTADOS.ADD_MORE:
        await this.processarAddMore(msg, telefone, mensagem);
        break;

      case ESTADOS.REVIEW:
        await this.processarReview(msg, telefone, mensagem);
        break;

      // I6 - Novos estados de edição
      case ESTADOS.REVIEW_EDIT_ACAI:
        await this.processarReviewEditAcai(msg, telefone, mensagem);
        break;

      case ESTADOS.REVIEW_EDIT_CATEGORIA:
        await this.processarReviewEditCategoria(msg, telefone, mensagem);
        break;

      case ESTADOS.REVIEW_ALTERAR_NOME:
        await this.processarReviewAlterarNome(msg, telefone, mensagem);
        break;

      // Prompt 7 - Escolha de entrega
      case ESTADOS.ESCOLHA_ENTREGA:
        await this.processarEscolhaEntrega(msg, telefone, mensagem);
        break;

      // Prompt 7 - Fluxo de delivery (endereço + taxa)
      case ESTADOS.ENDERECO_DELIVERY:
        await this.processarEnderecoDelivery(msg, telefone, mensagem);
        break;

      case ESTADOS.CONFIRMA_ENDERECO_DELIVERY:
        await this.processarConfirmaEnderecoDelivery(msg, telefone, mensagem);
        break;

      case ESTADOS.SELECIONA_REGIAO:
        await this.processarSelecionaRegiao(msg, telefone, mensagem);
        break;

      case ESTADOS.PREPARE:
        await this.processarPrepare(msg, telefone, mensagem);
        break;

      // Fluxo p2 - Pagamento
      case ESTADOS.PAGAMENTO:
        await this.processarPagamento(msg, telefone, mensagem);
        break;

      case ESTADOS.PAGAMENTO_PIX:
        await this.processarPagamentoPix(msg, telefone, mensagem);
        break;

      case ESTADOS.AGUARDANDO_OK_ADMIN:
        await this.processarAguardandoOkAdmin(msg, telefone, mensagem);
        break;

      case ESTADOS.PAGAMENTO_DINHEIRO:
        await this.processarPagamentoDinheiro(msg, telefone, mensagem);
        break;

      case ESTADOS.PAGAMENTO_DINHEIRO_TROCO:
        await this.processarPagamentoDinheiroTroco(msg, telefone, mensagem);
        break;

      case ESTADOS.PAGAMENTO_CARTAO:
        await this.processarPagamentoCartao(msg, telefone, mensagem);
        break;

      // Endereço (mantido para compatibilidade)
      case ESTADOS.ENDERECO_CLIENTE:
        await this.processarEnderecoCliente(msg, telefone, mensagem);
        break;

      case ESTADOS.CONFIRMA_ENDERECO:
        await this.processarConfirmaEndereco(msg, telefone, mensagem);
        break;

      // Prompt 7 - Aguardando retirada
      case ESTADOS.AGUARDANDO_RETIRADA:
        // Estado congelado, tratado em processarEstadoCongelado
        break;

      // Finalização
      case ESTADOS.CONFIRMACAO_FINAL:
        await this.processarConfirmacaoFinal(msg, telefone, mensagem);
        break;

      default:
        Logger.error(`Estado desconhecido: ${estado}`);
        break;
    }
  }

  // ===============================================
  // MENSAGENS E LÓGICA DOS ESTADOS
  // ===============================================

  /**
   * Estado: FORA_DO_HORARIO
   */
  getMensagemForaDoHorario() {
    return `Olá! 👋
Obrigado por entrar em contato com o *Espaço Açaí & Gelatos* 🍧💜
No momento estamos fora do horário de atendimento.
🕓 Funcionamos das *16h às 22h30* (segunda a domingo).
Se quiser, pode chamar novamente nesse horário 😍`;
  }

  async processarForaDoHorario(msg, telefone, mensagem) {
    // Verifica se digitou palavra de teste
    if (Helpers.ehModoTeste(mensagem)) {
      Logger.info(`Modo teste ativado para ${Helpers.formatarTelefone(telefone)}`);
      
      // v2.5.7 - MARCA sessão como modo teste para persistir durante todo o fluxo
      stateManager.setModoTeste(telefone, true);
      
      const cliente = database.getCliente(telefone);
      
      if (cliente && database.temPedidoAnterior(telefone)) {
        stateManager.setEstado(telefone, ESTADOS.RETURNING_CUSTOMER_MENU);
        await this.enviarMensagemBoasVindasRetornante(msg, cliente.primeiro_nome);
      } else {
        stateManager.setEstado(telefone, ESTADOS.BOAS_VINDAS);
        await this.enviarMensagemBoasVindas(msg);
      }
    }
  }

  /**
   * Estado: BOAS_VINDAS (cliente novo)
   */
  async enviarMensagemBoasVindas(msg) {
  const pergunta = `Olá! Sou o Assisntente Virtual do *Espaço Açaí & Gelatos* 💜
Seja muito bem-vindo(a)! 🍧
Para eu te atender direitinho, me diga seu *nome*, por favor 😊`;


    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);

    Logger.log(
      'ENVIADA',
      msg.from,
      null,
      ESTADOS.BOAS_VINDAS,
      'Solicitado nome do cliente'
    );
  }

  async processarBoasVindas(msg, telefone, mensagem) {
    // Valida nome
    const validacao = Validator.validarNome(mensagem);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, validacao.mensagem);
      Logger.log(
        'ENVIADA',
        Helpers.formatarTelefone(telefone),
        null,
        ESTADOS.BOAS_VINDAS,
        `Nome inválido: ${validacao.erro}`
      );
      return;
    }

    // E4 - Salva nome IMEDIATAMENTE no banco
    const primeiroNome = Helpers.extrairPrimeiroNome(validacao.nome);
    database.criarCliente(telefone, validacao.nome, primeiroNome);

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      primeiroNome,
      ESTADOS.BOAS_VINDAS,
      `Nome validado e salvo: ${validacao.nome}`
    );

    // Avança para confirmação
    stateManager.setEstado(telefone, ESTADOS.CONFIRMA_NOME);
    await this.processarConfirmaNome(msg, telefone);
  }

  /**
   * Estado: CONFIRMA_NOME
   */
  async processarConfirmaNome(msg, telefone) {
    const cliente = database.getCliente(telefone);
    const primeiroNome = cliente.primeiro_nome;

    await this.enviarMensagemComTyping(msg, 
      `Prazer, *${primeiroNome}!* 
Vou te mandar o nosso cardápio completo 👇`
    );

    // Envia imagem do cardápio
    await this.enviarCardapio(msg);

    Logger.log(
      'ENVIADA',
      Helpers.formatarTelefone(telefone),
      primeiroNome,
      ESTADOS.CONFIRMA_NOME,
      'Enviado cardápio e confirmação de nome'
    );

    // Avança para explicar funcionamento
    stateManager.setEstado(telefone, ESTADOS.EXPLICA_FUNCIONAMENTO);
    await Helpers.sleep(1500);
    await this.enviarMensagemExplicaFuncionamento(msg, primeiroNome);
  }

  /**
   * Envia imagem do cardápio
   */
  async enviarCardapio(msg) {
    try {
      const imagePath = path.join(__dirname, '../images/Cardapio.png');
      const media = MessageMedia.fromFilePath(imagePath);
      await this.enviarMidiaComTyping(msg, media);
    } catch (erro) {
      Logger.error('Erro ao enviar imagem do cardápio', erro);
    }
  }

  /**
   * Estado: EXPLICA_FUNCIONAMENTO
   * Prompt 7 - Atualizado com opção de taxas de entrega (3 opções)
   */
  async enviarMensagemExplicaFuncionamento(msg, primeiroNome) {
    const pergunta = `Só explicando rapidinho como funciona aqui 💡🍧
   *1.* Você escolhe seu açaí pelo whatsapp
   *2.* Montamos e pesamos na balança
   *3.* Te enviamos a foto do seu pedido 📸✅
   *4.* O valor final é a soma do peso + taxa de entrega (caso escolha delivery)
Como você prefere seguir?
*❯ 1-* 🤔 Tenho dúvidas
*❯ 2-* 📍 Taxas de entrega
*❯ 3-* 📝 Montar meu pedido`;

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);

    Logger.log(
      'ENVIADA',
      msg.from,
      primeiroNome,
      ESTADOS.EXPLICA_FUNCIONAMENTO,
      'Explicado funcionamento (Prompt 7 - com taxas)'
    );
  }

  /**
   * Prompt 7 - Processa explicação do funcionamento (agora com 3 opções)
   */
  async processarExplicaFuncionamento(msg, telefone, mensagem) {
    const validacao = Validator.validarOpcoes(mensagem, 3, false, false, false);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite *1*, *2* ou *3*.');
      return;
    }

    // Prompt 8 - Proteção contra undefined
    if (!validacao.opcoes || validacao.opcoes.length === 0) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite o número da opção desejada.');
      return;
    }

    const opcao = validacao.opcoes[0];
    const cliente = database.getCliente(telefone);

    if (opcao === 1) {
      // Tenho dúvidas
      stateManager.setEstado(telefone, ESTADOS.FAQ_MENU);
      await this.enviarMensagemFAQMenu(msg, cliente.primeiro_nome);
      
      Logger.log(
        'ENVIADA',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.EXPLICA_FUNCIONAMENTO,
        'Cliente escolheu: Tenho dúvidas'
      );
    } else if (opcao === 2) {
      // Prompt 7 - Taxas de entrega
      stateManager.setEstado(telefone, ESTADOS.EXIBE_TAXAS);
      await this.enviarMensagemTaxasEntrega(msg);
      
      Logger.log(
        'ENVIADA',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.EXPLICA_FUNCIONAMENTO,
        'Cliente escolheu: Taxas de entrega'
      );
    } else if (opcao === 3) {
      // Montar pedido
      stateManager.setEstado(telefone, ESTADOS.BUILD_START);
      await this.processarBuildStart(msg, telefone);
      
      Logger.log(
        'ENVIADA',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.EXPLICA_FUNCIONAMENTO,
        'Cliente escolheu: Montar pedido'
      );
    }
  }

  /**
   * Prompt 7 - Envia mensagem de taxas de entrega
   */
  async enviarMensagemTaxasEntrega(msg) {
    const pergunta = `*━━ TAXAS DE ENTREGA ━━*
*• Centro*: R$ 5,00
*• Arredores*: R$ 7,00
*• Zé Gomes*: R$ 10,0
*❯ 1-* 🤔 Tenho dúvidas
*❯ 2-* 📝 Montar meu pedido`;

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  /**
   * Prompt 7 - Processa estado EXIBE_TAXAS
   */
  async processarExibeTaxas(msg, telefone, mensagem) {
    const validacao = Validator.validarOpcoes(mensagem, 2, false, false, false);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite *1* ou *2*.');
      return;
    }

    // Prompt 8 - Proteção contra undefined
    if (!validacao.opcoes || validacao.opcoes.length === 0) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite o número da opção desejada.');
      return;
    }

    const opcao = validacao.opcoes[0];
    const cliente = database.getCliente(telefone);

    if (opcao === 1) {
      // Tenho dúvidas
      stateManager.setEstado(telefone, ESTADOS.FAQ_MENU);
      await this.enviarMensagemFAQMenu(msg, cliente.primeiro_nome);
      
      Logger.log(
        'ENVIADA',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.EXIBE_TAXAS,
        'Cliente escolheu: Tenho dúvidas (após ver taxas)'
      );
    } else if (opcao === 2) {
      // Montar pedido
      stateManager.setEstado(telefone, ESTADOS.BUILD_START);
      await this.processarBuildStart(msg, telefone);
      
      Logger.log(
        'ENVIADA',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.EXIBE_TAXAS,
        'Cliente escolheu: Montar pedido (após ver taxas)'
      );
    }
  }

  /**
   * Estado: RETURNING_CUSTOMER_MENU
   * E3 - Mensagem diferenciada para cliente antigo
   */
  async enviarMensagemBoasVindasRetornante(msg, primeiroNome) {
    const saudacao = Helpers.saudacaoDoDia();
    
    // E3 - Mensagem específica para cliente antigo
    const pergunta = `Olá, *${saudacao} ${primeiroNome}!* 😍🍧
Que bom ver você de volta no *Espaço Açaí & Gelatos* 💜
*❯ 1-* 🔁 Repetir meu último pedido
*❯ 2-* 📝 Montar meu pedido`;

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);

    Logger.log(
      'ENVIADA',
      msg.from,
      primeiroNome,
      ESTADOS.RETURNING_CUSTOMER_MENU,
      'Enviado menu para cliente retornante (E3 - cliente antigo)'
    );
  }

  async processarMenuClienteRetornante(msg, telefone, mensagem) {
    const validacao = Validator.validarOpcoes(mensagem, 2, false, false, false);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite *1* ou *2*.');
      return;
    }

    // Prompt 8 - Proteção contra undefined
    if (!validacao.opcoes || validacao.opcoes.length === 0) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite o número da opção desejada.');
      return;
    }

    const opcao = validacao.opcoes[0];
    const cliente = database.getCliente(telefone);

    if (opcao === 1) {
      // Repetir último pedido
      const ultimoPedido = database.getUltimoPedido(telefone);
      
      if (ultimoPedido && ultimoPedido.carrinho) {
        stateManager.setDados(telefone, 'carrinho', ultimoPedido.carrinho);
        stateManager.setEstado(telefone, ESTADOS.REVIEW);
        
        await this.enviarMensagemComTyping(msg, 
          `Perfeito! Vou repetir seu último pedido. 🔁`
        );
        
        await Helpers.sleep(1000);
        await this.enviarMensagemReview(msg, telefone);
        
        Logger.log(
          'OPERAÇÃO',
          Helpers.formatarTelefone(telefone),
          cliente.primeiro_nome,
          ESTADOS.RETURNING_CUSTOMER_MENU,
          'Cliente repetiu último pedido'
        );
      } else {
        await this.enviarMensagemComTyping(msg, 
          `Ops! Não encontrei seu último pedido. 😅
Vamos montar um novo então? Digite *2*.`
        );
      }
    } else if (opcao === 2) {
      // Montar novo pedido: enviar cardápio primeiro
      await this.enviarMensagemComTyping(msg, `Segue nosso cardápio completo 👇`);
      
      await this.enviarCardapio(msg);
      
      await Helpers.sleep(1500);
      
      stateManager.setEstado(telefone, ESTADOS.EXPLICA_FUNCIONAMENTO);
      await this.enviarMensagemExplicaFuncionamento(msg, cliente.primeiro_nome);
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.RETURNING_CUSTOMER_MENU,
        'Cliente escolheu montar novo pedido'
      );
    }
  }

  // ===============================================
  // FAQ - SISTEMA DE DÚVIDAS
  // Prompt 7 - Atualizado para 8 perguntas
  // ===============================================

  /**
   * Estado: FAQ_MENU
   * Prompt 7 - Atualizado para 8 perguntas
   */
  async enviarMensagemFAQMenu(msg, primeiroNome) {
    const pergunta = `Sem problemas, *${primeiroNome}!* 🤝
Escolha uma dúvida abaixo (digite o número):

*1.* 💰 Como é calculado o valor?
*2.* 🤳 Vocês enviam foto na balança?
*3.* 🍧 Por que o preço não é fixo?
*4.* ⏱️ Quanto tempo leva?
*5.* 🧾 Posso mudar depois de montar?
*6.* 🛵 Como funciona a taxa de entrega?
*7.* 🏪 Posso fazer retirada no local?
*8.* 👩‍💻 Quero falar com um atendente (suporte)

*❯* Digite: *1* a *8*
*❯* Ou digite *0* para Montar meu pedido 🍧`;

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  async processarFAQMenu(msg, telefone, mensagem) {
    const validacao = Validator.validarOpcoes(mensagem, 8, false, true, false);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite um número entre *1* e *8*, ou *0* para montar pedido.');
      return;
    }

    if (validacao.comando === 'pular') {
      stateManager.setEstado(telefone, ESTADOS.BUILD_START);
      await this.processarBuildStart(msg, telefone);
      return;
    }

    // Prompt 8 - Proteção contra undefined
    if (!validacao.opcoes || validacao.opcoes.length === 0) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite o número da opção desejada.');
      return;
    }

    const opcao = validacao.opcoes[0];
    const cliente = database.getCliente(telefone);

    if (opcao === 8) {
      // Falar com atendente (agora é opção 8)
      stateManager.setEstado(telefone, ESTADOS.FAQ_SUPPORT_WAIT);
      const resposta = MENU.FAQ[7].resposta.replace('{Nome}', cliente.primeiro_nome);
      await this.enviarMensagemComTyping(msg, resposta);
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.FAQ_MENU,
        'Cliente solicitou suporte humano'
      );
    } else {
      // Prompt 7 - Respostas do FAQ (1-7)
      const respostas = {
        1: `Aqui o valor é calculado pelo peso final na balança. O preço exato depende de quanto o açaí ficou no final`,
        2: `Sim ✅ Depois que você montar, a gente prepara e envia a foto do açaí na balança com o valor 📸`,
        3: `O tamanho ajuda na montagem, mas o valor final não é por tamanho e sim pelo peso`,
        4: `O tempo varia conforme a fila do momento ⏱️ Assim que finalizar a montagem, já encaminhamos pra pesar e te enviamos a foto`,
        5: `Se quiser mudar algo, altere logo
 na montagem ✍️ Depois de montado e pesado, não pode ser alterado`,
        6: `📍 *TAXA DE ENTREGA*\nCobramos uma taxa de acordo com o local:\n*• Centro:* R$ 5,00\n*• Arredores:* R$ 7,00\n*• Zé Gomes:* R$ 10,00\nA taxa é somada ao valor do seu pedido no final.\n✅ Se preferir, você pode fazer retirada no local sem taxa!`,
        7: `Sim! Você pode escolher fazer retirada no estabelecimento.\n📍 *Nosso endereço:*\nAvenida Sabino Câmara – Posto IC, Brejo-MA`,
      };

      const resposta = respostas[opcao];
      stateManager.setDados(telefone, 'ultimaFAQ', opcao);
      
      await this.enviarMensagemComTyping(msg, resposta);
      
      await Helpers.sleep(1500);
      
      stateManager.setEstado(telefone, ESTADOS.FAQ_NEXT);
      await this.enviarMensagemFAQNext(msg);
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.FAQ_MENU,
        `Mostrada resposta FAQ #${opcao}`
      );
    }
  }

  /**
   * Estado: FAQ_NEXT
   * Prompt 7 - Atualizado para 8 perguntas
   */
  async enviarMensagemFAQNext(msg) {
    const pergunta = `Quer ver mais alguma dúvida? 
*❯*  Digite outro número: *1* a *7*
*❯ 8-* 👩‍💻 Falar com atendente
*❯ 0-* 🍧 Montar meu pedido`;

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  async processarFAQNext(msg, telefone, mensagem) {
    const validacao = Validator.validarOpcoes(mensagem, 8, false, true, false);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite um número entre *1* e *8*, ou *0* para montar pedido.');
      return;
    }

    if (validacao.comando === 'pular') {
      stateManager.setEstado(telefone, ESTADOS.BUILD_START);
      await this.processarBuildStart(msg, telefone);
      return;
    }

    // Prompt 8 - Proteção contra undefined
    if (!validacao.opcoes || validacao.opcoes.length === 0) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite o número da opção desejada.');
      return;
    }

    const opcao = validacao.opcoes[0];
    const cliente = database.getCliente(telefone);

    if (opcao === 8) {
      // Falar com atendente
      stateManager.setEstado(telefone, ESTADOS.FAQ_SUPPORT_WAIT);
      const resposta = MENU.FAQ[7].resposta.replace('{Nome}', cliente.primeiro_nome);
      await this.enviarMensagemComTyping(msg, resposta);
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.FAQ_NEXT,
        'Cliente solicitou suporte humano'
      );
    } else if (opcao >= 1 && opcao <= 7) {
      // Prompt 7 - Respostas do FAQ (1-7)
      const respostas = {
        1: `Aqui o valor é calculado pelo peso final na balança. O preço exato depende de quanto o açaí ficou no final`,
        2: `Sim ✅ Depois que você montar, a gente prepara e envia a foto do açaí na balança com o valor 📸`,
        3: `O tamanho ajuda na montagem, mas o valor final não é por tamanho e sim pelo peso`,
        4: `O tempo varia conforme a fila do momento ⏱️ Assim que finalizar a montagem, já encaminhamos pra pesar e te enviamos a foto`,
        5: `Se quiser mudar algo, altere logo
 na montagem ✍️ Depois de montado e pesado, não pode ser alterado`,
        6: `📍 *TAXA DE ENTREGA*\nCobramos uma taxa de acordo com o local:\n*• Centro:* R$ 5,00\n*• Arredores:* R$ 7,00\n*• Zé Gomes:* R$ 10,00\nA taxa é somada ao valor do seu pedido no final.\n✅ Se preferir, você pode fazer retirada no local sem taxa!`,
        7: `Sim! Você pode escolher fazer retirada no estabelecimento.\n📍 *Nosso endereço:*\nAvenida Sabino Câmara – Posto IC, Brejo-MA`,
      };

      const resposta = respostas[opcao];
      
      await this.enviarMensagemComTyping(msg, resposta);
      
      await Helpers.sleep(1500);
      await this.enviarMensagemFAQNext(msg);
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.FAQ_NEXT,
        `Mostrada resposta FAQ #${opcao}`
      );
    }
  }

  /**
   * Estado: FAQ_SUPPORT_WAIT
   */
  async processarFAQSupport(msg, telefone, mensagem) {
    const cliente = database.getCliente(telefone);

    // I2 - Adiciona mensagem ao buffer
    const primeiraMsg = stateManager.adicionarMensagemSuporte(telefone, mensagem, async (duvidaCompleta) => {
      // Este callback é executado após o tempo
      
      // Encaminha para admin com telefone formatado (E2)
      const resumoSuporteParaAdmin = `🆘 *SOLICITAÇÃO DE SUPORTE*\n` +
        `👤 *Cliente:* ${cliente.nome_completo}\n` +
        `📞 *Telefone:* ${await this.formatarTelefoneParaAdmin(telefone)}\n` +
        `💬 *Dúvida/Mensagem:*\n${duvidaCompleta}`;

      try {
        await this.enviarParaAdmins(resumoSuporteParaAdmin);
        
        Logger.log(
          'ENVIADA',
          Helpers.formatarTelefone(telefone),
          cliente.primeiro_nome,
          ESTADOS.FAQ_SUPPORT_WAIT,
          'Dúvida encaminhada para admin'
        );
      } catch (erro) {
        Logger.error('Erro ao enviar para admin', erro);
      }

      // Envia confirmação UMA ÚNICA VEZ
      try {
        const chat = await this.client.getChatById(telefone);
        await chat.sendMessage(`✅ Recebido! Em breve te respondemos por aqui.`);
      } catch (erro) {
        Logger.error('Erro ao enviar confirmação de suporte', erro);
      }

      // Muda para estado congelado
      stateManager.setEstado(telefone, ESTADOS.CONGELADO_SUPORTE);
    });
    
    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.FAQ_SUPPORT_WAIT,
      `Mensagem de suporte adicionada ao buffer`
    );
  }

  // ===============================================
  // MONTAGEM DO PEDIDO
  // ===============================================

  /**
   * Estado: BUILD_START
   */
  async processarBuildStart(msg, telefone) {
    const cliente = database.getCliente(telefone);
    const carrinho = stateManager.getDados(telefone, 'carrinho') || [];
    const numeroAcai = carrinho.length + 1;

    // Inicia novo açaí
    stateManager.iniciarAcai(telefone, numeroAcai);

    if (numeroAcai === 1) {
      await this.enviarMensagemComTyping(msg, 
        `*${cliente.primeiro_nome}* vou te fazer algumas perguntas pra montar seu açaí. 😄`
      );
    } else {
      await this.enviarMensagemComTyping(msg, 
        `*${cliente.primeiro_nome}*, vamos montar mais um açaí para o seu pedido 🍧`
      );
    }

    await Helpers.sleep(1000);

    // Avança para escolha de tamanho
    stateManager.setEstado(telefone, ESTADOS.BUILD_SIZE);
    await this.enviarMensagemBuildSize(msg, telefone);

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.BUILD_START,
      `Iniciada montagem do Açaí #${numeroAcai}`
    );
  }

  /**
   * Estado: BUILD_SIZE
   * A1 - Em modo edição, não mostra 0/V
   */
  async enviarMensagemBuildSize(msg, telefone) {
    let pergunta = `Primeiro: escolha o *tamanho* 🥛\n\n`;
    
    MENU.TAMANHOS.forEach((item) => {
      pergunta += `${item.id}. ${item.nome}\n`;
    });

    // A1 - Verifica modo edição
    if (!stateManager.estaModoEdicao(telefone)) {
      pergunta += `\n*❯*  Digite o número (ex.: *1*)`;
    } else {
      pergunta += `\n*❯*  Digite o número do novo tamanho`;
    }

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  async processarBuildSize(msg, telefone, mensagem) {
    const validacao = Validator.validarOpcoes(mensagem, MENU.TAMANHOS.length, false, false, false);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, 
        validacao.mensagem || `Por favor, escolha um tamanho entre *1* e *${MENU.TAMANHOS.length}*.\nDigite apenas o número da opção.`
      );
      return;
    }

    // Prompt 8 - Proteção contra undefined
    if (!validacao.opcoes || validacao.opcoes.length === 0) {
      await this.enviarMensagemComTyping(msg, 
        `Por favor, escolha um tamanho entre *1* e *${MENU.TAMANHOS.length}*.`
      );
      return;
    }

    const opcao = validacao.opcoes[0];
    const tamanhoSelecionado = MENU.TAMANHOS.find(t => t.id === opcao);
    
    const acaiAtual = stateManager.getDados(telefone, 'acaiAtual');
    acaiAtual.tamanho = tamanhoSelecionado.nome;

    const cliente = database.getCliente(telefone);

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.BUILD_SIZE,
      `Tamanho selecionado: ${tamanhoSelecionado.nome}`
    );

    // A1/E1 - Verifica se está em modo edição
    if (stateManager.estaModoEdicao(telefone)) {
      await this.finalizarEdicaoEVoltarReview(msg, telefone);
      return;
    }

    // Avança para açaí
    stateManager.setEstado(telefone, ESTADOS.BUILD_ACAI);
    await this.enviarMensagemBuildAcai(msg, telefone);
  }

  /**
   * Estado: BUILD_ACAI
   * A1 - Em modo edição, não mostra 0/V
   */
  async enviarMensagemBuildAcai(msg, telefone) {
    let pergunta = `Agora escolha os *sabores de açaí/cremes* 🍧
(você pode escolher mais de um)\n\n`;
    
    MENU.ACAI.forEach((item) => {
      pergunta += `${item.id}. ${item.nome}\n`;
    });

    // A1 - Verifica modo edição
    if (!stateManager.estaModoEdicao(telefone)) {
      pergunta += `\nComo responder:\n*❯*  Um sabor: *1*\n*❯*  Vários: *1,3,5*\n*❯*  *0*- para pular\n*❯*  *V*- para voltar`;
    } else {
      pergunta += `\n*❯*  Um sabor: *1*\n*❯*  Vários: *1,3,5*`;
    }

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  async processarBuildAcai(msg, telefone, mensagem) {
    const modoEdicao = stateManager.estaModoEdicao(telefone);
    const validacao = Validator.validarOpcoes(mensagem, MENU.ACAI.length, true, !modoEdicao, !modoEdicao);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, validacao.mensagem);
      return;
    }

    const cliente = database.getCliente(telefone);

    // Voltar para tamanho (só se não estiver em modo edição)
    if (validacao.comando === 'voltar' && !modoEdicao) {
      stateManager.setEstado(telefone, ESTADOS.BUILD_SIZE);
      await this.enviarMensagemBuildSize(msg, telefone);
      return;
    }

    const acaiAtual = stateManager.getDados(telefone, 'acaiAtual');
    
    if (validacao.comando === 'pular' && !modoEdicao) {
      acaiAtual.acai = [];
    } else if (validacao.opcoes) {
      const itensSelecionados = Validator.buscarItensPorIds('ACAI', validacao.opcoes);
      acaiAtual.acai = itensSelecionados;
    }

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.BUILD_ACAI,
      `Açaís: ${acaiAtual.acai.join(', ') || 'nenhum'}`
    );

    // A1 - Verifica se está em modo edição
    if (modoEdicao) {
      await this.finalizarEdicaoEVoltarReview(msg, telefone);
      return;
    }

    stateManager.setEstado(telefone, ESTADOS.BUILD_GELATOS);
    await this.enviarMensagemBuildGelatos(msg, telefone);
  }

  /**
   * Estado: BUILD_GELATOS
   * A1 - Em modo edição, não mostra 0/V
   */
  async enviarMensagemBuildGelatos(msg, telefone) {
    let pergunta = `Quer adicionar *gelatos/sorvetes*? 🍦✨
(Escolha quantos quiser)\n\n`;
    
    pergunta += `*Tradicionais*\n`;
    MENU.GELATOS.filter(g => g.categoria === 'Tradicionais').forEach((item) => {
      pergunta += `${item.id}. ${item.nome}\n`;
    });

    pergunta += `\n*Cremes especiais*\n`;
    MENU.GELATOS.filter(g => g.categoria === 'Cremes especiais').forEach((item) => {
      pergunta += `${item.id}. ${item.nome}\n`;
    });

    // A1 - Verifica modo edição
    if (!stateManager.estaModoEdicao(telefone)) {
      pergunta += `\nResponda:\n*❯*  Um: *1*\n*❯*  Vários: *1,4,7*\n*❯*  *0*- pular | *V*- voltar`;
    } else {
      pergunta += `\n*❯*  Um: *1*\n*❯*  Vários: *1,4,7*`;
    }

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  async processarBuildGelatos(msg, telefone, mensagem) {
    const modoEdicao = stateManager.estaModoEdicao(telefone);
    const validacao = Validator.validarOpcoes(mensagem, MENU.GELATOS.length, true, !modoEdicao, !modoEdicao);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, validacao.mensagem);
      return;
    }

    const cliente = database.getCliente(telefone);

    if (validacao.comando === 'voltar' && !modoEdicao) {
      stateManager.setEstado(telefone, ESTADOS.BUILD_ACAI);
      await this.enviarMensagemBuildAcai(msg, telefone);
      return;
    }

    const acaiAtual = stateManager.getDados(telefone, 'acaiAtual');
    
    if (validacao.comando === 'pular' && !modoEdicao) {
      acaiAtual.gelatos = [];
    } else if (validacao.opcoes) {
      const itensSelecionados = Validator.buscarItensPorIds('GELATOS', validacao.opcoes);
      acaiAtual.gelatos = itensSelecionados;
    }

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.BUILD_GELATOS,
      `Gelatos: ${acaiAtual.gelatos.join(', ') || 'nenhum'}`
    );

    if (modoEdicao) {
      await this.finalizarEdicaoEVoltarReview(msg, telefone);
      return;
    }

    stateManager.setEstado(telefone, ESTADOS.BUILD_FRUTAS);
    await this.enviarMensagemBuildFrutas(msg, telefone);
  }

  /**
   * Estado: BUILD_FRUTAS
   * A1 - Em modo edição, não mostra 0/V
   */
  async enviarMensagemBuildFrutas(msg, telefone) {
    let pergunta = `Quer adicionar *frutas*? 🍓🍌
(Escolha quantas quiser)\n\n`;
    
    MENU.FRUTAS.forEach((item) => {
      pergunta += `${item.id}. ${item.nome}\n`;
    });

    // A1 - Verifica modo edição
    if (!stateManager.estaModoEdicao(telefone)) {
      pergunta += `\n*❯*  Responda: *1* ou *1,2*\n*❯*  *0*- pular | *V*- voltar`;
    } else {
      pergunta += `\n*❯*  Responda: *1* ou *1,2*`;
    }

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  async processarBuildFrutas(msg, telefone, mensagem) {
    const modoEdicao = stateManager.estaModoEdicao(telefone);
    const validacao = Validator.validarOpcoes(mensagem, MENU.FRUTAS.length, true, !modoEdicao, !modoEdicao);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, validacao.mensagem);
      return;
    }

    const cliente = database.getCliente(telefone);

    if (validacao.comando === 'voltar' && !modoEdicao) {
      stateManager.setEstado(telefone, ESTADOS.BUILD_GELATOS);
      await this.enviarMensagemBuildGelatos(msg, telefone);
      return;
    }

    const acaiAtual = stateManager.getDados(telefone, 'acaiAtual');
    
    if (validacao.comando === 'pular' && !modoEdicao) {
      acaiAtual.frutas = [];
    } else if (validacao.opcoes) {
      const itensSelecionados = Validator.buscarItensPorIds('FRUTAS', validacao.opcoes);
      acaiAtual.frutas = itensSelecionados;
    }

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.BUILD_FRUTAS,
      `Frutas: ${acaiAtual.frutas.join(', ') || 'nenhum'}`
    );

    if (modoEdicao) {
      await this.finalizarEdicaoEVoltarReview(msg, telefone);
      return;
    }

    stateManager.setEstado(telefone, ESTADOS.BUILD_COMPLEMENTOS);
    await this.enviarMensagemBuildComplementosP1(msg, telefone);
  }

  /**
   * Estado: BUILD_COMPLEMENTOS (Parte 1)
   * A1 - Em modo edição, não mostra 0/V
   */
  async enviarMensagemBuildComplementosP1(msg, telefone) {
    let pergunta = `Agora os *complementos* 🍬✨
(Parte 1 de 2)\n\n`;
    
    MENU.COMPLEMENTOS_P1.forEach((item) => {
      pergunta += `${item.id}. ${item.nome}\n`;
    });

    // A1 - Verifica modo edição
    if (!stateManager.estaModoEdicao(telefone)) {
      pergunta += `\n*❯*  Responda: *1* ou *1,3,5*\n*❯*  *0*- pular | *V*- voltar`;
    } else {
      pergunta += `\n*❯*  Responda: *1* ou *1,3,5*\n*❯*  *P*- ir para Parte 2`;
    }

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  async processarBuildComplementosP1(msg, telefone, mensagem) {
    const modoEdicao = stateManager.estaModoEdicao(telefone);
    const validacao = Validator.validarOpcoes(mensagem, MENU.COMPLEMENTOS_P1.length, true, !modoEdicao, !modoEdicao);
    
    if (!validacao.valido && validacao.comando !== 'proximo') {
      await this.enviarMensagemComTyping(msg, validacao.mensagem);
      return;
    }

    const cliente = database.getCliente(telefone);
    const acaiAtual = stateManager.getDados(telefone, 'acaiAtual');

    // Ir para próxima parte
    if (validacao.comando === 'proximo') {
      stateManager.setEstado(telefone, ESTADOS.BUILD_COMPLEMENTOS_P2);
      await this.enviarMensagemBuildComplementosP2(msg, telefone);
      return;
    }

    if (validacao.comando === 'voltar' && !modoEdicao) {
      stateManager.setEstado(telefone, ESTADOS.BUILD_FRUTAS);
      await this.enviarMensagemBuildFrutas(msg, telefone);
      return;
    }

    if (validacao.comando === 'pular' && !modoEdicao) {
      // Pula complementos, vai para caldas
      stateManager.setEstado(telefone, ESTADOS.BUILD_CALDAS);
      await this.enviarMensagemBuildCaldas(msg, telefone);
      return;
    }

    if (validacao.opcoes) {
      const itensSelecionados = Validator.buscarItensPorIds('COMPLEMENTOS_P1', validacao.opcoes);
      const complementosAtuais = acaiAtual.complementos || [];
      acaiAtual.complementos = [...complementosAtuais, ...itensSelecionados];
    }

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.BUILD_COMPLEMENTOS,
      `Complementos P1: ${acaiAtual.complementos?.join(', ') || 'nenhum'}`
    );

    // Vai para parte 2
    stateManager.setEstado(telefone, ESTADOS.BUILD_COMPLEMENTOS_P2);
    await this.enviarMensagemBuildComplementosP2(msg, telefone);
  }

  /**
   * Estado: BUILD_COMPLEMENTOS_P2 (Parte 2)
   * A1 - Em modo edição, não mostra 0/V
   */
  async enviarMensagemBuildComplementosP2(msg, telefone) {
    let pergunta = `*Complementos* 🍭 (Parte 2 de 2)\n\n`;
    
    MENU.COMPLEMENTOS_P2.forEach((item) => {
      pergunta += `${item.id}. ${item.nome}\n`;
    });

    // A1 - Verifica modo edição
    if (!stateManager.estaModoEdicao(telefone)) {
      pergunta += `\n*❯*  Responda: *1* ou *1,3*\n*❯*  *0*- pular | *V*- voltar`;
    } else {
      pergunta += `\n*❯*  Responda: *1* ou *1,3*\n*❯*  *A*- voltar Parte 1`;
    }

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  async processarBuildComplementosP2(msg, telefone, mensagem) {
    const modoEdicao = stateManager.estaModoEdicao(telefone);
    const maxOpcao = Math.max(...MENU.COMPLEMENTOS_P2.map(c => c.id));
    const validacao = Validator.validarOpcoes(mensagem, maxOpcao, true, !modoEdicao, !modoEdicao);
    
    if (!validacao.valido && validacao.comando !== 'anterior') {
      await this.enviarMensagemComTyping(msg, validacao.mensagem);
      return;
    }

    const cliente = database.getCliente(telefone);
    const acaiAtual = stateManager.getDados(telefone, 'acaiAtual');

    // Voltar para parte 1
    if (validacao.comando === 'anterior') {
      stateManager.setEstado(telefone, ESTADOS.BUILD_COMPLEMENTOS);
      await this.enviarMensagemBuildComplementosP1(msg, telefone);
      return;
    }

    if (validacao.comando === 'voltar' && !modoEdicao) {
      stateManager.setEstado(telefone, ESTADOS.BUILD_FRUTAS);
      await this.enviarMensagemBuildFrutas(msg, telefone);
      return;
    }

    if (validacao.comando === 'pular' && !modoEdicao) {
      stateManager.setEstado(telefone, ESTADOS.BUILD_CALDAS);
      await this.enviarMensagemBuildCaldas(msg, telefone);
      return;
    }

    if (validacao.opcoes) {
      const itensSelecionados = Validator.buscarItensPorIds('COMPLEMENTOS_P2', validacao.opcoes);
      const complementosAtuais = acaiAtual.complementos || [];
      acaiAtual.complementos = [...complementosAtuais, ...itensSelecionados];
    }

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.BUILD_COMPLEMENTOS_P2,
      `Complementos P2: ${acaiAtual.complementos?.join(', ') || 'nenhum'}`
    );

    if (modoEdicao) {
      await this.finalizarEdicaoEVoltarReview(msg, telefone);
      return;
    }

    // Avança para caldas
    stateManager.setEstado(telefone, ESTADOS.BUILD_CALDAS);
    await this.enviarMensagemBuildCaldas(msg, telefone);
  }

  /**
   * Estado: BUILD_CALDAS
   * A1 - Em modo edição, não mostra 0/V
   */
  async enviarMensagemBuildCaldas(msg, telefone) {
    let pergunta = `Por último, quer adicionar *caldas*? 🍯\n\n`;
    
    MENU.CALDAS.forEach((item) => {
      pergunta += `${item.id}. ${item.nome}\n`;
    });

    // A1 - Verifica modo edição
    if (!stateManager.estaModoEdicao(telefone)) {
      pergunta += `\n*❯*  Responda: *1* ou *1,2*\n*❯*  *0*- pular | *V*- voltar`;
    } else {
      pergunta += `\n*❯*  Responda: *1* ou *1,2*`;
    }

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  async processarBuildCaldas(msg, telefone, mensagem) {
    const modoEdicao = stateManager.estaModoEdicao(telefone);
    const validacao = Validator.validarOpcoes(mensagem, MENU.CALDAS.length, true, !modoEdicao, !modoEdicao);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, validacao.mensagem);
      return;
    }

    const cliente = database.getCliente(telefone);
    const acaiAtual = stateManager.getDados(telefone, 'acaiAtual');

    if (validacao.comando === 'voltar' && !modoEdicao) {
      stateManager.setEstado(telefone, ESTADOS.BUILD_COMPLEMENTOS_P2);
      await this.enviarMensagemBuildComplementosP2(msg, telefone);
      return;
    }

    if (validacao.comando === 'pular' && !modoEdicao) {
      acaiAtual.caldas = [];
    } else if (validacao.opcoes) {
      const itensSelecionados = Validator.buscarItensPorIds('CALDAS', validacao.opcoes);
      acaiAtual.caldas = itensSelecionados;
    }

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.BUILD_CALDAS,
      `Caldas: ${acaiAtual.caldas?.join(', ') || 'nenhum'}`
    );

    if (modoEdicao) {
      await this.finalizarEdicaoEVoltarReview(msg, telefone);
      return;
    }

    // Finaliza açaí e pergunta se quer adicionar mais
    stateManager.finalizarAcai(telefone);
    
    stateManager.setEstado(telefone, ESTADOS.ADD_MORE);
    await this.enviarMensagemAddMore(msg, telefone);
  }

  /**
   * Estado: ADD_MORE
   */
  async enviarMensagemAddMore(msg, telefone) {
    const carrinho = stateManager.getDados(telefone, 'carrinho');
    const totalAcais = carrinho.length;

    const pergunta = `Pronto! ${totalAcais}º açai montado ✅🍧
Quer adicionar *mais um açaí* ao pedido?
*❯ 1-* ➕ Adicionar outro açaí
*❯ 2-* ✅ Finalizar pedido`;

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  async processarAddMore(msg, telefone, mensagem) {
    const validacao = Validator.validarOpcoes(mensagem, 2, false, false, false);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite *1* ou *2*.');
      return;
    }

    // Prompt 8 - Proteção contra undefined
    if (!validacao.opcoes || validacao.opcoes.length === 0) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite o número da opção desejada.');
      return;
    }

    const opcao = validacao.opcoes[0];
    const cliente = database.getCliente(telefone);

    if (opcao === 1) {
      // Adicionar outro açaí
      stateManager.setEstado(telefone, ESTADOS.BUILD_START);
      await this.processarBuildStart(msg, telefone);
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.ADD_MORE,
        'Cliente adicionando outro açaí'
      );
    } else if (opcao === 2) {
      // Finalizar pedido
      stateManager.setEstado(telefone, ESTADOS.REVIEW);
      await this.enviarMensagemReview(msg, telefone);
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.ADD_MORE,
        'Cliente finalizando pedido'
      );
    }
  }

  // ===============================================
  // REVIEW E EDIÇÃO
  // ===============================================

  /**
   * Estado: REVIEW
   */
  async enviarMensagemReview(msg, telefone) {
    const cliente = database.getCliente(telefone);
    const carrinho = stateManager.getDados(telefone, 'carrinho');

    let resumo = `📋 *Resumo do seu pedido*\n\n`;

        carrinho.forEach((acai, index) => {
          resumo += `*Açaí ${index + 1}* 🍧\n`;
          resumo += `📦 Tamanho: *${acai.tamanho}*\n`;
          resumo += `🍨 Açaí: *${Helpers.formatarLista(acai.acai)}*\n`;
          resumo += `🍦 Gelatos: *${Helpers.formatarLista(acai.gelatos)}*\n`;
          resumo += `🍓 Frutas: *${Helpers.formatarLista(acai.frutas)}*\n`;
          resumo += `🍫 Complementos: *${Helpers.formatarLista(acai.complementos)}*\n`;
          resumo += `🍯 Caldas: *${Helpers.formatarLista(acai.caldas)}*\n\n`;
        });

        resumo += `*Preço base:* ${PRECO_BASE.DESCRICAO}\n\n`;

        
        resumo += `O que deseja fazer?\n`;
        resumo += `*❯ 1-* ✅ Confirmar pedido\n`;
        resumo += `*❯ 2-* ✏️ Editar um açaí\n`;
        resumo += `*❯ 3-* 📝 Refazer do Inicio\n`;
        resumo += `*❯ 4-* 🔄 Alterar meu nome`;

    await this.enviarMensagemComTyping(msg, resumo);
    stateManager.setUltimaPergunta(msg.from, resumo);
  }

  /**
   * Prompt 7 - Após confirmar pedido, vai para ESCOLHA_ENTREGA (não mais PREPARE)
   */
  async processarReview(msg, telefone, mensagem) {
    const validacao = Validator.validarOpcoes(mensagem, 4, false, false, false);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite *1*, *2*, *3* ou *4*.');
      return;
    }

    // Prompt 8 - Proteção contra undefined
    if (!validacao.opcoes || validacao.opcoes.length === 0) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite o número da opção desejada.');
      return;
    }

    const opcao = validacao.opcoes[0];
    const cliente = database.getCliente(telefone);

    if (opcao === 1) {
      // Marca confirmação do cliente para permitir persistência do ultimo_pedido no PREPARE
      stateManager.setDados(telefone, 'pedidoConfirmadoCliente', true);

      // Prompt 7 - Confirmar pedido -> vai para ESCOLHA_ENTREGA
      stateManager.setEstado(telefone, ESTADOS.ESCOLHA_ENTREGA);
      await this.enviarMensagemEscolhaEntrega(msg, telefone);
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.REVIEW,
        'Pedido confirmado - Indo para escolha de entrega (Prompt 7)'
      );
    } else if (opcao === 2) {
      // Editar açaí
      const carrinho = stateManager.getDados(telefone, 'carrinho');
      
      if (carrinho.length === 1) {
        // Só tem um açaí, edita direto
        stateManager.setDados(telefone, 'acaiEditando', 0);
        stateManager.setEstado(telefone, ESTADOS.REVIEW_EDIT_CATEGORIA);
        await this.enviarMensagemEditCategoria(msg, telefone, 0);
      } else {
        // Vários açaís, pergunta qual
        stateManager.setEstado(telefone, ESTADOS.REVIEW_EDIT_ACAI);
        await this.enviarMensagemEditAcai(msg, telefone);
      }
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.REVIEW,
        'Cliente escolheu editar açaí'
      );
    } else if (opcao === 3) {
      // Montar outro pedido (do zero)
      stateManager.limparCarrinho(telefone);
      stateManager.limparEscolhasParciais(telefone);
      stateManager.setDados(telefone, 'acaiAtual', null);
      stateManager.setDados(telefone, 'valor', null);
      stateManager.setDados(telefone, 'troco', null);
      stateManager.setDados(telefone, 'formaPagamento', null);
      stateManager.setDados(telefone, 'comprovanteRecebido', false);
      stateManager.setDados(telefone, 'modoEdicao', false);
      stateManager.setDados(telefone, 'categoriaEditando', null);
      stateManager.setDados(telefone, 'formaEntrega', null);
      stateManager.setDados(telefone, 'regiaoEntrega', null);
      stateManager.setDados(telefone, 'taxaEntrega', null);
      stateManager.setDados(telefone, 'enderecoDelivery', null);

      stateManager.setEstado(telefone, ESTADOS.BUILD_START);
      await this.processarBuildStart(msg, telefone);

      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.REVIEW,
        'Cliente escolheu montar outro pedido (reset do zero)'
      );
    } else if (opcao === 4) {
      // Alterar nome
      stateManager.setEstado(telefone, ESTADOS.REVIEW_ALTERAR_NOME);
      await this.enviarMensagemAlterarNome(msg, telefone);
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.REVIEW,
        'Cliente escolheu alterar nome'
      );
    }
  }

  /**
   * I6 - Editar açaí (escolher qual)
   */
  async enviarMensagemEditAcai(msg, telefone) {
    const carrinho = stateManager.getDados(telefone, 'carrinho');
    
    let pergunta = `Qual açaí você quer editar?\n\n`;
    carrinho.forEach((acai, index) => {
      pergunta += `*❯ ${index + 1}-* Açaí ${index + 1} (${acai.tamanho})\n`;
    });
    pergunta += `\n*❯ 0-* Voltar`;

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  async processarReviewEditAcai(msg, telefone, mensagem) {
    if (mensagem === '0') {
      stateManager.setEstado(telefone, ESTADOS.REVIEW);
      await this.enviarMensagemReview(msg, telefone);
      return;
    }

    const carrinho = stateManager.getDados(telefone, 'carrinho');
    const validacao = Validator.validarOpcoes(mensagem, carrinho.length, false, true, false);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, `Por favor, digite *1* a *${carrinho.length}*, ou *0* para voltar.`);
      return;
    }

    if (validacao.comando === 'pular') {
      stateManager.setEstado(telefone, ESTADOS.REVIEW);
      await this.enviarMensagemReview(msg, telefone);
      return;
    }

    // Prompt 8 - Proteção contra undefined
    if (!validacao.opcoes || validacao.opcoes.length === 0) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite o número da opção desejada.');
      return;
    }

    const acaiIndex = validacao.opcoes[0] - 1;
    stateManager.setDados(telefone, 'acaiEditando', acaiIndex);
    stateManager.setEstado(telefone, ESTADOS.REVIEW_EDIT_CATEGORIA);
    await this.enviarMensagemEditCategoria(msg, telefone, acaiIndex);
  }

  /**
   * I6 - Editar categoria do açaí
   */
  async enviarMensagemEditCategoria(msg, telefone, acaiIndex) {
    const carrinho = stateManager.getDados(telefone, 'carrinho');
    const acai = carrinho[acaiIndex];

    const pergunta = `O que quer alterar no *Açaí ${acaiIndex + 1}*?
*❯ 1-* 📦 Tamanho (${acai.tamanho})
*❯ 2-* 🍨 Açaí/Cremes
*❯ 3-* 🍦 Gelatos
*❯ 4-* 🍓 Frutas
*❯ 5-* 🍫 Complementos
*❯ 6-* 🍯 Caldas
*❯ 0-* Voltar`;

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  async processarReviewEditCategoria(msg, telefone, mensagem) {
    // Permite 0 para voltar
    if (mensagem === '0') {
      stateManager.setEstado(telefone, ESTADOS.REVIEW);
      await this.enviarMensagemReview(msg, telefone);
      return;
    }

    const validacao = Validator.validarOpcoes(mensagem, 6, false, false, false);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite *1* a *6*, ou *0* para voltar.');
      return;
    }

    // Prompt 8 - Proteção contra undefined
    if (!validacao.opcoes || validacao.opcoes.length === 0) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite o número da opção desejada.');
      return;
    }

    const opcao = validacao.opcoes[0];
    const cliente = database.getCliente(telefone);
    const acaiIndex = stateManager.getDados(telefone, 'acaiEditando');
    const carrinho = stateManager.getDados(telefone, 'carrinho');
    
    // Copia açaí para acaiAtual para edição
    stateManager.setDados(telefone, 'acaiAtual', { ...carrinho[acaiIndex] });
    
    // A1 - Ativa modo edição
    const categorias = {
      1: { estado: ESTADOS.BUILD_SIZE, categoria: 'tamanho' },
      2: { estado: ESTADOS.BUILD_ACAI, categoria: 'acai' },
      3: { estado: ESTADOS.BUILD_GELATOS, categoria: 'gelatos' },
      4: { estado: ESTADOS.BUILD_FRUTAS, categoria: 'frutas' },
      5: { estado: ESTADOS.BUILD_COMPLEMENTOS, categoria: 'complementos' },
      6: { estado: ESTADOS.BUILD_CALDAS, categoria: 'caldas' },
    };

    const config = categorias[opcao];
    stateManager.ativarModoEdicao(telefone, config.categoria);
    stateManager.setEstado(telefone, config.estado);

    // Envia tela de edição correspondente
    switch (opcao) {
      case 1:
        await this.enviarMensagemBuildSize(msg, telefone);
        break;
      case 2:
        await this.enviarMensagemBuildAcai(msg, telefone);
        break;
      case 3:
        await this.enviarMensagemBuildGelatos(msg, telefone);
        break;
      case 4:
        await this.enviarMensagemBuildFrutas(msg, telefone);
        break;
      case 5:
        await this.enviarMensagemBuildComplementosP1(msg, telefone);
        break;
      case 6:
        await this.enviarMensagemBuildCaldas(msg, telefone);
        break;
    }

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.REVIEW_EDIT_CATEGORIA,
      `Editando categoria: ${config.categoria}`
    );
  }

  /**
   * A1/E1 - Finaliza edição e volta para review
   */
  async finalizarEdicaoEVoltarReview(msg, telefone) {
    const acaiIndex = stateManager.getDados(telefone, 'acaiEditando');
    const acaiAtual = stateManager.getDados(telefone, 'acaiAtual');
    const carrinho = stateManager.getDados(telefone, 'carrinho');
    const cliente = database.getCliente(telefone);

    // Atualiza açaí no carrinho
    carrinho[acaiIndex] = { ...acaiAtual };

    // Desativa modo edição
    stateManager.desativarModoEdicao(telefone);

    await this.enviarMensagemComTyping(msg, `✅ Açaí ${acaiIndex + 1} atualizado!`);
    
    await Helpers.sleep(1000);

    // Volta para review
    stateManager.setEstado(telefone, ESTADOS.REVIEW);
    await this.enviarMensagemReview(msg, telefone);

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      'REVIEW_EDIT',
      `Edição finalizada - Açaí ${acaiIndex + 1} atualizado`
    );
  }

  /**
   * I6 - Alterar nome do cliente
   */
  async enviarMensagemAlterarNome(msg, telefone) {
    const cliente = database.getCliente(telefone);
    
    const pergunta = `Tudo bem 😊
Me informe seu nome correto, por favor.`;
    
    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  async processarReviewAlterarNome(msg, telefone, mensagem) {
    const validacao = Validator.validarNome(mensagem);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, validacao.mensagem);
      return;
    }

    const primeiroNome = Helpers.extrairPrimeiroNome(validacao.nome);
    
    // E4 - Atualiza nome IMEDIATAMENTE no banco
    database.atualizarNome(telefone, validacao.nome, primeiroNome);

    await this.enviarMensagemComTyping(msg, 
      `Perfeito ✅ Seu nome foi atualizado para *${validacao.nome}*`
    );
    
    await Helpers.sleep(1000);

    // Volta para review
    stateManager.setEstado(telefone, ESTADOS.REVIEW);
    await this.enviarMensagemReview(msg, telefone);

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      primeiroNome,
      ESTADOS.REVIEW_ALTERAR_NOME,
      `Nome atualizado: ${validacao.nome}`
    );
  }

  // ===============================================
  // PROMPT 7 - ESCOLHA DE ENTREGA (DELIVERY/RETIRADA)
  // ===============================================

  /**
   * Estado: ESCOLHA_ENTREGA (NOVO - Prompt 7)
   */
  async enviarMensagemEscolhaEntrega(msg, telefone) {
    const pergunta = `Antes de confirmarmos o pedido
Qual será a *forma de entrega?* 🤔
*❯ 1-* 🏍️ Delivery
*❯ 2-* 🏪 Retirada no local`;

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  async processarEscolhaEntrega(msg, telefone, mensagem) {
    const validacao = Validator.validarOpcoes(mensagem, 2, false, false, false);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite *1* ou *2*.');
      return;
    }

    // Prompt 8 - Proteção contra undefined
    if (!validacao.opcoes || validacao.opcoes.length === 0) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite o número da opção desejada.');
      return;
    }

    const opcao = validacao.opcoes[0];
    const cliente = database.getCliente(telefone);

    if (opcao === 1) {
      // DELIVERY
      stateManager.setDados(telefone, 'formaEntrega', 'delivery');
      
      // Verifica se cliente tem endereço salvo
      if (cliente.endereco) {
        // Prompt 9 - Versão 2: Cliente COM endereço salvo
        // Verifica se também tem região salva para mostrar integrado
        const regiaoSalva = cliente.ultimo_pedido?.regiao_entrega;
        const taxaSalva = cliente.ultimo_pedido?.taxa_entrega;
        
        stateManager.setEstado(telefone, ESTADOS.CONFIRMA_ENDERECO_DELIVERY);
        
        let pergunta;
        if (regiaoSalva && taxaSalva !== undefined && taxaSalva !== null) {
          // Prompt 9 - Endereço + região + taxa integrados
          pergunta = `Confere pra mim se está certinho ✅
📍 *${cliente.endereco}*
\t\t*${regiaoSalva} R$${Number(taxaSalva).toFixed(2)} de taxa*
*❯ 1-* Está certo
*❯ 2-* Quero alterar`;
        } else {
          // Sem região salva - mostra só endereço
          pergunta = `Encontrei este endereço salvo para você ✅
📍 *${cliente.endereco}*
Você quer manter esse endereço?
❯ 1- Sim, manter
❯ 2- Não, vou informar outro`;
        }

        await this.enviarMensagemComTyping(msg, pergunta);
        stateManager.setUltimaPergunta(msg.from, pergunta);
      } else {
        // Versão 1: Cliente SEM endereço salvo
        stateManager.setEstado(telefone, ESTADOS.ENDERECO_DELIVERY);
        
        const pergunta = `Rapidinho, nos informe seu *endereço* 👍
Separado por vírgula:
📍 *Bairro, Rua, Número* e (se tiver) *ponto de referência*`;

        await this.enviarMensagemComTyping(msg, pergunta);
        stateManager.setUltimaPergunta(msg.from, pergunta);
      }
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.ESCOLHA_ENTREGA,
        'Cliente escolheu: Delivery'
      );
    } else if (opcao === 2) {
      // RETIRADA
      stateManager.setDados(telefone, 'formaEntrega', 'retirada');
      stateManager.setDados(telefone, 'taxaEntrega', 0);
      stateManager.setDados(telefone, 'regiaoEntrega', null);
      
      // Vai direto para PREPARE (sem endereço, sem taxa)
      stateManager.setEstado(telefone, ESTADOS.PREPARE);
      await this.processarPrepare(msg, telefone, mensagem);
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.ESCOLHA_ENTREGA,
        'Cliente escolheu: Retirada no local'
      );
    }
  }

  // ===============================================
  // PROMPT 7 - FLUXO DE DELIVERY (ENDEREÇO + TAXA)
  // ===============================================

  /**
   * Estado: ENDERECO_DELIVERY (NOVO - Prompt 7)
   * Cliente informa endereço para delivery
   */
  async processarEnderecoDelivery(msg, telefone, mensagem) {
    const cliente = database.getCliente(telefone);

    // Prompt 8 - Validação completa de endereço (3 partes mínimas)
    const validacaoEndereco = Validator.validarEndereco(mensagem);
    if (!validacaoEndereco.valido) {
      await this.enviarMensagemComTyping(msg, validacaoEndereco.mensagem);
      return;
    }

    // Prompt 8 - Armazena temporariamente e pede confirmação
    stateManager.setDados(telefone, 'enderecoDeliveryTemp', mensagem);
    
    // Avança para confirmação do endereço
    stateManager.setEstado(telefone, ESTADOS.CONFIRMA_ENDERECO_DELIVERY);
    
    const pergunta = `Confere pra mim se está certinho ✅
📍 *${mensagem}*
❯ 1- Está certo
❯ 2- Quero alterar`;

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.ENDERECO_DELIVERY,
      `Aguardando confirmação do endereço delivery: ${mensagem}`
    );
  }

  /**
   * Estado: CONFIRMA_ENDERECO_DELIVERY (NOVO - Prompt 7)
   * Cliente confirma ou altera endereço salvo para delivery
   */
  async processarConfirmaEnderecoDelivery(msg, telefone, mensagem) {
    const validacao = Validator.validarOpcoes(mensagem, 2, false, false, false);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite *1* para manter ou *2* para informar outro.');
      return;
    }

    const cliente = database.getCliente(telefone);

    // Prompt 8 - Proteção contra undefined
    if (!validacao.opcoes || validacao.opcoes.length === 0) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite o número da opção desejada.');
      return;
    }

    if (validacao.opcoes[0] === 1) {
      // Prompt 9 - Verifica se é endereço salvo ou novo endereço digitado
      const enderecoTemp = stateManager.getDados(telefone, 'enderecoDeliveryTemp');
      const enderecoFinal = enderecoTemp || cliente.endereco;
      
      stateManager.setDados(telefone, 'enderecoDelivery', enderecoFinal);
      
      // Prompt 9 - Salva endereço no BD IMEDIATAMENTE após confirmação
      if (enderecoFinal) {
        database.atualizarEndereco(telefone, enderecoFinal);
      }
      
      // Prompt 9 - Verifica se já tem região+taxa salva (confirmação integrado)
      const regiaoSalva = cliente.ultimo_pedido?.regiao_entrega;
      const taxaSalva = cliente.ultimo_pedido?.taxa_entrega;
      
      if (regiaoSalva && taxaSalva !== undefined && taxaSalva !== null && !enderecoTemp) {
        // Cliente confirmou endereço+região+taxa integrados - pula seleção de região
        stateManager.setDados(telefone, 'regiaoEntrega', regiaoSalva);
        stateManager.setDados(telefone, 'taxaEntrega', Number(taxaSalva));
        
        stateManager.setEstado(telefone, ESTADOS.PREPARE);
        await this.processarPrepare(msg, telefone, mensagem);
        
        Logger.log(
          'OPERAÇÃO',
          Helpers.formatarTelefone(telefone),
          cliente.primeiro_nome,
          ESTADOS.CONFIRMA_ENDERECO_DELIVERY,
          `Endereço+região+taxa confirmados (integrado): ${enderecoFinal} | ${regiaoSalva} R$${Number(taxaSalva).toFixed(2)}`
        );
      } else {
        // Sem região salva ou novo endereço - vai para seleção de região
        stateManager.setEstado(telefone, ESTADOS.SELECIONA_REGIAO);
        await this.enviarMensagemSelecionaRegiao(msg);
        
        Logger.log(
          'OPERAÇÃO',
          Helpers.formatarTelefone(telefone),
          cliente.primeiro_nome,
          ESTADOS.CONFIRMA_ENDERECO_DELIVERY,
          `Endereço confirmado e salvo no BD: ${enderecoFinal} - aguardando região`
        );
      }
    } else {
      // Informar outro endereço
      stateManager.setEstado(telefone, ESTADOS.ENDERECO_DELIVERY);
      
      const pergunta = `Ok! Me informe o endereço completo para entrega:
📍 *Bairro, Rua, Número* e (se tiver) *ponto de referência*`;

      await this.enviarMensagemComTyping(msg, pergunta);
      stateManager.setUltimaPergunta(msg.from, pergunta);
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.CONFIRMA_ENDERECO_DELIVERY,
        'Cliente quis alterar endereço'
      );
    }
  }

  /**
   * Estado: SELECIONA_REGIAO (NOVO - Prompt 7)
   * Cliente seleciona região para calcular taxa
   */
  async enviarMensagemSelecionaRegiao(msg) {
    const pergunta = `Me informe qual *região* para calcular a taxa:
❯ 1- Centro (R$ 5,00)
❯ 2- Arredores (R$ 7,00)
❯ 3- Zé Gomes (R$ 10,00)`;

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  async processarSelecionaRegiao(msg, telefone, mensagem) {
    const validacao = Validator.validarOpcoes(mensagem, 3, false, false, false);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, 
        validacao.mensagem || 'Por favor, digite *1*, *2* ou *3*.\nDigite apenas o número da região.'
      );
      return;
    }

    // Prompt 8 - Proteção contra undefined
    if (!validacao.opcoes || validacao.opcoes.length === 0) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite *1*, *2* ou *3*.');
      return;
    }

    const opcao = validacao.opcoes[0];
    const cliente = database.getCliente(telefone);
    const taxaInfo = TAXAS_ENTREGA[opcao];

    // Salva região e taxa
    stateManager.setDados(telefone, 'regiaoEntrega', taxaInfo.regiao);
    stateManager.setDados(telefone, 'taxaEntrega', taxaInfo.valor);

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.SELECIONA_REGIAO,
      `Região: ${taxaInfo.regiao} | Taxa: R$ ${taxaInfo.valor.toFixed(2)}`
    );

    // Avança para PREPARE
    stateManager.setEstado(telefone, ESTADOS.PREPARE);
    await this.processarPrepare(msg, telefone, mensagem);
  }

  // ===============================================
  // PREPARO E PAGAMENTO
  // ===============================================

  /**
   * Estado: PREPARE
   * Prompt 7 - Mensagens diferenciadas para delivery e retirada
   */
  async processarPrepare(msg, telefone, mensagem) {
    const cliente = database.getCliente(telefone);
    const carrinho = stateManager.getDados(telefone, 'carrinho');
    const formaEntrega = stateManager.getDados(telefone, 'formaEntrega');
    const regiaoEntrega = stateManager.getDados(telefone, 'regiaoEntrega');
    const taxaEntrega = stateManager.getDados(telefone, 'taxaEntrega');
    const enderecoDelivery = stateManager.getDados(telefone, 'enderecoDelivery');

    // Atualiza último pedido no BD (sem resetar outras infos) e incrementa pedidos_confirmados 1x por pedido
    try {
      const confirmado = !!stateManager.getDados(telefone, 'pedidoConfirmadoCliente');
      const jaPersistiu = !!stateManager.getDados(telefone, 'pedidoConfirmadoPersistido');

      if (confirmado && !jaPersistiu) {
        database.salvarUltimoPedido(telefone, {
          carrinho,
          forma_entrega: formaEntrega,
          regiao_entrega: regiaoEntrega,
          taxa_entrega: taxaEntrega,
        });
        database.incrementarPedidosConfirmados(telefone);
        stateManager.setDados(telefone, 'pedidoConfirmadoPersistido', true);
      }
    } catch (erro) {
      Logger.error('Erro ao persistir último pedido no PREPARE', erro);
    }

    // Prompt 7 - Envia confirmação para cliente (com primeiro nome)
    await this.enviarMensagemComTyping(msg, 
      `Pedido recebido *${cliente.primeiro_nome}* 😉\n` +
      `Já estamos montando o seu açaí!\n` +
      `⏳ Em breve te enviamos a foto com o valor do pedido.`
    );

    // Prompt 7 - Monta resumo para admin diferenciado por forma de entrega
    let resumoAdmin = `🆕 *NOVO PEDIDO!*\n`;
    resumoAdmin += `👤 *Cliente:* ${cliente.nome_completo}\n`;
    resumoAdmin += `📞 *Telefone:* ${await this.formatarTelefoneParaAdmin(telefone)}\n\n`;

    if (formaEntrega === 'delivery') {
      // Versão DELIVERY
      resumoAdmin += `🏍️ *DELIVERY*\n`;
      resumoAdmin += `📍 *Endereço:* ${enderecoDelivery || cliente.endereco || 'Não informado'}\n`;
      resumoAdmin += `\t\t*Região:* ${regiaoEntrega || 'Não informada'}\n`;
      resumoAdmin += `💵 *Taxa de entrega:* R$ ${taxaEntrega ? taxaEntrega.toFixed(2) : '0.00'}\n\n`;
    } else if (formaEntrega === 'retirada') {
      // Versão RETIRADA
      resumoAdmin += `🏪 *RETIRADA NO LOCAL*\n`;
      resumoAdmin += `⚠️ Cliente vai retirar no estabelecimento\n\n`;
    }

    resumoAdmin += `*🍧 DETALHES DO PEDIDO*\n`;

    carrinho.forEach((acai, index) => {
      resumoAdmin += `\n*━━━ Açaí ${index + 1} ━━━*\n`;
      resumoAdmin += `   📦 ${acai.tamanho}\n`;
      resumoAdmin += `   🍨 ${Helpers.formatarLista(acai.acai)}\n`;
      resumoAdmin += `   🍦 ${Helpers.formatarLista(acai.gelatos)}\n`;
      resumoAdmin += `   🍓 ${Helpers.formatarLista(acai.frutas)}\n`;
      resumoAdmin += `   🍫 ${Helpers.formatarLista(acai.complementos)}\n`;
      resumoAdmin += `   🍯 ${Helpers.formatarLista(acai.caldas)}\n`;
    });

    resumoAdmin += `\nResposta Rápida:\n`;
    resumoAdmin += `Prontinho ✅🍧\n`;
    
    if (formaEntrega === 'delivery' && taxaEntrega) {
      resumoAdmin += `Valor do pedido: R$ (peso + ${taxaEntrega.toFixed(2)} taxa)\nJá somado com a taxa de entrega 👍`;
    } else {
      resumoAdmin += `Valor do pedido: R$ valor`;
    }

    // Envia para admin
    try {
      await this.enviarParaAdmins(resumoAdmin);
      
      Logger.log(
        'ENVIADA',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.PREPARE,
        `Resumo do pedido enviado para admin (${formaEntrega})`
      );
    } catch (erro) {
      Logger.error('Erro ao enviar resumo para admin', erro);
    }

    // Muda para estado de espera
    stateManager.setEstado(telefone, ESTADOS.ESPERA_PREPARO);
    
    const sessao = stateManager.getSessao(telefone);
    sessao.respondeuEspera = false;
  }

  /**
   * Estado: PAGAMENTO
   * A5 - Inicia timer de 5 minutos
   * Prompt 7 - Mensagem diferenciada para retirada (opção 4)
   */
  async enviarMensagemPagamento(chat, telefone) {
    const cliente = database.getCliente(telefone);
    const valor = stateManager.getDados(telefone, 'valor');
    const formaEntrega = stateManager.getDados(telefone, 'formaEntrega');
    const pagamentoRetiradaExplicadoSessao = stateManager.getDados(telefone, 'pagamentoRetiradaExplicado');
    const pagamentoRetiradaExplicadoDb = !!cliente?.pagamento_retirada_explicado;
    const pagamentoRetiradaExplicado = pagamentoRetiradaExplicadoDb || !!pagamentoRetiradaExplicadoSessao;

    let pergunta;
    
    if (formaEntrega === 'retirada') {
      if (!pagamentoRetiradaExplicado) {
        pergunta = `Qual será a *forma de pagamento?* 🤔
*❯ 1-* Pix (pague agora e retire depois)
*❯ 2-* Na retirada (pague na hora)`;
      } else {
        pergunta = `Qual será a *forma de pagamento?* 🤔
*❯ 1-* Pix   *2-* Na retirada`;
      }
    } else {
      // Mensagem padrão (delivery)
      pergunta = `Qual será a *forma de pagamento?* 🤔
*❯ 1-* Pix   *2-* Dinheiro   *3-* Cartão`;
    }

    await this.simularTypingEEnviar(chat, pergunta, TYPING_DELAY.PAGAMENTO);

    if (formaEntrega === 'retirada' && !pagamentoRetiradaExplicado) {
      stateManager.setDados(telefone, 'pagamentoRetiradaExplicado', true);

      if (cliente) {
        database.atualizarCliente(telefone, { pagamento_retirada_explicado: true });
      }
    }
    stateManager.setUltimaPergunta(telefone, pergunta);

    // A5 - Inicia timer de 5 minutos
    stateManager.iniciarTimerFormaPagamento(telefone, async (tel) => {
      // Callback executado após 5 minutos
      const cli = database.getCliente(tel);
      
      // Verifica se já enviou alerta
      if (!stateManager.jaEnviouAlertaPagamento(tel)) {
        try {
          const aviso = `⚠️ *CLIENTE SEM RESPOSTA - FORMA DE PAGAMENTO*\n` +
            `👤 *Cliente:* ${cli?.nome_completo || 'Desconhecido'}\n` +
            `📞 *Telefone:* ${await this.formatarTelefoneParaAdmin(tel)}\n` +
            `⏰ 5 minutos sem escolher forma de pagamento`;
          
          await this.enviarParaAdmins(aviso);
          stateManager.marcarAlertaPagamentoEnviado(tel);
          
          Logger.log(
            'OPERAÇÃO',
            Helpers.formatarTelefone(tel),
            cli?.primeiro_nome,
            'TIMEOUT_PAGAMENTO',
            'Timeout 5min - Admin avisado - Entrando em ESPERA_PAGAMENTO'
          );
        } catch (erro) {
          Logger.error('Erro ao avisar admin sobre timeout pagamento', erro);
        }
        
        // A5 - Entra em modo silencioso
        stateManager.setEstado(tel, ESTADOS.ESPERA_PAGAMENTO);
      }
    });

    Logger.log(
      'ENVIADA',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.PAGAMENTO,
      `Enviadas opções de pagamento (${formaEntrega}) - Timer A5 iniciado`
    );
  }

  /**
   * Prompt 7 - Processa pagamento com suporte a opção 4 (na retirada)
   */
  async processarPagamento(msg, telefone, mensagem) {
    const formaEntrega = stateManager.getDados(telefone, 'formaEntrega');
    const maxOpcoes = formaEntrega === 'retirada' ? 2 : 3;
    const validacao = Validator.validarOpcoes(mensagem, maxOpcoes, false, false, false);
    
    // Também aceita palavras-chave
    const msgLower = mensagem.toLowerCase().trim();
    let opcao = null;
    
    if (validacao.valido) {
      // Prompt 8 - Proteção contra undefined
      if (!validacao.opcoes || validacao.opcoes.length === 0) {
        await this.enviarMensagemComTyping(msg, 'Por favor, digite o número da opção desejada.');
        return;
      }

      opcao = validacao.opcoes[0];
    } else if (msgLower.includes('pix')) {
      opcao = 1;
    } else if (formaEntrega === 'retirada' && msgLower.includes('retirada')) {
      opcao = 2;
    } else if (msgLower.includes('dinheiro')) {
      opcao = 2;
    } else if (msgLower.includes('cartão') || msgLower.includes('cartao')) {
      opcao = 3;
    }
    
    if (!opcao) {
      if (formaEntrega === 'retirada') {
        await this.enviarMensagemComTyping(msg, 'Por favor, digite *1* ou *2*.');
      } else {
        await this.enviarMensagemComTyping(msg, 'Por favor, digite *1*, *2* ou *3*.');
      }
      return;
    }

    const cliente = database.getCliente(telefone);

    // A5 - Cancela timer de forma de pagamento
    stateManager.cancelarTimerFormaPagamento(telefone);

    if (opcao === 1) {
      // Pix
      stateManager.setDados(telefone, 'formaPagamento', 'pix');
      stateManager.setEstado(telefone, ESTADOS.PAGAMENTO_PIX);
      await this.enviarMensagemPagamentoPix(msg, telefone);
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.PAGAMENTO,
        'Cliente escolheu: Pix'
      );
    } else if (opcao === 2 && formaEntrega === 'retirada') {
      // Na retirada
      stateManager.setDados(telefone, 'formaPagamento', 'na_retirada');
      
      // Vai para AGUARDANDO_RETIRADA
      stateManager.setEstado(telefone, ESTADOS.AGUARDANDO_RETIRADA);
      await this.enviarMensagemAguardandoRetiradaMsg(msg);
      
      // Envia agradecimento
      await Helpers.sleep(1500);
      await this.enviarMensagemAgradecimento(msg, telefone);
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.PAGAMENTO,
        'Cliente escolheu: Na retirada'
      );
    } else if (opcao === 2) {
      // Dinheiro
      stateManager.setDados(telefone, 'formaPagamento', 'dinheiro');
      stateManager.setEstado(telefone, ESTADOS.PAGAMENTO_DINHEIRO);
      await this.enviarMensagemPagamentoDinheiro(msg, telefone);
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.PAGAMENTO,
        'Cliente escolheu: Dinheiro'
      );
    } else if (opcao === 3) {
      // Cartão
      stateManager.setDados(telefone, 'formaPagamento', 'cartao');
      stateManager.setEstado(telefone, ESTADOS.PAGAMENTO_CARTAO);
      await this.enviarMensagemPagamentoCartao(msg, telefone);
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.PAGAMENTO,
        'Cliente escolheu: Cartão'
      );
    }
  }

  /**
   * Estado: PAGAMENTO_PIX
   * A2 - Sem valor na terceira linha
   * A4 - Timer de 5 minutos
   */
  async enviarMensagemPagamentoPix(msg, telefone) {
    const valor = stateManager.getDados(telefone, 'valor');
    
    // Prompt 4 - Mensagem 1
    await this.enviarMensagemComTyping(msg, `*Nossa chave Pix* 👇`);
    
    await Helpers.sleep(500);
    
    // Prompt 4 - Mensagem 2 (chave Pix para copiar)
    await this.client.sendMessage(msg.from, CHAVE_PIX);
    
    await Helpers.sleep(500);
    
    // Prompt 4 - Mensagem 3
    const msg3 = `*| Conta:* Posto IC
*❯* Por favor, envie o comprovante aqui para confirmarmos`;
    await this.enviarMensagemComTyping(msg, msg3);
    
    stateManager.setUltimaPergunta(msg.from, msg3);

    // A4 - Inicia timer de 5 minutos para comprovante
    stateManager.iniciarTimerPixComprovante(telefone, async (tel) => {
      const cli = database.getCliente(tel);
      
      try {
        const aviso = `⚠️ *CLIENTE SEM RESPOSTA - COMPROVANTE PIX*\n` +
          `👤 *Cliente:* ${cli?.nome_completo || 'Desconhecido'}\n` +
          `📞 *Telefone:* ${await this.formatarTelefoneParaAdmin(tel)}\n` +
          `⏰ 5 minutos sem enviar comprovante`;
        
        await this.enviarParaAdmins(aviso);
        
        Logger.log(
          'OPERAÇÃO',
          Helpers.formatarTelefone(tel),
          cli?.primeiro_nome,
          'TIMEOUT_PIX',
          'Timeout 5min comprovante Pix - Admin avisado'
        );
      } catch (erro) {
        Logger.error('Erro ao avisar admin sobre timeout Pix', erro);
      }
    });
  }

  async processarPagamentoPix(msg, telefone, mensagem) {
    // Se não enviou mídia, apenas aguarda
    await this.enviarMensagemComTyping(msg, 
      `Por favor, envie o *comprovante de pagamento* (foto ou PDF) para confirmarmos ✅`
    );
  }

  /**
   * Estado: AGUARDANDO_OK_ADMIN
   */
  async processarAguardandoOkAdmin(msg, telefone, mensagem) {
    await this.enviarMensagemComTyping(msg, 
      `Seu comprovante já foi recebido ✅\nAguarde só um instante enquanto confirmamos o pagamento ⌛`
    );
  }

  /**
   * Estado: PAGAMENTO_DINHEIRO
   */
  async enviarMensagemPagamentoDinheiro(msg, telefone) {
    const valor = stateManager.getDados(telefone, 'valor');

    const mensagem = `Certo ✅ Você vai precisar de troco? 
*❯ 1-* Não precisa
*❯ 2-* Sim, preciso de troco`;

    await this.enviarMensagemComTyping(msg, mensagem);
    stateManager.setUltimaPergunta(msg.from, mensagem);
  }

  async processarPagamentoDinheiro(msg, telefone, mensagem) {
    const validacao = Validator.validarOpcoes(mensagem, 2, false, false, false);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite *1* ou *2*.');
      return;
    }

    // Prompt 8 - Proteção contra undefined
    if (!validacao.opcoes || validacao.opcoes.length === 0) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite o número da opção desejada.');
      return;
    }

    const opcao = validacao.opcoes[0];
    const cliente = database.getCliente(telefone);
    const formaEntrega = stateManager.getDados(telefone, 'formaEntrega');

    if (opcao === 1) {
      // Não precisa de troco
      stateManager.setDados(telefone, 'troco', null);
      
      // Prompt 7 - Decide próximo passo baseado na forma de entrega
      if (formaEntrega === 'retirada') {
        stateManager.setEstado(telefone, ESTADOS.AGUARDANDO_RETIRADA);
        await this.enviarMensagemAguardandoRetiradaMsg(msg);
        await Helpers.sleep(1500);
        await this.enviarMensagemAgradecimento(msg, telefone);
      } else {
        // Delivery: vai para confirmação final
        stateManager.setEstado(telefone, ESTADOS.CONFIRMACAO_FINAL);
        await this.enviarMensagemConfirmacaoFinal(msg, telefone);
      }
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.PAGAMENTO_DINHEIRO,
        'Cliente não precisa de troco'
      );
    } else if (opcao === 2) {
      // Precisa de troco
      stateManager.setEstado(telefone, ESTADOS.PAGAMENTO_DINHEIRO_TROCO);
      await this.enviarMensagemPagamentoTroco(msg, telefone);
      
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        ESTADOS.PAGAMENTO_DINHEIRO,
        'Cliente precisa de troco'
      );
    }
  }

  /**
   * Estado: PAGAMENTO_DINHEIRO_TROCO
   */
  async enviarMensagemPagamentoTroco(msg, telefone) {
    const pergunta = `Beleza, Troco para quanto? (ex.: *50* ou *100*)`;

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  async processarPagamentoDinheiroTroco(msg, telefone, mensagem) {
    const numeros = mensagem.match(/\d+/);
    
    if (!numeros) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite um valor numérico. Ex.: *50*');
      return;
    }

    const valorTroco = parseInt(numeros[0]);
    const valorPedido = stateManager.getDados(telefone, 'valor');
    const cliente = database.getCliente(telefone);
    const formaEntrega = stateManager.getDados(telefone, 'formaEntrega');

    if (valorTroco <= valorPedido) {
      await this.enviarMensagemComTyping(msg, 
        `O valor do troco precisa ser maior que R$ ${valorPedido.toFixed(2)}.\nPor favor, digite novamente.`
      );
      return;
    }

    stateManager.setDados(telefone, 'troco', valorTroco);
    
    // Prompt 7 - Decide próximo passo baseado na forma de entrega
    if (formaEntrega === 'retirada') {
      stateManager.setEstado(telefone, ESTADOS.AGUARDANDO_RETIRADA);
      await this.enviarMensagemAguardandoRetiradaMsg(msg);
      await Helpers.sleep(1500);
      await this.enviarMensagemAgradecimento(msg, telefone);
    } else {
      // Delivery: vai para confirmação final
      stateManager.setEstado(telefone, ESTADOS.CONFIRMACAO_FINAL);
      await this.enviarMensagemConfirmacaoFinal(msg, telefone);
    }

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.PAGAMENTO_DINHEIRO_TROCO,
      `Troco para R$ ${valorTroco}`
    );
  }

  /**
   * Estado: PAGAMENTO_CARTAO
   */
  async enviarMensagemPagamentoCartao(msg, telefone) {
    const valor = stateManager.getDados(telefone, 'valor');
    const formaEntrega = stateManager.getDados(telefone, 'formaEntrega');

    if (formaEntrega === 'retirada') {
      const mensagem = `Perfeito ✅
👉 O pagamento será realizado no momento da retirada 🏪`;

      await this.enviarMensagemComTyping(msg, mensagem);
      
      await Helpers.sleep(1500);
      stateManager.setEstado(telefone, ESTADOS.AGUARDANDO_RETIRADA);
      await this.enviarMensagemAguardandoRetiradaMsg(msg);
      await Helpers.sleep(1500);
      await this.enviarMensagemAgradecimento(msg, telefone);
    } else {
      const mensagem = `Perfeito ✅
👉 O pagamento será realizado no momento da entrega, diretamente com o entregador 🏍️`;

      await this.enviarMensagemComTyping(msg, mensagem);
      
      // Delivery: vai para confirmação final
      await Helpers.sleep(1500);
      stateManager.setEstado(telefone, ESTADOS.CONFIRMACAO_FINAL);
      await this.enviarMensagemConfirmacaoFinal(msg, telefone);
    }
  }

  async processarPagamentoCartao(msg, telefone, mensagem) {
    // Estado transitório, não precisa processar
  }

  // ===============================================
  // PROMPT 7 - AGUARDANDO RETIRADA
  // ===============================================

  /**
   * Estado: AGUARDANDO_RETIRADA (NOVO - Prompt 7)
   * Envia mensagem usando msg object
   */
  async enviarMensagemAguardandoRetiradaMsg(msg) {
    const mensagem = `Perfeito! 🎉
Estamos te aguardando 😉
📍 *Nosso endereço:*
Avenida Sabino Câmara – Posto IC, Brejo-MA`;

    await this.enviarMensagemComTyping(msg, mensagem);
  }

  /**
   * Envia mensagem de aguardando retirada usando telefone (sem msg object)
   * Usado quando funcionário confirma Pix
   */
  async enviarMensagemAguardandoRetirada(telefone) {
    const mensagem = `Perfeito! 🎉
Estamos te aguardando 😉
📍 *Nosso endereço:*
Avenida Sabino Câmara – Posto IC, Brejo-MA`;

    await this.client.sendMessage(telefone, mensagem);
    
    // Envia agradecimento
    await Helpers.sleep(1500);
    await this.enviarMensagemAgradecimentoChat(telefone);
  }

  // ===============================================
  // ENDEREÇO (mantido para compatibilidade)
  // ===============================================

  /**
   * Envia mensagem de endereço sem depender de objeto msg
   * Usado quando o funcionário confirma comprovante Pix (fluxo antigo)
   */
  async enviarMensagemEnderecoCliente(telefone) {
    const cliente = database.getCliente(telefone);
    
    // Verifica se já tem endereço salvo
    if (cliente.endereco) {
      const pergunta = `Encontrei este endereço salvo para você ✅
📍 *${cliente.endereco}*

Você quer manter esse endereço?
*❯ 1-* Sim, manter
*❯ 2-* Não, vou informar outro`;

      await this.client.sendMessage(telefone, pergunta);
      stateManager.setUltimaPergunta(telefone, pergunta);
      stateManager.setEstado(telefone, ESTADOS.CONFIRMA_ENDERECO);
    } else {
      // E1 - Pede endereço com formato de vírgulas
      const pergunta = `E para finalizar, *${cliente.primeiro_nome}* 😊
Me informe o endereço completo para entrega:
📍 *Bairro, Rua, Número* e (se tiver) *ponto de referência*`;

      await this.client.sendMessage(telefone, pergunta);
      stateManager.setUltimaPergunta(telefone, pergunta);
    }
  }

  /**
   * Estado: ENDERECO_CLIENTE
   */
  async enviarMensagemEndereco(msg, telefone) {
    const cliente = database.getCliente(telefone);
    
    // Verifica se já tem endereço salvo
    if (cliente.endereco) {
      const pergunta = `Encontrei este endereço salvo para você ✅
📍 *${cliente.endereco}*

Você quer manter esse endereço?
*❯ 1-* Sim, manter
*❯ 2-* Não, vou informar outro`;

      await this.enviarMensagemComTyping(msg, pergunta);
      stateManager.setUltimaPergunta(msg.from, pergunta);
      stateManager.setEstado(telefone, ESTADOS.CONFIRMA_ENDERECO);
    } else {
      // E1 - Pede endereço com formato de vírgulas
      const pergunta = `E para finalizar, *${cliente.primeiro_nome}* 😊
Me informe o endereço completo para entrega:
📍 *Bairro, Rua, Número* e (se tiver) *ponto de referência*`;

      await this.enviarMensagemComTyping(msg, pergunta);
      stateManager.setUltimaPergunta(msg.from, pergunta);
    }
  }

  async processarEnderecoCliente(msg, telefone, mensagem) {
    const cliente = database.getCliente(telefone);

    // Prompt 8 - Validação completa de endereço (3 partes mínimas)
    const validacaoEndereco = Validator.validarEndereco(mensagem);
    if (!validacaoEndereco.valido) {
      await this.enviarMensagemComTyping(msg, validacaoEndereco.mensagem);
      return;
    }

    // Armazena endereço temporariamente para confirmação
    stateManager.setDados(telefone, 'enderecoTemp', mensagem);

    // Avança para confirmação de endereço
    stateManager.setEstado(telefone, ESTADOS.CONFIRMA_ENDERECO);
    await this.enviarMensagemConfirmaEndereco(msg, telefone, mensagem);

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.ENDERECO_CLIENTE,
      `Aguardando confirmação do endereço: ${mensagem}`
    );
  }

  /**
   * Envia mensagem de confirmação de endereço
   * E3 - SEM linhas vazias
   */
  async enviarMensagemConfirmaEndereco(msg, telefone, endereco) {
    const pergunta = `Confere pra mim se está certinho ✅
📍 *${endereco}*
*❯ 1-* Está certo
*❯ 2-* Quero alterar`;

    await this.enviarMensagemComTyping(msg, pergunta);
    stateManager.setUltimaPergunta(msg.from, pergunta);
  }

  /**
   * Estado: CONFIRMA_ENDERECO
   */
  async processarConfirmaEndereco(msg, telefone, mensagem) {
    const validacao = Validator.validarOpcoes(mensagem, 2, false, false, false);
    
    if (!validacao.valido) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite *1* para confirmar ou *2* para alterar.');
      return;
    }

    const cliente = database.getCliente(telefone);

    // Prompt 8 - Proteção contra undefined
    if (!validacao.opcoes || validacao.opcoes.length === 0) {
      await this.enviarMensagemComTyping(msg, 'Por favor, digite o número da opção desejada.');
      return;
    }

    if (validacao.opcoes[0] === 1) {
      // Usa enderecoTemp quando disponível, caso contrário usa o endereço já salvo no cliente
      const enderecoTemp = stateManager.getDados(telefone, 'enderecoTemp');
      const endereco = enderecoTemp || cliente.endereco;
      stateManager.setDados(telefone, 'endereco', endereco);

      // E4 - Salva endereço no banco IMEDIATAMENTE após confirmação
      if (endereco) {
        database.atualizarEndereco(telefone, endereco);
      }
      
      stateManager.setEstado(telefone, ESTADOS.CONFIRMACAO_FINAL);
      await this.enviarMensagemConfirmacaoFinal(msg, telefone);
    } else {
      stateManager.setEstado(telefone, ESTADOS.ENDERECO_CLIENTE);
      
      await this.enviarMensagemComTyping(msg, 
        `Ok! Me informe o endereço correto para entrega:
📍 *Bairro, Rua, Número* e (se tiver) *ponto de referência*`
      );
    }

    Logger.log(
      'OPERAÇÃO',
      Helpers.formatarTelefone(telefone),
      cliente.primeiro_nome,
      ESTADOS.CONFIRMA_ENDERECO,
      validacao.opcoes && validacao.opcoes[0] === 1 ? 'Endereço confirmado' : 'Cliente quis alterar endereço'
    );
  }

  // ===============================================
  // CONFIRMAÇÃO FINAL E AGRADECIMENTO
  // ===============================================

  /**
   * Estado: CONFIRMACAO_FINAL (Delivery)
   */
  async enviarMensagemConfirmacaoFinal(msg, telefone) {
    const cliente = database.getCliente(telefone);
    const valor = stateManager.getDados(telefone, 'valor');
    const formaPagamento = stateManager.getDados(telefone, 'formaPagamento');
    const troco = stateManager.getDados(telefone, 'troco');

    // Formata forma de pagamento
    let formaPgtoTexto = '';
    switch (formaPagamento) {
      case 'pix':
        formaPgtoTexto = '📱 Pix (pago)';
        break;
      case 'dinheiro':
        formaPgtoTexto = troco ? `💵 Dinheiro (troco para R$ ${troco})` : '💵 Dinheiro';
        break;
      case 'cartao':
        formaPgtoTexto = '💳 Cartão (na entrega)';
        break;
      case 'na_retirada':
        formaPgtoTexto = '🏪 Na retirada';
        break;
    }

    // Mensagem 1: Seu açaí já saiu para entrega (delay maior)
    await this.enviarMensagemComTyping(msg, 
      `Seu açaí já saiu para entrega 💜✨
Já já chega até você 🍧😄`, 
      TYPING_DELAY.CONFIRMACAO_FINAL * 2
    );

    // Aguarda um pouco entre mensagens
    await Helpers.sleep(1000);

    // Mensagem de agradecimento
    await this.enviarMensagemAgradecimento(msg, telefone);

    // Envia resumo para entregador (apenas delivery)
    try {
      const endereco = stateManager.getDados(telefone, 'enderecoDelivery') || stateManager.getDados(telefone, 'endereco') || cliente.endereco;
      const carrinho = stateManager.getDados(telefone, 'carrinho') || [];
      const telefoneAdmin = await this.formatarTelefoneParaAdmin(telefone);

      const contagemPorTamanho = new Map();
      for (const item of carrinho) {
        const tamanho = item?.tamanho || 'Tamanho não informado';
        contagemPorTamanho.set(tamanho, (contagemPorTamanho.get(tamanho) || 0) + 1);
      }

      let itensTexto = `${carrinho.length} açaí(s)`;
      for (const [tamanho, qtd] of contagemPorTamanho.entries()) {
        itensTexto += `\n- ${tamanho} x${qtd}`;
      }

      let resumoEntregador = `🛵 *ENTREGA - NOVO PEDIDO*\n\n`;
      resumoEntregador += `👤 *Cliente:* ${cliente?.nome_completo || 'Desconhecido'}\n`;
      resumoEntregador += `📞 *Telefone:* ${telefoneAdmin}\n`;
      resumoEntregador += `📍 *Endereço:* ${endereco || 'Não informado'}\n`;
      resumoEntregador += `💳 *Pagamento:* ${formaPgtoTexto || 'Não informado'}\n`;
      resumoEntregador += `🍧 *Itens:* ${itensTexto}`;

      await this.enviarParaEntregadores(resumoEntregador);
    } catch (erro) {
      Logger.error('Erro ao enviar resumo para entregador', erro);
    }

    // Envia resumo final para admin (E2 - telefone formatado)
    try {
      const endereco = stateManager.getDados(telefone, 'enderecoDelivery') || stateManager.getDados(telefone, 'endereco') || cliente.endereco;
      const carrinho = stateManager.getDados(telefone, 'carrinho');
      
      let resumoAdmin = `✅ *PEDIDO FINALIZADO*\n\n`;
      resumoAdmin += `👤 *Cliente:* ${cliente.nome_completo}\n`;
      resumoAdmin += `📞 *Telefone:* ${await this.formatarTelefoneParaAdmin(telefone)}\n`;
      resumoAdmin += `📍 *Endereço:* ${endereco}\n`;
      resumoAdmin += `💰 *Valor:* R$ ${valor ? valor.toFixed(2) : 'N/A'}\n`;
      resumoAdmin += `💳 *Pagamento:* ${formaPgtoTexto}\n`;
      resumoAdmin += `🍧 *Itens:* ${carrinho.length} açaí(s)`;

      await this.enviarParaAdmins(resumoAdmin);
    } catch (erro) {
      Logger.error('Erro ao enviar resumo final para admin', erro);
    }

    // Encerra sessão após alguns segundos
    setTimeout(() => {
      stateManager.encerrarSessao(telefone);
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        'ENCERRADO',
        'Sessão encerrada após confirmação final'
      );
    }, 5000);
  }

  /**
   * Confirmação final via chat (sem msg object)
   * Usado quando funcionário confirma Pix no delivery
   */
  async enviarMensagemConfirmacaoFinalChat(chat, telefone) {
    const cliente = database.getCliente(telefone);

    await this.simularTypingEEnviar(chat, 
      `Seu açaí já saiu para entrega 💜✨
Já já chega até você 🍧😄`, 
      TYPING_DELAY.CONFIRMACAO_FINAL * 2
    );

    await Helpers.sleep(1000);

    // Agradecimento
    await this.enviarMensagemAgradecimentoChat(telefone);

    // Envia resumo final para admin
    try {
      const valor = stateManager.getDados(telefone, 'valor');
      const formaPagamento = stateManager.getDados(telefone, 'formaPagamento');
      const endereco = stateManager.getDados(telefone, 'enderecoDelivery') || stateManager.getDados(telefone, 'endereco') || cliente.endereco;
      const carrinho = stateManager.getDados(telefone, 'carrinho');

      // Resumo para entregador (apenas delivery)
      try {
        const telefoneAdmin = await this.formatarTelefoneParaAdmin(telefone);
        const contagemPorTamanho = new Map();
        for (const item of carrinho || []) {
          const tamanho = item?.tamanho || 'Tamanho não informado';
          contagemPorTamanho.set(tamanho, (contagemPorTamanho.get(tamanho) || 0) + 1);
        }

        let itensTexto = `${(carrinho || []).length} açaí(s)`;
        for (const [tamanho, qtd] of contagemPorTamanho.entries()) {
          itensTexto += `\n- ${tamanho} x${qtd}`;
        }

        let resumoEntregador = `🛵 *ENTREGA - NOVO PEDIDO*\n\n`;
        resumoEntregador += `👤 *Cliente:* ${cliente?.nome_completo || 'Desconhecido'}\n`;
        resumoEntregador += `📞 *Telefone:* ${telefoneAdmin}\n`;
        resumoEntregador += `📍 *Endereço:* ${endereco || 'Não informado'}\n`;
        resumoEntregador += `💳 *Pagamento:* 📱 Pix (pago)\n`;
        resumoEntregador += `🍧 *Itens:* ${itensTexto}`;

        await this.enviarParaEntregadores(resumoEntregador);
      } catch (erro) {
        Logger.error('Erro ao enviar resumo para entregador (chat)', erro);
      }
      
      let resumoAdmin = `✅ *PEDIDO FINALIZADO*\n\n`;
      resumoAdmin += `👤 *Cliente:* ${cliente.nome_completo}\n`;
      resumoAdmin += `📞 *Telefone:* ${await this.formatarTelefoneParaAdmin(telefone)}\n`;
      resumoAdmin += `📍 *Endereço:* ${endereco}\n`;
      resumoAdmin += `💰 *Valor:* R$ ${valor ? valor.toFixed(2) : 'N/A'}\n`;
      resumoAdmin += `💳 *Pagamento:* 📱 Pix (pago)\n`;
      resumoAdmin += `🍧 *Itens:* ${carrinho.length} açaí(s)`;

      await this.enviarParaAdmins(resumoAdmin);
    } catch (erro) {
      Logger.error('Erro ao enviar resumo final para admin', erro);
    }

    // Encerra sessão
    setTimeout(() => {
      stateManager.encerrarSessao(telefone);
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        'ENCERRADO',
        'Sessão encerrada após confirmação final (Pix delivery)'
      );
    }, 5000);
  }

  /**
   * Prompt 7 - Envia mensagem de agradecimento (cliente novo vs antigo)
   * Correção: mensagem para clientes antigos agora é enviada corretamente
   */
  async enviarMensagemAgradecimento(msg, telefone) {
    const cliente = database.getCliente(telefone);
    
    // Prompt 8 - Usa contagem de pedidos confirmados do BD
    const pedidosConfirmados = database.getPedidosConfirmados(telefone);
    
    let mensagemAgradecimento = '';
    
    if (pedidosConfirmados >= 2) {
      // Cliente com 2+ pedidos confirmados
      mensagemAgradecimento = `Agradecemos seu pedido, *${cliente.primeiro_nome}!* 💜
Foi um prazer atender você novamente no *Espaço Açaí & Gelatos* 🍧
Esperamos que aproveite muito 😋
Volte sempre!`;
    } else {
      // Primeiro pedido confirmado
      mensagemAgradecimento = `Agradecemos seu pedido, *${cliente.primeiro_nome}!* 💜
Foi um prazer atender você no *Espaço Açaí & Gelatos* 🍧
Esperamos que aproveite muito 😋
Volte sempre!`;
    }

    await this.enviarMensagemComTyping(msg, mensagemAgradecimento, TYPING_DELAY.PADRAO);

    // Encerra sessão após alguns segundos (para retirada)
    const formaEntrega = stateManager.getDados(telefone, 'formaEntrega');
    if (formaEntrega === 'retirada') {
      setTimeout(() => {
        stateManager.encerrarSessao(telefone);
        Logger.log(
          'OPERAÇÃO',
          Helpers.formatarTelefone(telefone),
          cliente.primeiro_nome,
          'ENCERRADO',
          'Sessão encerrada após agradecimento (retirada)'
        );
      }, 5000);
    }
  }

  /**
   * Envia agradecimento via chat (sem msg object)
   */
  async enviarMensagemAgradecimentoChat(telefone) {
    const cliente = database.getCliente(telefone);
    
    // Prompt 8 - Usa contagem de pedidos confirmados do BD
    const pedidosConfirmados = database.getPedidosConfirmados(telefone);
    
    let mensagemAgradecimento = '';
    
    if (pedidosConfirmados >= 2) {
      // Cliente com 2+ pedidos confirmados
      mensagemAgradecimento = `Agradecemos seu pedido, *${cliente.primeiro_nome}!* 💜
Foi um prazer atender você novamente no *Espaço Açaí & Gelatos* 🍧
Esperamos que aproveite muito 😋
Volte sempre!`;
    } else {
      // Primeiro pedido confirmado
      mensagemAgradecimento = `Agradecemos seu pedido, *${cliente.primeiro_nome}!* 💜
Foi um prazer atender você no *Espaço Açaí & Gelatos* 🍧
Esperamos que aproveite muito 😋
Volte sempre!`;
    }

    await this.client.sendMessage(telefone, mensagemAgradecimento);

    // Encerra sessão
    setTimeout(() => {
      stateManager.encerrarSessao(telefone);
      Logger.log(
        'OPERAÇÃO',
        Helpers.formatarTelefone(telefone),
        cliente.primeiro_nome,
        'ENCERRADO',
        'Sessão encerrada após agradecimento (via chat)'
      );
    }, 5000);
  }

  async processarConfirmacaoFinal(msg, telefone, mensagem) {
    // Pedido já confirmado, não precisa processar
    await this.enviarMensagemComTyping(msg, 
      `Seu açaí já saiu para entrega 💜✨
Já já chega até você 🍧😄`
    );
  }

  // ===============================================
  // UTILITÁRIOS
  // ===============================================

  /**
   * Simula digitação e envia mensagem
   */
  async enviarMensagemComTyping(msg, texto, delay = TYPING_DELAY.PADRAO) {
    try {
      const chat = await msg.getChat();
      await chat.sendStateTyping();
      await Helpers.sleep(delay);
      await chat.sendMessage(texto);
    } catch (erro) {
      Logger.error('Erro ao enviar mensagem com typing', erro);
      // Tenta enviar sem typing
      await msg.reply(texto);
    }
  }

  /**
   * Simula digitação e envia para chat (sem msg original)
   */
  async simularTypingEEnviar(chat, texto, delay = TYPING_DELAY.PADRAO) {
    try {
      await chat.sendStateTyping();
      await Helpers.sleep(delay);
      await chat.sendMessage(texto);
    } catch (erro) {
      Logger.error('Erro ao enviar para chat', erro);
    }
  }

  /**
   * Envia mídia com simulação de typing
   */
  async enviarMidiaComTyping(msg, media, caption = '') {
    try {
      const chat = await msg.getChat();
      await chat.sendStateTyping();
      await Helpers.sleep(1000);
      await chat.sendMessage(media, { caption });
    } catch (erro) {
      Logger.error('Erro ao enviar mídia', erro);
    }
  }
}

module.exports = MessageHandler;
