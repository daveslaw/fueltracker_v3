export type Product = {
  id: string
  catalogue_id: string
  stock_code: string
  description: string
  cost_price: number
  sell_price: number
  is_active: boolean
}

export type ProductCatalogue = {
  id: string
  name: string
}

export function getActiveProducts(products: Product[]): Product[] {
  return products.filter((p) => p.is_active)
}
