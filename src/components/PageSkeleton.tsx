/** 骨架版型：對應各頁載入後的實際版面 */
type SkeletonVariant = 'rows' | 'rowsWithAction' | 'settings' | 'setup';

/** 骨架列數：與一般名單、紀錄數量相近即可 */
const ROW_COUNT = 3;

/**
 * 灰色骨架條。
 * @param props.width CSS 寬度
 * @param props.height CSS 高度
 * @param props.round 是否為全圓（按鈕形狀）
 * @returns 裝飾用的區塊，對輔助技術隱藏
 */
function Bone({ width, height, round }: { width: string; height: string; round?: boolean }): React.JSX.Element {
  return <span className={round ? 'bone round' : 'bone'} style={{ width, height }} aria-hidden="true" />;
}

/** 名單、紀錄頁的群組清單骨架 */
function RowsBody(): React.JSX.Element {
  return (
    <ul className="list-rows skeleton-in" aria-hidden="true">
      {Array.from({ length: ROW_COUNT }, (_, i) => (
        <li key={i}>
          <div className="info">
            <Bone width={`${[36, 48, 30][i]}%`} height="17px" />
            <Bone width={`${[52, 40, 46][i]}%`} height="12px" />
          </div>
          <Bone width="96px" height="36px" round />
        </li>
      ))}
    </ul>
  );
}

/** 備份設定頁的兩張編輯卡骨架 */
function SettingsBody(): React.JSX.Element {
  return (
    <>
      {/* 對應說明文字一行的高度（16px × 行高 1.7） */}
      <p className="lede skeleton-in skeleton-line" aria-hidden="true">
        <Bone width="min(420px, 80%)" height="16px" />
      </p>
      {[0, 1].map((i) => (
        <section key={i} className="editor skeleton-in" aria-hidden="true">
          <Bone width="64px" height="19px" />
          <Bone width="70%" height="14px" />
          <Bone width="120px" height="44px" round />
        </section>
      ))}
    </>
  );
}

/** 抽獎設定頁的兩欄骨架 */
function SetupBody(): React.JSX.Element {
  return (
    <div className="setup-grid skeleton-in" aria-hidden="true">
      <section className="editor">
        <Bone width="72px" height="14px" />
        <Bone width="100%" height="44px" />
        <Bone width="160px" height="14px" />
        <Bone width="100%" height="360px" />
      </section>
      <section className="editor">
        <Bone width="40px" height="14px" />
        <Bone width="100%" height="44px" />
        <Bone width="60%" height="44px" />
        <Bone width="50%" height="20px" />
        <Bone width="50%" height="20px" />
        <Bone width="100%" height="56px" round />
      </section>
    </div>
  );
}

/**
 * 頁面載入骨架：標題立即顯示，其餘區塊延遲 200ms 才淡入並以呼吸動畫提示載入中，
 * 形狀與載入後的實際版面一致，避免內容出現時版面跳動。
 * @param props.title 頁面標題（與實際頁面 h1 相同）
 * @param props.variant 骨架版型
 * @returns 標示為忙碌中的 main 區塊
 */
export function PageSkeleton({ title, variant }: { title: string; variant: SkeletonVariant }): React.JSX.Element {
  const heading = <h1>{title}</h1>;
  return (
    <main className={variant === 'setup' ? 'page setup' : 'page'} aria-busy="true">
      {variant === 'rowsWithAction' || variant === 'setup' ? (
        <div className="page-head">
          {heading}
          {variant === 'rowsWithAction' && (
            <span className="skeleton-in" aria-hidden="true">
              <Bone width="112px" height="44px" round />
            </span>
          )}
        </div>
      ) : (
        heading
      )}
      <p className="sr-only" role="status">
        載入中
      </p>
      {variant === 'settings' && <SettingsBody />}
      {variant === 'setup' && <SetupBody />}
      {(variant === 'rows' || variant === 'rowsWithAction') && (
        <>
          {/* 對應實際頁面的訊息列，保留相同高度 */}
          <p className="message" aria-hidden="true" />
          <RowsBody />
        </>
      )}
    </main>
  );
}
