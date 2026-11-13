# In Dress — loja online

Site da **In Dress** (moda fit feminina, [@use.indress](https://instagram.com/use.indress)).
A cliente escolhe as peças e envia o pedido pronto pelo WhatsApp. Não há pagamento no site.

- **Loja:** `https://taiquee.github.io/indress-site/`
- **Painel:** `https://taiquee.github.io/indress-site/admin/`

## Painel da loja

No painel dá para adicionar, editar e excluir produtos, subir fotos pelo celular, mudar preço, preço promocional, descrição, tamanhos e cores, marcar peças como esgotadas e alterar o WhatsApp e os textos do site.

Cada alteração salva vira um commit neste repositório e aparece no site em cerca de 1 minuto.

### Como gerar a chave de acesso (só na primeira vez)

1. Entre em **github.com → foto do perfil → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Repository access:** *Only select repositories* → `indress-site`.
3. **Permissions → Repository permissions → Contents:** *Read and write*.
4. Gere o token e copie (começa com `github_pat_`).
5. Abra `/admin`, cole a chave e clique em **Entrar**. O navegador lembra a chave e você só faz isso uma vez por aparelho.

Para dar acesso à dona da loja: adicione a conta GitHub dela como colaboradora do repositório (*Settings → Collaborators*). Ela gera a própria chave seguindo os passos acima.

Não compartilhe a chave. Para revogar, apague o token na mesma tela do GitHub.

## Estrutura

```
index.html, css/, js/app.js     loja
admin/, js/admin.js             painel
js/shared.js                    armazenamento (GitHub / Vercel / teste local) e utilitários
data/products.json              catálogo publicado (editado pelo painel)
data/seed.json                  catálogo inicial
img/produtos/                   fotos enviadas pelo painel
api/                            backend opcional para hospedar na Vercel
```

## Testar no computador

```
python3 -m http.server
```

Abra `http://localhost:8000`. Fora do GitHub Pages, o painel entra em modo de teste e salva só no navegador.
