# 🍧 Chatbot WhatsApp - Espaço Açaí & Gelatos

Bot de atendimento automatizado para delivery de açaí via WhatsApp.

## 📋 Versão 2.0.0

### Funcionalidades Principais

- ✅ Atendimento automático via WhatsApp
- ✅ Montagem personalizada de açaí
- ✅ Sistema de FAQ com suporte humano
- ✅ Cliente retornante com histórico
- ✅ Fluxo completo de pagamento (Pix, Dinheiro, Cartão)
- ✅ Gerenciamento de endereço de entrega
- ✅ Detecção de áudio e mídia
- ✅ Estados congelados para suporte e preparo
- ✅ Anti-duplicação de mensagens

## 🚀 Instalação

```bash
cd /home/ubuntu/chatbot_acai_gelatos
npm install
```

## ▶️ Executar

```bash
npm start
```

Escaneie o QR Code que aparece no terminal com seu WhatsApp.

## 🔧 Configurações

Edite o arquivo `config/constants.js`:

```javascript
// Horário de funcionamento
HORARIO: {
  ABERTURA: 16,      // 16h
  FECHAMENTO: 22.5,  // 22h30
}

// Número do admin
ADMIN_NUMBER: '5598970278100@c.us'

// Chave Pix
CHAVE_PIX: '38424116000120'

// Timeouts
TIMEOUTS: {
  PADRAO: 10 * 60 * 1000,   // 10 minutos
  PREPARO: 35 * 60 * 1000,  // 35 minutos
  PAGAMENTO: 10 * 60 * 1000 // 10 minutos
}
```

## 📱 Implementações Técnicas (T1-T8)

### T1 - Detecção de Mensagem do Funcionário
- Identifica `msg.fromMe === true`
- Mensagens do funcionário não disparam respostas automáticas
- Usadas para enviar valor (m1), "👉 Digite 0...", "Ok 👍"

### T2 - Detectar m1 com Valor
- Padrão: "Prontinho ✅🍧\nValor total do pedido: R$ {valor}"
- Aceita: 28, 28,35, 28.35
- Libera cliente de ESPERA_PREPARO → PAGAMENTO

### T3 - Detectar Comprovante Pix
- Detecta imagem ou PDF
- Encaminha para admin
- Aguarda "Ok 👍" para prosseguir

### T5 - Detecção de Áudio
- Responde com mensagem padrão 1 vez
- Repete última pergunta
- Evita spam

### T6 - Estados Congelados
- **CONGELADO_SUPORTE**: Bot mudo até cliente digitar 0
- **ESPERA_PREPARO**: Bot mudo até funcionário enviar m1

### T7 - Timeouts
- 10min: etapas iniciais
- 35min: preparo
- 10min: pagamento (apenas avisa admin)

### T8 - Anti-duplicação
- Ignora mensagens duplicadas por ID
- Evita enviar mensagens iniciais repetidas

## 📦 Fluxo do Pedido

### Fluxo p1 (Montagem)
1. Boas-vindas e nome
2. Envio do cardápio
3. Explicação do funcionamento
4. FAQ (opcional)
5. Montagem: tamanho → açaí → gelatos → frutas → complementos → caldas
6. Adicionar mais açaís (opcional)
7. Revisão do pedido
8. Preparação (ESPERA_PREPARO)

### Fluxo p2 (Pagamento e Entrega)
9. Forma de pagamento
   - 9.1 Pix (comprovante + Ok do admin)
   - 9.2 Dinheiro (troco)
   - 9.3 Cartão (na entrega)
10. Endereço (novo ou salvo)
11. Confirmação final
12. Agradecimento

## 📁 Estrutura do Projeto

```
chatbot_acai_gelatos/
├── bot.js                    # Ponto de entrada
├── config/
│   ├── constants.js          # Configurações e estados
│   └── menu.js               # Cardápio e FAQ
├── services/
│   ├── messageHandler.js     # Lógica de estados
│   ├── stateManager.js       # Gerenciamento de sessões
│   ├── database.js           # Persistência JSON
│   └── validator.js          # Validações
├── utils/
│   ├── helpers.js            # Funções auxiliares
│   └── logger.js             # Sistema de logs
├── images/
│   └── Cardapio.png          # Imagem do cardápio
└── data/
    └── customers.json        # Banco de dados
```

## 🧪 Modo Teste

Digite `testacai` para testar fora do horário de funcionamento.

## 📞 Suporte

- Admin: (98) 97027-8100
- Instagram: @espacoacaiegelatos

## 📝 Changelog

Veja [CHANGELOG.md](CHANGELOG.md) para histórico de alterações.
# Acai-bot
