#!/bin/bash

##############################################################################
# Script de Restart Inteligente do Bot
# Versão: 1.0
# 
# Este script para o bot, limpa a sessão e reinicia automaticamente
# Use este ao invés de "pm2 restart acai-bot"
##############################################################################

echo ""
echo "=============================================================================="
echo "🔄 RESTART INTELIGENTE DO BOT"
echo "=============================================================================="
echo ""
echo "Este script vai:"
echo "   1. Parar o bot"
echo "   2. Limpar a sessão WhatsApp"
echo "   3. Reiniciar o bot"
echo "   4. Você precisará escanear o QR Code novamente"
echo ""

read -p "Deseja continuar? (s/N): " confirmacao

if [[ ! "$confirmacao" =~ ^[sS]$ ]]; then
    echo "❌ Operação cancelada"
    exit 0
fi

echo ""
echo "1️⃣ Parando o bot..."
pm2 stop acai-bot 2>/dev/null
pm2 delete acai-bot 2>/dev/null
echo "   ✅ Bot parado"

echo ""
echo "2️⃣ Limpando sessão WhatsApp..."
rm -rf .wwebjs_auth .wwebjs_cache
echo "   ✅ Sessão limpa"

echo ""
echo "3️⃣ Iniciando bot..."
pm2 start bot.js --name acai-bot
echo "   ✅ Bot iniciado"

echo ""
echo "=============================================================================="
echo "✅ RESTART CONCLUÍDO!"
echo "=============================================================================="
echo ""
echo "📱 Próximos passos:"
echo "   1. Execute: pm2 logs acai-bot"
echo "   2. Aguarde o QR Code aparecer"
echo "   3. Escaneie com seu WhatsApp"
echo "   4. Aguarde: '✅ Bot CONECTADO e pronto para receber mensagens!'"
echo "   5. Teste enviando 'Oi' no WhatsApp"
echo ""
echo "=============================================================================="
