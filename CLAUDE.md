# TAVI。引継ぎ資料(2026年9月12日時点・v125)

新しいチャット(またはClaude Code)で作業を再開するための引継ぎ資料。旧資料(2026年7月2日時点・v100)を土台とし、フォロー・通知・ブロック・アカウント管理・DMチャットまでの実装(v101〜v122)、旅行計画(GROUPS)のSupabase化・ルーム調整内容の永続化(v123)、および旅の招待・参加が成立しなかったRLSデッドロックの解消となりすまし投票の除去(v124)、個人入力の1人1行化と進行操作の作成者限定(v125)を反映して全面更新している。作業を始める前に、まず本資料を読み、次に作業ファイル(`C:\Dev\TAVI\index.html`)を確認すること。

## 開発時の運用ルール(継続適用)

　提案・実装にあたっては、シニアソフトウェアエンジニア(保守性・性能・拡張性・セキュリティ)、プロダクトマネージャー(ユーザー価値と長期戦略)、UI/UXデザイナー(直感的で一貫性ある体験)、グロースマーケター(口コミ・継続率・SNS共有率・利用頻度・獲得)の視点を統合し、起業家視点(収益性・事業性)は収益化や競争優位性が設計判断に大きく影響する場合のみ補助的に用いる。ユーザーにとっての長期的価値を最優先とし、そのうえで保守性・性能・拡張性・事業性とのバランスを取る。

　機能やUIを提案する際は、実装可能かだけでなく、初回体験、口コミ・SNSで共有したくなる要素・画面、競合との差別化も考慮して評価・提案する。

　実装にあたっては、不要なリファクタリングを行わない。設計・仕様・UI・データ構造・API・既存機能への影響がある変更は、推測で実装せずユーザーの意図を確認する(軽微な修正や意図が一意に定まる変更は確認不要)。ライブラリ追加は、標準機能や導入済みライブラリで要件を満たせない場合に限り、必要性・代替案・保守性への影響を説明し承認を得る。技術的負債を増やさない(一時的な応急処置ではなく長期的な保守性を考慮した実装を優先する)。複数案がある場合、明確な優劣があれば最適案を推奨し、優劣が判断しにくい・トレードオフが大きい場合のみ複数案を提示する。

　**(v123で追加、継続適用)**: 修正を実装したら、コミット&プッシュする前に必ずユーザーへ許可を求める。ユーザーは本番のGitHub Pages上で動作確認する運用のため、「先に動作確認してからコミットする」手順は取れない(確認するにはまずデプロイが必要)。そのため、修正→検証(構文チェック等)→**コミット&プッシュの許可を質問**→承認後にコミット&プッシュ→ユーザーに本番での再確認を依頼、という順序を徹底する。

## ファイル運用

　Claude Codeでの作業は`C:\Dev\TAVI\index.html`を直接編集し、`git add`/`commit`/`push`でGitHub Pagesへ反映する運用に統一済み(ChatGPT/Claude.ai上での`/mnt/user-data/outputs/`経由のアップロード運用は過去の名残であり、Claude Codeでは使わない)。**現在の最新バージョンはv125**。設計メモは `TAVI_設計方針メモ.md`(最古)、旧引継ぎ資料(v100時点)、本資料(v125時点・最新、`CLAUDE.md`)の3本立てになっているため、次回以降は本資料をベースに更新していく。

　Service Worker(`/mnt/user-data/outputs/sw.js`)は、v92で全面的に書き換えた別ファイルであり、index.htmlと一緒にGitHubへ上げる必要がある。sw.js自体を変更しない限り、次回以降は index.html だけ差し替えれば反映される設計(後述「PWA更新設計」参照)。ただし後述の通り、直近でGitHub Pages側のデプロイ不良が発生しており、index.htmlの更新だけでは反映されないケースがあったため、「反映されない」報告があった場合はまずデプロイ状況を疑うこと。

## 検証手順(毎回必須)

　全`<script>`ブロックを抽出し`node --check`で構文チェックする。`court`という文字列の混入チェックを毎回行う。辞書(i18n)はja/enのキー数が一致し、片方にしかないキーが無いことを確認する(現在811キー)。計算ロジック(クロップ・座標変換など)を変更した場合は、Node.jsで該当関数だけを抽出し、複数パターンの入力に対する期待値をテストしてから反映する。Playwright(390×844想定)で`page.evaluate()`を使い、`window.__authUser`をモックし、`window.SB`(Supabaseクライアント)もモック関数に差し替えて、実際のDB接続なしにロジックを検証する手法がこのセッションで定着した。モックSupabaseのfrom()チェーンは、実際に使うメソッド(`.select().eq().maybeSingle()`等)をその都度模して作る。

## Supabaseの全体構成(v125時点)

　プロジェクトURL・anonキーはHTML内に埋め込み済み。以下のテーブルが存在する。

- `profiles`(id uuid PK, display_name, avatar_url, avatar_url_full, is_private, is_deactivated, bio, birthday, user_id, show_read_receipts, created_at)
- `posts`(id, author_id, text, visibility, image_urls jsonb, image_ratio, location jsonb, created_at)
- `likes`, `comments`, `comment_likes`(投稿・コメントへのいいね/コメント本体)
- `follows`(follower_id, followee_id, status['accepted'|'pending'], created_at。主キーは複合)
- `blocks`(blocker_id, blocked_id, created_at。主キーは複合)
- `notifications`(id, recipient_id, actor_id, type['like'|'comment'|'mention'|'follow'|'follow_request'|'follow_accept'|'message'|'group_invite'|...], post_id, comment_id, group_id, read, created_at)
- `calendar_events`(id, user_id, date, type['availability'|'trip'|'google'], status, ref_group_id, external_id, created_at。availabilityは(user_id,date)の部分ユニークインデックスで1日1件に制限)
- `conversations`(id, kind['dm'|'group'], title, created_at)
- `conversation_members`(conversation_id, user_id, joined_at, last_read_at)
- `messages`(id, conversation_id, sender_id, text, image_url, image_url_full, created_at)
- `user_id_history`(ID変更履歴、v100時点で実装済み)
- `trip_groups`(id, name, dest_kind['domestic'|'overseas'], destination, created_by, created_at, **room_state jsonb**(v123追加、後述))
- `trip_group_members`(group_id, user_id, role、複合PK)
- `trip_date_votes`(group_id, user_id, date_key, slot)
- `trip_spot_candidates`(group_id, name等、候補スポットのマスタ)
- `trip_spot_votes`(group_id, user_id, spot_name等)
- `trip_member_state`(group_id, user_id, wishes jsonb, budget jsonb, consent jsonb、複合PK。v125追加。希望集約・予算・最終合意というメンバー個人の入力を1人1行で持つ。後述)

　Storageバケット: `post-images`(投稿画像)、`avatars`(プロフィール写真、アイコン200px+フル画像のRLS付き)、`chat-images`(チャット画像、通常800px+拡大1600px)。いずれも「読み取りは全員可・書き込みは自分のuidフォルダ配下のみ」というRLSパターンで統一している。

　RPC関数: `delete_own_account()`(security definer、自分の全関連データ+auth.usersまで削除。実機でauth.users削除まで成功することを確認済み)。`is_conversation_member(conv_id, uid)`、`dm_blocked_in_conversation(conv_id, uid)`(いずれもsecurity definer。conversation_members自身のRLSが自己参照して無限再帰するのを避けるために導入)。`is_trip_group_member(group_id, uid)`(security definer。trip_group_members自身のRLSが自己参照して無限再帰するのを避けるために導入、後述)。`is_trip_group_creator(group_id, uid)`(security definer、v124で追加。ポリシー内から`trip_groups`を参照する際にそのテーブルのRLSに阻まれるのを避けるために導入、後述)。

　**RLS設計上の重要な教訓(v123で新たに確認、全テーブル共通の注意事項)**: このSupabaseプロジェクトでは、`.upsert()`(`INSERT ... ON CONFLICT DO UPDATE`)が、実際には競合していない全くの新規行に対してさえ「new row violates row-level security policy」で403になることをコンソールでのA/B比較により実機確認済み(同一ペイロードの plain `.insert()` は成功する)。ポリシー内容やGRANTを何度見直しても解消しなかった。原因は完全には特定できていない(理論的にはON CONFLICT DO UPDATEがUPDATEポリシーのWITH CHECKを常に要求するためとも考えられるが未確定)ため、**このプロジェクトでは新規行が発生しうる書き込みに`upsert`を使わず、「insertを試し、重複エラー(23505)なら update または無視する」パターンに統一する**方針にした(`trip_groups`/`trip_group_members`/`trip_date_votes`/`trip_spot_votes`で適用済み)。既存の`profiles`/`follows`のupsertは元々問題なく動いているため、あえて触っていない(挙動が違う可能性はあるが、動いているものを不要に変更しない方針)。`calendar_events`の部分インデックスupsert問題(後述)とは別の、より根深い制約として記録しておく。

　**RLS設計上の重要な教訓その2(v124で判明、全テーブル共通の最重要注意事項)**: **ポリシーの式の中で別テーブルを生のサブクエリ(`EXISTS (select 1 from ...)`)で参照すると、そのサブクエリにも参照先テーブルのRLSが適用される**。PostgreSQLの仕様であり、security definer関数経由の参照とは決定的に異なる。v124で、これが原因の相互デッドロックが発生していた: `trip_group_members`のINSERTポリシーが「自分がメンバー、または`EXISTS(select 1 from trip_groups where created_by = auth.uid())`」を要求し、一方で`trip_groups`のSELECTポリシーが「`is_trip_group_member(id, auth.uid())`であること」を要求していた。結果、①メンバー行を入れるにはtrip_groupsの行が見える必要がある ②行が見えるには既にメンバーである必要がある ③メンバーになるにはメンバー行を入れる必要がある、という循環になり、**旅の作成者自身の最初のowner行すら永久に入らなかった**。`trip_groups`には行があるのに`trip_group_members`が空になるため、「作成直後は画面に出るがリロードすると『あなたの旅』から消える」「他人を招待しても相手に通知も参加も届かない(招待者は既存メンバーではないので①も②も満たせない)」という、一見別々に見える2つの不具合が同時に起きていた。対処として`is_trip_group_creator()`(security definer)を新設してポリシー内の生EXISTSを置き換え、あわせて`trip_groups_select`に`or created_by = auth.uid()`(同一テーブル参照なので再帰しない)を追加した。**今後ポリシーを書く際は、別テーブルを参照する条件は必ずsecurity definer関数に包むこと。** なお、日程・スポット投票系3テーブル(`trip_date_votes`/`trip_spot_candidates`/`trip_spot_votes`)は当初から`is_trip_group_member()`経由で書かれており、この罠は無いことを確認済み。

## 画像フェーズ(v100までに完成、変更なし)

　投稿画像は、選択時にサムネイル(200px)を作って一覧のプレビューに使い、投稿確定時に元画像から3段階(200px・800px・1080px、最高画質ONで1600px)を生成して`post-images`バケットへアップロードする。投稿確定時に選択範囲を実際にCanvasで切り出し(`extractCroppedImageDataUrl`)、切り出し済みの画像を圧縮してアップロードする方式(表示のたびに再計算しない)。定数は `IMG_THUMB_MAX=200`, `IMG_MID_MAX=800`, `IMG_STD_MAX=1080`, `IMG_HQ_MAX=1600`, `IMG_QUALITY=0.82`。

## 位置情報タグ機能(v100までに完成、変更なし)

　OpenStreetMapのNominatim(無料・APIキー不要)をクライアントサイドから直接fetchする実装。地図表示はGoogleマップへの外部リンク(`openLocationOnMap`)。位置情報アイコンは絵文字ではなく`UI_IMG.pin_white`/`pin_red`/`pin_black`を使う。

## プロフィール写真アップロード機能(v101-105, v118-119)

　プロフィール編集画面で写真をタップすると、1:1固定・円形マスク表示のクロップ画面(`openAvatarCropScreen`)が開く。既存の投稿画像クロップと同じ計算ロジック(`cropMinScale`/`cropOffsetLimits`/`clampCropOffsetPx`)を流用しつつ、DOM要素は完全に分離した専用実装。クロップ確定時は画面全体を再描画せず、写真プレビュー要素(`.pava-edit .pava`)だけを部分更新する(**重要**: 以前は`renderApp()`で全体再描画していたため、名前・自己紹介など記入中の他フィールドが消えるバグがあった。修正済み)。

　保存ボタンを押した時点でまとめてアップロードする設計(アイコン用200px・拡大表示用800pxの2種類、`avatars`バケット)。`ME.photo`(アイコン用)・`ME.photoFull`(拡大表示用)の2つのフィールドで管理する。

　**CSS上の既知のバグ修正**: `.pava`という基本クラスには元々スタイル定義がなく、`.prof-top .pava`という限定的なセレクタでのみサイズ・形状が定義されていた。編集画面の`.pava-edit .pava`はこの対象に含まれず、実質サイズ0で見えない状態だった。`.pava`単体にベーススタイルを移し、`.prof-top .pava`にはmarginだけ残す形で修正済み。今後`.pava`を新しい文脈で使う際は、この構造(`.pava`が基本形、文脈依存の調整は個別セレクタで上書き)を踏襲すること。

## プロフィール4タブ構成(v106-107)

　My Posts / Reposts / My Map / My Calendar の4タブ。`profileTab`(グローバル変数)で切り替え。My Postsは自分の画像付き投稿のみ3列Masonry(CSS columns)、タップで「自分の投稿だけが並ぶ専用フィード画面」(`screenMyPostsFeed`)に遷移し、該当投稿までスクロール+一瞬ハイライトする。Reposts・My Mapは未実装で「近日公開」表示のみ。My Calendarは既存の「空き予定管理」画面の中身(`calendarBodyHTML`共通関数)をタブ内に埋め込んだもの。

　バッジ・重視する条件はアコーディオン化済み(`profileAccOpen`, `profileInfoTip`)。開閉・ⓘボタン操作は`rerenderProfileInPlace()`という専用の部分再描画関数を使い、`renderApp()`経由の全体再描画(トップへ強制スクロールを引き起こす)を避けている。プロフィール下部の「友だち追加・検索」「設定」項目は、検索タブ・右上歯車アイコンと重複するため削除済み。

## My CalendarのSupabase化(v108, v110)

　`calendar_events`(type='availability')に永続化。ログイン時に`loadCalendarAvailability()`で読み込み、`MYCAL`(日付→状態のマップ)を構築する。日付タップ時の保存(`cycleMyCal`→`saveCalendarAvailability`)は「先に画面反映→バックグラウンドで保存」という楽観的UI更新。既存行の有無でINSERT/UPDATEを切り替える2段階の確実な方式。

　**重要な既知の制約**: 週一括切り替え(`toggleMyCalWeek`→`saveCalendarAvailabilityBulk`)は、当初`upsert`(`onConflict`指定)で実装したが、部分ユニークインデックス(条件付き一意制約)をPostgRESTの`on_conflict`パラメータでは正しく解決できず400エラーになった。そのため現在は1日ずつ`saveCalendarAvailability`をループで呼ぶ確実な方式に統一している。今後、部分インデックスを使うテーブルで`upsert`を使う際は、この制約を念頭に置くこと。

## フォロー機能のSupabase化(v111-112)

　`PEOPLE`配列を固定6人のモックデータから、Supabaseの`profiles`/`follows`由来の実データキャッシュへ全面移行した。要素は`{id(uuid), userId(表示用ハンドル), name, photo, photoFull, private, iFollow, followsMe, reqIncoming, reqOutgoing, blocked, avatar}`という構造。検索・フォロー関係の解決を通じて動的に配列へ積まれていく。

　`upsertPeopleFromProfile(prof)`が、Supabaseのprofiles行をPEOPLE配列へ反映する共通ヘルパー。`loadFollowState()`がログイン時に自分に関係する`follows`行を全部取得しPEOPLE配列を構築する。`follow`/`unfollow`/`sendRequest`/`cancelRequest`/`acceptRequest`/`declineRequest`/`removeFollower`が全てSupabase連携済み。**`follow`/`sendRequest`は`insert`ではなく`upsert`(`onConflict: "follower_id,followee_id"`)を使う**(過去のテスト操作で残留した`pending`行があっても自己修復するため。`follows`の主キーは通常の複合PKなので、`calendar_events`のような部分インデックス問題は起きない)。

　`openProfileByName(userIdOrName)`は、PEOPLE配列にまだキャッシュされていない相手でも、Supabaseへ直接問い合わせてその場でキャッシュする(投稿一覧からの初見ユーザーへの遷移に必要)。

　通知画面の「フォロー申請」は、その場で全展開せず、件数だけを示す移行欄(バナー)から専用一覧画面(`screenFollowRequests`)へ遷移する設計。

## 通知システムのSupabase化(v113)

　`notifications`テーブルと`createNotification(recipientId, type, extra)`という共通関数で一本化。いいね・コメント・フォロー・フォローリクエスト・フォロー承認・メッセージ(v120で追加)の6種に対応。`loadNotifications()`がログイン時に自分宛ての通知を取得し、actorのprofilesと結合して`NOTIFS`配列を構築する。通知タップで`markNotificationRead(id)`によりSupabase側も既読化。

　**未実装**: メンション通知・タグ付け通知は、投稿・コメント本文の`@name`を構造化データとして解析する処理が別途必要なため、次のタグ付け機能実装時にまとめて対応する予定(合意済み)。

　グループ(旅行計画)関連の通知は、v113時点ではGROUPS自体が未Supabase化だったため一旦削除していたが、v123でのGROUPS Supabase化にともない`group_invite`typeとして復活済み(`notifications.group_id`列を追加)。招待(`toggleFriendMember`/`doInvite`)のタイミングで`createNotification(pid, "group_invite", {groupId})`を呼んでいる。

## ブロック機能(v114-115)

　「ブロックは特定機能に閉じず、アプリ全体が参照する共通ルール」という設計方針。`isBlockedRelation(userId)`(方向を問わずブロック関係にあるか)と`hasBlockedUser(userId)`(自分が能動的にブロックしたか)という2つの判定関数が全ての起点。`loadBlocks()`がログイン時に`BLOCKED_BY_ME`/`BLOCKING_ME`という2つのSetを構築する。**Instagramに近い仕様として、ブロックされた事実は一切明示しない**(検索・投稿一覧・プロフィール取得などから結果的に消えるだけ)。

　現在この判定を適用済みの箇所: 投稿一覧(`loadPosts`)、検索(`searchById`)、通知作成(`createNotification`)、プロフィール取得(`screenUserProfile`→ブロック関係にある場合は「ユーザーが見つかりません」の一般的な表示`screenUserNotFound`)、DMメッセージ送信(後述)。**未適用**: コメント・いいね一覧・メンション・タグ付けなど。新しい機能を実装する際は、その機能がブロック対象ユーザーとの相互作用を持つか都度確認し、必要なら`isBlockedRelation`を組み込むこと。

　`blockUser`実行時は`blocks`テーブルへのinsertとあわせて、`follows`テーブルから双方向の関係を削除する。ブロック解除は「設定→ブロック済みアカウント」画面(`screenBlockedUsers`)からのみ行える設計にしており、この一覧は`BLOCKED_LIST`という、PEOPLE配列とは意図的に分離した最小限データ(アイコン・表示名・ユーザー名のみ)を使い、プロフィールへの遷移機能を持たせていない。プロフィール画面内にあった旧ブロック解除ボタンは削除し、「設定から行えます」という案内文に差し替えている。

## アカウント管理(利用解除/削除)(v116-117)

　設定画面最下部の「アカウントの管理」から、「利用解除」「削除」を選べる。共通の4段階フロー(`accountActionType`で種別切り替え): ①影響表示(フォロワー数・投稿数・旅計画数、`screenAccountAction1`) ②パスワード再確認(`signInWithPassword`で再認証、`screenAccountAction2`) ③操作種別ごとの最終確認(`screenAccountAction3`) ④実行(`executeAccountAction`)。

　削除は`delete_own_account()`RPCを呼び、成功後サインアウト+リロード。実機で`auth.users`まで削除できることを確認済み。利用解除は`profiles.is_deactivated`をtrueにしてサインアウトする。ログイン時(`onAuthChanged`)、自分の`is_deactivated`がtrueなら、タブバー・トップバーを含む通常画面を一切表示せず「利用再開」専用画面(`screenReactivate`)だけを出すゲート処理を`renderApp()`冒頭に実装済み。承認すると`is_deactivated`をfalseへ戻し、通常のデータ読み込みをやり直す。

　利用解除中ユーザーの除外は、ブロックと同じ考え方で投稿一覧・検索・プロフィール取得の3箇所に適用済み(`is_deactivated`列をprofilesクエリで都度取得し判定)。

## DMチャット機能(v120-122)

　`DM[otherUserId]`(表示用メッセージ配列)と`DM_CONV_ID[otherUserId]`(会話uuidのキャッシュ)という2つのローカル変数でSupabaseと連携する。`findExistingDMConversation`/`getOrCreateDMConversation`/`loadDMMessages`/`loadDMOtherReadState`/`subscribeDMRealtime`/`loadDMSummaries`/`sendDM`/`sendDMPhoto`が主要関数。

　**ブロック仕様(合意済みの重要な設計)**: ブロックしたことは相手に通知しない。ブロックされた側からも明示的な表示はしない。ブロック中も、DM一覧・チャットルーム・過去のメッセージ履歴は一切削除せず保持し、解除後は同じ履歴から再開できる。ブロックの効果は「新規メッセージの送信(INSERT)」だけに限定し、閲覧(SELECT)・既読更新には一切影響させない。ブロックされた側が送信しようとした場合は「メッセージの送信に失敗しました」という一般的な表示のみで、原因がブロックだとは伝えない。これはクライアント側(`isBlockedRelation`)とRLS側の二重チェックで実現している。

　既読機能: `conversation_members.last_read_at`と`profiles.show_read_receipts`(デフォルトtrue)で管理。**last_read_atの更新は、DM画面を開きメッセージ一覧が取得・表示された時点で1回だけ**(「その時点で確認可能な最新メッセージのcreated_at」を記録)。リアルタイム受信ごとの更新は意味がブレる・スパム更新になるため行わない。ブロック中でも既読更新は止めない(止めると解除後に既読状態が壊れるため。表示を制御したい場合は各自の`show_read_receipts`設定で対応する)。

　写真送信は通常表示800px・拡大表示1600pxの2段階(`messages.image_url`/`image_url_full`)。タップで`openFullImage`により拡大表示。

　リアクション・返信引用・メッセージ削除/取り消しは今回のスコープ外とし、関連するUI要素(長押しメニュー等)はDM側からは削除済み(グループチャット側には残置、そちらは未着手のため無害)。

　**RLS設計上の重要な教訓**:
1. `conversation_members`自身を参照するRLSポリシー(自己参照するサブクエリ)は無限再帰を起こす。`security definer`関数(`is_conversation_member`, `dm_blocked_in_conversation`)を経由させることで解決した。
2. `messages`のINSERTポリシーにブロック判定を追加する際、`conversations.kind = 'dm'`という条件を明示すること。将来グループチャットを実装した際、1人ブロックしているだけでグループ全体への送信が止まる、という意図しない挙動を防ぐため。ブロックはユーザー間関係として一貫して定義しつつ、「新規送信を止める」という適用範囲をDMの文脈に限定する、という切り分け。
3. `insert().select()`という一括パターンは、INSERT対象のポリシー(`with_check`)だけでなく、返り値取得のためのSELECT対象のポリシー(`qual`/`using`)も同時に満たす必要がある。新規作成した`conversations`行のように、SELECTポリシーが「自分がメンバーであること」を要求する場合、`conversation_members`への登録が完了する前に`.select()`しようとすると、まだメンバーでないためRLSに拒否される。対策は、クライアント側で`crypto.randomUUID()`によりIDを事前生成し、`.select()`を使わずにinsertするだけで済ませること。
4. `conversation_members.last_read_at`の更新権限は、行レベルのRLS(`user_id = auth.uid()`)だけでは「その行の任意の列」を書き換え可能になってしまう。列レベルGRANT(`revoke update ... ; grant update (last_read_at) ...`)と組み合わせて、更新可能な列を実質的に絞り込む設計にしている。
5. Supabaseのポリシー・GRANTを変更した際は「ポリシーの条件式が正しいか」だけでなく「テーブルへのGRANT自体が付与されているか」を必ず両方確認すること。このセッションでは、ポリシー自体は正しいのにGRANT漏れで403/RLSエラーになるケースが複数回(`avatars`ストレージ、`calendar_events`、`conversations`関連)発生した。

## 旅行計画(GROUPS)のSupabase化とルーム調整フローの永続化(v123)

　旅行計画(`GROUPS`)がモックデータからSupabase(`trip_groups`/`trip_group_members`/`trip_date_votes`/`trip_spot_candidates`/`trip_spot_votes`)へ全面移行済み。ルーム作成〜招待〜希望集約〜日程調整〜予算〜スポット投票〜最終合意〜詳細プランという一連のフローの状態は、ローカルの`S`(現在編集中のルーム)オブジェクトで管理し、`commitRoom(immediate)`で`GROUPS`配列内の該当グループの`room`へ同期している。

　**リロードで調整内容が消えるバグの修正**: 日程投票(`trip_date_votes`)とスポット投票(`trip_spot_votes`)以外の調整内容(ステップ進行・確定日程・予算投票・最終合意・スポット巡回順・1日ごとの詳細プランなど)は、以前はブラウザのメモリ上にしか存在せず、`loadTripGroups()`が`blankRoom()`で毎回作り直すため、リロードのたびに消えていた。`trip_groups.room_state jsonb`列を新設し、`g.room`オブジェクト全体をここへ保存する方式で解決した。保存は`commitRoom(immediate)`から呼ばれる`persistRoomStateNow(gid)`(即時)/`scheduleRoomStatePersist(gid)`(900msデバウンス)の2系統で、カレンダーのタップや予算札の増減のような連打されうる細かい更新(`render({noscroll:true})`)はデバウンス、ステップ遷移(次へ/戻るなど、通常の`render()`)は即時保存にしている。加えて`visibilitychange`/`pagehide`でタブを隠す・閉じる直前にデバウンス中の保存を強制フラッシュし、編集直後のリロードでも保存漏れが起きないようにしてある。`loadTripGroups()`側では、`roomName`/`destination`/`destKind`/`members`は常にDBの正規テーブル側を優先し、`room_state`の古い値で上書きされないようにしている。

　**upsertがRLSで403になる不具合**: 上記の永続化を実装・検証する過程で、旅グループ作成自体が`persistTripGroup`の`upsert`呼び出しで常に403(RLS違反)になっており、そもそも旅グループが一度もSupabaseへ保存できていなかったことが判明した(詳細は上の「Supabaseの全体構成」内のRLSの教訓を参照)。`persistTripGroup`/`toggleFriendMember`/`doInvite`/`saveTripDateVote`/`saveTripSpotAdd`・`saveTripSpotVoteToggle`の計5箇所を、upsertから「insert→23505なら update/無視」方式に書き換えて解決した。

　**旅グループ作成画面(STEP1)の入力消失バグ修正**: ルーム名・行き先の入力欄と日数セレクトは、以前は「作成」ボタン押下時にのみ`S`へ反映していたため、その前にカバー画像を選択すると(画面再描画が起きるため)入力しかけの内容が消えていた。各入力に`oninput`/`onchange`を追加し、編集の都度`S`へ即時反映するよう修正済み。

　**招待人数の要件緩和(STEP2)**: 以前は「希望集約へ進む」ために友達3人以上の招待(自分を含め4人以上)を必須としていたが、要件変更により友達1人以上の招待(自分を含め2人以上)で進めるよう緩和した(`s2.hint`/`toast.need3`の文言も変更)。希望集約画面(STEP3)で自由記述を匿名性保護のため伏せる「3人以上で表示」という別のしきい値(`wt.veil`)は、意図的に変更せず維持している(混同しないこと)。

　**パスワードリセット等のメールリンクのredirectToパス欠落バグ修正**: `authResetPassword`と設定画面内の`requestAccountPasswordReset`(いずれもパスワードリセットメール送信箇所)で、`resetPasswordForEmail`に`redirectTo`オプション自体を渡していなかったため、メール内リンクが`https://mimi-tomato.github.io/`(パスなし)に飛び、GitHub Pagesの404/otp_expiredになっていた。`signUp`/認証コード再送信で既に使われていた`location.origin + location.pathname`のパターンを両箇所にも追加して統一した。

## 旅の招待・参加が成立しなかったRLSデッドロックの解消と、なりすまし投票の除去(v124)

　v123で残っていた未検証項目を本番で確認したところ、「リロードすると旅が『あなたの旅』から消える」「B・Cを招待しても通知が届かず、参加がA画面でしか成立しない」という2つの症状が出ていた。**この2つは同一の原因(上記「RLS設計上の重要な教訓その2」のデッドロック)によるもの**で、SQL側のポリシー修正で解消済み(本番で動作確認済み)。適用した内容は、①`is_trip_group_creator()`(security definer)の新設 ②`trip_group_members`のINSERT/UPDATEポリシーの生EXISTSをこの関数へ置き換え ③`trip_groups_select`に`or created_by = auth.uid()`を追加 ④既に発生していた「メンバー行が無い旅」(作成者のowner行が入らなかった過去分)の復旧INSERT、の4点。

　**なりすまし投票の除去**: 旅ルームの5画面(希望集約・日程・予算・スポット投票・最終合意)の先頭に、`personSwitch()`という「🧪試作モード / 操作中: ○○ として入力中」の人物切り替えプルダウンが残っていた。ログイン前提が無かった単独ブラウザでのモック検証時代の名残だが、`renderApp()`冒頭の認証ゲートにより現在アプリは全画面ログイン必須であるため、本番でも常時表示・操作可能であり、**自分の画面から他メンバーになりすまして投票・自由記述ができる状態**だった。`isSignedIn()`なら描画しないようにして塞いだ(関数自体は残置)。

　**失敗を握り潰さない方針(継続適用)**: 上記デッドロックの発見が遅れた直接の原因は、`doInvite`/`toggleFriendMember`/`persistTripGroup`がいずれも「先に画面とトーストを成功状態に更新し、裏でSupabaseへ書き込み、失敗しても`console.log`するだけ」という実装になっていたことである。DBが拒否していても招待した側の画面だけは成功に見え、相手には行も通知も届かない、という食い違いが表に出なかった。v124で、`doInvite`は書き込み成功後にのみ画面へ反映する順序に変更し、`toggleFriendMember`は失敗時にローカルのメンバー追加/削除を巻き戻してトーストを出すようにし、`persistTripGroup`は作成者自身の参加行が入らなかった場合にトーストを出すようにした(新規辞書キー`toast.memberAddFailed`/`toast.memberRemoveFailed`/`toast.tripSaveFailed`)。**今後Supabaseへの書き込みを実装する際は、楽観的UI更新を行う場合でも必ず失敗時のロールバックとユーザーへの提示をセットで実装すること。**

## 個人入力の1人1行化と、進行操作の作成者限定(v125)

　v124でB・Cが実際に旅へ参加できるようになった結果、`room_state`の設計上の問題が現実の不具合になった。`commitRoom()`は`g.room`を**まるごと**`trip_groups.room_state`へUPDATEしていたため、共有列を各自の端末のスナップショットで置き換える形になり、**後から保存した人が他メンバーの入力・進行を巻き戻していた**(last-writer-wins)。しかも`render()`末尾で`commitRoom()`が呼ばれる設計上、**ルームを開いただけでも保存が走る**ため、何も操作していない閲覧者が古い内容で上書きすることさえあった。以下の3点で解消した。

　**(1) room_stateへ保存するキーを絞った**: `ROOM_SHARED_KEYS`(`step`/`mode`/`limitDays`/`dateMode`/`chosenDate`/`tripStartKey`/`tripEndKey`/`spotOrder`/`tripDays`/`dayLabels`/`dayPlan`)だけを書く。除外したのは、①閲覧者ローカルのUI状態(`me`/`region`/`budgetMode`/`rangeStart`/`activeDay`/`calYear`/`calMonth`。共有すると他人のタブ操作や表示中の月が全員の画面へ書き込まれる) ②メンバー個人の入力(後述の新テーブルへ) ③正規化テーブルが真の値を持つもの(`avail`=trip_date_votes、`spotPool`/`spotVotes`=trip_spot_*) ④`trip_groups`の列やmembersと重複するもの(`roomName`/`destination`/`destKind`/`members`)。読み込み側は`pickSharedRoomState()`で、room_stateに無いキーを`undefined`で潰さず`blankRoom()`の既定値を活かす。**今後`blankRoom()`にキーを足したら、共有すべき値かどうかを判断して`ROOM_SHARED_KEYS`に入れるか決めること(入れなければ保存されない)。**

　**(2) 内容が変わった時だけ書く**: `roomStateLastSaved[gid]`に直近で読み書きした共有部分のJSONを持ち、同じ内容なら書き込みを行わない。`loadTripGroups()`でも読み込み直後に基準値を入れるため、「ルームを開いただけ」では保存が飛ばなくなった。

　**(3) メンバー個人の入力を`trip_member_state`(1人1行)へ移した**: 希望集約(STEP3)・予算(STEP5)・最終合意(STEP6)の入力を、`trip_member_state(group_id, user_id, wishes jsonb, budget jsonb, consent jsonb)`へ保存する。RLSは`select`が同じ旅のメンバー全員(集計に必要)、`insert`/`update`/`delete`が`user_id = auth.uid()`なので、**他人の入力は構造的に書き換えられない**。画面側は従来どおり`S.budgetVotes[メンバーid]`のようなマップを読む作りのままで、`loadTripMemberStates()`が全メンバー分の行からそのマップを組み立て直している。保存は`scheduleMemberStateSave()`(900msデバウンス。地図タップ・予算札の増減など連打される操作)と`persistMemberStateNow()`(即時。「保存」ボタンやステップ移動時)の2系統。

　**進行操作の作成者限定**: `S.step`はルーム全員で共有される1つの値なので、**動かせるのは旅の作成者だけ**にした(ユーザーとの合意事項)。`isTripGroupOwner(g)`/`isRoomOwner()`で判定し(`createdBy`を持たない古いデータ・ローカル作成直後は操作不能になるのを避けるため作成者扱い)、ステップを進める操作はすべて`goStep()`を経由させている。参加者の端末からは`persistRoomStateNow()`自体が共有列を書かない。**参加者が過去のステップを見返せるよう、共有の進行とは別に`S.viewStep`(この端末だけの表示ステップ、room_stateへは保存しない)を持たせた**。`goStepBack()`は作成者なら全員の進行ごと戻し、参加者なら自分の画面だけ遡る。`render()`は`roomViewStep()`(= `S.viewStep ?? S.step`)で描画する。

　**進むボタンの無効化は一箇所でまとめて当てている**: 各画面のテンプレートに条件分岐を書くと入れ忘れが出るため、`applyStepOwnerGate()`が描画後に`STEP_ADVANCE_CALLS`(`goStep(`/`nextAfterDate(`など、進行を進める呼び出しの一覧)に一致するボタンをまとめて`disabled`にし、理由(「旅をつくった人が、みんなの入力を待って進めます」)を添える。**ステップを進める操作を新しく足す場合は、必ず`STEP_ADVANCE_CALLS`にも追加すること。** 忘れると参加者の画面でそのボタンだけ押せてしまう。

　**回答画面のボタン構成(v125で変更)**: 希望集約・日程・予算・スポットの4画面は、従来「回答を保存(ghost)」と「締め切って集計を見る(primary)」を`.btn-row`で横並びにしていたが、**メンバー本人の操作である「回答を保存」を主役(primary・中央)にし、進行を進める操作は`room.closeEarly`(「期限を待たずに締め切る」)という共通ラベルのghostボタンとして、その下に小さく添える**構成へ変更した(`.answer-actions`クラス)。画面ごとに違っていた締め切りボタンの文言(`s3.tally`/`s4.tally`/`s5.tally`/`s6.tally`)は`room.closeEarly`へ統合して削除済み。参加者の画面ではこの締め切りボタンだけが`applyStepOwnerGate()`によって無効化される。

　**作成者専用ブロックの共通化**: 行き先確定画面(STEP3.5)の「この結果をふまえ、行き先を決める」のように、作成者にしか意味がない入力は、**表示は残したまま操作だけ無効化する**。対象のブロックに`owner-only`クラスを付ければ、`applyStepOwnerGate()`が中の`input`/`textarea`/`select`/`button`をまとめて無効化する。同種のものが出てきたらクラスを付けるだけでよい。

　**日程調整画面でのマイカレンダー反映を手動化(v125)**: 以前は日程画面を開いた時点で、未入力なら`applyMyCalToAvail(false)`がマイカレンダーの空き予定を自動でコピーしていた。手動で調整したい人には邪魔になるため、**既定では反映せず、「反映する」ボタンを押した時だけ`applyMyCalNow()`で上書き反映する**方式へ変更した(マイカレンダーが空の人には案内自体を出さない)。あわせて、反映時に既存回答の削除(`clearTripDateVotes`)と新規登録(`saveTripDateVotesFromMap`)を並行して投げていたため、**削除が後着して登録したばかりの行まで消える可能性**があった問題を、`replaceTripDateVotes()`で順に実行する形に直した。

　**既知の制約(未対応)**: 作成者がステップを進めても、参加者の画面はリアルタイムには追従しない(ルームを開き直すと反映される)。DMで実績のあるSupabase Realtimeを使えば実装できるが、今回のスコープ外とした。

## 【重要・現在進行中】GitHub Pagesへのデプロイ不良

　v122提出時点で、GitHub Pagesへの反映に関するトラブルが継続している。切り分け済みの内容:

- ソースファイル自体は正しく最新化されている(GitHub上のファイル内容を直接検索して確認済み)。
- ブラウザのキャッシュ・Service Worker・シークレットモードのいずれでも解消しない(`fetch(url, {cache:"no-store"})`で直接確認しても「まだ古い版が配信されている」と出た)。
- 原因は、GitHub Pagesの「Deployments」および「Actions」タブで確認したところ、最新のデプロイ自体が`actions/deploy-pages@v5`のステップで`Error: Deployment failed, try again later.`という、情報量の少ないエラーで失敗していたことだった。これはGitHub側のバックエンドサービスの一時的な不調によるものであることが多いと、複数のGitHub公式コミュニティディスカッションから確認済み。
- デプロイの「キャンセル」は、既に完了(失敗)した実行には効かない。「Re-run all jobs」で再実行する必要があるが、UIの配置がGitHubの仕様変更で変わっていることがあり、ワークフロー実行詳細ページ右上、または「...」メニュー内を探す必要がある。
- さらに、ローカル(`C:\Dev\TAVI\index.html`)の変更がそもそもコミットされていなかった(VS Codeでの保存はしたがコミットしていなかった)、という別の問題も同時に発生していた。`git add`/`commit`/`push`を実行したところ、今度は`remote: fatal error in commit_refs`という、GitHubサーバー側の内部エラーでpush自体が拒否される事象が発生した。これも複数の公式ディスカッションで報告されている既知のサーバー側エラーであり、GitHubステータスページ(`githubstatus.com`)では「All Systems Operational」だったため、大規模障害ではなく局所的な不調と考えられる。
- **次回作業時の対応**: この一連の問題が解消しているか、まず`git push`を再試行し、失敗する場合はGitHubサポートへの問い合わせ(リポジトリ名`mimi-tomato/TAVI-`、エラー全文、発生日時を添えて)を検討する。解消していれば、通常通りコミット→GitHub Pages自動デプロイのフローに戻ってよい。
- **v124時点の状況**: `git push`・GitHub Pagesへの反映ともに正常に戻っていることを確認済み(`remote: fatal error in commit_refs`は再現せず、本番でも更新が反映された)。GitHub側の一時的な不調だったと判断してよい。再発した場合のみ上記手順に戻ること。
- Build and deploymentの設定(Settings→Pages→Source)は「Deploy from a branch」のままでよく、「GitHub Actions」への変更は今回の問題解決には直接寄与しないと判断し、変更していない。

## 既知の未着手・懸念事項

　`repeatTrip()`(「同じメンバーでもう一度旅を作る」)はGROUPSのSupabase化に取り残されている(v124時点)。グループidを`"g"+GID`という非uuid形式で作り、メンバーidも`uid()`の偽idで複製し、`persistTripGroup()`を一切呼ばない。そのためリロードで消えるうえ、`S.me`が認証ユーザーのidではなく偽idになり、以降の個人単位の入力キーがずれる。実装するか導線を外すかを判断する必要がある。

　過去投稿のcrop情報を参照する後方互換コードは残置したまま(v100からの継続、明確な必要性が生じるまで着手しない方針)。

　ファイル分割(Capacitor導入時に一括で行う方針)は未着手。現在ファイルサイズは約1.2MB。

　グループチャットは未着手。土台となる旅行計画(`GROUPS`)はv123でSupabase化済みのため、着手条件は満たしている。その際、ブロックの扱い(グループ内の1人をブロックしていても投稿自体は見える設計にするか等)を改めて設計する必要がある。

　タグ付け機能(投稿作成画面で「タグ付けする」を選択しFF内のユーザーを検索・複数追加、いいね・コメントの隣にタグアイコン、タップでタグ付けされた人一覧がドロップダウン、タグ付けされた人への通知、投稿の三点リーダからのタグ付け解除)は未着手。メンション通知とあわせて実装する予定。この際、Supabaseに`post_tags`のような中間テーブル(post_id, tagged_user_id)の新設が必要になる見込み。

　Reposts機能(自分がタグ付けされた他人の投稿のみリポスト可能)も、タグ付け機能と同時か直後の実装が想定されている。

　My Map機能は、ワイヤーフレーム(添付画像で共有済み)をもとに、日本→都道府県、世界→地域→国という段階的ズーム、ピンの種類別色分け(過去訪問・今後の予定・投稿位置情報)、ピンタップで旅行詳細へ遷移、という設計案がある。地図の実現方式は「簡略化したデフォルメマップ」の方向で合意していたが、既存コード(`screenMyMap`, `JP_PREF`)に、前回セッションで実装済みの、実際の地理形状に近い47都道府県のSVGパスデータが既に存在することが判明した。この既存資産を活かすかデフォルメマップに作り直すか、着手時に改めて相談する必要がある。

## 直近の実装順序(今回までのセッションで完了・更新)

　プロフィール4タブの土台→My Posts→My Calendar→フォロー機能→通知システム→ブロック機能→アカウント管理→DMチャット→旅行計画(GROUPS)のSupabase化・ルーム調整内容の永続化(v123)→旅の招待・参加を阻んでいたRLSデッドロックの解消となりすまし投票の除去(v124)、の順で完了した。v124で初めて、A以外のメンバーが実際に旅へ参加して投票できる状態になった。次は「既知の未着手・懸念事項」の筆頭にある`room_state`の全体上書き問題(複数人が同時に使うと進行が巻き戻る)に着手するか、グループチャット・タグ付け機能・Repostsのどれを先にするかを、次回セッション開始時に相談して決める。

## 引継ぎ時の作業開始手順

　新しいチャット(Claude Code)では、本資料(`C:\Dev\TAVI\CLAUDE.md`)がセッション開始時に自動的に読み込まれるので、まずこれを読んでから`C:\Dev\TAVI\index.html`を確認して作業を再開すること。会話の冒頭で運用ルール(役割統合・実装方針、および**修正後は必ずコミット&プッシュの許可を求めること**)を再確認し、ユーザーからの変更依頼に対しては、まず現状のコードを確認してから対応を検討する、という進め方を踏襲する。着手内容が未定の場合は、「既知の未着手・懸念事項」の筆頭にある`room_state`の全体上書き問題から相談を始めること。

　**Supabase側の調査が必要な場合**: このプロジェクトではSQLをリポジトリで管理せず、ユーザーがSupabaseのダッシュボードで直接適用する運用のため、Claude Code側からDBは見えない。ポリシー起因が疑われる場合は、憶測で修正案を書かず、まず`select tablename, policyname, cmd, roles, qual, with_check from pg_policies where tablename in (...)`をユーザーに実行してもらい、実際の定義を見てから対処すること(v124のデッドロックはこの手順で特定できた)。

　GitHub Pagesへのデプロイが引き続き不安定な場合は、まず本資料の「GitHub Pagesへのデプロイ不良」セクションを参照し、同じ切り分け手順(ソース確認→ブラウザキャッシュ確認→Deployments/Actionsタブでのデプロイ状況確認→再実行)を踏むこと。
