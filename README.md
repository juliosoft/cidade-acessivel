# Cidade Acessível 2D — versão 3.1

Jogo educativo para projeto escolar. Informe apenas um nickname, escolha um personagem e percorra três fases. Não há senha, cadastro de conta ou banco SQL.

- **No seu PC:** JSON em `data/partidas/`, sem credenciais e sem internet durante o jogo.
- **Na Vercel:** JSON em um **Vercel Blob privado**, compartilhando ranking e histórico entre dispositivos.
- A mesma interface e as mesmas regras são usadas nos dois modos. Rankings local e online são separados.

## 1. Rodar no Windows

1. Instale **Node.js 22.9 ou superior da linha 22.x**.
2. Extraia o ZIP. Entre na pasta `cidade-acessivel` (a que contém `package.json`).
3. Abra o terminal do VSCode ou PowerShell nessa pasta:

```powershell
npm install
npm run dev
```

4. Abra **http://localhost:3000**. Informe um nickname de 3–12 letras/números (hífen e sublinhado também são aceitos).
5. Para encerrar o servidor, pressione `Ctrl+C` no terminal.

Não precisa criar `.env.local`, conectar Vercel ou fornecer token para o modo local. O primeiro `npm install` precisa de internet; depois o modo local funciona sem internet. Se o PowerShell bloquear `npm.ps1`, use `npm.cmd install` e `npm.cmd run dev` ou o Prompt de Comando.

**Os resultados ficam em `data/partidas/`.** Fechar o navegador ou reiniciar o PC não apaga os arquivos. Copiar a pasta `data` faz um backup. A pasta é criada ao iniciar a primeira partida e está excluída do Git. Para uma nova sessão de apresentação com ranking vazio, pare o servidor e mova `data` para uma pasta de backup.

Se a porta 3000 estiver ocupada, feche a outra instância ou use:

```powershell
$env:PORT=3001
npm run dev
```

Nesse caso, abra http://localhost:3001.

## 2. Testar no celular usando seu PC

1. Conecte PC e celular à mesma rede Wi-Fi.
2. Mantenha `npm run dev` aberto no PC.
3. Execute `ipconfig` e procure o endereço IPv4 do adaptador Wi-Fi, por exemplo `192.168.1.20`.
4. No celular, abra `http://192.168.1.20:3000` (substitua pelo IP real do PC).
5. Se o Windows solicitar, permita o Node.js no firewall **para a rede privada**.
6. Gire o celular para a horizontal quando solicitado.

Não use `localhost` no celular: esse endereço aponta para o próprio telefone. Todos os dispositivos acessando esse servidor local compartilham os JSON do PC. O PC precisa permanecer ligado. Acesso fora da rede doméstica deve usar a URL da Vercel; não é necessário abrir portas do roteador.

## 3. Publicar na Vercel com Blob

1. Envie o conteúdo de `cidade-acessivel` para um repositório Git. Não envie `node_modules`, `data` ou `.env.local`.
2. Importe o repositório na Vercel. Se a pasta `cidade-acessivel` estiver dentro dele, selecione-a como **Root Directory**.
3. Use **Framework Preset: Other** e Node.js **22.x**. `vercel.json` já define `npm run build`, saída `public` e a API Node.js em `api/game.js`.
4. Na aba **Storage**, crie um **Blob** com acesso **Private** e conecte-o ao projeto. Este código exige Blob privado; um Blob público não é equivalente.
5. Selecione o ambiente **Production**. A conexão deve disponibilizar `BLOB_READ_WRITE_TOKEN` ou as credenciais gerenciadas `BLOB_STORE_ID` e `VERCEL_OIDC_TOKEN`. O SDK aceita a configuração gerenciada automaticamente. Não coloque essas variáveis no HTML/JavaScript público.
6. Faça **Redeploy** após conectar o armazenamento.
7. Abra a URL publicada e conclua uma partida. Abra o ranking em outro dispositivo para conferir o resultado compartilhado.

`STORAGE_MODE` não é obrigatório: na Vercel ele é automaticamente `blob`; no PC, `local`. Se quiser declará-lo explicitamente na Vercel, use `STORAGE_MODE=blob`. O projeto rejeita `local` em ambiente Vercel para evitar perda silenciosa de dados.

O Blob tem limites de armazenamento e operações. A versão salva quatro arquivos por partida completa (início + três fases) e consulta arquivos para formar ranking e histórico. Isso foi pensado para uma apresentação/turma pequena. Veja o consumo na Vercel; leituras, listagens e gravações utilizam a franquia. Ranking não é atualizado por polling; ele é consultado quando aberto e pode usar cache de até 30 segundos. Para turmas grandes/uso contínuo, será necessário otimizar a indexação ou usar um banco.

## 4. Usar o Blob real durante o desenvolvimento

É opcional e precisa de internet. Copie `.env.example` para `.env.local`, descomente e preencha:

```dotenv
STORAGE_MODE=blob
BLOB_READ_WRITE_TOKEN=seu_token_real_do_blob_privado
```

Reinicie `npm run dev`. Esses testes usam o Blob real e consomem sua franquia. Prefira um Blob separado para desenvolvimento; apontar para o de produção coloca os testes no ranking da turma. Nunca compartilhe ou envie `.env.local` ao Git. Para voltar ao disco local, remova `STORAGE_MODE=blob` ou configure `STORAGE_MODE=local` e reinicie o servidor.

## 5. Regras do jogo

- Três fases, dois desafios e dez coletáveis por fase.
- Desktop: A/D ou setas para mover, Espaço/W para pular, E/Enter para interagir, Esc para pausar.
- Mobile: botões touch simultâneos. Em vertical, aparece o pedido de rotação e o relógio pausa. Em horizontal, o cenário usa a altura da tela com os controles sobrepostos.
- Desafios abrem sem alternativa marcada. A resposta só é registrada ao clicar **Confirmar resposta**; esse botão começa desabilitado.
- Cada obstáculo admite **uma tentativa confirmada por partida**. Fechar sem confirmar permite voltar depois. Confirmar uma resposta incorreta não permite repetir.
- Pode terminar a fase com qualquer quantidade de ações pendentes. Ações ignoradas valem zero.
- O relógio de cada fase inclui deslocamento e decisão nos desafios. Pausa explícita, aba oculta, orientação vertical e telas entre fases não contam.
- O ranking ordena pontuação decrescente, tempo total crescente e data de conclusão crescente. Exibe os dez melhores resultados, incluindo tempos por fase. Uma pessoa pode ter várias partidas no ranking.

| Desafio | Opção 1 | Opção 2 | Opção 3 |
|---|---:|---:|---:|
| Farmácia | Aviso: 10 | Rampa: 100 | Fundos: 25 |
| Praça | Carregar pessoa: 0 | Mais degraus: 0 | Elevador: 100 |
| Travessia | Semáforo sonoro: 100 | Cor mais forte: 10 | Mais velocidade: 0 |
| Piso tátil | Tapete: 0 | Reparar: 100 | Cone: 0 |
| Pátio | Mais volume: 0 | Impedir uso: 0 | Reduzir ruído/calmaria: 100 |
| Sala | Libras/legendas: 100 | Falar alto: 0 | Apagar avisos: 0 |

Por fase: `pontos das escolhas + itens × 10 + bônus`.

`bônus = floor(max(0, 120 − segundos da fase) × barreiras corrigidas / 2)`.

O bônus proporcional evita premiar quem apenas corre e ignora todas as ações. Pontos parciais representam uma ação insuficiente, não uma solução acessível completa. O feedback explica a alternativa recomendada. Pontuação máxima teórica da partida: 1.260, antes do tempo mínimo de deslocamento.

## 6. Nicknames e histórico

Não há autenticação: qualquer pessoa pode usar um nickname existente e consultar os resultados dele. `Aluno` e `aluno` agrupam o mesmo histórico. Use nicknames distintos na turma para evitar mistura entre pessoas. O navegador só lembra o último nickname preenchido; resultados são mantidos no servidor.

Cada nova partida recebe um ID independente. Um identificador temporário protege o envio daquela partida por aquela aba, mas não é senha de usuário. Duas pessoas jogando simultaneamente, inclusive com o mesmo nickname, criam partidas separadas.

A cada fase concluída, a API salva um JSON imutável contendo a pontuação acumulada e os detalhes das fases. Há quatro arquivos: `0.json` (início), `1.json`, `2.json` e `3.json`. Isso preserva histórico parcial e evita regravar um ranking único. Um reenvio idêntico recupera o resultado; um reenvio alterado não substitui a resposta anterior. No Blob ficam sob `cidade-acessivel-v3/partidas/`; no PC, sob `data/partidas/`. A subpasta do nickname usa um hash para evitar caracteres problemáticos no nome de arquivo.

O histórico mostra as últimas 50 partidas daquele nickname, incluindo as não concluídas. As demais permanecem nos arquivos. Não há retomada automática de uma fase em andamento após fechar/recarregar a página. Fases já registradas continuam salvas. Se o envio falhar, o resultado fica em memória e há um botão para tentar novamente; mantenha a página aberta até salvar.

## 7. Organização para explicar o projeto

| Arquivo | Responsabilidade |
|---|---|
| `public/index.html` | Telas e botões |
| `public/style.css` | Aparência e adaptação para celular |
| `public/game.js` | Movimento, desenho, escolhas e telas |
| `api/game.js` | Receber pedidos do navegador |
| `lib/rules.js` | Validar e calcular pontos no servidor |
| `lib/game-service.js` | Organizar partidas, ranking e histórico |
| `lib/storage.js` | Escolher entre arquivos locais e Blob |
| `scripts/dev.mjs` | Servidor local |
| `vercel.json` | Configuração da hospedagem |

A API recalcula pontos: não aceita um score pronto vindo do navegador. Eventos de jogo e tempo ativo ainda vêm do cliente; esta é uma aplicação educativa, não um sistema antifraude para campeonatos com premiação.

## 8. Verificação

```powershell
npm test
npm run build
```

Os testes verificam regras, escolha única sem pré-seleção, física, fases ignoradas, persistência real em arquivos temporários, concorrência, idempotência, histórico, ranking e o contrato do adaptador Blob com SDK simulado. O layout foi conferido em Chromium com telas touch emuladas de 844×390, 667×375, 568×320 e 1024×768, incluindo rotação, diálogos e fallback. A conferência em aparelhos físicos, especialmente Safari/iPhone, permanece necessária. O teste do Blob não usa credenciais nem comprova a configuração do armazenamento online; valide essa integração depois de conectá-lo na Vercel. A API não disponibiliza operações para apagar resultados.

Fontes: [SDK Vercel Blob](https://vercel.com/docs/vercel-blob/using-blob-sdk), [Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js).

## Ajuste mobile — versão 3.1

No celular em horizontal, o jogo se ajusta automaticamente à área visível, sem cabeçalho ou rodapé. O botão **⛶ Tela cheia**, no canto superior do jogo, pede tela cheia ao navegador. **⤢ Reduzir** sai do modo expandido. O cenário mantém a proporção 16:9: pequenas faixas livres são normais em telas mais largas.

Quando a tela cheia nativa não está disponível (incluindo algumas versões do Safari/iPhone), o botão usa a área disponível da página e mantém apenas o jogo e controles. As barras do navegador podem permanecer. Rotação e mudanças nas barras recalculam o espaço disponível; os desafios continuam acessíveis em tela cheia.

Para atualizar uma instalação existente, substitua apenas `public/index.html`, `public/style.css` e `public/game.js` e recarregue a página. Não substitua sua pasta `data` nem `.env.local`. No deploy, publique novamente o projeto.
