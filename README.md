# TaPiYoTa Grand Boat Club

共同保有艇「TaPiYoTa号」を安全・快適に運用するためのPWA土台です。ログイン、ホーム、船舶情報、メンバー管理、予約カレンダーに加えて、出船前チェック、帰港後チェック、申し送りノート、サポート要請、通知センター、航行ログを追加しています。

## 技術構成

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Firebase Authentication / Firestore 接続前提
- PWA基本設定 `manifest.webmanifest` / `sw.js`

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev:local
```

ブラウザで `http://localhost:3001` を開きます。ローカル確認時はポートが変わらないように `dev:local` を使うのがおすすめです。

## Web確認フロー

実運用テストや複数人での確認は、ローカルではなくWeb上のプレビューURLで行うのがおすすめです。ローカルサーバー停止、ポート競合、端末ごとのキャッシュ差分を避けられます。

### 推奨構成

TaPiYoTa Grand Boat Clubと、別プロジェクトで動いている釣果ログMVPは、デプロイ先プロジェクトを分けて管理します。

- TaPiYoTa Grand Boat Club: `tapiyota-grand-boat-club`
- 釣果ログMVP: `turilog` など別プロジェクト

同じVercelアカウントや同じFirebaseアカウント内でも、プロジェクトは分けておくとURL、環境変数、デプロイ履歴が混ざりません。

### Vercelで確認する場合

1. GitHubなどにこのリポジトリをpushします。
2. Vercelで新規Projectを作成し、このリポジトリをImportします。
3. Project Nameは `tapiyota-boatapp` にします。
4. Framework PresetはNext.jsを選択します。
5. Build Commandは `npm run build` のままで問題ありません。
6. Environment Variablesに以下を設定します。

```env
NEXT_PUBLIC_DATA_SOURCE=mock
NEXT_PUBLIC_USE_MOCK_DATA=true
```

7. Deploy後、Production URLを `https://tapiyota-boatapp.vercel.app` として確認します。

Vercelのプロジェクト名を `tapiyota-boatapp` にすると、利用可能であれば自動的に `tapiyota-boatapp.vercel.app` が割り当てられます。すでに同名URLが使われている場合は、VercelのProject Settings > Domainsから別名を設定するか、独自ドメインを追加してください。

モック確認段階ではFirebase設定値は空でも動きます。Firebase接続に切り替えるタイミングで、Firebase Web Appの環境変数をVercel側にも追加してください。

### Firebase Hostingで確認する場合

Firebase Hostingを使う場合も、TaPiYoTa Grand Boat Club用と釣果ログMVP用でFirebase ProjectまたはHosting Siteを分けるのがおすすめです。

Firebase AuthenticationやFirestoreを本格接続する段階では、Hosting、Authentication、Firestoreのプロジェクトを同じFirebase Projectに揃えると運用しやすくなります。

### 確認URLの扱い

確認メンバーに共有するURLは、READMEやチャットに以下のように明記します。

```text
TaPiYoTa Grand Boat Club 確認URL: https://tapiyota-boatapp.vercel.app
釣果ログMVP 確認URL: https://turilog.vercel.app
```

ログインは現時点ではモックログインです。

- メール: `admin@example.com`
- パスワード: `password`

## データソース切り替え

初期状態はモックデータです。

```env
NEXT_PUBLIC_DATA_SOURCE=mock
NEXT_PUBLIC_USE_MOCK_DATA=true
```

Firebase接続へ進める場合は `.env.local` とVercelのEnvironment VariablesにFirebase Web Appの設定値を入れます。

```env
NEXT_PUBLIC_DATA_SOURCE=firebase
NEXT_PUBLIC_USE_MOCK_DATA=false
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
NEXT_PUBLIC_APP_URL=https://tapiyota-boatapp.vercel.app

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_REDIRECT_URI=...

FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
# または
FIREBASE_SERVICE_ACCOUNT_BASE64=...
```

本接続では `NEXT_PUBLIC_DATA_SOURCE=firebase`、`NEXT_PUBLIC_USE_MOCK_DATA=false` を設定してください。この状態では通常表示にモックデータを混ぜず、Firestoreの実データを優先します。Firestoreに船舶やメンバーが未登録の場合は、画面上に空状態を表示します。

Firestore接続時は以下のコレクションを読み書きします。初回は画面上で登録/保存した内容がFirestoreへ作成されます。実メンバー名や実予約を使う段階では、Firestore側の `users`、`boats`、`organizations` を実データへ置き換えてください。

- `organizations`
- `organizationMembers`
- `organizationRules`
- `organizationInvites`
- `boats`
- `users`
- `memberBoatPermissions`
- `reservations`
- `joinRequests`
- `preDepartureChecks`
- `postReturnChecks`
- `handoverNotes`
- `supportRequests`
- `supportMessages`
- `voyageLogs`
- `memberTripRatings`
- `skillAssessments`
- `maintenanceLogs`
- `notifications`
- `notificationPreferences`
- `notificationTokens`
- `notificationTokens`

## 主なディレクトリ

- `src/app`: 画面ルーティング
- `src/components`: 共通UIとアプリシェル
- `src/lib`: Firebase設定、モックデータ、表示ラベル、予約ロジック
- `src/types`: Firestoreドキュメントに対応する型定義
- `public`: PWA manifest、Service Worker、アイコン

## 追加された画面

- `/checks/pre-departure`: 出船前チェック。予約、実施者、実施日時、各チェック項目、問題有無、コメントを保存できます。
- `/checks/post-return`: 帰港後チェック。利用後の給油、洗艇、係留、備品、申し送り有無を記録できます。
- `/handovers`: 申し送りノート。カテゴリ、重要度、ステータス、対象予約、作成者を持つ運用ログを作成・確認できます。
- `/support`: サポート要請。出船中の困りごとを共同オーナー/メンバー間で相談し、対応履歴を残せます。
- `/voyages`: 航行ログ。予約に紐づけて出船開始、現在地記録、帰港記録、実利用時間、航行距離を残せます。
- `/notifications`: 通知センター。天候/海況、予約、チェック、申し送り、サポート、メンテナンス通知を確認し、ユーザー別の通知設定を変更できます。
- `/organization`: 組織設定。組織情報、メンバー招待、利用ルール、月間予約上限を管理できます。
- `/join`: 招待コード参加画面。メール送信なしで、招待URL/コードからログイン中ユーザーを組織メンバーに追加できます。
- `/usage-history`: マイ利用履歴。予約、チェック、航海ログ、申し送り、相談サポートから利用実績を集計します。

ホーム画面では、今日の予約や航行中ステータスに応じた「次にやること」を表示します。予約、出船前チェック、出船開始、サポート要請、帰港後チェック、申し送りまでの流れを順番に進められます。

船舶情報画面では、管理者が船名、状態、係留場所、定員、燃料、エンジン、備考、船舶写真を編集できます。船舶写真は保存前に圧縮し、オフライン時は端末内に保留してオンライン復帰後に同期できます。

## Googleカレンダー連携

BoatOSで作成・更新した予約を、船舶ごとに設定したGoogleカレンダーへ片方向同期できます。Googleカレンダー側で作成・編集した予定をBoatOSへ取り込む双方向同期は実装していません。

### できること

- 船舶ごとにGoogleカレンダー連携ON/OFFを設定
- 船舶ごとにGoogleカレンダーIDとカレンダー名を設定
- 予約作成時にGoogleイベントを作成
- 予約更新時にGoogleイベントを更新
- 予約削除時にGoogleイベントへキャンセル反映
- 予約詳細から同期状態、最終同期日時、同期エラーを確認
- 予約詳細から手動再同期
- 船舶編集画面からテスト同期

Google同期に失敗しても、BoatOS側の予約保存は失敗させません。予約には `googleSyncStatus` と `googleSyncError` を保存し、画面で確認できます。

### Google Calendar API設定

1. Google Cloud Consoleで対象プロジェクトを開きます。
2. Google Calendar APIを有効化します。
3. OAuthクライアントを作成します。
4. スコープは `https://www.googleapis.com/auth/calendar.events` を使います。
5. サーバー側で使うRefresh Tokenを取得します。
6. Vercel Environment Variablesに以下を追加します。

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_REDIRECT_URI=...
```

この実装では、GoogleのアクセストークンやRefresh TokenをFirestoreの予約データへ保存しません。サーバー側環境変数でRefresh Tokenを管理し、API Route `/api/google-calendar/sync` がGoogle Calendar APIを呼び出します。

### カレンダーIDの確認方法

Googleカレンダーを開き、対象カレンダーの「設定と共有」から「カレンダーの統合」を確認します。表示される「カレンダーID」をBoatOSの船舶編集画面に入力してください。

### 船舶ごとの設定

船舶情報画面で管理者が以下を設定します。

- Googleカレンダー連携ON/OFF
- GoogleカレンダーID
- カレンダー名
- テスト同期

テスト同期は `【BoatOSテスト】船名` という短時間の予定を作成します。

### 同期失敗時の確認

- 船舶情報のGoogle同期エラー
- 予約詳細のGoogle同期状態
- 予約詳細の `googleSyncError`
- Vercelの環境変数 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`GOOGLE_REFRESH_TOKEN`
- Google Calendar APIが有効化されているか
- カレンダーIDが正しいか
- 連携Googleアカウントが対象カレンダーに予定作成権限を持つか

## Firestore想定コレクション

- `organizations`
- `organizationMembers`
- `organizationRules`
- `organizationInvites`
- `boats`
- `users`
- `memberBoatPermissions`
- `reservations`
- `joinRequests`
- `preDepartureChecks`
- `postReturnChecks`
- `handoverNotes`
- `supportRequests`
- `supportMessages`
- `voyageLogs`
- `memberTripRatings`
- `skillAssessments`
- `maintenanceLogs`
- `notifications`
- `notificationPreferences`

各型は `src/types/domain.ts` に定義しています。将来の出船前チェック、帰港後チェック、申し送り、サポート要請、メンテナンス台帳、船舶カルテ、操船スキル管理へ拡張しやすいよう、船舶・ユーザー・予約・運用ログを分けています。

複数艇管理では、アプリ全体で `currentOrganizationId`、`currentBoatId`、`currentUserId` を扱います。ホームで利用する船を選び、選択中の `boatId` に紐づく予約、チェック、申し送り、サポート要請、航行ログを表示します。予約カレンダーは全艇/船ごと/自分の予約に切り替えられ、全艇表示では予約カードに船名を表示します。

選択状態はブラウザのlocalStorageに `lastOrganizationId`、`lastBoatId` として保存します。次回アクセス時は前回選択していた船を復元し、その船が現在の組織に属していない、または利用権限がない場合は利用可能な船の先頭へ戻します。

### 追加データ構造

`organizationMembers`

- `organizationId`
- `userId`
- `role`
- `displayName`
- `email`
- `isActive`
- `createdAt`
- `updatedAt`

`organizationRules`

- `organizationId`
- `monthlyReservationLimit`
- `standardUsageHours`
- `bookingWindowDays`
- `allowNightUse`
- `allowSoloUse`
- `allowJoinRequests`
- `allowGuestOnBoard`
- `requirePreDepartureCheck`
- `requirePostReturnCheck`
- `requireFullFuelReturn`
- `strictLimit`
- `ruleText`
- `notes`
- `emergencyContact`
- `createdAt`
- `updatedAt`

予約作成時は `organizationRules.monthlyReservationLimit` を参照し、対象ユーザーの当月予約数と残り回数を表示します。上限超過時は警告表示のみ行います。`strictLimit` は将来、予約ブロックへ切り替えるための拡張項目です。

`organizationInvites`

- `organizationId`
- `email`
- `role`
- `inviteCode`
- `status`
- `memo`
- `invitedBy`
- `expiresAt`
- `acceptedBy`
- `acceptedAt`
- `createdAt`
- `updatedAt`

現段階ではメール送信は行わず、画面上に招待URL/招待コードを表示して共有します。参加時は `organizationMembers` と `users` に反映し、船ごとの利用権限は参加後に管理者が設定します。

`memberBoatPermissions`

- `organizationId`
- `userId`
- `boatId`
- `canReserve`
- `canSolo`
- `canNightUse`
- `canUseAsGuestHost`
- `skillLevel`
- `notes`
- `createdAt`
- `updatedAt`

予約作成時は `memberBoatPermissions` と船の状態を見て、修理中、予約権限なし、単独利用権限なし、夜間利用権限なしを警告表示します。現段階では厳格ブロックではなく、実運用テスト向けの警告表示です。

## 利用履歴と将来拡張

`/usage-history` では新しい評価点数を作らず、既存の予約、出船前チェック、帰港後チェック、航海ログ、相談サポート、申し送りから利用実績を集計します。

表示する主な実績:

- 今月の利用回数
- 累計利用回数
- 累計利用時間
- 夜間利用回数
- 利用した船舶数
- 出船前チェック実施率
- 帰港後チェック実施率
- 相談サポート作成数
- サポート回答数
- 申し送り作成数

将来的には、これらの実績をもとに、運営団体をまたいだ船長技能プラットフォーム、技能認定、公開プロフィールへ拡張できます。今回の実装では、星評価、船長スコア、公開共有、決済、外部募集は実装していません。

`preDepartureChecks`

- `organizationId`
- `boatId`
- `reservationId`
- `userId`
- `checkedAt`
- `items.fuelOk`
- `items.batterySwitchOn`
- `items.engineStarted`
- `items.navigationLightsOk`
- `items.bilgeOk`
- `items.mooringRopesOk`
- `items.lifeJacketsOk`
- `items.safetyEquipmentOk`
- `items.weatherChecked`
- `items.phoneCharged`
- `items.hullDamageOk`
- `items.handoverChecked`
- `hasIssue`
- `comment`
- `createdAt`
- `updatedAt`

`postReturnChecks`

- `organizationId`
- `boatId`
- `reservationId`
- `userId`
- `checkedAt`
- `items.refueled`
- `items.washed`
- `items.tiltedUp`
- `items.batterySwitchOff`
- `items.trashRemoved`
- `items.mooringRopesOk`
- `items.hullAndPropellerOk`
- `items.lightsOk`
- `items.equipmentReturned`
- `items.noHandoverNeeded`
- `hasIssue`
- `comment`
- `createdAt`
- `updatedAt`

`handoverNotes`

- `organizationId`
- `boatId`
- `reservationId`
- `title`
- `body`
- `category`
- `priority`
- `status`
- `createdBy`
- `estimatedCost`
- `createdAt`
- `updatedAt`
- `resolvedAt`

申し送り作成時に想定費用を入力できます。申し送り詳細から、管理者/共同オーナーは内容を `maintenanceLogs` へ昇格できます。昇格時にも整備費用を入力でき、整備記録には `handoverNoteId` を保持して申し送りとメンテナンス台帳を紐づけます。

`joinRequests`

- `organizationId`
- `boatId`
- `reservationId`
- `userId`
- `message`
- `status`
- `createdAt`
- `updatedAt`

予約カレンダーでは、便乗歓迎かつ空き席がある予約に対してメンバーが便乗希望を送れます。現時点では希望送信と一覧表示を行い、承認/見送りの運用は今後の拡張対象です。

`supportRequests`

- `organizationId`
- `boatId`
- `reservationId`
- `title`
- `category`
- `urgency`
- `body`
- `status`
- `createdBy`
- `assignedTo`
- `location.latitude`
- `location.longitude`
- `location.accuracy`
- `location.capturedAt`
- `createdAt`
- `updatedAt`
- `resolvedAt`
- `closedAt`

サポート要請詳細では、関連予約に紐づく `preDepartureChecks` と `postReturnChecks` を表示します。出船前チェックが未登録の場合は、該当予約の出船前チェック画面へ遷移できます。

`supportMessages`

- `organizationId`
- `supportRequestId`
- `body`
- `createdBy`
- `createdAt`

`voyageLogs`

- `organizationId`
- `boatId`
- `reservationId`
- `userId`
- `status`
- `departedAt`
- `returnedAt`
- `durationMinutes`
- `distanceKm`
- `trackPoints.latitude`
- `trackPoints.longitude`
- `trackPoints.accuracy`
- `trackPoints.capturedAt`
- `passengerCount`
- `memo`
- `reviewStatus`
- `reviewMemo`
- `reviewedBy`
- `reviewedAt`
- `createdAt`
- `updatedAt`

`memberTripRatings`

- `organizationId`
- `boatId`
- `reservationId`
- `userId`
- `evaluatorId`
- `safetyScore`
- `preparationScore`
- `communicationScore`
- `boatCareScore`
- `overallScore`
- `comment`
- `createdAt`
- `updatedAt`

`skillAssessments`

- `organizationId`
- `boatId`
- `userId`
- `assessorId`
- `dockingScore`
- `departureScore`
- `navigationRulesScore`
- `weatherJudgmentScore`
- `emergencyScore`
- `equipmentScore`
- `status`
- `recommendation`
- `assessedAt`
- `createdAt`
- `updatedAt`

航跡レビューではGoogle Maps JavaScript APIを利用し、`trackPoints` を地図上のPolylineとして表示します。Google Cloud ConsoleでMaps JavaScript APIを有効化し、VercelのEnvironment Variablesに `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` を設定してください。APIキーはHTTPリファラー制限で `https://tapiyota-boatapp.vercel.app/*` とローカル確認用の `http://localhost:3001/*` などに絞ることを推奨します。

`maintenanceLogs`

- `organizationId`
- `boatId`
- `handoverNoteId`
- `category`
- `title`
- `body`
- `cost`
- `performedAt`
- `createdBy`
- `createdAt`

## モックデータ

初期状態では `src/lib/mock-data.ts` のモックデータを使います。今日の予約、未解決の申し送り、重要度高の申し送り、出船前チェック履歴、帰港後チェック履歴を含んでいます。
サポート要請についても、未対応、対応中、解決済み、位置情報付き、スレッドコメント付きのモックデータを含んでいます。
航行ログについても、完了済みの航行ログと位置情報のモックデータを含んでいます。

Web確認段階では、登録した予約、チェック履歴、申し送り、サポート要請、サポートコメント、ステータス変更をブラウザの `localStorage` に保存します。同じ端末・同じブラウザでは再読み込み後も確認できますが、Firebase未接続のため他のメンバーの端末とは共有されません。

実稼働テストで複数人が同じデータを見る段階では、`NEXT_PUBLIC_DATA_SOURCE=firebase` に切り替え、Firestore Repositoryを接続します。その場合、確認用のモックメンバー名やモック申し送りはFirestoreの実データに置き換わります。

切り替えは `.env.local` で行います。

```env
NEXT_PUBLIC_DATA_SOURCE=mock
NEXT_PUBLIC_USE_MOCK_DATA=true
```

Firebase接続時は以下へ変更します。

```env
NEXT_PUBLIC_DATA_SOURCE=firebase
NEXT_PUBLIC_USE_MOCK_DATA=false
```

このモードでは、予約登録、出船前チェック、帰港後チェック、申し送り作成、サポート要請作成、サポートコメント、ステータス変更がFirestoreへ保存されます。

Firestoreは `undefined` の保存に対応していないため、アプリ側では保存前に未定義の任意項目を取り除いてから書き込みます。

## ログイン

現時点ではメール/パスワードログインとGoogleログインのUIに対応しています。

Firebase未接続時は、どちらもモックログインとしてホームへ遷移します。Firebase Authenticationを接続する場合は、Firebase Consoleで以下を有効化してください。

- Email/Password
- Google

GoogleログインではFirebase Authの `GoogleAuthProvider` と `signInWithPopup` を使う構造にしています。

## 通知

通知センターでは、海上や桟橋での利用を想定して、以下を優先的に見られるようにしています。

- 天候/海況アラート
- 予約リマインド
- 出船前/帰港後チェック
- 重要申し送り
- サポート要請
- メンテナンス通知

Firebase Cloud Messaging接続後は、通知センターの「プッシュ通知を有効化する」ボタンから端末ごとのFCMトークンを `notificationTokens` に保存します。サポート要請コメントと緊急度高のサポート要請は、Next.js Route Handler `/api/notifications/send` からFirebase Admin SDKでWeb Push配信します。

FCM利用時に必要な設定:

- Firebase Console > Cloud Messaging > Web Push certificates でVAPIDキーを作成し、`NEXT_PUBLIC_FIREBASE_VAPID_KEY` に設定
- VercelのEnvironment VariablesにFirebase Admin SDK用の `FIREBASE_PROJECT_ID`、`FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY` を設定
- 複数行の秘密鍵が扱いづらい場合は、サービスアカウントJSONをBase64化して `FIREBASE_SERVICE_ACCOUNT_BASE64` に設定
- `NEXT_PUBLIC_APP_URL=https://tapiyota-boatapp.vercel.app` を設定し、通知タップ時の遷移先を本番URLに固定

通知対象:

- 緊急度高のサポート要請: 通知設定がOFFでも、投稿者以外の全メンバーへ送信対象
- サポート要請コメント: 要請作成者とadmin/ownerへ送信対象。通常時は `notificationPreferences` のサポート通知/Push設定を尊重

Firestore Rulesでは、ログイン済みユーザーが自分の `notificationTokens` を作成/更新でき、admin/ownerまたは送信API用のAdmin SDKが読み取れる運用を想定しています。テスト段階で単純化する場合は、まずログイン済みユーザーに `notificationTokens` の読み書きを許可してください。

## サポート要請

サポート要請は、出船中のメンバーが困った時に共同オーナー/メンバーへ相談するための機能です。海上保安庁118番や緊急救助の代替ではありません。

主な機能:

- サポート要請作成
- カテゴリ/ステータスフィルタ付き一覧
- 詳細表示
- サポートスレッド
- 「対応します」による対応中ステータス
- 解決済み/クローズ操作
- 予約との紐付け
- Geolocation APIによる現在地取得
- Firebase Storageによる写真添付
- 関連予約に紐づく出船前/帰港後チェック結果の確認

Geolocation APIはブラウザの位置情報許可が必要です。取得できた場合は緯度、経度、精度、取得時刻を保存する想定です。取得できない場合でもサポート要請は作成できます。

写真添付を使う場合は、Firebase ConsoleでStorageを有効化し、テスト段階では以下のようにログイン済みユーザーだけ読み書きできるRulesを設定します。アプリは現在、船舶写真を `boats/{boatId}/...`、申し送り写真を `handoverNotes/{noteId}/...`、サポート写真を `supportRequests/{requestId}/...` に保存します。

```js
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    function signedIn() {
      return request.auth != null;
    }

    match /boats/{boatId}/{fileName} {
      allow read: if signedIn();
      allow write: if signedIn();
    }

    match /handoverNotes/{noteId}/{fileName} {
      allow read: if signedIn();
      allow write: if signedIn();
    }

    match /supportRequests/{requestId}/{fileName} {
      allow read: if signedIn();
      allow write: if signedIn();
    }
  }
}
```

実運用では、組織IDやユーザー権限に応じたStorage Rulesへ絞り込む予定です。

今後はサポート要請作成時やステータス変更時にFirebase Cloud Messagingで通知する設計へ拡張します。

## 会費配分

`/revenue` に、管理者/オーナー向けの月次配分レポート画面を追加しています。

今回の実装範囲:

- 船ごとの船主/還元先設定
- 共同所有者向けの所有割合/還元割合
- 会員プラン/月額費設定
- メンバーへの会員プラン紐づけ
- 船ごとの配分ルール設定
- 指定月の月次配分レポート生成
- 最多利用艇帰属、利用回数按分、利用時間按分の候補額表示
- 管理者による最終配分額/船主還元額/調整理由の編集
- 月次配分の確定/再オープン
- ownerが自分の船の配分結果だけ確認できる表示

追加データ構造:

- `boatOwnerships`
- `membershipPlans`
- `memberSubscriptions`
- `boatRevenuePolicies`
- `monthlyRevenueReports`

初期集計では、`closed` の予約、または完了済み航海ログがある予約を配分対象にします。削除済み/キャンセル済み予約は配分対象外です。天候中止、船主利用枠、メンテナンス停止日は、現段階では手動調整欄とメモで管理し、将来的に専用ブロック機能へ接続する想定です。

Firestore接続時は、上記5コレクションをログイン済み管理者/オーナーが読み書きできるようにRulesへ追加してください。実運用では `monthlyRevenueReports` の確定済みデータはadminのみ再編集できるように絞り込む想定です。

## 今後追加予定の機能

- 船舶カルテ
- 操船スキル詳細評価
- メンバー利用制限
- 便乗希望機能
- Firebase Cloud Messagingによるプッシュ通知本接続
- サポート要請作成/更新時のプッシュ通知
- 写真添付のオフライン送信キュー本格化

## モックログイン

ログイン画面はFirebase Auth前提の構造です。Firebase設定がない場合でも、以下の入力例またはGoogleログインボタンでモック遷移できます。

- メール: `admin@example.com`
- パスワード: `password`
