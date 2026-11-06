import Link from 'next/link';
import { HomeDemo } from '@/components/HomeDemo';
import { FAQ, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import styles from './home.module.css';

/** 首頁特色清單 */
const FEATURES = [
  { title: '免註冊', body: '打開網頁就能用，不需要建立帳號或登入。' },
  { title: '最多 200 人', body: '一場最多可放 200 位參加者，適合尾牙抽獎與大型活動。' },
  { title: '可重播', body: '每場抽獎都會保留種子，隨時能在歷史紀錄重播同一場結果。' },
  { title: '資料只存在你的瀏覽器', body: '名單與紀錄只放在本機 localStorage，不會上傳到任何伺服器。' },
  { title: '3 種台面', body: '經典、蛇行、瀑布三種彈珠台面，依場合挑選喜歡的。' },
];

/** 使用步驟 */
const STEPS = [
  { title: '1. 貼上名單', body: '一行一位，直接從 Excel 或聊天室複製貼上。' },
  { title: '2. 選台面與名額', body: '挑選台面，設定要抽出幾位得獎者。' },
  { title: '3. 開始抽獎', body: '按下開始，看彈珠一路滾落，最先抵達終點的就是得獎者。' },
];

/** FAQPage 結構化資料 */
const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

/** WebApplication 結構化資料 */
const APP_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: 'zh-Hant',
  applicationCategory: 'UtilitiesApplication',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'TWD' },
};

/**
 * 將結構化資料序列化為可安全內嵌於 script 的字串（跳脫 < 以免提前結束標籤）。
 * @param data 結構化資料物件
 * @returns JSON 字串
 */
function toJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * 首頁（伺服器元件，靜態產生）：主視覺、示範、特色、步驟與常見問題。
 * @returns 首頁內容
 */
export default function Home(): React.JSX.Element {
  return (
    <main className={styles.home}>
      <section className={styles.hero}>
        <h1>免費線上抽獎彈珠台</h1>
        <p className={styles.subtitle}>貼上名單就能開抽</p>
        <p className={styles.lead}>
          抽獎彈珠台是免費的線上抽獎工具，不論是尾牙抽獎、社團活動或直播抽獎，貼上名單、按下開始，
          就能讓彈珠決定得獎者，過程公開透明、結果可重播。
        </p>
        <Link href="/play" className={styles.cta}>
          開始抽獎
        </Link>
      </section>

      <HomeDemo />

      <section>
        <h2>為什麼選擇抽獎彈珠台</h2>
        <ul className={styles.features}>
          {FEATURES.map((f) => (
            <li key={f.title}>
              <strong>{f.title}</strong>
              {f.body}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>三步驟完成線上抽獎</h2>
        <ol className={styles.steps}>
          {STEPS.map((s) => (
            <li key={s.title}>
              <strong>{s.title}</strong>
              {s.body}
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.faq}>
        <h2>常見問題</h2>
        {FAQ.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(FAQ_JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(APP_JSON_LD) }} />
    </main>
  );
}
