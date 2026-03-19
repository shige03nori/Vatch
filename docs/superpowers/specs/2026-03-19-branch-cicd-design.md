# ブランチ構成・CI/CD 設計書

## 概要

**目的:** `staging` / `develop` ブランチを追加し、`staging` への push 時に fly.io (`vatch` アプリ) へ自動デプロイする GitHub Actions ワークフローを構築する。

---

## ブランチ構成

| ブランチ | 役割 | デプロイ先 |
|---------|------|-----------|
| `master` | 本番環境 | （手動 / 将来的に自動化可能） |
| `staging` | 検証環境 | fly.io `vatch` アプリ（自動） |
| `develop` | ローカル開発用 | なし |

**作成元:** `staging` / `develop` ともに現在の `master` HEAD から作成。

**運用フロー:** `develop` → `staging` → `master` の順でマージする。

---

## デプロイ前提条件（初回のみ）

`flyctl deploy` 実行前に、fly.io アプリ側に必要な環境変数をシークレットとして設定しておく必要がある。
設定されていない場合、ビルドまたは起動時にクラッシュする。

```bash
fly secrets set \
  DATABASE_URL="postgresql://..." \
  NEXTAUTH_SECRET="..." \
  NEXTAUTH_URL="https://vatch.fly.dev" \
  --app vatch
```

設定済みシークレットの確認: `fly secrets list --app vatch`

---

## GitHub Actions ワークフロー

### トリガー

`staging` ブランチへの push のみ。

### 処理内容

1. リポジトリを checkout
2. `superfly/flyctl-actions/setup-flyctl@v1` で flyctl をセットアップ
3. `flyctl deploy --remote-only` を実行（fly.io のリモートビルダーでビルド）

### 認証

`FLY_API_TOKEN` を GitHub Secrets から `secrets.FLY_API_TOKEN` として参照。

### 同時実行制御

`concurrency.group: deploy-staging` + `cancel-in-progress: true` を設定し、新しい push が来た場合に進行中のデプロイをキャンセルしてレースコンディションを防ぐ。

### ワークフローファイル

**ファイルパス:** `.github/workflows/deploy-staging.yml`

```yaml
name: Deploy to Staging (fly.io)

on:
  push:
    branches:
      - staging

jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    concurrency:
      group: deploy-staging
      cancel-in-progress: true
    steps:
      - uses: actions/checkout@v4

      - uses: superfly/flyctl-actions/setup-flyctl@v1

      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

---

## FLY_API_TOKEN の取得・設定手順

### トークン生成

fly.io CLI (`flyctl`) がインストール済みの環境でターミナルから実行：

```bash
fly tokens create deploy -x 999999h
```

出力されたトークン文字列をコピーする。

### GitHub Secrets への登録

1. GitHub リポジトリ (`shige03nori/Vatch`) を開く
2. `Settings → Secrets and variables → Actions → New repository secret`
3. Name: `FLY_API_TOKEN`、Value: 上でコピーしたトークンを貼り付け
4. `Add secret` をクリック

---

## ファイル構成

| ファイル | 操作 | 役割 |
|---------|------|------|
| `.github/workflows/deploy-staging.yml` | 新規作成 | staging 自動デプロイワークフロー |

ブランチ操作（git コマンド）はファイル変更なし。

---

## 注意事項

- `fly.toml` はリポジトリルートに既存（app: `vatch`, region: `nrt`）。変更不要。
- `Dockerfile` も既存。`--remote-only` フラグで fly.io 側でビルドするため、GitHub Actions ランナーで Docker ビルドは不要。
- `master` ブランチへの自動デプロイは本設計のスコープ外。必要に応じて別途追加する。
