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
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
```

Firestore接続時は以下のコレクションを読み書きします。初回は画面上で登録/保存した内容がFirestoreへ作成されます。実メンバー名や実予約を使う段階では、Firestore側の `users`、`boats`、`organizations` を実データへ置き換えてください。

- `organizations`
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

ホーム画面では、今日の予約や航行中ステータスに応じた「次にやること」を表示します。予約、出船前チェック、出船開始、サポート要請、帰港後チェック、申し送りまでの流れを順番に進められます。

船舶情報画面では、管理者が船名、状態、係留場所、定員、燃料、エンジン、備考、船舶写真を編集できます。船舶写真は保存前に圧縮し、オフライン時は端末内に保留してオンライン復帰後に同期できます。

## Firestore想定コレクション

- `organizations`
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

複数艇管理では、ホームで利用する船を選び、選択中の `boatId` に紐づく予約、チェック、申し送り、サポート要請、航行ログを表示します。予約カレンダーは全艇/船ごと/自分の予約に切り替えられ、全艇表示では予約カードに船名を表示します。

### 追加データ構造

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

現在はブラウザ通知の許可UI、モック通知、ユーザー別 `notificationPreferences` の保存を確認できます。将来的にはFirebase Cloud Messagingと接続し、設定内容に応じて実際のプッシュ通知を配信します。

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
