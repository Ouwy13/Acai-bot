/**
 * Funções auxiliares
 * Versão: 2.5.4 - Prompt 10
 * 
 * Prompt 8:
 * - Validação de endereço melhorada (3 partes mínimas: Bairro, Rua, Número)
 * 
 * Prompt 10 (v2.5.4):
 * - CORREÇÃO CRÍTICA: Timezone forçado para America/Fortaleza (Brejo-MA)
 * - Servidor pode estar em Hub Europe, precisa usar timezone do Brasil
 * - Logs detalhados para debug de horário
 */

const { HORARIO, PALAVRA_TESTE, PALAVRA_PARAR } = require('../config/constants');

// Timezone de Brejo-MA (mesmo que Fortaleza)
const TIMEZONE_BRASIL = 'America/Fortaleza';

class Helpers {
  /**
   * Verifica se está dentro do horário de funcionamento
   * CORREÇÃO v2.5.4: Usa timezone de Brejo-MA, não do servidor
   */
  static dentroDoHorario() {
    // Pega a hora atual no timezone de Brejo-MA (America/Fortaleza)
    const agora = new Date();
    
    // Converte para o timezone correto
    const horasBrasil = parseInt(agora.toLocaleString('pt-BR', { 
      timeZone: TIMEZONE_BRASIL, 
      hour: '2-digit', 
      hour12: false 
    }));
    
    const minutosBrasil = parseInt(agora.toLocaleString('pt-BR', { 
      timeZone: TIMEZONE_BRASIL, 
      minute: '2-digit' 
    }));
    
    const hora = horasBrasil + minutosBrasil / 60;
    
    const dentroHorario = hora >= HORARIO.ABERTURA && hora <= HORARIO.FECHAMENTO;
    
    // Log para debug (servidor pode ter timezone diferente)
    console.log(`[HORÁRIO] Servidor: ${agora.toISOString()} | Brasil (${TIMEZONE_BRASIL}): ${horasBrasil}:${minutosBrasil.toString().padStart(2, '0')} | Decimal: ${hora.toFixed(2)} | Aberto: ${HORARIO.ABERTURA}-${HORARIO.FECHAMENTO} | Resultado: ${dentroHorario ? 'ABERTO ✅' : 'FECHADO ❌'}`);
    
    return dentroHorario;
  }

  /**
   * Verifica se a mensagem contém a palavra de teste
   */
  static ehModoTeste(mensagem) {
    return mensagem.toLowerCase().includes(PALAVRA_TESTE);
  }

  /**
   * NF1 - Verifica se a mensagem é o comando de parar (stopacai)
   */
  static ehComandoParar(mensagem) {
    return mensagem.toLowerCase().trim() === PALAVRA_PARAR;
  }

  /**
   * Extrai o primeiro nome de um nome completo
   */
  static extrairPrimeiroNome(nomeCompleto) {
    return nomeCompleto.trim().split(' ')[0];
  }

  /**
   * Extrai números de uma string
   * Ex: "1,3,5" -> [1, 3, 5]
   * Ex: "quero 1 e 3" -> [1, 3]
   */
  static extrairNumeros(texto) {
    const numeros = texto.match(/\d+/g);
    return numeros ? numeros.map(Number) : [];
  }

  /**
   * Verifica se é uma saudação comum
   */
  static ehSaudacao(mensagem) {
    const saudacoes = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'opa', 'e ai', 'testacai'];
    const msg = mensagem.toLowerCase().trim();
    return saudacoes.some(s => msg.includes(s));
  }

  /**
   * Retorna saudação baseada no horário
   */
  static saudacaoDoDia() {
    const hora = new Date().getHours();
    
    if (hora >= 6 && hora < 12) {
      return 'Bom dia';
    } else if (hora >= 12 && hora < 18) {
      return 'Boa tarde';
    } else {
      return 'Boa noite';
    }
  }

  /**
   * Formata uma lista de itens para exibição
   */
  static formatarLista(itens) {
    if (!itens || itens.length === 0) {
      return '(não selecionado)';
    }
    return itens.join(', ');
  }

  /**
   * Formata número de telefone para o padrão do WhatsApp
   */
  static formatarTelefone(numero) {
    return numero.replace('@c.us', '');
  }

  /**
   * E2 (Prompt 6) - Limpa telefone para exibição ao admin
   * Remove @lid, @c.us e qualquer sufixo, deixando apenas números válidos
   * Trata prefixos estranhos como 2360...
   * Formato final: 55XXXXXXXXXXX ou "telefone não reconhecido"
   */
  static limparTelefoneParaAdmin(telefone) {
    if (!telefone) {
      return 'telefone não reconhecido';
    }

    // Remove @lid, @c.us e qualquer sufixo após @
    let limpo = telefone.replace(/@.*$/, '');
    
    // Remove qualquer caractere que não seja número
    limpo = limpo.replace(/\D/g, '');

    // Se começar com prefixo estranho (2360...), tenta extrair o número válido
    // Prefixos estranhos geralmente têm 4+ dígitos antes do número real
    if (limpo.length > 13) {
      // Tenta encontrar padrão brasileiro: 55 + DDD (2 dígitos) + número (8-9 dígitos)
      // Total esperado: 12-13 dígitos
      const padraoBrasileiro = limpo.match(/(55\d{10,11})$/);
      if (padraoBrasileiro) {
        limpo = padraoBrasileiro[1];
      } else {
        // Se não encontrar padrão, pega os últimos 13 dígitos (assumindo 55+DDD+número)
        limpo = limpo.slice(-13);
      }
    }

    // Valida se parece um número brasileiro válido (11-13 dígitos)
    if (limpo.length >= 10 && limpo.length <= 13) {
      return limpo;
    }

    // Se não conseguir inferir, retorna com aviso
    if (limpo.length > 0) {
      return `${limpo} (verificar)`;
    }

    return 'telefone não reconhecido';
  }

  /**
   * E1 (Prompt 6) - Valida se endereço tem vírgulas
   * Prompt 8 - Validação melhorada: verifica se tem pelo menos 3 partes
   * (Bairro, Rua, Número). Ponto de referência é opcional.
   */
  static validarEnderecoComVirgulas(endereco) {
    if (!endereco) return false;
    
    // Verifica se tem vírgulas
    if (!endereco.includes(',')) return false;
    
    // Separa as partes e remove espaços vazios
    const partes = endereco.split(',').map(p => p.trim()).filter(p => p.length > 0);
    
    // Precisa ter pelo menos 3 partes (Bairro, Rua, Número)
    return partes.length >= 3;
  }

  /**
   * Aguarda um tempo em milissegundos
   */
  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Formata data/hora para exibição
   */
  static formatarDataHora(data) {
    return data.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

module.exports = Helpers;
