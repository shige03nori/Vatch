# ブランチ構成・CI/CD 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `staging` / `develop` ブランチを作成し、`staging` への push 時に fly.io (`vatch` アプリ) へ自動デプロイする GitHub Actions ワークフローを追加する。

**Architecture:** `.github/workflows/deploy-staging.yml` を新規作成し、`staging` ブランチへの push トリガーで `flyctl deploy --remote-only` を実行する。ブランチは `master` HEAD から作成し、リモートへ push する。

**Tech Stack:** GitHub Actions, superfly/flyctl-actions@v1, fly.io (flyctl)

---

## 前提条件（実装前に確認・設定が必要）

以下は自動化できない手動作業。実装前に完了させること。

### 1. FLY_API_TOKEN の取得

flyctl がインストール済みの端末で実行：

```bash
fly tokens create deploy -x 999999h
```

出力されたトークン文字列をコピーする。

### 2. GitHub Secrets への登録

1. `https://github.com/shige03nori/Vatch` を開く
2. `Settings → Secrets and variables → Actions → New repository secret`
3. Name: `FLY_API_TOKEN`、Value: 上でコピーしたトークン
4. `Add secret` をクリック

### 3. fly.io シークレットの設定（まだの場合）

```bash
fly secrets set \
  DATABASE_URL="postgresql://..." \
  NEXTAUTH_SECRET="..." \
  NEXTAUTH_URL="https://vatch.fly.dev" \
  --app vatch
```

確認: `fly secrets list --app vatch`

---

## ファイル構成

| ファイル | 操作 | 役割 |
|---------|------|------|
| `.github/workflows/deploy-staging.yml` | 新規作成 | staging 自動デプロイワークフロー |

ブランチ操作はファイル変更なし。

---

## Task 1: GitHub Actions ワークフローを作成する

**Files:**
- Create: `.github/workflows/deploy-staging.yml`

---

- [ ] **Step 1: `.github/workflows/` ディレクトリを作成し、ワークフローファイルを作成する**

`.github/workflows/deploy-staging.yml` を以下の内容で作成する：

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
    concurrency: deploy-group
    steps:
      - uses: actions/checkout@v4

      - uses: superfly/flyctl-actions/setup-flyctl@v1

      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

- [ ] **Step 2: YAML の構文を確認する**

```bash
cat .github/workflows/deploy-staging.yml
```

Expected: ファイルが正しく表示される。

- [ ] **Step 3: コミットする**

```bash
git add .github/workflows/deploy-staging.yml
git commit -m "ci: add GitHub Actions workflow for staging auto-deploy"
```

---

## Task 2: `staging` / `develop` ブランチを作成してリモートに push する

**Files:** なし（git 操作のみ）

---

- [ ] **Step 1: 現在のブランチが `master` であること、ワーキングツリーがクリーンであることを確認する**

```bash
git status
git branch
```

Expected:
- `* master`
- `nothing to commit, working tree clean`

- [ ] **Step 2: `staging` ブランチを `master` HEAD から作成して push する**

```bash
git checkout -b staging
git push -u origin staging
```

Expected: `Branch 'staging' set up to track remote branch 'staging' from 'origin'.`

- [ ] **Step 3: `develop` ブランチを `master` HEAD から作成して push する**

```bash
git checkout master
git checkout -b develop
git push -u origin develop
```

Expected: `Branch 'develop' set up to track remote branch 'develop' from 'origin'.`

- [ ] **Step 4: `master` に戻る**

```bash
git checkout master
```

- [ ] **Step 5: ブランチ一覧を確認する**

```bash
git branch -a
```

Expected: 以下の3ブランチがすべて表示される：
```
* master
  staging
  develop
  remotes/origin/master
  remotes/origin/staging
  remotes/origin/develop
```

---

## Task 3: staging ブランチに push して自動デプロイを動作確認する

**Files:** なし（確認作業のみ）

> **前提:** Task 1 の前提条件（FLY_API_TOKEN の設定）が完了していること。

---

- [ ] **Step 1: `staging` ブランチに切り替える**

```bash
git checkout staging
```

- [ ] **Step 2: `master` の内容が `staging` に含まれていることを確認する（ワークフローファイルを含む）**

```bash
git log --oneline -5
ls .github/workflows/
```

Expected: `deploy-staging.yml` が存在すること。

- [ ] **Step 3: GitHub Actions のワークフローが起動したことを確認する**

ブラウザで `https://github.com/shige03nori/Vatch/actions` を開き、`Deploy to Staging (fly.io)` ワークフローが実行中または完了していることを確認する。

- [ ] **Step 4: `master` に戻る**

```bash
git checkout master
```
