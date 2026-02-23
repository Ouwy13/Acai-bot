/**
 * Validações de entrada do usuário
 * Versão: 2.5.1 - Prompt 8
 * 
 * Prompt 8:
 * - Validação rigorosa: só aceita números, vírgulas e espaços
 * - Rejeita entradas com letras misturadas (ex: "quero o 1")
 */

const MENU = require('../config/menu');

class Validator {
  /**
   * Valida nome do cliente
   * Deve conter apenas letras, acentos e espaços
   */
  static validarNome(nome) {
    if (!nome || nome.trim().length === 0) {
      return { valido: false, erro: 'Nome vazio' };
    }

    // Remove espaços extras
    const nomeFormatado = nome.trim().replace(/\s+/g, ' ');

    // Verifica se contém apenas letras, acentos e espaços
    const regex = /^[a-zÀ-ÿ\s]+$/i;
    
    if (!regex.test(nomeFormatado)) {
      return { 
        valido: false, 
        erro: 'Nome deve conter apenas letras',
        mensagem: 'Por favor, digite apenas seu nome (sem números ou símbolos).\nEx.: *Maria* ou *José Carlos*' 
      };
    }

    if (nomeFormatado.length < 2) {
      return { 
        valido: false, 
        erro: 'Nome muito curto',
        mensagem: 'Por favor, digite seu nome completo.\nEx.: *Maria Silva*' 
      };
    }

    return { valido: true, nome: nomeFormatado };
  }

  /**
   * Valida seleção de opções numéricas
   * Prompt 8 - Validação rigorosa: só aceita números, vírgulas e espaços
   * Rejeita qualquer entrada que contenha letras ou caracteres inválidos
   * 
   * @param {string} entrada - Entrada do usuário
   * @param {number} maxOpcoes - Número máximo de opções
   * @param {boolean} aceitaMultiplos - Se aceita múltiplas seleções
   * @param {boolean} aceitaZero - Se aceita 0 (pular)
   * @param {boolean} aceitaVoltar - Se aceita 'v' (voltar)
   */
  static validarOpcoes(entrada, maxOpcoes, aceitaMultiplos = true, aceitaZero = true, aceitaVoltar = true) {
    const entradaLimpa = entrada.toLowerCase().trim();

    // Verifica comandos especiais (apenas letra única)
    if (aceitaVoltar && entradaLimpa === 'v') {
      return { valido: true, comando: 'voltar' };
    }

    if (aceitaZero && entradaLimpa === '0') {
      return { valido: true, comando: 'pular' };
    }

    // Verifica 'p' para próxima parte (complementos)
    if (entradaLimpa === 'p') {
      return { valido: true, comando: 'proximo' };
    }

    // Verifica 'a' para parte anterior (complementos)
    if (entradaLimpa === 'a') {
      return { valido: true, comando: 'anterior' };
    }

    // Prompt 8 - Validação rigorosa: só aceita números, vírgulas, espaços e pontos
    // Rejeita qualquer entrada que contenha letras ou caracteres inválidos
    const regexValido = /^[\d,.\s]+$/;
    if (!regexValido.test(entradaLimpa)) {
      return { 
        valido: false, 
        erro: 'Entrada contém caracteres inválidos',
        mensagem: `Por favor, digite apenas o número da opção.\nEx.: *1* ou *1,3,5*`
      };
    }

    // Extrai números
    const numeros = entrada.match(/\d+/g);
    
    if (!numeros || numeros.length === 0) {
      return { 
        valido: false, 
        erro: 'Nenhum número encontrado',
        mensagem: 'Por favor, digite o número da opção desejada.'
      };
    }

    const opcoes = numeros.map(Number);

    // Verifica se aceita múltiplos
    if (!aceitaMultiplos && opcoes.length > 1) {
      return { 
        valido: false, 
        erro: 'Múltiplas opções não permitidas',
        mensagem: 'Por favor, escolha apenas *uma* opção.'
      };
    }

    // Verifica se todas as opções são válidas
    const opcoesInvalidas = opcoes.filter(n => n < 1 || n > maxOpcoes);
    
    if (opcoesInvalidas.length > 0) {
      return { 
        valido: false, 
        erro: 'Opções inválidas: ' + opcoesInvalidas.join(', '),
        mensagem: `Por favor, escolha opções entre *1* e *${maxOpcoes}*.`
      };
    }

    return { valido: true, opcoes };
  }

  /**
   * Prompt 8 - Validação de endereço com campos obrigatórios
   * Verifica se o endereço contém pelo menos 3 partes separadas por vírgula
   * (Bairro, Rua, Número). Ponto de referência é opcional.
   */
  static validarEndereco(endereco) {
    if (!endereco || endereco.trim().length === 0) {
      return { 
        valido: false, 
        erro: 'Endereço vazio',
        mensagem: `Por favor, me envie seu endereço completo separado por vírgulas 🤔\nExemplo: *Bairro, Rua, Número*`
      };
    }

    // Verifica se tem vírgulas
    if (!endereco.includes(',')) {
      return { 
        valido: false, 
        erro: 'Endereço sem vírgulas',
        mensagem: `Para eu registrar certinho, me envie seu endereço separado por vírgulas 🤔\nExemplo: *Bairro, Rua, Número, Referência*`
      };
    }

    // Separa as partes e remove espaços vazios
    const partes = endereco.split(',').map(p => p.trim()).filter(p => p.length > 0);

    // Precisa ter pelo menos 3 partes (Bairro, Rua, Número)
    if (partes.length < 3) {
      return { 
        valido: false, 
        erro: 'Endereço incompleto',
        mensagem: `Seu endereço parece incompleto 🤔\nPreciso de pelo menos: *Bairro, Rua, Número*\nExemplo: *Centro, Rua das Flores, 123*`
      };
    }

    // Verifica se cada parte tem pelo menos 1 caractere significativo
    const partesValidas = partes.filter(p => p.length >= 1);
    if (partesValidas.length < 3) {
      return { 
        valido: false, 
        erro: 'Partes do endereço muito curtas',
        mensagem: `Por favor, informe o endereço completo:\n*Bairro, Rua, Número*\nExemplo: *Centro, Rua das Flores, 123*`
      };
    }

    return { valido: true, endereco: endereco.trim(), partes: partesValidas };
  }

  /**
   * Busca itens do menu pelos IDs selecionados
   */
  static buscarItensPorIds(categoria, ids) {
    const itensMenu = MENU[categoria];
    if (!itensMenu) return [];

    return ids.map(id => {
      const item = itensMenu.find(i => i.id === id);
      return item ? item.nome : null;
    }).filter(Boolean);
  }
}

module.exports = Validator;
