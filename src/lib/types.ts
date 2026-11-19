export type OrderStatus = 'pendiente' | 'enviado' | 'entregado' | 'cancelado';

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
];

export interface Client {
  id: string;
  user_id: string;
  code: string | null;
  name: string;
  tax_id: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  notes: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  user_id: string;
  code: string;
  barcode_ean: string | null;
  spar_ref: string | null;
  spar_code: string | null;
  observations: string | null;
  description: string;
  category: string | null;
  unit: string | null;
  price: number;
  discount_pct: number;
  active: boolean;
  photo_url: string | null;
  photo_signed?: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_code: string | null;
  description: string | null;
  unit: string | null;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  line_total: number;
  position: number;
}

export interface Order {
  id: string;
  user_id: string;
  order_number: number;
  client_id: string | null;
  order_date: string;
  status: OrderStatus;
  subtotal: number;
  discount_total: number;
  total: number;
  notes: string | null;
  created_at: string;
  clients?: { id: string; name: string; code: string | null } | null;
  order_items?: OrderItem[];
}

export interface NewOrderLine {
  product_id: string;
  product_code: string;
  description: string;
  unit: string | null;
  photo: string | null;
  price: number;
  discount_pct: number;
  quantity: number;
  unit_price: number;
}

export interface PrefilledLine {
  product_id: string;
  product_code: string;
  description: string;
  unit: string | null;
  photo: string | null;
  unit_price: number;
  discount_pct: number;
  quantity: number;
}

export interface ClientRoadmap {
  id: string;
  user_id: string;
  client_id: string;
  subclient_code: string | null;
  subclient_name: string | null;
  source_name: string | null;
  document_date: string | null;
  imported_at: string;
  created_at: string;
  client_roadmap_items?: ClientRoadmapItem[];
}

export interface ClientRoadmapItem {
  id: string;
  roadmap_id: string;
  product_id: string | null;
  ean: string | null;
  reference: string | null;
  description: string;
  price: number;
  tariff: string | null;
  units_sold: number;
  last_purchase_date: string | null;
  quantity_to_order: number;
  selected: boolean;
  created_at: string;
}
