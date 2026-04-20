#!/usr/bin/env bash
# =============================================================================
#  commits.sh — Sistema Bússola
#  Script de commit e push completo para o repositório GitHub
#
#  Uso:
#    chmod +x commits.sh
#    ./commits.sh
#
#  O script assume que você já executou:
#    git init
#    git remote add origin https://github.com/SEU_USUARIO/sistema-bussola.git
# =============================================================================

set -e  # Aborta se qualquer comando falhar

# ── Cores para output ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RESET='\033[0m'

log()  { echo -e "${CYAN}[bussola]${RESET} $1"; }
ok()   { echo -e "${GREEN}[ok]${RESET} $1"; }
warn() { echo -e "${YELLOW}[warn]${RESET} $1"; }
err()  { echo -e "${RED}[erro]${RESET} $1"; exit 1; }

log "Iniciando sequência de commits — Sistema Bússola v2.0.0"
echo ""

# ── Verificações iniciais ────────────────────────────────────────────────────
command -v git >/dev/null 2>&1 || err "Git não encontrado. Instale o git e tente novamente."

if [ ! -d ".git" ]; then
  warn "Repositório git não inicializado. Inicializando..."
  git init
  git branch -M main
fi

# ── Configuração de identidade (descomente e edite se necessário) ─────────────
# git config user.name  "Seu Nome"
# git config user.email "seu@email.com"

# =============================================================================
# 1. INFRAESTRUTURA — .gitignore
# =============================================================================
log "1/10  Commitando infraestrutura do repositório..."

git add .gitignore

git commit -m "chore(repo): add .gitignore for Sistema Bussola" \
  -m "Configures git to ignore sensitive files, local environment artifacts," \
  -m "development tooling and OS-specific noise." \
  -m "" \
  -m "Ignored categories:" \
  -m "- commits.sh (deployment script — not part of the web app)" \
  -m "- node_modules/ and package-lock.json (dev tools only)" \
  -m "- .env and .env.local (never commit credentials)" \
  -m "- OS files: .DS_Store (macOS), Thumbs.db (Windows)" \
  -m "- Editor configs: .vscode/, .idea/" \
  -m "- Build artifacts and temporary files"

ok "Infraestrutura commitada."
echo ""

# =============================================================================
# 2. DESIGN SYSTEM — style.css e utils.js
# =============================================================================
log "2/10  Commitando design system e utilitários globais..."

git add style.css utils.js

git commit -m "feat(design-system): add global CSS design system and JS utilities" \
  -m "Introduces the complete design system for Sistema Bussola, replacing the" \
  -m "previous chaotic 700-line CSS with a clean, token-based architecture." \
  -m "" \
  -m "style.css changes:" \
  -m "- Full dark theme with CSS custom properties (tokens)" \
  -m "- Color palette: navy bg, teal accent (#06b6d4), semantic red/green/amber" \
  -m "- Typography: Sora (display) + JetBrains Mono (numbers) via Google Fonts" \
  -m "- Components: navbar, cards, forms, tables, badges, flash messages," \
  -m "  dashboard grid, stats bar, saldo display, report grid" \
  -m "- Responsive breakpoints at 600px and 900px" \
  -m "- Custom scrollbar, focus rings, fade-in animation" \
  -m "" \
  -m "utils.js additions:" \
  -m "- requireAuth(): session guard — redirects to login if unauthenticated" \
  -m "- flash(msg, type): inline toast notification system" \
  -m "- brl(v): BRL currency formatter using Intl.NumberFormat" \
  -m "- fmtDate(d): ISO date to pt-BR dd/mm/yyyy" \
  -m "- MESES[]: month name lookup array"

ok "Design system commitado."
echo ""

# =============================================================================
# 3. BACKEND CLIENT — supabase.js
# =============================================================================
log "3/10  Commitando configuração do cliente Supabase..."

git add supabase.js

git commit -m "feat(backend): add Supabase client configuration" \
  -m "Initializes the Supabase JS SDK v2 client with the project URL and" \
  -m "anonymous key. Auth options configured for session persistence and" \
  -m "automatic token refresh." \
  -m "" \
  -m "Note: The anon key is safe to expose in frontend code — it is" \
  -m "restricted by Supabase Row Level Security (RLS) policies. Never" \
  -m "commit the service_role key."

ok "Cliente Supabase commitado."
echo ""

# =============================================================================
# 4. AUTENTICAÇÃO — index.html e cadastro.html
# =============================================================================
log "4/10  Commitando módulo de autenticação..."

git add index.html cadastro.html

git commit -m "feat(auth): add login and registration pages" \
  -m "Implements the authentication module for Sistema Bussola." \
  -m "" \
  -m "index.html (Login):" \
  -m "- Email/password login via supabase.auth.signInWithPassword()" \
  -m "- Google OAuth via supabase.auth.signInWithOAuth()" \
  -m "- Auto-redirect to dashboard if session already active" \
  -m "- Enter key submits form; inline loading spinner on button" \
  -m "- User-friendly error messages (distinguishes invalid credentials)" \
  -m "" \
  -m "cadastro.html (Registration):" \
  -m "- Email/password account creation via supabase.auth.signUp()" \
  -m "- Password confirmation field with client-side validation" \
  -m "- Minimum 6-character password enforcement" \
  -m "- Google OAuth registration support" \
  -m "- Redirects to login after successful registration" \
  -m "" \
  -m "Fulfills UC-001, UC-002, UC-003 (Especialidade AP-052 req. 4.2)."

ok "Autenticação commitada."
echo ""

# =============================================================================
# 5. DASHBOARD — dashboard.html
# =============================================================================
log "5/10  Commitando painel de controle..."

git add dashboard.html

git commit -m "feat(dashboard): add main control panel with live stats" \
  -m "Adds the central dashboard page, the primary navigation hub after login." \
  -m "" \
  -m "Features:" \
  -m "- Live stats bar: total units, total pathfinders, open fees, cash balance" \
  -m "- All stats loaded in parallel with Promise.all() for performance" \
  -m "- Cash balance color-coded (green = positive, red = negative)" \
  -m "- Navigation grid with 9 cards: Units, Pathfinders, Monthly Fees, Cash," \
  -m "  Patrimony, Minutes/Acts, Counselors, Specialties, Reports, Logout" \
  -m "- Session guard via requireAuth() — redirects to login if unauthenticated" \
  -m "- Displays logged-in user email in navbar" \
  -m "- Logout clears Supabase session and redirects to index.html" \
  -m "" \
  -m "Fulfills UC-004 and provides navigation for all UC-005 through UC-016."

ok "Dashboard commitado."
echo ""

# =============================================================================
# 6. MÓDULOS DE CADASTRO
# =============================================================================
log "6/10  Commitando módulos de cadastro..."

git add conselheiro.html unidade.html desbravador.html \
        perfil-desbravador.html especialidades.html

git commit -m "feat(cadastros): add counselors, units, pathfinders and specialties modules" \
  -m "Implements the four core registration modules of Sistema Bussola." \
  -m "" \
  -m "conselheiro.html:" \
  -m "- Full CRUD for club counselors (name, phone, email)" \
  -m "- Required prerequisite before registering units" \
  -m "" \
  -m "unidade.html:" \
  -m "- Full CRUD for units (name, head counselor, up to 2 associates)" \
  -m "- Inline edit mode with cancel button" \
  -m "- Supabase JOIN query: unidade + conselheiro (x3 roles)" \
  -m "" \
  -m "desbravador.html:" \
  -m "- Full CRUD for pathfinder members" \
  -m "- Fields: name, birth date, contact, unit, class, specialties" \
  -m "- Real-time name search filter" \
  -m "- Specialties synced via desbravador_especialidade pivot table" \
  -m "- On delete: cascades to mensalidade and desbravador_especialidade" \
  -m "- Link to individual profile page" \
  -m "" \
  -m "perfil-desbravador.html:" \
  -m "- Read-only profile view for a single pathfinder" \
  -m "- Displays: personal data, unit, class, specialties, payment history" \
  -m "- ID passed via URL query parameter (?id=uuid)" \
  -m "" \
  -m "especialidades.html:" \
  -m "- Full CRUD for specialty catalog" \
  -m "- Displays count of pathfinders per specialty" \
  -m "- One-click import of 30 standard DSA specialties" \
  -m "- Real-time name search filter" \
  -m "" \
  -m "Fulfills UC-005 through UC-008 and AP-052 req. 4.1.1."

ok "Módulos de cadastro commitados."
echo ""

# =============================================================================
# 7. MÓDULOS FINANCEIROS
# =============================================================================
log "7/10  Commitando módulos financeiros..."

git add mensalidade.html caixa.html

git commit -m "feat(financeiro): add monthly fees and cash control modules" \
  -m "Implements the two financial control modules of Sistema Bussola." \
  -m "" \
  -m "mensalidade.html:" \
  -m "- Register fees by pathfinder, month (name selector) and year" \
  -m "- Year field pre-filled with current year" \
  -m "- Toggle paid/unpaid status directly from the table row" \
  -m "- Dual filter: by pathfinder AND by status (all / paid / open)" \
  -m "- Color-coded status badges (green = paid, red = open)" \
  -m "" \
  -m "caixa.html:" \
  -m "- Register entries and exits with type, description, value and date" \
  -m "- Date field pre-filled with today" \
  -m "- Live summary bar: total entries, total exits, current balance" \
  -m "- Balance color changes: green (positive) / red (negative)" \
  -m "- Dual filter: by type AND by month (month picker)" \
  -m "- Values displayed with sign prefix (+ / -) and semantic color" \
  -m "" \
  -m "Fulfills UC-009 through UC-011 and AP-052 req. 4.1.2, 4.1.3, 4.1.4."

ok "Módulos financeiros commitados."
echo ""

# =============================================================================
# 8. MÓDULOS ADMINISTRATIVOS
# =============================================================================
log "8/10  Commitando módulos administrativos..."

git add patrimonio.html atas_atos.html

git commit -m "feat(administrativo): add patrimony and minutes/acts modules" \
  -m "Implements the two administrative record-keeping modules." \
  -m "" \
  -m "patrimonio.html:" \
  -m "- Full CRUD for patrimonial items (name, quantity, condition, unit)" \
  -m "- Condition options: Novo, Bom, Usado, Danificado, Descartado" \
  -m "- Color-coded condition badges" \
  -m "- Optional unit assignment per item" \
  -m "- Real-time name search filter" \
  -m "" \
  -m "atas_atos.html:" \
  -m "- Full CRUD for official club records (atas and atos)" \
  -m "- Separate Supabase tables: atas (meeting minutes) / atos (admin acts)" \
  -m "- Type-switch on edit: migrates record to correct table if type changes" \
  -m "- Tab filter: All / Atas only / Atos only" \
  -m "- Inline preview modal: full content display without navigation" \
  -m "- Cards show 2-line content preview with CSS line-clamp" \
  -m "" \
  -m "Fulfills UC-012, UC-013 and AP-052 req. 4.1.5, 4.1.6, 4.1.7."

ok "Módulos administrativos commitados."
echo ""

# =============================================================================
# 9. RELATÓRIOS
# =============================================================================
log "9/10  Commitando central de relatórios..."

git add relatorios.html

git commit -m "feat(relatorios): add PDF report generation module — 6 report types" \
  -m "Implements the full reporting module using jsPDF 2.5.1 + jsPDF-AutoTable" \
  -m "3.5.31, with all PDF generation executed client-side in the browser." \
  -m "" \
  -m "Reports implemented:" \
  -m "" \
  -m "1. Autorizacao de Saida (UC-014 / AP-052 req. 4.1.8)" \
  -m "   - Filtered by unit; table with signature field; footer with sign lines" \
  -m "" \
  -m "2. Fluxo de Caixa (UC-015 / AP-052 req. 4.1.9)" \
  -m "   - Summary boxes: total entries, exits, balance (color-coded)" \
  -m "   - Full transaction table ordered by date" \
  -m "" \
  -m "3. Patrimonio (AP-052 req. 4.1.10)" \
  -m "   - Complete inventory table with item count summary footer" \
  -m "" \
  -m "4. Livro de Atas e Atos (AP-052 req. 4.1.11)" \
  -m "   - Index table + dedicated page per record with full content" \
  -m "" \
  -m "5. Mensalidades (AP-052 req. 4.1.12)" \
  -m "   - Summary header + color-coded status column via didParseCell hook" \
  -m "" \
  -m "6. Relatorio Geral (UC-016 / AP-052 req. 4.1.13)" \
  -m "   - Four sections: Units, Classes, Specialties, Pathfinders" \
  -m "" \
  -m "All PDFs: teal branded header, page footer with page/total, timestamp."

ok "Relatórios commitados."
echo ""

# =============================================================================
# 10. DOCUMENTAÇÃO
# =============================================================================
log "10/10  Commitando documentação..."

git add README.md

git commit -m "docs(readme): add comprehensive project README" \
  -m "Adds the main README.md for Sistema Bussola with full setup guide." \
  -m "" \
  -m "Contents:" \
  -m "- Feature table: all 8 modules described" \
  -m "- Tech stack: HTML5, CSS3, JS ES2022, Supabase, jsPDF, Sora font" \
  -m "- Full project file structure tree (19 files)" \
  -m "- Supabase setup: complete SQL schema for all 13 tables" \
  -m "- Credential configuration and deploy instructions" \
  -m "- Google OAuth optional setup steps" \
  -m "- Especialidade AP-052 coverage checklist (13/13 req. met)" \
  -m "- JavaScript language history section"

# ── Docs formais (se existirem) ──────────────────────────────────────────────
if [ -d "docs" ] && [ "$(ls -A docs/ 2>/dev/null)" ]; then

  for f in \
    "docs/Sistema_Bussola_Documento_de_Visao.docx" \
    "docs/Sistema_Bussola_Documento_de_Visao.pdf"; do
    [ -f "$f" ] && git add "$f"
  done
  git diff --cached --quiet || git commit \
    -m "docs(visao): add Sistema Bussola vision document v2.0.0" \
    -m "Adds the formal Vision Document for Sistema Bussola — Plataforma de" \
    -m "Administracao e Controle para Clubes de Desbravadores." \
    -m "" \
    -m "Contents:" \
    -m "- Sec. 1: Introduction, scope, acronyms and references" \
    -m "- Sec. 2: Problem description and product positioning statement" \
    -m "- Sec. 3: Stakeholders, user profiles and key needs" \
    -m "- Sec. 4: Product overview, capability summary and cost estimate" \
    -m "- Sec. 5: Feature precedence and priority table" \
    -m "- Sec. 6: Non-functional requirements (performance, security, usability)" \
    -m "- Sec. 7: Technical constraints and applicable standards" \
    -m "- Sec. 8: JavaScript — chosen language, origin and history" \
    -m "- Sec. 9: Data dictionary with all 13 database entities" \
    -m "" \
    -m "Fulfills requirement 3 of Especialidade de Informatica Programavel" \
    -m "(AP-052, Level 3, Divisao Sul Americana, 2012)."

  for f in \
    "docs/Sistema_Bussola_Casos_de_Uso.docx" \
    "docs/Sistema_Bussola_Casos_de_Uso.pdf"; do
    [ -f "$f" ] && git add "$f"
  done
  git diff --cached --quiet || git commit \
    -m "docs(use-cases): add Sistema Bussola use case specification v2.0.0" \
    -m "Adds the formal Use Case Specification document for Sistema Bussola," \
    -m "consolidating all UC-001 through UC-016 across all system modules." \
    -m "" \
    -m "Contents:" \
    -m "- Sec. 1-6: Introduction, scope, actors, NFRs, architecture, constraints" \
    -m "- Sec. 7: Full UC specification with main flow, alternative flows," \
    -m "  post-conditions and business rules for all 16 use cases:" \
    -m "  - UC-001 to UC-004: Authentication module" \
    -m "  - UC-005 to UC-006: Units module" \
    -m "  - UC-007 to UC-008: Pathfinders module" \
    -m "  - UC-009 to UC-010: Monthly fees module" \
    -m "  - UC-011: Cash control module" \
    -m "  - UC-012: Patrimony module" \
    -m "  - UC-013: Minutes and acts module" \
    -m "  - UC-014 to UC-016: PDF reports module" \
    -m "- Sec. 8: Requirements traceability matrix (UC x RF x AP-052)" \
    -m "- Sec. 9: Identified risks table" \
    -m "" \
    -m "Fulfills requirement 4.2 of Especialidade de Informatica Programavel" \
    -m "(AP-052, Level 3, Divisao Sul Americana, 2012)."

  for f in \
    "docs/Sistema_Bussola_Arquitetura_de_Software.docx" \
    "docs/Sistema_Bussola_Arquitetura_de_Software.pdf"; do
    [ -f "$f" ] && git add "$f"
  done
  git diff --cached --quiet || git commit \
    -m "docs(architecture): add Sistema Bussola software architecture document v2.0.0" \
    -m "Adds the formal Software Architecture Document for Sistema Bussola," \
    -m "based on the 4+1 view model (Kruchten, IEEE Software, 1995)." \
    -m "" \
    -m "Contents:" \
    -m "- Sec. 1: Introduction, scope, acronyms and references" \
    -m "- Sec. 2: Architectural representation and component relations diagram" \
    -m "  (Presentation -> Supabase BaaS -> PostgreSQL 15)" \
    -m "- Sec. 3: Architectural requirements and constraints table" \
    -m "- Sec. 4: Use case view with architectural significance analysis" \
    -m "- Sec. 5: Logical view — layers, modules and file structure" \
    -m "- Sec. 6: Implementation view with sequence diagrams:" \
    -m "  - UC-001 Login flow" \
    -m "  - UC-014/016 PDF generation flow (client-side jsPDF)" \
    -m "  - Full Entity-Relationship Diagram (13 entities)" \
    -m "- Sec. 7: Deployment view — GitHub Pages + Supabase Cloud" \
    -m "- Sec. 8: Architectural decisions (BaaS, vanilla JS, client-side PDF)" \
    -m "" \
    -m "Fulfills requirement 4.2 of Especialidade de Informatica Programavel" \
    -m "(AP-052, Level 3, Divisao Sul Americana, 2012)."

  for f in \
    "docs/Sistema_Bussola_Manual_do_Usuario.docx" \
    "docs/Sistema_Bussola_Manual_do_Usuario.pdf"; do
    [ -f "$f" ] && git add "$f"
  done
  git diff --cached --quiet || git commit \
    -m "docs(manual): add Sistema Bussola user manual v2.0.0" \
    -m "Adds the formal User Manual for Sistema Bussola, covering all system" \
    -m "modules with step-by-step instructions and FAQ." \
    -m "" \
    -m "Contents:" \
    -m "- Sec. 1: Introduction and compatible browsers" \
    -m "- Sec. 2: Getting started — account creation and login" \
    -m "- Sec. 3: Dashboard — stats cards and quick access grid" \
    -m "- Sec. 4: Units management — create, edit, delete" \
    -m "- Sec. 5: Pathfinders management — create, edit, delete, filter" \
    -m "- Sec. 6: Monthly fees — register, update status, filter" \
    -m "- Sec. 7: Cash control — register entries, exits and costs" \
    -m "- Sec. 8: Patrimony — inventory management" \
    -m "- Sec. 9: Minutes and acts — register with attachments" \
    -m "- Sec. 10: PDF reports — all 6 report types explained" \
    -m "- Sec. 11: FAQ — 6 most common issues and solutions" \
    -m "" \
    -m "Fulfills requirement 4.4 of Especialidade de Informatica Programavel" \
    -m "(AP-052, Level 3, Divisao Sul Americana, 2012)."

  for f in \
    "docs/Sistema_Bussola_Especificacao_de_Requisitos_SRS.docx" \
    "docs/Sistema_Bussola_Especificacao_de_Requisitos_SRS.pdf"; do
    [ -f "$f" ] && git add "$f"
  done
  git diff --cached --quiet || git commit \
    -m "docs(srs): add Sistema Bussola software requirements specification v2.0.0" \
    -m "Adds the formal SRS document listing all 35 functional requirements" \
    -m "and 12 non-functional requirements, with priority and status." \
    -m "" \
    -m "Contents:" \
    -m "- RF-001 to RF-035: functional requirements across all 8 modules" \
    -m "- RNF-001 to RNF-012: performance, security, usability, maintainability" \
    -m "- AP-052 coverage analysis table" \
    -m "" \
    -m "Fulfills requirement 4.2 of Especialidade de Informatica Programavel" \
    -m "(AP-052, Level 3, Divisao Sul Americana, 2012)."

  ok "Documentação formal commitada."
else
  warn "Pasta docs/ não encontrada ou vazia. Pulando commits de documentação."
  warn "Renomeie seus .docx para o padrão Sistema_Bussola_*.docx,"
  warn "coloque-os em docs/ e re-execute o script."
fi

echo ""

# =============================================================================
# PUSH FINAL
# =============================================================================
log "Verificando remote origin..."

if git remote get-url origin >/dev/null 2>&1; then
  log "Enviando para o GitHub..."
  git push -u origin main
  echo ""
  ok "════════════════════════════════════════════════════"
  ok " Sistema Bússola v2.0.0 publicado com sucesso!"
  ok " Acesse: $(git remote get-url origin | sed 's/\.git$//')"
  ok "════════════════════════════════════════════════════"
else
  echo ""
  warn "Remote 'origin' não configurado. Commits realizados apenas localmente."
  warn "Para publicar, execute:"
  warn "  git remote add origin https://github.com/SEU_USUARIO/sistema-bussola.git"
  warn "  git push -u origin main"
fi

echo ""
log "Histórico de commits gerado:"
git log --oneline
