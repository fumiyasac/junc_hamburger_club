export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-10 px-4 mt-auto">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 font-black text-xl text-white mb-3">
              <span>🍔</span>
              <span>JUNC Hamburger Club</span>
            </div>
            <p className="text-sm text-gray-400">
              こだわりの素材で作る、本物のハンバーガーをあなたへ。
            </p>
          </div>
          <div>
            <h3 className="font-bold text-white mb-3">メニュー</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="/menu" className="hover:text-white transition-colors">全メニュー</a></li>
              <li><a href="/menu?popular=true" className="hover:text-white transition-colors">人気バーガー</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-white mb-3">サポート</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">お問い合わせ</a></li>
              <li><a href="#" className="hover:text-white transition-colors">プライバシーポリシー</a></li>
              <li><a href="#" className="hover:text-white transition-colors">利用規約</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 pt-6 text-sm text-center text-gray-500">
          © 2026 JUNC Hamburger Club. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
