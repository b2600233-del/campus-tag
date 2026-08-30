export default function SearchLoading() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto flex min-h-[60vh] w-full max-w-5xl items-center justify-center rounded-2xl bg-white p-8 shadow-sm">
        <div
          role="status"
          aria-live="polite"
          className="text-center"
        >
          <div
            aria-hidden="true"
            className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-700"
          />

          <p className="mt-5 font-medium text-gray-900">
            検索条件を解析しています
          </p>

          <p className="mt-2 text-sm text-gray-500">
            公開プロフィールから一致する学生を探しています。
          </p>
        </div>
      </div>
    </main>
  )
}