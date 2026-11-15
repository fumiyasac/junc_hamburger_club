import Link from 'next/link'
import { notFound } from 'next/navigation'
import { newsApi } from '@/lib/api'
import { NEWS_CATEGORY_LABEL, NEWS_CATEGORY_BADGE, formatNewsDate } from '@/lib/utils'

export const revalidate = 60

export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let news
  try {
    news = await newsApi.get(id)
  } catch {
    notFound()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/news" className="text-primary font-bold mb-6 inline-flex items-center gap-1 hover:underline">
        ← お知らせ一覧に戻る
      </Link>

      <article className="card p-6 md:p-8 mt-4">
        <div className="flex items-center gap-3 text-sm mb-4">
          <time className="text-gray-500">{formatNewsDate(news.publishedAt)}</time>
          <span className={`badge ${NEWS_CATEGORY_BADGE[news.category]}`}>
            {NEWS_CATEGORY_LABEL[news.category]}
          </span>
        </div>

        <h1 className="text-2xl md:text-3xl font-black mb-6 leading-tight">{news.title}</h1>

        {/* 本文: プレーンテキスト。pre-wrap で改行を保持。 */}
        <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
          {news.body}
        </div>
      </article>
    </div>
  )
}
