import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Client, ClientRoadmap, Order, OrderStatus, Product } from './types';

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name');
      if (error) throw error;
      return data as Client[];
    },
  });
}

export function useClientRoadmaps(clientId: string | undefined) {
  return useQuery({
    queryKey: ['roadmaps', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_roadmaps')
        .select('*, client_roadmap_items(*)')
        .eq('client_id', clientId!)
        .order('imported_at', { ascending: false });
      if (error) throw error;
      return data as ClientRoadmap[];
    },
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('code');
      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, clients(id, name, code)')
        .order('order_date', { ascending: false })
        .order('order_number', { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['orders', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, clients(*), order_items(*)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const items = [...(data.order_items ?? [])].sort(
        (a: { position: number }, b: { position: number }) => a.position - b.position,
      );
      return { ...data, order_items: items } as Order;
    },
  });
}

export interface StatsRange {
  from: string;
}

export function useStats(from: string) {
  return useQuery({
    queryKey: ['stats', from],
    queryFn: async () => {
      const [ordersRes, itemsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_date, total, status, client_id, clients(name)')
          .gte('order_date', from)
          .neq('status', 'cancelado'),
        supabase
          .from('order_items')
          .select('product_id, product_code, description, quantity, line_total, orders!inner(order_date, status)')
          .gte('orders.order_date', from)
          .neq('orders.status', 'cancelado'),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (itemsRes.error) throw itemsRes.error;
      return { orders: ordersRes.data ?? [], items: itemsRes.data ?? [] };
    },
  });
}

export function useUpdateOrderStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (status: OrderStatus) => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['purchase-history'] });
    },
  });
}

export function useDeleteOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['orders', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['purchase-history'] });
    },
  });
}

export function useDeleteClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['clients', id] });
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useDeleteProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['products', id] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export interface PurchaseHistoryItem {
  product_id: string | null;
  product_code: string | null;
  description: string | null;
  barcode_ean: string | null;
  unit_price: number;
  discount_pct: number;
  total_quantity: number;
  last_date: string;
  last_order_id: string;
  last_order_number: number;
}

export function useClientPurchaseHistory(clientId: string | undefined) {
  return useQuery({
    queryKey: ['purchase-history', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select(
          'product_id, product_code, description, unit_price, discount_pct, quantity, line_total, order_id, orders!inner(order_date, status, order_number, client_id)',
        )
        .eq('orders.client_id', clientId!)
        .neq('orders.status', 'cancelado')
        .order('orders.order_date', { ascending: false });

      if (error) throw error;

      const rows = data as unknown as Array<{
        product_id: string | null;
        product_code: string | null;
        description: string | null;
        unit_price: number;
        discount_pct: number;
        quantity: number;
        order_id: string;
        orders: { order_date: string; status: string; order_number: number; client_id: string };
      }>;

      const merged = new Map<string, PurchaseHistoryItem>();
      for (const r of rows) {
        const key = r.product_id ?? r.product_code ?? r.description ?? '';
        if (!key) continue;
        const existing = merged.get(key);
        if (existing) {
          existing.total_quantity += Number(r.quantity);
          if (r.orders.order_date > existing.last_date) {
            existing.last_date = r.orders.order_date;
            existing.last_order_id = r.order_id;
            existing.last_order_number = r.orders.order_number;
          }
        } else {
          merged.set(key, {
            product_id: r.product_id,
            product_code: r.product_code,
            description: r.description,
            barcode_ean: null,
            unit_price: Number(r.unit_price),
            discount_pct: Number(r.discount_pct),
            total_quantity: Number(r.quantity),
            last_date: r.orders.order_date,
            last_order_id: r.order_id,
            last_order_number: r.orders.order_number,
          });
        }
      }

      // Enrich with barcode_ean from products table
      const productIds = [...merged.values()]
        .map((m) => m.product_id)
        .filter((id): id is string => !!id);
      if (productIds.length > 0) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, barcode_ean, price, discount_pct')
          .in('id', productIds);
        if (prods) {
          const prodMap = new Map(prods.map((p) => [p.id, p]));
          for (const item of merged.values()) {
            if (item.product_id) {
              const p = prodMap.get(item.product_id);
              if (p) {
                item.barcode_ean = p.barcode_ean;
                // Use current price and discount
                item.unit_price = Number(p.price);
                item.discount_pct = Number(p.discount_pct);
              }
            }
          }
        }
      }

      return [...merged.values()].sort((a, b) => b.last_date.localeCompare(a.last_date));
    },
  });
}

export async function signProductPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const { data, error } = await supabase.storage.from('product-photos').createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
