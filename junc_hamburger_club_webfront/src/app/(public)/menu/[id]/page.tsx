import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { burgerApi } from '@/lib/api'
import { formatPrice, resolveBurgerImage } from '@/lib/utils'

export const revalidate = 60

export default async function BurgerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let burger
  try {
    burger = await burgerApi.get(id)
  } catch {
    notFound()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/menu" className="text-primary font-bold mb-6 inline-flex items-center gap-1 hover:underline">
        ← メニューに戻る
      </Link>

      <div className="card overflow-hidden mt-4">
        <div className="relative h-72 bg-gray-100">
          {resolveBurgerImage(burger.id, burger.imageUrl) ? (
            <Image src={resolveBurgerImage(burger.id, burger.imageUrl)!} alt={burger.name} fill className="object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full text-7xl">🍔</div>
          )}
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="text-primary font-semibold text-sm mb-1">
                {burger.categoryEmoji} {burger.categoryName}
              </div>
              <h1 className="text-2xl font-black">{burger.name}</h1>
            </div>
            <div className="text-right">
              <div className="text-primary font-black text-3xl">{formatPrice(burger.price)}</div>
              {burger.calories && (
                <div className="text-gray-400 text-sm">{burger.calories} kcal</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <span>⭐ {burger.rating.toFixed(1)}</span>
            <span>({burger.reviewCount} レビュー)</span>
            {burger.isPopular && <span className="badge bg-primary text-white">人気</span>}
          </div>

          <p className="text-gray-600 mb-6">{burger.description}</p>

          {burger.ingredients.length > 0 && (
            <div className="mb-6">
              <h2 className="font-bold text-lg mb-3">食材</h2>
              <div className="flex flex-wrap gap-2">
                {burger.ingredients.map((ing) => (
                  <span key={ing} className="badge bg-primary-light text-primary-dark">{ing}</span>
                ))}
              </div>
            </div>
          )}

          {burger.tags.length > 0 && (
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                {burger.tags.map((tag) => (
                  <span key={tag} className="badge bg-gray-100 text-gray-600">#{tag}</span>
                ))}
              </div>
            </div>
          )}

          {burger.isAvailable ? (
            <div className="bg-primary-light rounded-xl p-4 text-center">
              <p className="text-primary font-bold mb-2">注文はモバイルアプリから</p>
              <p className="text-sm text-gray-600">JUNC Hamburger Club アプリをダウンロードしてご注文ください</p>
            </div>
          ) : (
            <div className="bg-gray-100 rounded-xl p-4 text-center text-gray-500">
              現在このバーガーはご提供できません
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
