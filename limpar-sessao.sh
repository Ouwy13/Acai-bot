#!/bin/bash

##############################################################################
# Script de Limpeza de Sessão WhatsApp
# Versão: 1.0
# 
# Use este script para limpar completamente a sessão do WhatsApp e 
# registrar um novo número
##############################################################################

echo ""
echo "=============================================================================="
echo "🧹 LIMPEZA DE SESSÃO DO WHATSAPP"
echo "=============================================================================="
echo ""
echo "⚠️  ATENÇÃO: Este script irá:"
echo "   1. Parar o bot (se estiver rodando)"
echo "   2. Remover TODOS os dados de autenticação do WhatsApp"
echo "   3. Na próxima inicialização, você precisará escanear o QR Code novamente"
echo ""
echo "❌ O banco de dados de clientes NÃO será apagado"
echo ""

read -p "Deseja continuar? (s/N): " confirmacao

if [[ ! "$confirmacao" =~ ^[sS]$ ]]; then
    echo "❌ Operação cancelada"
    exit 0
fi

echo ""
echo "1️⃣ Verificando se o bot está rodando..."
if pm2 describe acai-bot > /dev/null 2>&1; then
    echo "   ⏸️  Bot está rodando, parando..."
    pm2 stop acai-bot
    sleep 3
    echo "   ✅ Bot parado"
else
    echo "   ℹ️  Bot não está rodando"
fi

echo ""
echo "2️⃣ Removendo diretórios de autenticação..."

# Remove diretório de autenticação
if [ -d ".wwebjs_auth" ]; then
    rm -rf .wwebjs_auth
    echo "   ✅ Removido: .wwebjs_auth"
else
    echo "   ℹ️  Diretório .wwebjs_auth não existe"
fi

# Remove cache (se existir)
if [ -d ".wwebjs_cache" ]; then
    rm -rf .wwebjs_cache
    echo "   ✅ Removido: .wwebjs_cache"
else
    echo "   ℹ️  Diretório .wwebjs_cache não existe"
fi

echo ""
echo "3️⃣ Limpando processos do PM2..."
pm2 delete acai-bot 2>/dev/null || true
echo "   ✅ Processo removido do PM2"

echo ""
echo "=============================================================================="
echo "✅ LIMPEZA CONCLUÍDA COM SUCESSO!"
echo "=============================================================================="
echo ""
echo "📱 Para registrar um novo WhatsApp:"
echo "   1. Execute: pm2 start ecosystem.config.js"
echo "   2. Visualize o QR Code: pm2 logs acai-bot"
echo "   3. Escaneie com seu WhatsApp"
echo ""
echo "=============================================================================="
