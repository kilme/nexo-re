export type PropertyType = 'office' | 'industrial' | 'retail' | 'business_park' | 'land' | 'other'
export type OperationType = 'rent' | 'sale' | 'rent_sale'
export type PropertyStatus = 'active' | 'inactive'

export interface PropertyAddress {
  street?: string
  city?: string
  state?: string
  country?: string
  formattedAddress?: string
  lat?: number
  lng?: number
}

export interface PropertyImage {
  url: string
  category?: string
  caption?: string
}

export interface Property {
  id: string
  name: string
  type: PropertyType
  status: PropertyStatus
  totalArea: number
  floors?: number
  yearBuilt?: number
  clase?: string
  address: PropertyAddress
  rentPricePerM2?: number
  salePricePerM2?: number
  currency?: string
  description?: string
  images?: PropertyImage[]
  coverImage?: string
  createdAt?: string
  updatedAt?: string
  externalId?: string  // ID from Dynamics
}

export interface ListingImage {
  url: string
  caption?: string
}

export interface Listing {
  id: string
  name: string
  propertyType: PropertyType
  operationType: OperationType
  status: PropertyStatus
  area: number
  floor?: string
  address: PropertyAddress
  rentPrice?: number
  salePrice?: number
  currency?: string
  description?: string
  images?: ListingImage[]
  coverImage?: string
  amenities?: string[]
  createdAt?: string
  updatedAt?: string
  externalId?: string  // ID from Dynamics
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  office: 'Oficinas',
  industrial: 'Industrial',
  retail: 'Retail',
  business_park: 'Parque Empresarial',
  land: 'Terreno',
  other: 'Otro',
}

export const OPERATION_LABELS: Record<OperationType, string> = {
  rent: 'Alquiler',
  sale: 'Venta',
  rent_sale: 'Alquiler y Venta',
}
