/**
 * Sistema de persistência em JSON
 * Versão: 2.5.1 - Prompt 8
 * 
 * E4 (Prompt 6) - Persistência imediata:
 * - Salvar IMEDIATAMENTE ao coletar/atualizar dados
 * - Não depender de "salvar no final"
 * - Reconstruir cliente pelo telefone ao reiniciar
 * 
 * Prompt 7 - Novos campos:
 * - forma_entrega: 'delivery' ou 'retirada'
 * - regiao_entrega: 'Centro', 'Arredores' ou 'Zé Gomes'
 * - taxa_entrega: valor numérico da taxa
 * 
 * Prompt 8 - Novos campos:
 * - pedidos_confirmados: contagem de pedidos confirmados pelo cliente
 * 
 * Campos permitidos:
 * - primeiro_nome
 * - nome_completo
 * - endereco
 * - ultimo_pedido (sobrescrever, não histórico)
 * - pedidos_confirmados (contagem incremental)
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/customers.json');

class Database {
  constructor() {
    this.data = this.load();
  }

  _resolverChaveTelefone(telefone) {
    if (!telefone) return null;

    if (this.data[telefone]) return telefone;

    if (telefone.includes('@lid')) {
      const alt = telefone.replace('@lid', '@c.us');
      if (this.data[alt]) return alt;
    }

    if (telefone.includes('@c.us')) {
      const alt = telefone.replace('@c.us', '@lid');
      if (this.data[alt]) return alt;
    }

    const base = String(telefone).replace(/@.*$/, '').replace(/\D/g, '');
    if (!base) return null;

    const keys = Object.keys(this.data);
    for (const key of keys) {
      const keyBase = String(key).replace(/@.*$/, '').replace(/\D/g, '');
      if (keyBase === base) {
        return key;
      }
    }

    return null;
  }

  /**
   * Carrega dados do arquivo JSON
   */
  load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const rawData = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(rawData);
      }
      return {};
    } catch (erro) {
      console.error('Erro ao carregar banco de dados:', erro);
      return {};
    }
  }

  /**
   * E4 - Salva dados no arquivo JSON IMEDIATAMENTE
   * Chamado em cada operação crítica
   */
  save() {
    try {
      // Garante que o diretório existe
      const dirPath = path.dirname(DB_PATH);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf8');
      console.log(`💾 BD salvo: ${Object.keys(this.data).length} clientes`);
      return true;
    } catch (erro) {
      console.error('❌ Erro ao salvar banco de dados:', erro);
      return false;
    }
  }

  /**
   * Busca cliente por telefone
   * E4 - Usado para reconstruir cliente ao reiniciar
   */
  getCliente(telefone) {
    const chave = this._resolverChaveTelefone(telefone);
    return chave ? (this.data[chave] || null) : null;
  }

  /**
   * Verifica se é cliente novo
   */
  isClienteNovo(telefone) {
    return !this.getCliente(telefone);
  }

  /**
   * E3 (Prompt 6) - Verifica se é cliente antigo
   * Cliente antigo = existe no BD com nome e/ou endereço e/ou último pedido
   */
  isClienteAntigo(telefone) {
    const cliente = this.getCliente(telefone);
    if (!cliente) return false;
    
    // Cliente antigo se tem qualquer dado persistido
    return !!(cliente.primeiro_nome || cliente.nome_completo || 
              cliente.endereco || cliente.ultimo_pedido);
  }

  /**
   * E4 - Cria novo cliente (salva IMEDIATAMENTE)
   * Prompt 8 - Inclui pedidos_confirmados
   */
  criarCliente(telefone, nome, primeiroNome) {
    this.data[telefone] = {
      primeiro_nome: primeiroNome,
      nome_completo: nome,
      endereco: null,
      ultimo_pedido: null,
      pedidos_confirmados: 0,
      pagamento_retirada_explicado: false,
    };
    
    // E4 - Salvar IMEDIATAMENTE ao receber nome
    this.save();
    console.log(`✅ Cliente criado e salvo: ${primeiroNome} (${telefone})`);
    
    return this.data[telefone];
  }

  /**
   * E4 - Atualiza informações do cliente (salva IMEDIATAMENTE)
   * Prompt 8 - pedidos_confirmados nos campos permitidos
   */
  atualizarCliente(telefone, dados) {
    const chave = this._resolverChaveTelefone(telefone) || telefone;
    if (this.data[chave]) {
      // Permitir apenas campos autorizados
      const camposPermitidos = ['primeiro_nome', 'nome_completo', 'endereco', 'ultimo_pedido', 'pedidos_confirmados', 'pagamento_retirada_explicado'];
      
      for (const campo of camposPermitidos) {
        if (dados[campo] !== undefined) {
          this.data[chave][campo] = dados[campo];
        }
      }
      
      // E4 - Salvar IMEDIATAMENTE após qualquer atualização
      this.save();
      console.log(`✅ Cliente atualizado: ${telefone} - campos: ${Object.keys(dados).join(', ')}`);
      
      return this.data[chave];
    }
    return null;
  }

  /**
   * E4 - Atualiza nome do cliente (ponto crítico de salvamento)
   */
  atualizarNome(telefone, nomeCompleto, primeiroNome) {
    const chave = this._resolverChaveTelefone(telefone) || telefone;
    if (this.data[chave]) {
      this.data[chave].primeiro_nome = primeiroNome;
      this.data[chave].nome_completo = nomeCompleto;
      
      // E4 - Salvar IMEDIATAMENTE ao alterar nome
      this.save();
      console.log(`✅ Nome atualizado: ${primeiroNome} (${telefone})`);
      
      return this.data[chave];
    }
    return null;
  }

  /**
   * E4 - Atualiza endereço do cliente (ponto crítico de salvamento)
   */
  atualizarEndereco(telefone, endereco) {
    const chave = this._resolverChaveTelefone(telefone) || telefone;
    if (this.data[chave]) {
      this.data[chave].endereco = endereco;
      
      // E4 - Salvar IMEDIATAMENTE ao confirmar endereço
      this.save();
      console.log(`✅ Endereço salvo: ${endereco.substring(0, 30)}... (${telefone})`);
      
      return this.data[chave];
    }
    return null;
  }

  /**
   * E4 - Salva último pedido (ponto crítico de salvamento)
   * Prompt 7 - Inclui forma_entrega, regiao_entrega e taxa_entrega
   * Prompt 8 - Incrementa pedidos_confirmados
   */
  salvarUltimoPedido(telefone, pedido) {
    const chave = this._resolverChaveTelefone(telefone) || telefone;
    if (this.data[chave]) {
      // Cria resumo do pedido
      const resumoPedido = {
        data: new Date().toISOString(),
        carrinho: pedido.carrinho,
        forma_entrega: pedido.forma_entrega || null,
        regiao_entrega: pedido.regiao_entrega || null,
        taxa_entrega: pedido.taxa_entrega || null,
      };
      
      // Sobrescreve ultimo_pedido (não mantém histórico)
      this.data[chave].ultimo_pedido = resumoPedido;
      
      // E4 - Salvar IMEDIATAMENTE ao confirmar pedido
      this.save();
      console.log(`✅ Último pedido salvo: ${pedido.carrinho?.length || 0} itens | Entrega: ${pedido.forma_entrega || 'N/A'} (${telefone})`);
      
      return true;
    }
    return false;
  }

  /**
   * Prompt 8 - Incrementa contagem de pedidos confirmados
   */
  incrementarPedidosConfirmados(telefone) {
    const chave = this._resolverChaveTelefone(telefone) || telefone;
    if (!this.data[chave]) return false;

    if (typeof this.data[chave].pedidos_confirmados !== 'number') {
      this.data[chave].pedidos_confirmados = 0;
    }
    this.data[chave].pedidos_confirmados += 1;

    this.save();
    console.log(`✅ pedidos_confirmados incrementado: ${this.data[chave].pedidos_confirmados} (${telefone})`);
    return true;
  }

  /**
   * Prompt 8 - Retorna quantidade de pedidos confirmados
   */
  getPedidosConfirmados(telefone) {
    const cliente = this.getCliente(telefone);
    if (cliente && typeof cliente.pedidos_confirmados === 'number') {
      return cliente.pedidos_confirmados;
    }
    return 0;
  }

  /**
   * Busca último pedido do cliente (para repetir pedido)
   */
  getUltimoPedido(telefone) {
    const cliente = this.getCliente(telefone);
    if (cliente && cliente.ultimo_pedido) {
      return cliente.ultimo_pedido;
    }
    return null;
  }

  /**
   * Verifica se cliente tem pedido anterior (para menu de cliente retornante)
   * Prompt 10 - Verificação robusta: null, undefined e objeto válido
   */
  temPedidoAnterior(telefone) {
    const cliente = this.getCliente(telefone);
    
    // Cliente não existe
    if (!cliente) {
      console.log(`[DB] temPedidoAnterior(${telefone}): false - cliente não existe`);
      return false;
    }
    
    // Verifica se ultimo_pedido existe, não é null, não é undefined e tem dados
    const ultimoPedido = cliente.ultimo_pedido;
    
    // null ou undefined
    if (ultimoPedido === null || ultimoPedido === undefined) {
      console.log(`[DB] temPedidoAnterior(${telefone}): false - ultimo_pedido é ${ultimoPedido}`);
      return false;
    }
    
    // Objeto vazio {}
    if (typeof ultimoPedido === 'object' && Object.keys(ultimoPedido).length === 0) {
      console.log(`[DB] temPedidoAnterior(${telefone}): false - ultimo_pedido é objeto vazio`);
      return false;
    }
    
    // Tem carrinho válido?
    if (!ultimoPedido.carrinho || !Array.isArray(ultimoPedido.carrinho) || ultimoPedido.carrinho.length === 0) {
      console.log(`[DB] temPedidoAnterior(${telefone}): false - carrinho inválido ou vazio`);
      return false;
    }
    
    console.log(`[DB] temPedidoAnterior(${telefone}): true - pedido válido com ${ultimoPedido.carrinho.length} itens`);
    return true;
  }

  /**
   * Migração: Converte dados antigos para o novo formato
   * Prompt 8 - Inicializa pedidos_confirmados para clientes existentes
   */
  migrarParaNovoFormato() {
    let alterado = false;
    
    for (const telefone in this.data) {
      const cliente = this.data[telefone];
      
      // Se tem array de pedidos (formato antigo), pega o último
      if (cliente.pedidos && Array.isArray(cliente.pedidos)) {
        if (cliente.pedidos.length > 0) {
          cliente.ultimo_pedido = cliente.pedidos[cliente.pedidos.length - 1];
        }
        delete cliente.pedidos;
        alterado = true;
      }
      
      // Prompt 8 - Inicializa pedidos_confirmados se não existe
      if (typeof cliente.pedidos_confirmados !== 'number') {
        // Se já tem ultimo_pedido, assume que fez pelo menos 1 pedido
        cliente.pedidos_confirmados = cliente.ultimo_pedido ? 1 : 0;
        alterado = true;
      }
      
      // Remove campos não permitidos
      const camposPermitidos = ['primeiro_nome', 'nome_completo', 'endereco', 'ultimo_pedido', 'pedidos_confirmados', 'pagamento_retirada_explicado'];
      for (const campo in cliente) {
        if (!camposPermitidos.includes(campo)) {
          delete cliente[campo];
          alterado = true;
        }
      }
    }
    
    if (alterado) {
      this.save();
      console.log('✅ Banco de dados migrado para formato Prompt 8 (pedidos_confirmados)');
    }
    
    return alterado;
  }

  /**
   * E4 - Flush de segurança (chamado em SIGINT/SIGTERM)
   * Tenta garantir que dados não sejam perdidos
   */
  flushSeguranca() {
    try {
      this.save();
      console.log('💾 Flush de segurança executado');
      return true;
    } catch (erro) {
      console.error('❌ Erro no flush de segurança:', erro);
      return false;
    }
  }
}

// Instância única
const database = new Database();

// Executa migração na inicialização
database.migrarParaNovoFormato();

module.exports = database;
