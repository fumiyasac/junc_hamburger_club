import Link from 'next/link'
import Image from 'next/image'
import { burgerApi } from '@/lib/api'
import { formatPrice, resolveBurgerImage } from '@/lib/utils'
import { Burger } from '@/lib/types'

export const revalidate = 60

async function getPopularBurgers(): Promise<Burger[]> {
  try {
    const result = await burgerApi.list({ popular: 'true', limit: '6' })
    return result.burgers
  } catch {
    return []
  }
}

export default async function HomePage() {
  const popularBurgers = await getPopularBurgers()

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary-dark to-bun-dark text-white py-20 px-4 border-b-8 border-secondary">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-6xl mb-4">🍔</div>
          <h1 className="text-4xl md:text-6xl font-black mb-4">
            JUNC Hamburger Club
          </h1>
          <p className="text-xl md:text-2xl opacity-90 mb-8">
            こだわりの素材で作るプレミアムバーガー
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/menu" className="bg-white text-primary font-bold px-8 py-4 rounded-2xl text-lg hover:bg-primary-light transition-colors">
              メニューを見る
            </Link>
            <Link href="/auth" className="border-2 border-white text-white font-bold px-8 py-4 rounded-2xl text-lg hover:bg-white/10 transition-colors">
              会員登録
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              { emoji: '🥩', title: '厳選素材', desc: '毎日仕入れる新鮮な素材のみを使用' },
              { emoji: '👨‍🍳', title: '職人技', desc: '経験豊かなシェフが一枚一枚丁寧に' },
              { emoji: '📱', title: 'モバイル注文', desc: 'アプリでかんたん注文・受取' },
            ].map((f) => (
              <div key={f.title} className="p-6">
                <div className="text-5xl mb-3">{f.emoji}</div>
                <h3 className="font-bold text-xl mb-2">{f.title}</h3>
                <p className="text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Burgers */}
      {popularBurgers.length > 0 && (
        <section className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-black text-center mb-10">
              人気バーガー <span className="text-primary">TOP 6</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {popularBurgers.map((burger) => (
                <BurgerCard key={burger.id} burger={burger} />
              ))}
            </div>
            <div className="text-center mt-10">
              <Link href="/menu" className="btn-primary inline-block">
                全メニューを見る
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-secondary py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-black mb-4">アプリで注文しよう</h2>
          <p className="text-gray-700 mb-6">
            モバイルアプリをダウンロードして、どこでも手軽に注文。
            待ち時間をリアルタイムで確認できます。
          </p>
          <div className="flex gap-4 justify-center">
            <div className="bg-black text-white px-6 py-3 rounded-xl font-bold">
              App Store
            </div>
            <div className="bg-black text-white px-6 py-3 rounded-xl font-bold">
              Google Play
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function BurgerCard({ burger }: { burger: Burger }) {
  return (
    <Link href={`/menu/${burger.id}`} className="card hover:shadow-lg transition-shadow group">
      <div className="relative h-48 bg-gray-100">
        {resolveBurgerImage(burger.id, burger.imageUrl) ? (
          <Image
            src={resolveBurgerImage(burger.id, burger.imageUrl)!}
            alt={burger.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-6xl">🍔</div>
        )}
        {burger.isPopular && (
          <span className="absolute top-2 left-2 badge bg-primary text-white">人気</span>
        )}
      </div>
      <div className="p-4">
        <div className="text-sm text-primary font-semibold mb-1">
          {burger.categoryEmoji} {burger.categoryName}
        </div>
        <h3 className="font-bold text-lg mb-1 line-clamp-1">{burger.name}</h3>
        <p className="text-gray-500 text-sm mb-3 line-clamp-2">{burger.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-primary font-black text-xl">{formatPrice(burger.price)}</span>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <span>⭐</span>
            <span>{burger.rating.toFixed(1)}</span>
            <span>({burger.reviewCount})</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
