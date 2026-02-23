#!/bin/bash

# ============================================================
# SCRIPT DE INSTALAÇÃO COMPLETA DO CHATBOT AÇAÍ
# Versão: 2.5.3 - Com Reset e Debug da 3ª Via
# ============================================================

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Diretório do projeto
PROJECT_DIR="/root/chatbot_acai"

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     INSTALAÇÃO DO CHATBOT ESPAÇO AÇAÍ & GELATOS v2.5.3    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================
# FUNÇÃO: Verificar se é root
# ============================================================
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}❌ ERRO: Execute este script como root!${NC}"
        echo "   Use: sudo ./install_contabo.sh"
        exit 1
    fi
    echo -e "${GREEN}✅ Executando como root${NC}"
}

# ============================================================
# FUNÇÃO: Perguntar se quer fazer reset
# ============================================================
ask_reset() {
    echo ""
    echo -e "${YELLOW}⚠️  RESET COMPLETO${NC}"
    echo "   Deseja fazer um reset completo do sistema antes de instalar?"
    echo "   (Recomendado se houver problemas com instalação anterior)"
    echo ""
    read -p "   Fazer reset? (s/N): " reset_choice
    
    if [[ "$reset_choice" =~ ^[Ss]$ ]]; then
        do_reset
    else
        echo -e "${BLUE}ℹ️  Pulando reset...${NC}"
    fi
}

# ============================================================
# FUNÇÃO: Reset completo
# ============================================================
do_reset() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  ETAPA 0: RESET COMPLETO DO SISTEMA${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    echo -e "${YELLOW}🔄 Parando PM2...${NC}"
    pm2 stop all 2>/dev/null
    pm2 delete all 2>/dev/null
    pm2 kill 2>/dev/null
    
    echo -e "${YELLOW}🔄 Matando processos Node.js...${NC}"
    pkill -f node 2>/dev/null
    
    echo -e "${YELLOW}🔄 Matando processos Chromium...${NC}"
    pkill -f chromium 2>/dev/null
    pkill -f chrome 2>/dev/null
    
    echo -e "${YELLOW}🔄 Removendo PM2...${NC}"
    npm uninstall -g pm2 2>/dev/null
    
    echo -e "${YELLOW}🔄 Removendo Node.js...${NC}"
    apt remove nodejs -y 2>/dev/null
    apt purge nodejs -y 2>/dev/null
    apt autoremove -y 2>/dev/null
    
    echo -e "${YELLOW}🔄 Removendo NodeSource...${NC}"
    rm -rf /etc/apt/sources.list.d/nodesource.list 2>/dev/null
    rm -rf /usr/local/lib/node_modules 2>/dev/null
    rm -rf /usr/local/bin/node 2>/dev/null
    rm -rf /usr/local/bin/npm 2>/dev/null
    rm -rf /usr/local/bin/npx 2>/dev/null
    
    echo -e "${YELLOW}🔄 Limpando cache...${NC}"
    rm -rf ~/.npm 2>/dev/null
    apt clean 2>/dev/null
    apt autoclean 2>/dev/null
    
    echo -e "${GREEN}✅ Reset completo finalizado!${NC}"
    sleep 2
}

# ============================================================
# ETAPA 1: Verificações iniciais
# ============================================================
step_1_checks() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  ETAPA 1: VERIFICAÇÕES INICIAIS${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    check_root
    
    # Verificar conexão com internet
    echo -e "${YELLOW}🔍 Verificando conexão com internet...${NC}"
    if ping -c 1 google.com &> /dev/null; then
        echo -e "${GREEN}✅ Conexão com internet OK${NC}"
    else
        echo -e "${RED}❌ Sem conexão com internet!${NC}"
        exit 1
    fi
}

# ============================================================
# ETAPA 2: Atualizar sistema
# ============================================================
step_2_update() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  ETAPA 2: ATUALIZANDO SISTEMA${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    echo -e "${YELLOW}🔄 Atualizando lista de pacotes...${NC}"
    apt update -y
    
    echo -e "${YELLOW}🔄 Atualizando pacotes instalados...${NC}"
    DEBIAN_FRONTEND=noninteractive apt upgrade -y
    
    echo -e "${GREEN}✅ Sistema atualizado!${NC}"
}

# ============================================================
# ETAPA 3: Instalar Node.js 18.x
# ============================================================
step_3_nodejs() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  ETAPA 3: INSTALANDO NODE.JS 18.x${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Instalar curl
    echo -e "${YELLOW}🔄 Instalando curl...${NC}"
    apt install curl -y
    
    # NodeSource
    echo -e "${YELLOW}🔄 Configurando NodeSource...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    
    # Instalar Node.js
    echo -e "${YELLOW}🔄 Instalando Node.js...${NC}"
    apt install nodejs -y
    
    # Verificar
    NODE_VERSION=$(node -v 2>/dev/null)
    NPM_VERSION=$(npm -v 2>/dev/null)
    
    if [[ $NODE_VERSION == v18* ]]; then
        echo -e "${GREEN}✅ Node.js instalado: $NODE_VERSION${NC}"
        echo -e "${GREEN}✅ NPM instalado: $NPM_VERSION${NC}"
    else
        echo -e "${RED}❌ ERRO: Node.js não foi instalado corretamente!${NC}"
        echo "   Versão encontrada: $NODE_VERSION"
        echo "   Esperado: v18.x.x"
        exit 1
    fi
}

# ============================================================
# ETAPA 4: Instalar dependências do Chromium
# ============================================================
step_4_chromium() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  ETAPA 4: INSTALANDO DEPENDÊNCIAS DO CHROMIUM${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    echo -e "${YELLOW}🔄 Instalando Chromium e bibliotecas...${NC}"
    
    apt install -y \
        chromium-browser \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        xdg-utils \
        fonts-liberation
    
    # Verificar Chromium
    CHROMIUM_VERSION=$(chromium-browser --version 2>/dev/null)
    
    if [[ -n "$CHROMIUM_VERSION" ]]; then
        echo -e "${GREEN}✅ Chromium instalado: $CHROMIUM_VERSION${NC}"
    else
        echo -e "${YELLOW}⚠️  Chromium pode não estar no PATH, mas deve funcionar${NC}"
    fi
}

# ============================================================
# ETAPA 5: Verificar projeto
# ============================================================
step_5_project() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  ETAPA 5: VERIFICANDO PROJETO${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ -d "$PROJECT_DIR" ]; then
        echo -e "${GREEN}✅ Diretório do projeto encontrado: $PROJECT_DIR${NC}"
        
        # Verificar arquivos essenciais
        if [ -f "$PROJECT_DIR/bot.js" ]; then
            echo -e "${GREEN}✅ bot.js encontrado${NC}"
        else
            echo -e "${RED}❌ bot.js NÃO encontrado!${NC}"
            exit 1
        fi
        
        if [ -f "$PROJECT_DIR/package.json" ]; then
            echo -e "${GREEN}✅ package.json encontrado${NC}"
        else
            echo -e "${RED}❌ package.json NÃO encontrado!${NC}"
            exit 1
        fi
        
        if [ -d "$PROJECT_DIR/services" ]; then
            echo -e "${GREEN}✅ Pasta services encontrada${NC}"
        else
            echo -e "${RED}❌ Pasta services NÃO encontrada!${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ ERRO: Projeto não encontrado em $PROJECT_DIR${NC}"
        echo ""
        echo "   Por favor, faça upload do projeto via SFTP para:"
        echo "   $PROJECT_DIR"
        echo ""
        exit 1
    fi
}

# ============================================================
# ETAPA 6: Instalar dependências do projeto
# ============================================================
step_6_npm_install() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  ETAPA 6: INSTALANDO DEPENDÊNCIAS DO PROJETO${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    cd "$PROJECT_DIR"
    
    echo -e "${YELLOW}🔄 Executando npm install...${NC}"
    npm install
    
    if [ -d "$PROJECT_DIR/node_modules" ]; then
        echo -e "${GREEN}✅ node_modules criado com sucesso!${NC}"
    else
        echo -e "${RED}❌ ERRO: node_modules não foi criado!${NC}"
        exit 1
    fi
    
    if [ -d "$PROJECT_DIR/node_modules/whatsapp-web.js" ]; then
        echo -e "${GREEN}✅ whatsapp-web.js instalado${NC}"
    else
        echo -e "${RED}❌ ERRO: whatsapp-web.js não foi instalado!${NC}"
        exit 1
    fi
}

# ============================================================
# ETAPA 7: Instalar PM2
# ============================================================
step_7_pm2() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  ETAPA 7: INSTALANDO PM2${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    echo -e "${YELLOW}🔄 Instalando PM2 globalmente...${NC}"
    npm install -g pm2
    
    PM2_VERSION=$(pm2 -v 2>/dev/null)
    
    if [[ -n "$PM2_VERSION" ]]; then
        echo -e "${GREEN}✅ PM2 instalado: v$PM2_VERSION${NC}"
    else
        echo -e "${RED}❌ ERRO: PM2 não foi instalado!${NC}"
        exit 1
    fi
}

# ============================================================
# ETAPA 8: Verificar configuração do admin
# ============================================================
step_8_check_admin() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  ETAPA 8: VERIFICANDO CONFIGURAÇÃO DO ADMIN${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    ADMIN_LINE=$(grep "ADMIN_NUMBER" "$PROJECT_DIR/config/constants.js" | head -1)
    
    echo -e "${YELLOW}📱 Número do admin configurado:${NC}"
    echo "   $ADMIN_LINE"
    echo ""
    
    if [[ "$ADMIN_LINE" == *"999999999"* ]]; then
        echo -e "${RED}⚠️  ATENÇÃO: O número do admin parece não ter sido configurado!${NC}"
        echo ""
        echo "   Edite o arquivo: $PROJECT_DIR/config/constants.js"
        echo "   Altere ADMIN_NUMBER para seu número real"
        echo ""
    else
        echo -e "${GREEN}✅ Número do admin parece estar configurado${NC}"
    fi
}

# ============================================================
# RESUMO FINAL
# ============================================================
show_summary() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    INSTALAÇÃO CONCLUÍDA!                   ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}✅ VERSÕES INSTALADAS:${NC}"
    echo "   Node.js: $(node -v)"
    echo "   NPM: $(npm -v)"
    echo "   PM2: $(pm2 -v)"
    echo "   Chromium: $(chromium-browser --version 2>/dev/null || echo 'instalado')"
    echo ""
    echo -e "${YELLOW}📋 PRÓXIMOS PASSOS:${NC}"
    echo ""
    echo "   1. VERIFICAR NÚMERO DO ADMIN:"
    echo "      nano $PROJECT_DIR/config/constants.js"
    echo ""
    echo "   2. TESTAR O BOT (modo manual):"
    echo "      cd $PROJECT_DIR"
    echo "      npm start"
    echo "      (Escaneie o QR Code e teste as 3 vias)"
    echo "      (Ctrl+C para parar)"
    echo ""
    echo "   3. INICIAR COM PM2 (24/7):"
    echo "      cd $PROJECT_DIR"
    echo "      pm2 start ecosystem.config.js"
    echo "      pm2 save"
    echo "      pm2 startup"
    echo ""
    echo "   4. VER LOGS:"
    echo "      pm2 logs chatbot-acai"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  Guia completo em: $PROJECT_DIR/Guia/GUIA_RESET_DEPLOY_COMPLETO.md${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# ============================================================
# EXECUÇÃO PRINCIPAL
# ============================================================
main() {
    step_1_checks
    ask_reset
    step_2_update
    step_3_nodejs
    step_4_chromium
    step_5_project
    step_6_npm_install
    step_7_pm2
    step_8_check_admin
    show_summary
}

# Executar
main
