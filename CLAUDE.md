# FlowOps: site institucional

Site da FlowOps, marca comercial de Lourenço Couto e Pedro Marques (trabalhadores independentes). Desenvolvemos software, websites e apps à medida para resolver problemas de empresas.

## Stack
- Astro + Tailwind CSS + TypeScript (versões fixas no `package.json`).
- Site estático. A única rota de servidor é `POST /api/contact`, num Worker da Cloudflare (Resend + Turnstile + honeypot + limite de pedidos).
- Alojamento: Cloudflare.

## Comandos
- `npm run dev`: servidor local.
- `npm run build`: build de produção.
- `npx astro check`: verificação de tipos (tem de passar sem erros nem avisos).
- `npm run verify`: verificação completa em várias larguras e browsers (tem de passar antes de cada commit).
- `npm run brand`: regenera logótipos, favicon e imagem Open Graph a partir de `public/brand/logo-source.svg`.

## Onde estão as coisas
- Nome, domínio, URL canónica, titulares, NIF e morada: só em `site.config.mjs`. Nunca escrevas o nome ou o domínio diretamente noutros ficheiros.
- Textos, FAQ e projetos: em `src/content/`. Nos textos, o nome da marca escreve-se `{marca}`.
- Logótipo: um único ficheiro de origem, `public/brand/logo-source.svg`.
- Pendentes: `A-CONFIRMAR.md`.

## Regras de conteúdo
- Português de Portugal, tratamento por "você" ou neutro. Tom seguro e profissional, sem emojis.
- Nunca inventar testemunhos, números de clientes, logótipos de clientes, estatísticas ou anos de experiência.
- Projetos do portefólio são de demonstração e com empresas fictícias, sempre identificados como tal.
- Não nos chamar "empresa" (somos trabalhadores independentes). Usar "equipa" ou "nós".
- Prometer apenas o que conseguimos cumprir (ex.: suporte em até 1 dia útil).

## Regras técnicas
- Acessibilidade WCAG 2.1 AA: contraste verificado, navegação por teclado, áreas de toque de pelo menos 44 × 44 px, nada que dependa só de hover, `prefers-reduced-motion` respeitado.
- Mobile-first. Verificar em 320, 375, 768, 1024, 1280, 1440 e 1920 px.
- Paleta: verde principal `#0F766E`. Âmbar `#F59E0B` só em pormenores; nunca texto branco sobre âmbar.
- Performance: Lighthouse mobile igual ou superior a 95. Sem bibliotecas de animação pesadas; preferir CSS e SVG.
- Segurança: segredos apenas no `.env` local e no painel do Worker. CSP restrita: qualquer domínio novo tem de ser acrescentado de propósito e justificado.
- RGPD: analytics sem cookies; qualquer dado novo recolhido tem de constar da Política de Privacidade.
- Dependências: só versões publicadas há pelo menos duas semanas.

## Antes de dar uma tarefa por concluída
1. `npx astro check` sem erros nem avisos.
2. `npm run verify` a passar.
3. Commit pequeno, com mensagem clara. Push só quando pedido.
