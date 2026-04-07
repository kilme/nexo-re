export type PropertyType = 'office' | 'industrial' | 'retail' | 'business_park' | 'land' | 'hotel' | 'mixed' | 'other'
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

export type ImagenTipo = 'portada' | 'fachada' | 'interior' | 'planta' | 'exterior'

export interface Imagen {
  url:         string
  tipo:        ImagenTipo
  descripcion?: string  // descripción generada por IA
  fileName:    string   // nombre original del archivo (para poder eliminarlo)
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
  salePrice?: number
  currency?: string
  description?: string
  images?: Imagen[]
  coverImage?: string
  createdAt?: string
  updatedAt?: string
  externalId?: string  // ID from Dynamics
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
  images?: Imagen[]
  coverImage?: string
  amenities?: string[]
  createdAt?: string
  updatedAt?: string
  externalId?: string  // ID from Dynamics
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  office: 'Oficinas',
  industrial: 'Industrial',
  retail: 'Retail / Local',
  business_park: 'Centro Comercial',
  land: 'Terreno',
  hotel: 'Hotel',
  mixed: 'Mixto',
  other: 'Otro',
}

export const OPERATION_LABELS: Record<OperationType, string> = {
  rent: 'Alquiler',
  sale: 'Venta',
  rent_sale: 'Alquiler y Venta',
}
