import Link from 'next/link'
import { newsApi } from '@/lib/api'
import { NEWS_CATEGORY_LABEL } from '@/lib/utils'
import { NewsCategory, NewsListItem, PaginationMeta } from '@/lib/types'
import NewsCard from '@/components/public/NewsCard'

export const revalidate = 60

// クライアントは RSC だが、Next.js の searchParams を使ってカテゴリー/ページ切替を行う。
// タブ UI はサーバーサイドの Link 遷移で絞り込む。
const CATEGORY_TABS: Array<{ key: NewsCategory | 'all'; label: string }> = [
  { key: 'all', label: 'すべて' },
  { key: 'store', label: NEWS_CATEGORY_LABEL.store },
  { key: 'menu', label: NEWS_CATEGORY_LABEL.menu },
  { key: 'campaign', label: NEWS_CATEGORY_LABEL.campaign },
  { key: 'app', label: NEWS_CATEGORY_LABEL.app },
]

async function getNews(params: Record<string, string>): Promise<{ news: NewsListItem[]; pagination: PaginationMeta }> {
  try {
    return await newsApi.list(params)
  } catch {
    return { news: [], pagination: { total: 0, page: 1, limit: 20, pages: 0 } }
  }
}

export default async function NewsListPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>
}) {
  const sp = await searchParams
  const selected = (sp.category && CATEGORY_TABS.some((t) => t.key === sp.category) ? sp.category : 'all') as NewsCategory | 'all'
  const page = Math.max(1, Number(sp.page ?? 1))

  const params: Record<string, string> = { page: String(page), limit: '10' }
  if (selected !== 'all') params.category = selected

  const { news, pagination } = await getNews(params)

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-black mb-2">お知らせ</h1>
      <p className="text-gray-500 mb-6">全 {pagination.total} 件</p>

      {/* カテゴリータブ */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORY_TABS.map((tab) => {
          const isActive = tab.key === selected
          const href = tab.key === 'all' ? '/news' : `/news?category=${tab.key}`
          return (
            <Link
              key={tab.key}
              href={href}
              className={
                'px-4 py-2 rounded-full text-sm font-bold transition-colors ' +
                (isActive
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 hover:bg-primary-light hover:text-primary')
              }
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* 一覧 */}
      {news.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-3">📭</div>
          <p>該当するお知らせはありません</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {news.map((n) => (
            <NewsCard key={n.id} news={n} />
          ))}
        </div>
      )}

      {/* ページネーション */}
      {pagination.pages > 1 && (
        <nav className="flex items-center justify-center gap-2 mt-10" aria-label="ページネーション">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => {
            const isCurrent = p === pagination.page
            const sp = new URLSearchParams()
            if (selected !== 'all') sp.set('category', selected)
            sp.set('page', String(p))
            return (
              <Link
                key={p}
                href={`/news?${sp.toString()}`}
                className={
                  'px-3 py-1.5 rounded-lg font-bold text-sm transition-colors ' +
                  (isCurrent
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-600 hover:bg-primary-light hover:text-primary')
                }
                aria-current={isCurrent ? 'page' : undefined}
              >
                {p}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
