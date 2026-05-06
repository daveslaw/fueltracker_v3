'use client'

import { useState, useTransition } from 'react'
import {
  saveCashierStockReading,
  saveCashierStockDelivery,
  deleteCashierStockDelivery,
} from '../actions'

type Delivery = { id: string; quantity: number }

type ProductRow = {
  id: string
  stock_code: string
  description: string
  openingCount: number | null
  closingCount: number | null
  deliveries: Delivery[]
}

type Props = {
  shiftId: string
  stationId: string
  products: ProductRow[]
}

export function StockCountForm({ shiftId, stationId, products: initialProducts }: Props) {
  const [products, setProducts] = useState(initialProducts)
  const [closingInputs, setClosingInputs] = useState<Record<string, string>>(
    Object.fromEntries(initialProducts.map(p => [p.id, p.closingCount?.toString() ?? '']))
  )
  const [deliveryInputs, setDeliveryInputs] = useState<Record<string, string>>(
    Object.fromEntries(initialProducts.map(p => [p.id, '']))
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  function setProductDeliveries(productId: string, deliveries: Delivery[]) {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, deliveries } : p))
  }

  function saveReading(productId: string) {
    const value = parseFloat(closingInputs[productId] ?? '')
    if (isNaN(value) || value < 0) {
      setErrors(prev => ({ ...prev, [productId]: 'Enter a valid count' }))
      return
    }
    setErrors(prev => { const next = { ...prev }; delete next[productId]; return next })
    startTransition(async () => {
      const result = await saveCashierStockReading(shiftId, productId, value)
      if ('error' in result) {
        setErrors(prev => ({ ...prev, [productId]: result.error }))
      } else {
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, closingCount: value } : p))
      }
    })
  }

  function addDelivery(productId: string) {
    const qty = parseFloat(deliveryInputs[productId] ?? '')
    if (isNaN(qty) || qty <= 0) {
      setErrors(prev => ({ ...prev, [`del-${productId}`]: 'Enter a valid quantity' }))
      return
    }
    setErrors(prev => { const next = { ...prev }; delete next[`del-${productId}`]; return next })
    startTransition(async () => {
      const result = await saveCashierStockDelivery(shiftId, stationId, productId, qty)
      if ('error' in result) {
        setErrors(prev => ({ ...prev, [`del-${productId}`]: result.error }))
      } else {
        setDeliveryInputs(prev => ({ ...prev, [productId]: '' }))
        // Re-fetch would be ideal; optimistic update for now
        setProductDeliveries(productId, [
          ...(products.find(p => p.id === productId)?.deliveries ?? []),
          { id: `temp-${Date.now()}`, quantity: qty },
        ])
      }
    })
  }

  function removeDelivery(productId: string, deliveryId: string) {
    startTransition(async () => {
      const result = await deleteCashierStockDelivery(shiftId, deliveryId)
      if (!('error' in result)) {
        setProductDeliveries(
          productId,
          (products.find(p => p.id === productId)?.deliveries ?? []).filter(d => d.id !== deliveryId)
        )
      }
    })
  }

  return (
    <div className="space-y-6">
      {products.map(product => (
        <section key={product.id} className="rounded-lg border p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-sm">{product.description}</p>
              <p className="text-xs text-gray-400">{product.stock_code}</p>
            </div>
            {product.closingCount !== null && (
              <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">Saved</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-1">Opening count</p>
              <p className="font-medium">
                {product.openingCount !== null ? product.openingCount : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Deliveries received</p>
              {product.deliveries.length === 0 ? (
                <p className="text-gray-400">None</p>
              ) : (
                <ul className="space-y-1">
                  {product.deliveries.map(d => (
                    <li key={d.id} className="flex items-center gap-2">
                      <span>+{d.quantity}</span>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => removeDelivery(product.id, d.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Add delivery */}
          <div className="flex gap-2 items-center">
            <input
              type="number"
              step="0.001"
              min="0.001"
              placeholder="Delivery qty"
              value={deliveryInputs[product.id]}
              onChange={e => setDeliveryInputs(prev => ({ ...prev, [product.id]: e.target.value }))}
              className="flex-1 rounded border px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              disabled={isPending}
              onClick={() => addDelivery(product.id)}
              className="rounded border px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Add delivery
            </button>
          </div>
          {errors[`del-${product.id}`] && (
            <p className="text-xs text-red-600">{errors[`del-${product.id}`]}</p>
          )}

          {/* Closing count */}
          <div className="flex gap-2 items-center">
            <input
              type="number"
              step="0.001"
              min="0"
              placeholder="Closing count"
              value={closingInputs[product.id]}
              onChange={e => setClosingInputs(prev => ({ ...prev, [product.id]: e.target.value }))}
              className="flex-1 rounded border px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              disabled={isPending}
              onClick={() => saveReading(product.id)}
              className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>
          {errors[product.id] && (
            <p className="text-xs text-red-600">{errors[product.id]}</p>
          )}
        </section>
      ))}
    </div>
  )
}
