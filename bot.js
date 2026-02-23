/**
 * Chatbot WhatsApp - Espaço Açaí & Gelatos
 * Versão: 2.5.10 FINAL (Híbrida Estável)
 * Node: 18.20.8
 * 
 * Implementações Prompt 7:
 * - Sistema de delivery com taxa por região
 * - Retirada no local
 * - FAQ atualizado (8 perguntas)
 * - Escolha de entrega após confirmação do pedido
 * - Mensagem de aguardando retirada
 * - Agradecimento corrigido para clientes antigos
 * - Nova abordagem para cliente que desistiu
 * 
 * Prompt 8:
 * - Proteção contra envio sem conversa iniciada
 * - Validação rigorosa de inputs numéricos
 * - Confirmação de endereço em todos os fluxos
 * - Agradecimento baseado na contagem de pedidos no BD
 * - Contagem de pedidos confirmados no BD
 * 
 * v2.5.4 (Prompt 10) - CORREÇÕES CRÍTICAS:
 * - Timezone forçado para America/Fortaleza (Brejo-MA)
 * - Verificação de horário obrigatória para TODOS os clientes
 * - Reconhecimento de cliente melhorado
 * - Puppeteer otimizado para PM2 em VPS (erros corrigidos)
 * 
 * v2.5.10 FINAL (Versão Híbrida Estável):
 * - BASE: Configuração v2.5.4 (reconexão funciona perfeitamente)
 * - ADICIONADO: Graceful shutdown v2.5.8 (encerramento limpo 30s)
 * - ADICIONADO: Proteção contra mensagens de canais/communities v2.5.7
 * - REMOVIDO: webVersionCache remoto (quebrava reconexão)
 * - MANTIDO: --single-process (essencial para reconexão)
 * - MANTIDO: timeout 60s (configuração estável)
 * - RESULTADO: Bot reconecta perfeitamente após pm2 restart! ✅
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const MessageHandler = require('./services/messageHandler');
const Logger = require('./utils/logger');
const { ADMIN_NUMBER, ESTADOS } = require('./config/constants');
const stateManager = require('./services/stateManager');
const database = require('./services/database');
const path = require('path');

// Prompt 8 - Rastreia contatos que iniciaram conversa com o bot
// Só responde para quem mandou mensagem primeiro
const contatosQueIniciaramConversa = new Set();

// ============================================================
// v2.5.4 - CONFIGURAÇÃO OTIMIZADA DO PUPPETEER PARA PM2
// Resolve erros de navegador em ambiente de servidor
// ============================================================

// Inicializa cliente WhatsApp
// Configuração otimizada para VPS Ubuntu (Contabo/Hostinger) rodando como Root
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.join(__dirname, '.wwebjs_auth'), // Diretório de autenticação local
  }),
  takeoverOnConflict: true,
  takeoverTimeoutMs: 0,
  puppeteer: {
    // Usa Chromium do sistema
    // Em VPS Ubuntu: apt install chromium-browser
    headless: true,
    args: [
      // ============================================================
      // OBRIGATÓRIO para rodar como Root em VPS
      // ============================================================
      '--no-sandbox',
      '--disable-setuid-sandbox',
      
      // ============================================================
      // v2.5.4 - CORREÇÃO DE ERROS PM2
      // Flags adicionais para estabilidade em servidor
      // ============================================================
      '--disable-dev-shm-usage',           // Usa /tmp em vez de /dev/shm
      '--disable-accelerated-2d-canvas',   // Desabilita aceleração 2D
      '--disable-gpu',                     // Desabilita GPU
      '--no-first-run',                    // Pula configuração inicial
      '--no-zygote',                       // Desabilita processo zygote
      '--single-process',                  // Usa processo único
      '--disable-software-rasterizer',     // v2.5.4 - Desabilita rasterização por software
      
      // ============================================================
      // Reduz uso de memória
      // ============================================================
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--disable-default-apps',            // v2.5.4 - Desabilita apps padrão
      '--disable-features=TranslateUI',    // v2.5.4 - Desabilita tradução
      '--disable-features=site-per-process', // v2.5.4 - Otimização de memória
      '--metrics-recording-only',
      '--mute-audio',
      '--no-default-browser-check',        // v2.5.4 - Pula verificação de navegador padrão
      
      // ============================================================
      // v2.5.4 - Flags para evitar erros de renderização
      // ============================================================
      '--disable-infobars',
      '--disable-notifications',
      '--disable-popup-blocking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-ipc-flooding-protection',
      '--ignore-certificate-errors',       // v2.5.4 - Ignora erros de certificado
      '--ignore-certificate-errors-spki-list',
      
      // ============================================================
      // Configurações de tamanho de janela e cache
      // ============================================================
      '--window-size=1920,1080',           // Tamanho fixo
      '--window-position=0,0',
      '--disable-web-security',            // Para ambiente de teste
      '--allow-running-insecure-content',
    ],
    // v2.5.4 - Configurações adicionais do Puppeteer
    timeout: 60000,                        // Timeout de 60 segundos para inicialização
    handleSIGINT: false,                   // Não captura SIGINT (deixa para o processo)
    handleSIGTERM: false,                  // Não captura SIGTERM
    handleSIGHUP: false,                   // Não captura SIGHUP
  },
  // NF2 - Configurações para reconexão
  restartOnAuthFail: true,
  webVersionCache: process.env.WEB_VERSION_REMOTE === '1' ? {
    type: 'remote',
    remotePath: process.env.WEB_VERSION_REMOTE_PATH || 'https://raw.githubusercontent.com/wppconnect-team/wa-version/refs/heads/main/html/2.3000.1031490220-alpha.html',
  } : undefined,
  // v2.5.4 - Configurações de QR Code
  qrMaxRetries: 5,
});

// Inicializa handler de mensagens
const messageHandler = new MessageHandler(client);

// ===============================================
// EVENTOS DO WHATSAPP
// ===============================================

/**
 * Evento: QR Code gerado
 */
client.on('qr', (qr) => {
  console.log('\n' + '='.repeat(80));
  console.log('📱 QR CODE GERADO!');
  console.log('Escaneie o QR Code abaixo com seu WhatsApp:');
  console.log('='.repeat(80) + '\n');
  
  qrcode.generate(qr, { small: true });
  
  console.log('\n' + '='.repeat(80));
  console.log('👉 Abra o WhatsApp no celular');
  console.log('👉 Vá em Menu > Aparelhos conectados');
  console.log('👉 Conectar um aparelho');
  console.log('👉 Escaneie o código acima');
  console.log('='.repeat(80) + '\n');
});

/**
 * Evento: Cliente autenticado
 */
client.on('authenticated', () => {
  Logger.info('✅ Cliente autenticado com sucesso!');
});

/**
 * Evento: Autenticação falhou
 */
client.on('auth_failure', (msg) => {
  Logger.error('❌ Falha na autenticação', msg);
});

/**
 * Evento: Cliente pronto
 */
client.on('ready', () => {
  console.log('\n' + '='.repeat(80));
  console.log('🎉 BOT INICIADO COM SUCESSO! 🎉');
  console.log('='.repeat(80));
  console.log('💬 Bot: Espaço Açaí & Gelatos v2.5.10 FINAL (Híbrida Estável)');
  console.log('⏰ Horário: 16h - 22h30 (timezone: America/Fortaleza)');
  console.log('🔑 Modo teste: Digite "testacai" para testar fora do horário');
  console.log('🛑 Parar fluxo: Digite "stopacai" para encerrar atendimento');
  console.log('📞 Admin: 5598970278100');
  console.log('='.repeat(80));
  console.log('📋 v2.5.10 FINAL - Versão Híbrida Estável:');
  console.log('   ✅ BASE v2.5.4: Reconexão funciona perfeitamente!');
  console.log('   ✅ ADICIONADO: Graceful shutdown (30s) da v2.5.8');
  console.log('   ✅ ADICIONADO: Proteção contra canais da v2.5.7');
  console.log('   ✅ MANTIDO: --single-process (essencial)');
  console.log('   ✅ RESULTADO: pm2 restart funciona! 🎉');
  console.log('='.repeat(80));
  console.log('📋 Funcionalidades mantidas (Prompts 1-8):');
  console.log('   E1-E4 | A1-A5 | NF1-NF2 | T1-T8 | I1-I9');
  console.log('   🏍️ Delivery | 🏪 Retirada | ❓ FAQ (8 perguntas)');
  console.log('   🕐 Timezone America/Fortaleza | 🚫 Verificação de horário');
  console.log('='.repeat(80));
  console.log('👀 Aguardando mensagens...');
  console.log('='.repeat(80) + '\n');
  
  // Prompt 7 - Log de inicialização
  Logger.inicializacao();
});

/**
 * Evento: Mensagem recebida (do cliente)
 * Prompt 8 - Registra contato como quem iniciou conversa
 * v2.5.7/v2.5.10 - Proteção contra erros de canais/communities
 */
client.on('message', async (msg) => {
  try {
    // v2.5.7/v2.5.10 - PROTEÇÃO: Ignora mensagens de tipos não suportados
    // Verifica se é de canal/community/newsletter antes de tentar getChat()
    if (msg.from && (
      msg.from.includes('@newsletter') ||
      msg.from.includes('@broadcast') ||
      msg.from === 'status@broadcast'
    )) {
      Logger.info(`[IGNORADO] Mensagem de canal/newsletter: ${msg.from}`);
      return;
    }

    // v2.5.7/v2.5.10 - PROTEÇÃO: Try-catch específico para getChat()
    // Evita crash com canais/communities que causam erro "Cannot read properties of undefined"
    let chat;
    try {
      chat = await msg.getChat();
    } catch (getChatError) {
      // Erro ao obter chat - provavelmente canal, community ou tipo não suportado
      Logger.error(`[ERRO getChat] Tipo de mensagem não suportado de ${msg.from}`, getChatError.message);
      return;
    }
    
    // Ignora mensagens de grupos
    if (chat.isGroup) {
      Logger.grupo(chat.id._serialized, chat.name);
      return;
    }

    // Ignora mensagens de status (verificação adicional)
    if (msg.from === 'status@broadcast') {
      return;
    }

    // Prompt 8 - Registra que este contato iniciou conversa
    // Isso garante que o bot só responde para quem mandou mensagem primeiro
    contatosQueIniciaramConversa.add(msg.from);

    // T5 - Detecta áudio
    const isAudio = msg.type === 'audio' || msg.type === 'ptt';
    
    // T3 - Detecta mídia (imagem/documento para comprovante Pix)
    const hasMedia = msg.hasMedia;
    let mediaType = null;
    
    if (hasMedia) {
      if (msg.type === 'image') {
        mediaType = 'image';
      } else if (msg.type === 'document') {
        mediaType = 'document';
      }
    }

    // Log detalhado
    Logger.info(`[MSG] De: ${msg.from} | Tipo: ${msg.type} | Mídia: ${hasMedia} | Audio: ${isAudio}`);

    // Processa mensagem (não é fromMe, pois é mensagem recebida)
    await messageHandler.processar(msg, false, isAudio, hasMedia, mediaType);
    
  } catch (erro) {
    Logger.error('Erro ao processar mensagem', erro);
  }
});

/**
 * Evento: Mensagem criada (enviada pelo bot/funcionário)
 * T1 - Detecta mensagens do funcionário
 * Prompt 8 - Só processa se o contato já iniciou conversa
 * v2.5.7/v2.5.10 - Proteção contra erros de canais/communities
 */
client.on('message_create', async (msg) => {
  try {
    // v2.5.7/v2.5.10 - PROTEÇÃO: Ignora mensagens para canais/newsletters
    if (msg.to && (
      msg.to.includes('status@broadcast') ||
      msg.to.includes('@newsletter') ||
      msg.to.includes('@broadcast')
    )) {
      return;
    }

    // T1 - Se a mensagem é fromMe (enviada pelo proprietário do WhatsApp)
    if (msg.fromMe) {
      // Prompt 8 - Verifica se o contato já iniciou conversa
      // Só processa comandos do funcionário para contatos que já mandaram mensagem
      if (!contatosQueIniciaramConversa.has(msg.to)) {
        Logger.info(`[PROTEÇÃO] Ignorando mensagem para ${msg.to} - contato não iniciou conversa`);
        return;
      }

      // v2.5.7/v2.5.10 - PROTEÇÃO: Try-catch para getChat()
      let chat;
      try {
        chat = await msg.getChat();
      } catch (getChatError) {
        // Erro ao obter chat - ignora silenciosamente
        Logger.error(`[ERRO getChat] message_create para ${msg.to}`, getChatError.message);
        return;
      }

      // Ignora mensagens de grupos
      if (chat.isGroup) {
        return;
      }

      // Detecta tipos de mensagem
      const isAudio = msg.type === 'audio' || msg.type === 'ptt';
      const hasMedia = msg.hasMedia;
      let mediaType = null;
      
      if (hasMedia) {
        if (msg.type === 'image') {
          mediaType = 'image';
        } else if (msg.type === 'document') {
          mediaType = 'document';
        }
      }

      Logger.info(`[FUNCIONÁRIO] Para: ${msg.to} | Tipo: ${msg.type} | Msg: "${msg.body?.substring(0, 50)}..."`);

      // Processa como mensagem do funcionário
      await messageHandler.processar(msg, true, isAudio, hasMedia, mediaType);
    }
  } catch (erro) {
    Logger.error('Erro ao processar mensagem do funcionário', erro);
  }
});

/**
 * Evento: Desconectado
 * NF2 - Reconexão automática
 */
client.on('disconnected', (reason) => {
  Logger.error('Cliente desconectado', reason);
  console.log('\n🔄 Tentando reconectar em 5 segundos...');
  
  setTimeout(() => {
    console.log('🔄 Reiniciando cliente...');
    client.initialize();
  }, 5000);
});

// ===============================================
// TRATAMENTO DE ERROS
// ===============================================

process.on('uncaughtException', (erro) => {
  Logger.error('Erro não capturado', erro);
});

process.on('unhandledRejection', (erro) => {
  Logger.error('Rejeição não tratada', erro);
});

// ===============================================
// E4/E1 (Prompt 6) - ENCERRAMENTO LIMPO
// Flush de segurança do BD antes de encerrar
// ===============================================

// ===============================================
// E4/E1 (Prompt 6) - ENCERRAMENTO LIMPO
// Flush de segurança do BD antes de encerrar
// v2.5.8/v2.5.10 - Graceful shutdown melhorado
// ===============================================

// Flag para evitar múltiplos encerramemtos
let encerrando = false;

async function encerrarGracefully(sinal) {
  // Evita múltiplas execuções
  if (encerrando) {
    console.log('⚠️ Encerramento já em andamento...');
    return;
  }
  
  encerrando = true;
  console.log(`\n🛑 Encerrando bot (${sinal})...`);
  
  // E4 - Flush de segurança do BD
  database.flushSeguranca();
  
  try {
    // Timeout de 25 segundos para destroy (PM2 tem 30s total)
    const destroyPromise = client.destroy();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout ao encerrar sessão')), 25000)
    );
    
    await Promise.race([destroyPromise, timeoutPromise]);
    console.log('✅ Sessão WhatsApp encerrada com sucesso');
  } catch (erro) {
    console.error('⚠️ Erro ao encerrar sessão:', erro.message);
  }
  
  // Pequeno delay para garantir que logs sejam escritos
  await new Promise(resolve => setTimeout(resolve, 500));
  
  process.exit(0);
}

process.on('SIGINT', () => encerrarGracefully('SIGINT'));
process.on('SIGTERM', () => encerrarGracefully('SIGTERM'));

// ===============================================
// INICIALIZA BOT
// ===============================================

console.log('\n' + '='.repeat(80));
console.log('🚀 INICIANDO CHATBOT v2.5.10 FINAL (Híbrida Estável)...');
console.log('='.repeat(80) + '\n');

client.initialize();
