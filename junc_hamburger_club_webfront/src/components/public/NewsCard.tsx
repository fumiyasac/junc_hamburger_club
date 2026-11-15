import Link from 'next/link'
import { NewsListItem } from '@/lib/types'
import { NEWS_CATEGORY_LABEL, NEWS_CATEGORY_BADGE, formatNewsDate } from '@/lib/utils'

export default function NewsCard({ news, compact = false }: { news: NewsListItem; compact?: boolean }) {
  return (
    <Link
      href={`/news/${news.id}`}
      className="card hover:shadow-lg transition-shadow p-5 flex flex-col gap-2"
    >
      <div className="flex items-center gap-3 text-sm">
        <time className="text-gray-500">{formatNewsDate(news.publishedAt)}</time>
        <span className={`badge ${NEWS_CATEGORY_BADGE[news.category]}`}>
          {NEWS_CATEGORY_LABEL[news.category]}
        </span>
      </div>
      <h3 className="font-bold text-lg line-clamp-2">{news.title}</h3>
      {!compact && (
        <p className="text-gray-500 text-sm line-clamp-2">{news.excerpt}</p>
      )}
    </Link>
  )
}
