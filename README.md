# Campus Tag

Campus Tagは、大学内で共通の言語・興味・経験を持つ学生を見つけるためのプロフィール検索アプリです。

自然な日本語の検索文をGeminiで構造化し、本人が公開を許可した安全確認済みのプロフィール情報だけを検索対象にします。

## 本番環境

https://campus-tag.vercel.app

ログインおよび新規登録には、Campus Tagで許可されたAIUメールアドレスが必要です。

## MVPの対象範囲

今回のMVPでは、中心機能を「学生プロフィール検索」に限定しています。

Ride Tagなどの追加マッチング機能は、将来の拡張候補として扱い、今回の実装対象には含めていません。

## 主な機能

### 認証

- AIUメールアドレスに限定した新規登録
- メールアドレスとパスワードによるログイン
- メール確認後の認証コールバック
- パスワード再設定
- ログアウト
- 停止中アカウントの利用制限

### プロフィール

- 表示名、生年月日、自己紹介、学生区分の設定
- 正規学生、交換留学生、大学院生、その他の区分に対応
- 言語と、各言語との関係の設定
  - 母語
  - 話せる
  - 学習中
  - 交流したい
- プロフィール公開・非公開設定
- タグの追加、一覧表示、削除
- タグの重複防止、登録数制限、文字数制限

### Geminiによるタグ安全確認

- 追加されたタグをGeminiで安全確認
- 公開可能なタグは検索対象として保存
- 要確認タグは非公開の審査待ちとして保存
- Geminiの判定に失敗したタグを公開対象から除外
- EditorおよびAdminによる段階的な審査

### 学生プロフィール検索

- 自然な日本語による検索
- 言語、興味、経験、学生区分、年齢などの条件解析
- Geminiの構造化出力を利用した検索条件生成
- タグの完全一致、表記揺れ、部分一致への対応
- 明示されていない学生区分を検索条件にしない検証
- 本人が公開を許可したプロフィールだけを検索
- 安全確認済みのタグだけを検索対象として使用
- Gemini APIの一時的な429・5xxエラーに対する再試行
- 検索結果の一致度による並び替え

### Editor機能

- Geminiが要確認と判断したタグの審査
- 公開可能なタグの承認
- 問題の可能性が残るタグのAdminへの送付
- Editor以上のロールだけが審査画面へアクセス可能

### Admin機能

- Editorから送られたタグの最終審査
- ユーザー一覧の確認
- viewer、editor、adminロールの管理
- アカウント状態の管理
- 自分自身に対する危険なロール変更・停止操作の防止
- Adminだけが管理画面と管理用処理へアクセス可能

## ロール

| ロール | 主な権限 |
| --- | --- |
| `viewer` | プロフィール設定、タグ設定、公開設定、学生検索 |
| `editor` | viewerの権限に加えて、要確認タグの一次審査 |
| `admin` | editorの権限に加えて、最終審査、ユーザー・ロール・アカウント管理 |

新規ユーザーには `viewer` ロールを自動付与します。
`editor` と `admin` は、Adminが必要なユーザーへ付与します。

## セキュリティとプライバシー

- Supabase Authによる認証
- Row Level Security（RLS）によるデータアクセス制御
- データベース関数によるロール検証
- 管理処理をサーバー側およびデータベース側で制限
- 公開プロフィール専用ビューを通した検索
- 非公開プロフィール、強制非公開プロフィール、停止中アカウントを検索対象から除外
- 必須プロフィール情報が不足しているユーザーを検索対象から除外
- 母語と公開可能タグが設定されていないプロフィールを検索対象から除外
- Gemini APIキーとSupabase秘密鍵をサーバー側だけで使用

`SUPABASE_SECRET_KEY` と `GEMINI_API_KEY` を、ブラウザー側のコードやGitリポジトリへ公開しないでください。

## 技術構成

| 分類 | 使用技術 |
| --- | --- |
| フレームワーク | Next.js 16.3.1 |
| UI | React 19.2.8、Tailwind CSS 4 |
| 言語 | TypeScript 5 |
| 認証・データベース | Supabase |
| AI | Google Gemini API（`gemini-2.5-flash-lite`） |
| デプロイ | Vercel |
| バージョン管理 | Git、GitHub |

## 環境変数

`.env.example` を `.env.local` へコピーし、各サービスから取得した値を設定します。

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
GEMINI_API_KEY=
SUPABASE_SECRET_KEY=
```

変数の用途は次のとおりです。

| 変数 | 用途 | ブラウザー公開 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトURL | 可 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase公開用キー | 可 |
| `GEMINI_API_KEY` | タグ判定・検索条件解析 | 不可 |
| `SUPABASE_SECRET_KEY` | サーバー側の管理処理 | 不可 |

実際の値を含む `.env.local` はGitへコミットしないでください。

## ローカルでの起動

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数ファイルの作成

Windows PowerShellの場合：

```powershell
Copy-Item .env.example .env.local
```

macOSまたはLinuxの場合：

```bash
cp .env.example .env.local
```

作成した `.env.local` に必要な値を設定します。

### 3. 開発サーバーの起動

```bash
npm run dev
```

Windows PowerShellで実行ポリシーのエラーが発生する場合：

```powershell
npm.cmd run dev
```

ブラウザーで http://localhost:3000 を開きます。

## Supabaseのセットアップ

データベース定義は `supabase/migrations` に保存しています。

主なマイグレーション内容：

- 基本スキーマ
- Geminiタグ審査用スキーマ
- 制約とインデックス
- RLSとロール判定関数
- 公開プロフィール取得層
- 認証後のユーザー初期化
- 対応言語の初期データ
- Editor用タグ審査関数
- Admin用最終審査関数
- Admin用ユーザー管理関数

新しい、または操作権限のあるSupabaseプロジェクトへ適用する場合：

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```

誤ったプロジェクトへマイグレーションを適用しないよう、`PROJECT_REF` を必ず確認してください。

## Supabase AuthのURL設定

本番環境では、Supabase DashboardのAuthentication URL Configurationに次を設定します。

Site URL：

```text
https://campus-tag.vercel.app
```

Redirect URLs：

```text
http://localhost:3000/**
https://campus-tag.vercel.app/auth/callback?next=/account
https://campus-tag.vercel.app/auth/callback?next=/update-password
```

## 品質確認

Lint：

```bash
npm run lint
```

本番ビルド：

```bash
npm run build
```

Windows PowerShellの場合：

```powershell
npm.cmd run lint
npm.cmd run build
```

## デプロイ

1. GitHubリポジトリをVercelへImportする
2. `.env.local` と同じ4つの環境変数をVercelへ設定する
3. ProductionとPreviewへ環境変数を適用する
4. Deployを実行する
5. Supabase Authへ本番URLとリダイレクトURLを設定する

`main` ブランチへのpush後、Vercelが自動的に本番環境を更新します。

## 主なルート

| ルート | 内容 |
| --- | --- |
| `/login` | ログイン |
| `/signup` | 新規登録 |
| `/forgot-password` | パスワード再設定メール送信 |
| `/update-password` | 新しいパスワードの設定 |
| `/account` | アカウント情報と機能メニュー |
| `/search` | 学生プロフィール検索 |
| `/profile/edit` | 基本プロフィール設定 |
| `/profile/languages` | 言語設定 |
| `/profile/tags` | タグ設定 |
| `/profile/publication` | 公開設定 |
| `/editor/tags` | Editor用タグ審査 |
| `/admin/reviews` | Admin用最終審査 |
| `/admin/users` | Admin用ユーザー管理 |

## 本番環境で確認済みの項目

- ログインとログアウト
- 認証後のアカウント画面への移動
- 未認証状態での管理画面アクセス防止
- 基本プロフィール・言語・タグ・公開設定の表示
- Geminiによるタグの安全判定
- 公開可能タグの保存
- 言語検索
- タグ検索
- 自然文による検索
- 学生区分フィルター
- Editor画面
- Admin審査画面
- Adminユーザー管理画面
- Vercelへの自動デプロイ
- Lint
- 本番ビルド

## 動作確認と現時点の制約

- 本番環境でViewer、Editor、Adminのテストアカウントを使用し、各ロールのメニュー表示、保護された画面へのアクセス制御、Adminによるロール変更を確認済みです。
- Gemini APIが長時間利用不能な場合、再試行後も検索またはタグ判定に失敗する可能性があります。
- 今回のMVPは学生プロフィール検索を中心とし、Ride Tagなどの追加機能は含みません。