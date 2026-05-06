export type Product = {
  id: string
  station_id: string
  stock_code: string
  description: string
  cost_price: number
  sell_price: number
  is_active: boolean
}

export function getActiveProducts(products: Product[]): Product[] {
  return products.filter((p) => p.is_active)
}
