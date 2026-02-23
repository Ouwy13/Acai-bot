/**
 * Sistema de logs detalhados no terminal
 * Versão: 2.5.0 - Prompt 7
 * Registra telefone, nome, estado e operação
 */

class Logger {
  static log(tipo, telefone, nome, estado, operacao) {
    const timestamp = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
    
    const nomeExibir = nome || '(sem nome)';
    
    console.log('\n' + '='.repeat(80));
    console.log(`[${timestamp}] ${tipo.toUpperCase()}`);
    console.log(`📞 Telefone: ${telefone}`);
    console.log(`👤 Nome: ${nomeExibir}`);
    console.log(`📋 Estado: ${estado}`);
    console.log(`⚙️ Operação: ${operacao}`);
    console.log('='.repeat(80) + '\n');
  }

  static info(mensagem) {
    const timestamp = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
    console.log(`[${timestamp}] ℹ️ INFO: ${mensagem}`);
  }

  static error(mensagem, erro) {
    const timestamp = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
    console.log(`[${timestamp}] ❌ ERRO: ${mensagem}`);
    if (erro) {
      console.error(erro);
    }
  }

  static grupo(chatId, chatName) {
    const timestamp = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
    console.log(`[${timestamp}] 👥 GRUPO DETECTADO: ${chatName || chatId} - Mensagem ignorada`);
  }

  /**
   * Prompt 7 - Log de inicialização do bot
   */
  static inicializacao() {
    const timestamp = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
  }
}

module.exports = Logger;
