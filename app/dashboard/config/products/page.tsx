import { createClient }    from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import Link                from 'next/link'
import { StationSelect }   from '../baselines/StationSelect'
import {
  createProduct,
  updateProductDetails,
  updateProductPricing,
  deactivateProduct,
  reactivateProduct,
} from './actions'

type Props = { searchParams: Promise<{ station?: string }> }

type ProductRow = {
  id:          string
  stock_code:  string
  description: string
  is_active:   boolean
  cost_price:  number | null
  sell_price:  number | null
}

export default async function ProductsPage({ searchParams }: Props) {
  const { station: stationParam } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('role, is_active').eq('user_id', user.id).single()
  if (!profile?.is_active || profile.role !== 'owner') redirect('/login')

  const { data: stations } = await supabase
    .from('stations').select('id, name').order('name')

  const selectedStation = stationParam ?? stations?.[0]?.id ?? ''

  let products: ProductRow[] = []

  if (selectedStation) {
    const [{ data: rawProducts }, { data: prices }] = await Promise.all([
      supabase
        .from('products')
        .select('id, stock_code, description, is_active')
        .eq('station_id', selectedStation)
        .order('stock_code'),
      supabase
        .from('product_prices')
        .select('product_id, cost_price, sell_price')
        .eq('station_id', selectedStation)
        .is('valid_to', null),
    ])

    products = (rawProducts ?? []).map(p => {
      const price = (prices ?? []).find(pr => pr.product_id === p.id)
      return {
        id:          p.id,
        stock_code:  p.stock_code,
        description: p.description,
        is_active:   p.is_active,
        cost_price:  price?.cost_price ?? null,
        sell_price:  price?.sell_price ?? null,
      }
    })
  }

  const fmt = (n: number | null) =>
    n === null ? '—' : `R ${n.toFixed(2)}`

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Product Catalogue</h1>
        <Link href="/dashboard/config" className="text-sm text-blue-600 underline">← Config</Link>
      </div>

      <p className="text-sm text-gray-500">
        Manage dry stock products per station — add products, update pricing, and control active status.
      </p>

      <StationSelect stations={stations ?? []} selectedStation={selectedStation} />

      {selectedStation && (
        <div className="space-y-6">

          {/* ── Add product ──────────────────────────────────────────────────── */}
          <details className="rounded border">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium select-none">
              + Add product
            </summary>
            <form
              action={createProduct as unknown as (f: FormData) => Promise<void>}
              className="border-t p-4 space-y-3"
            >
              <input type="hidden" name="station_id" value={selectedStation} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Stock code</label>
                  <input
                    type="text" name="stock_code" required
                    placeholder="e.g. CHIP001"
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Description</label>
                  <input
                    type="text" name="description" required
                    placeholder="e.g. Lays Chips 50g"
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Cost price (ZAR)</label>
                  <input
                    type="number" name="cost_price" required min="0" step="0.01"
                    placeholder="0.00"
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Sell price (ZAR)</label>
                  <input
                    type="number" name="sell_price" required min="0" step="0.01"
                    placeholder="0.00"
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Opening stock count</label>
                  <input
                    type="number" name="initial_stock_count" required min="0" step="1"
                    placeholder="0"
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <button
                  type="submit"
                  className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Add product
                </button>
              </div>
            </form>
          </details>

          {/* ── Product list ─────────────────────────────────────────────────── */}
          {products.length === 0 ? (
            <p className="text-sm text-gray-400">No products configured for this station.</p>
          ) : (
            <div className="space-y-2">
              {products.map(product => (
                <div key={product.id} className="rounded border">
                  {/* Product row summary */}
                  <div className="flex items-center gap-4 px-4 py-3">
                    <span className="font-mono text-sm font-medium w-24 shrink-0">
                      {product.stock_code}
                    </span>
                    <span className="flex-1 text-sm">{product.description}</span>
                    <span className="text-sm text-gray-500 w-24 text-right">
                      Cost: {fmt(product.cost_price)}
                    </span>
                    <span className="text-sm text-gray-700 w-24 text-right font-medium">
                      Sell: {fmt(product.sell_price)}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full w-16 text-center ${
                        product.is_active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {product.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* ── Edit details ───────────────────────────────────────── */}
                  <details className="border-t">
                    <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-gray-500 select-none hover:text-gray-800">
                      Edit details
                    </summary>
                    <form
                      action={updateProductDetails as unknown as (f: FormData) => Promise<void>}
                      className="border-t px-4 py-3 flex items-end gap-3"
                    >
                      <input type="hidden" name="product_id" value={product.id} />
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600">Stock code</label>
                        <input
                          type="text" name="stock_code" required
                          defaultValue={product.stock_code}
                          className="rounded border px-3 py-1.5 text-sm w-32"
                        />
                      </div>
                      <div className="space-y-1 flex-1">
                        <label className="text-xs font-medium text-gray-600">Description</label>
                        <input
                          type="text" name="description" required
                          defaultValue={product.description}
                          className="w-full rounded border px-3 py-1.5 text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white shrink-0"
                      >
                        Save
                      </button>
                    </form>
                  </details>

                  {/* ── Update pricing ─────────────────────────────────────── */}
                  <details className="border-t">
                    <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-gray-500 select-none hover:text-gray-800">
                      Update pricing
                    </summary>
                    <form
                      action={updateProductPricing as unknown as (f: FormData) => Promise<void>}
                      className="border-t px-4 py-3 flex items-end gap-3"
                    >
                      <input type="hidden" name="product_id" value={product.id} />
                      <input type="hidden" name="station_id" value={selectedStation} />
                      <input type="hidden" name="has_prior" value={product.cost_price !== null ? 'true' : 'false'} />
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600">Cost price (ZAR)</label>
                        <input
                          type="number" name="cost_price" required min="0" step="0.01"
                          defaultValue={product.cost_price ?? undefined}
                          className="rounded border px-3 py-1.5 text-sm w-28"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600">Sell price (ZAR)</label>
                        <input
                          type="number" name="sell_price" required min="0" step="0.01"
                          defaultValue={product.sell_price ?? undefined}
                          className="rounded border px-3 py-1.5 text-sm w-28"
                        />
                      </div>
                      <button
                        type="submit"
                        className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white shrink-0"
                      >
                        Update
                      </button>
                    </form>
                  </details>

                  {/* ── Activate / Deactivate ──────────────────────────────── */}
                  <div className="border-t px-4 py-2">
                    {product.is_active ? (
                      <form action={deactivateProduct as unknown as (f: FormData) => Promise<void>}>
                        <input type="hidden" name="product_id" value={product.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Deactivate
                        </button>
                      </form>
                    ) : (
                      <form action={reactivateProduct as unknown as (f: FormData) => Promise<void>}>
                        <input type="hidden" name="product_id" value={product.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Reactivate
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedStation && (
        <p className="text-sm text-gray-400">No stations configured.</p>
      )}
    </main>
  )
}
