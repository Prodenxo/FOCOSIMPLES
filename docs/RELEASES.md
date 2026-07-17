# Fluxo de releases

## Versionamento

- `app.json` → `expo.version` (semver, ex.: `2.1.3`)
- `app.json` → `expo.android.versionCode` (inteiro, incrementa a cada submit)
- `package.json` → `version` (mantém em sincronia com `expo.version`)

## Passo a passo de cada release

1. **Bump** da versão em `app.json` (semver + versionCode) e `package.json`.
2. Commitar com mensagem `chore: bump versão para X.Y.Z`.
3. **Tag git** no commit de bump (essencial — o git-cliff agrupa o changelog por tags):
   ```bash
   git tag vX.Y.Z
   ```
4. Atualizar o CHANGELOG técnico:
   ```bash
   npm run changelog
   ```
5. Escrever as **notas curtas da Play Store** (≤ 500 caracteres) em:
   ```
   fastlane/metadata/android/pt-BR/changelogs/<versionCode>.txt
   ```
   Foco no que o usuário final percebe. (Opcional: criar a versão en-US em `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt`.)
6. Commitar `CHANGELOG.md` e o arquivo do fastlane.
7. Push da tag:
   ```bash
   git push origin vX.Y.Z
   ```

## Build & submit

```bash
npx eas build   --profile production --platform android
npx eas submit  --profile production --platform android
```

> O `eas submit` **não** lê o `fastlane/metadata/` automaticamente.
> Caminhos para entregar as notas à Play Store:
>
> - **Manual:** copiar o conteúdo do `fastlane/metadata/android/pt-BR/changelogs/<versionCode>.txt` no Play Console após o submit.
> - **Automatizado:** `gem install fastlane` e depois `fastlane supply --skip_upload_apk --skip_upload_aab` (sobe apenas metadados, incluindo as notas).

## git-cliff — comandos úteis

```bash
# Gera/atualiza o CHANGELOG.md completo (todas as tags)
npm run changelog

# Mostra apenas o que ainda não está numa tag (Unreleased)
npx git-cliff --unreleased

# Mostra as notas de uma versão específica
npx git-cliff --tag v2.1.3 --strip all
```

## Tags retroativas (uma única vez)

Se as versões 2.1.2 e 2.1.3 ainda não estiverem taggeadas, criar agora:

```bash
git tag v2.1.2 4fdf87c   # commit que bumpou para 2.1.2
git tag v2.1.3 93e6347   # commit que bumpou para 2.1.3
git push origin v2.1.2 v2.1.3
```

Sem isso, o git-cliff coloca tudo em **Não lançado**.
