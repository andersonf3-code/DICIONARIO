# Termos de Compartilhamento do CAF

Versão independente do Portal de Solicitação de Dados do CAF, sem apresentação do dicionário e sem seleção de variáveis.

## Funcionalidades

- Formulário da instituição, responsável e múltiplos tratadores.
- Validação dos campos obrigatórios, CPF e e-mail.
- Termo de responsabilidade do responsável e termo individual de sigilo por tratador.
- Planilha com os dados da solicitação, sem variáveis.
- E-mail fixo `caf@mda.gov.br`, assunto com a instituição e mensagem preparada.
- Processamento no navegador, sem banco de dados e sem envio automático de informações.

## Publicação

1. Incorporar a alteração na branch `main`.
2. Acessar **Settings → Pages → Build and deployment → Source** e selecionar **GitHub Actions**.
3. Em **Actions**, acompanhar a execução de **Publicar aplicação no GitHub Pages**; se necessário, usar **Run workflow**.
4. Após o sucesso, acessar https://andersonf3-code.github.io/DICIONARIO/ .

O endereço só estará disponível após a publicação concluir. Se o nome do repositório mudar, ajustar `base` em `vite.config.ts`.

## Execução local

Requer Node.js 24.

```sh
npm ci
npm run dev
```

Para verificar os tipos e gerar a versão de publicação:

```sh
npm run build
```

Os dados preenchidos ficam apenas na memória da página e são perdidos ao recarregar ou fechar. Baixe os documentos antes de sair. O botão de e-mail apenas prepara a mensagem no aplicativo de e-mail; os documentos assinados devem ser anexados manualmente.
