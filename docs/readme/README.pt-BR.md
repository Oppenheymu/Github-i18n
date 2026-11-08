<div align="center">

<h1 id="github-i18n">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../../.github/assets/wordmark-dark.svg">
    <img src="../../.github/assets/wordmark-light.svg" alt="Github-i18n" width="560">
  </picture>
</h1>

**Traduza a interface do GitHub para o seu idioma — dicionário embutido, tudo local, zero requisições de rede**

[![CI](https://img.shields.io/github/actions/workflow/status/Oppenheymu/Github-i18n/ci.yml?style=flat-square&label=CI)](https://github.com/Oppenheymu/Github-i18n/actions/workflows/ci.yml)
&emsp;
[![Bun](https://img.shields.io/badge/dev--runtime-Bun-f472b6?style=flat-square&logo=bun)](https://bun.sh)
&emsp;
![Manifest V3](https://img.shields.io/badge/Manifest-V3-2ea44f?style=flat-square&logo=googlechrome&logoColor=white)
&emsp;
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](../../LICENSE)

<p>
  <a href="#recursos">Recursos</a> •
  <a href="#instalação">Instalação</a> •
  <a href="#uso">Uso</a> •
  <a href="#como-funciona">Como funciona</a> •
  <a href="#desenvolvimento">Desenvolvimento</a> •
  <a href="#documentação">Documentação</a>
</p>

<sub><a href="../../README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a> · <a href="./README.zh-TW.md">繁體中文</a> · <a href="./README.ja.md">日本語</a> · <a href="./README.ko.md">한국어</a> · <a href="./README.es.md">Español</a> · <a href="./README.fr.md">Français</a> · <a href="./README.de.md">Deutsch</a> · <strong>Português (Brasil)</strong> · <a href="./README.pt-PT.md">Português (Portugal)</a> · <a href="./README.ru.md">Русский</a></sub>

</div>

> [!NOTE]
> **Não oficial**: o nome e o logotipo "GitHub" são marcas da GitHub, Inc. Este projeto é uma ferramenta independente de localização da comunidade, sem afiliação, parceria ou endosso da GitHub, Inc. Veja [NOTICE](../../NOTICE) para detalhes.

---

## Recursos

- **Dicionário embutido**: as traduções acompanham a extensão — nada é baixado e nenhum serviço on-line é chamado.
- **Carregamento por página**: as entradas são roteadas por módulo, as da página específica têm prioridade sobre o fallback global, e o texto não coberto continua em inglês.
- **Conteúdo intacto**: blocos de código, diffs, o editor, READMEs e corpos de issues são ignorados por inteiro; só o texto da interface é traduzido.
- **Zero coleta**: nenhum dado é coletado ou enviado; o coletor de falhas do modo desenvolvedor vem desligado por padrão e grava apenas localmente.
- **Acompanha a SPA**: um `MutationObserver` continua traduzindo durante a navegação do Turbo, sem precisar recarregar.

---

## Instalação

A extensão atua em `github.com` e `gist.github.com` e é distribuída como "compilar do código-fonte + carregar manualmente".

```bash
bun install
bun run build
```

1. Abra `chrome://extensions` (`edge://extensions` no Edge) e ative o **modo de desenvolvedor**;
2. Clique em **Carregar sem compactação** e selecione `dist/`;
3. Abra o GitHub e clique no ícone da barra de ferramentas para confirmar que a chave está ligada.

> [!TIP]
> Depois de alterar o código, rode `bun run watch` para recompilar e clique em **Recarregar** uma vez na página de extensões; `bun run pack` gera `github-i18n-v<versão>.zip`.

---

## Uso

- **Chave**: desligada, a página inteira volta ao inglês.
- **Idioma**: segue o navegador por padrão e também pode ser escolhido manualmente. O chinês simplificado é a base (100%); 日本語, 繁體中文, 한국어, Español, Français, Deutsch, Português (Brasil / Portugal) e Русский vão sendo preenchidos conforme ficam prontos, e o que não foi traduzido continua em inglês.
- **Modo desenvolvedor**: desligado por padrão; quando ligado, coleta apenas no seu computador o texto não traduzido, que você pode copiar ou limpar.

---

## Como funciona

O content script é injetado em `document_start`, observa a página com um `MutationObserver`, resolve uma visão do dicionário por "caminho + idioma" e grava as traduções de volta.

<details>
<summary>Ver o fluxo</summary>

```mermaid
flowchart LR
    GH["Página do GitHub"] --> OBS["MutationObserver"]
    OBS --> ENGINE["engine<br/>agrupamento em microtarefas · flush"]
    ENGINE --> VIEW["pages<br/>caminho + idioma → visão"]
    DICT["dicionário"] --> VIEW
    VIEW --> WALKER["walker<br/>texto · atributos · regras"]
    WALKER --> DOM["traduções gravadas"]
```

</details>

---

## Desenvolvimento

```bash
bun run check          # verificação completa
bun run build          # compilar dist/
bun run watch          # recompilar ao mudar
bun run pack           # empacotar o zip
bun run report:misses  # log de falhas → relatório
```

`bun run check` precisa estar verde antes do commit. O dicionário é 100% original e **é terminantemente proibido importar dicionários ou código de qualquer projeto de localização sob GPL / AGPL**. As convenções estão em [AGENTS.md](../../AGENTS.md) e o fluxo no [guia de desenvolvimento](../guides/development.md).

---

## Documentação

- [Guia de desenvolvimento](../guides/development.md)
- [Convenções do repositório](../../AGENTS.md)
- [Política de segurança](../../.github/SECURITY.md)
- [Licença MIT](../../LICENSE) ｜ [Avisos](../../NOTICE)

---

## Status

[![Repobeats analytics image](https://repobeats.axiom.co/api/embed/ce368e09dd89056975ae095d1d52a1974ade8ad3.svg "Repobeats analytics image")](https://github.com/Oppenheymu/Github-i18n/pulse)

---

## Licença

O código-fonte e o dicionário são originais e distribuídos sob a licença [MIT](../../LICENSE); sem vínculo com a GitHub, Inc., veja [NOTICE](../../NOTICE) para detalhes.
