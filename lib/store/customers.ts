import data from "@/data/customers.json";

/**
 * The fictional customers and their orders (spec §3, §10 P-05): about 5 customers, chosen in the
 * persona picker, with 2–3 orders each. The order tools read them, scoped to the chosen persona
 * (spec §4). Every name, e-mail and order is invented; e-mails and URLs use the reserved
 * .example domain. tests/customers.test.ts checks the data against the policies of spec §3.
 */
export const CUSTOMERS_PATH = "data/customers.json";

export const ORDER_STATUSES = ["processing", "shipped", "delivered", "returned"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SHIPPING_METHODS = ["standard", "express"] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

/** Prices are US dollars. */
export type OrderItem = { name: string; variant?: string; quantity: number; price: number };

export type Refund = { amount: number; issuedOn: string; to: string };

/**
 * One order. Dates are store dates (lib/store/dates.ts). Which optional fields an order has
 * follows from its status: tests/customers.test.ts pins the rule.
 */
export type Order = {
  id: string;
  placedOn: string;
  status: OrderStatus;
  shippingMethod: ShippingMethod;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  shippedOn?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  /** Only while the order is on its way. */
  estimatedDelivery?: string;
  deliveredOn?: string;
  /** The day a returned order arrived back at the warehouse. */
  returnReceivedOn?: string;
  refund?: Refund;
};

export type Customer = { id: string; name: string; email: string; orders: Order[] };

export type StoreData = {
  about: string;
  /** The day the data describes: no order changes after it. */
  asOf: string;
  currency: "USD";
  customers: Customer[];
};

export const storeData = data as StoreData;
