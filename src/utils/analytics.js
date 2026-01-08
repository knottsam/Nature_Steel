// src/utils/analytics.js
import { analytics } from '../firebase.js';
import { logEvent } from 'firebase/analytics';

// Analytics utility functions for tracking user interactions and e-commerce events

export const trackPageView = (pageName, pageTitle) => {
  if (!analytics) return;

  logEvent(analytics, 'page_view', {
    page_title: pageTitle,
    page_location: window.location.href,
    page_path: window.location.pathname,
    page_name: pageName
  });
};

export const trackProductView = (product) => {
  if (!analytics) return;

  logEvent(analytics, 'view_item', {
    currency: 'GBP',
    value: product.price,
    items: [{
      item_id: product.id,
      item_name: product.name,
      item_category: product.category,
      item_category2: product.material,
      price: product.price,
      quantity: 1
    }]
  });
};

export const trackAddToCart = (product, quantity = 1) => {
  if (!analytics) return;

  logEvent(analytics, 'add_to_cart', {
    currency: 'GBP',
    value: product.price * quantity,
    items: [{
      item_id: product.id,
      item_name: product.name,
      item_category: product.category,
      item_category2: product.material,
      price: product.price,
      quantity: quantity
    }]
  });
};

export const trackRemoveFromCart = (product, quantity = 1) => {
  if (!analytics) return;

  logEvent(analytics, 'remove_from_cart', {
    currency: 'GBP',
    value: product.price * quantity,
    items: [{
      item_id: product.id,
      item_name: product.name,
      item_category: product.category,
      item_category2: product.material,
      price: product.price,
      quantity: quantity
    }]
  });
};

export const trackViewCart = (cartItems, totalValue) => {
  if (!analytics) return;

  const items = cartItems.map(item => ({
    item_id: item.id,
    item_name: item.name,
    item_category: item.category,
    item_category2: item.material,
    price: item.price,
    quantity: item.quantity
  }));

  logEvent(analytics, 'view_cart', {
    currency: 'GBP',
    value: totalValue,
    items: items
  });
};

export const trackBeginCheckout = (cartItems, totalValue) => {
  if (!analytics) return;

  const items = cartItems.map(item => ({
    item_id: item.id,
    item_name: item.name,
    item_category: item.category,
    item_category2: item.material,
    price: item.price,
    quantity: item.quantity
  }));

  logEvent(analytics, 'begin_checkout', {
    currency: 'GBP',
    value: totalValue,
    items: items
  });
};

export const trackPurchase = (orderDetails, cartItems, totalValue) => {
  if (!analytics) return;

  const items = cartItems.map(item => ({
    item_id: item.id,
    item_name: item.name,
    item_category: item.category,
    item_category2: item.material,
    price: item.price,
    quantity: item.quantity
  }));

  logEvent(analytics, 'purchase', {
    transaction_id: orderDetails.orderId || orderDetails.id,
    currency: 'GBP',
    value: totalValue,
    tax: orderDetails.tax || 0,
    shipping: orderDetails.shipping || 0,
    items: items
  });
};

export const trackSearch = (searchTerm, resultsCount) => {
  if (!analytics) return;

  logEvent(analytics, 'search', {
    search_term: searchTerm,
    results_count: resultsCount
  });
};

export const trackFilterUsed = (filterType, filterValue) => {
  if (!analytics) return;

  logEvent(analytics, 'select_content', {
    content_type: 'filter',
    content_id: `${filterType}:${filterValue}`
  });
};

export const trackUserEngagement = (engagementType, details = {}) => {
  if (!analytics) return;

  logEvent(analytics, 'user_engagement', {
    engagement_type: engagementType,
    ...details
  });
};

// Performance tracking
export const trackWebVitals = (metric) => {
  if (!analytics) return;

  logEvent(analytics, 'web_vitals', {
    name: metric.name,
    value: Math.round(metric.value * 1000) / 1000, // round to 3 decimal places
    event_category: 'Web Vitals',
    event_label: metric.id,
    custom_map: { metric_value: metric.value }
  });
};