import Image from 'next/image'
import Link from 'next/link'
import { burgerApi } from '@/lib/api'
import { formatPrice, resolveBurgerImage } from '@/lib/utils'
import { Burger, Category } from '@/lib/types'

export const revalidate = 60

async function getData() {
  const [burgersResult, categories] = await Promise.all([
    burgerApi.list({ limit: '100' }).catch(() => ({ burgers: [], pagination: { total: 0, page: 1, limit: 100, pages: 1 } })),
    burgerApi.categories().catch(() => [] as Category[]),
  ])
  return { burgers: burgersResult.burgers, categories }
}

export default async function MenuPage() {
  const { burgers, categories } = await getData()

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-black mb-2">メニュー</h1>
      <p className="text-gray-500 mb-8">全 {burgers.length} 品</p>

      {categories.map((cat) => {
        const catBurgers = burgers.filter((b) => b.categoryId === cat.id)
        if (catBurgers.length === 0) return null
        return (
          <div key={cat.id} className="mb-12">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
              <span>{cat.emoji}</span>
              <span>{cat.name}</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {catBurgers.map((burger) => (
                <MenuCard key={burger.id} burger={burger} />
              ))}
            </div>
          </div>
        )
      })}

      {burgers.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">🍔</div>
          <p>メニューを読み込み中...</p>
        </div>
      )}
    </div>
  )
}

function MenuCard({ burger }: { burger: Burger }) {
  return (
    <Link href={`/menu/${burger.id}`} className="card hover:shadow-lg transition-shadow group flex flex-col">
      <div className="relative h-44 bg-gray-100 flex-shrink-0">
        {resolveBurgerImage(burger.id, burger.imageUrl) ? (
          <Image
            src={resolveBurgerImage(burger.id, burger.imageUrl)!}
            alt={burger.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-5xl">🍔</div>
        )}
        {!burger.isAvailable && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold">現在品切れ</span>
          </div>
        )}
        {burger.isPopular && (
          <span className="absolute top-2 left-2 badge bg-primary text-white">人気</span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-base mb-1 line-clamp-2 flex-1">{burger.name}</h3>
        <p className="text-gray-400 text-xs mb-3 line-clamp-2">{burger.description}</p>
        <div className="flex items-center justify-between mt-auto">
          <span className="text-primary font-black text-lg">{formatPrice(burger.price)}</span>
          <div className="flex items-center gap-0.5 text-xs text-gray-400">
            <span>⭐ {burger.rating.toFixed(1)}</span>
          </div>
        </div>
        {burger.calories && (
          <div className="text-xs text-gray-400 mt-1">{burger.calories} kcal</div>
        )}
      </div>
    </Link>
  )
}
