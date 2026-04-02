'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

type Product = {
  id: string;
  name: string;
  sku: string | null;
  salesPrice: string | null;
  isActive: boolean;
};

type InventoryItem = {
  id: string;
  name: string;
  unit: string;
};

type InventoryItemListResponse = {
  rows: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type Recipe = {
  id: string;
  name: string | null;
  yieldQuantity: string;
  product: Product;
  lines: Array<{ id: string; itemId: string; quantity: string; unit: string | null; item: InventoryItem }>;
};

type Capabilities = {
  manageProduct: boolean;
  manageRecipe: boolean;
  readRecipe: boolean;
};

export default function RecipesPage() {
  const [caps, setCaps] = useState<Capabilities>({ manageProduct: false, manageRecipe: false, readRecipe: false });
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  const [productName, setProductName] = useState('');
  const [productSku, setProductSku] = useState('');
  const [productPrice, setProductPrice] = useState('');

  const [recipeProductId, setRecipeProductId] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [yieldQuantity, setYieldQuantity] = useState('1');
  const [lineItemId, setLineItemId] = useState('');
  const [lineQty, setLineQty] = useState('');
  const [lineUnit, setLineUnit] = useState('');
  const [lines, setLines] = useState<Array<{ itemId: string; quantity: number; unit: string | null }>>([]);

  async function load() {
    const [capRows, productRows, recipeRows, itemRows] = await Promise.all([
      apiFetch('/app-api/recipes/capabilities') as Promise<Capabilities>,
      apiFetch('/app-api/recipes/products') as Promise<Product[]>,
      apiFetch('/app-api/recipes/recipes') as Promise<Recipe[]>,
      apiFetch('/app-api/inventory/items') as Promise<InventoryItem[] | InventoryItemListResponse>
    ]);
    setCaps(capRows);
    setProducts(productRows);
    setRecipes(recipeRows);
    setItems(Array.isArray(itemRows) ? itemRows : itemRows.rows);
  }

  useEffect(() => {
    load().catch(handleApiError);
  }, []);

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/recipes/products', {
      method: 'POST',
      body: JSON.stringify({
        name: productName,
        sku: productSku || null,
        salesPrice: productPrice === '' ? null : Number(productPrice),
        isActive: true
      })
    });
    setProductName('');
    setProductSku('');
    setProductPrice('');
    await load();
  }

  async function createRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch('/app-api/recipes/recipes', {
      method: 'POST',
      body: JSON.stringify({
        productId: recipeProductId,
        name: recipeName || null,
        yieldQuantity: Number(yieldQuantity),
        lines
      })
    });
    setRecipeProductId('');
    setRecipeName('');
    setYieldQuantity('1');
    setLines([]);
    await load();
  }

  function addLine() {
    if (!lineItemId || Number(lineQty) <= 0) return;
    if (lines.some((row) => row.itemId === lineItemId)) return;
    setLines((prev) => [...prev, { itemId: lineItemId, quantity: Number(lineQty), unit: lineUnit || null }]);
    setLineItemId('');
    setLineQty('');
    setLineUnit('');
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Recipe Core</h1>
        <p className="text-sm text-slate-600">Define products and BOM recipes mapped to inventory items.</p>
      </header>

      {!caps.readRecipe ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Your role does not have recipe read permission.
        </p>
      ) : null}

      {caps.manageProduct ? (
        <form className="grid gap-2 rounded bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={(event) => createProduct(event).catch(handleApiError)}>
          <input className="rounded border px-3 py-2" placeholder="Product name" value={productName} onChange={(event) => setProductName(event.target.value)} required />
          <input className="rounded border px-3 py-2" placeholder="SKU" value={productSku} onChange={(event) => setProductSku(event.target.value)} />
          <input className="rounded border px-3 py-2" type="number" step="0.01" placeholder="Sales price" value={productPrice} onChange={(event) => setProductPrice(event.target.value)} />
          <button className="rounded bg-slate-900 px-3 py-2 text-white">Create Product</button>
        </form>
      ) : null}

      <div className="rounded bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Products</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-left">Sales Price</th>
            </tr>
          </thead>
          <tbody>
            {products.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2">{row.sku ?? '-'}</td>
                <td className="px-3 py-2">{row.salesPrice ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {caps.manageRecipe ? (
        <form className="space-y-3 rounded bg-white p-4 shadow-sm" onSubmit={(event) => createRecipe(event).catch(handleApiError)}>
          <h2 className="text-lg font-semibold">Create Recipe</h2>
          <div className="grid gap-2 md:grid-cols-3">
            <select className="rounded border px-3 py-2" value={recipeProductId} onChange={(event) => setRecipeProductId(event.target.value)} required>
              <option value="">Select product</option>
              {products.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <input className="rounded border px-3 py-2" placeholder="Recipe name" value={recipeName} onChange={(event) => setRecipeName(event.target.value)} />
            <input className="rounded border px-3 py-2" type="number" step="0.0001" placeholder="Yield quantity" value={yieldQuantity} onChange={(event) => setYieldQuantity(event.target.value)} required />
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <select className="rounded border px-3 py-2" value={lineItemId} onChange={(event) => setLineItemId(event.target.value)}>
              <option value="">Ingredient item</option>
              {items.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <input className="rounded border px-3 py-2" type="number" step="0.0001" placeholder="Quantity" value={lineQty} onChange={(event) => setLineQty(event.target.value)} />
            <input className="rounded border px-3 py-2" placeholder="Unit (optional)" value={lineUnit} onChange={(event) => setLineUnit(event.target.value)} />
            <button type="button" className="rounded border border-slate-300 bg-white px-3 py-2" onClick={addLine}>
              Add Line
            </button>
          </div>

          <pre className="rounded bg-slate-50 p-3 text-xs">{JSON.stringify(lines, null, 2)}</pre>

          <button className="rounded bg-mono-500 px-3 py-2 text-white" disabled={lines.length === 0}>
            Save Recipe
          </button>
        </form>
      ) : null}

      <div className="rounded bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Recipes</h2>
        <div className="space-y-4">
          {recipes.map((row) => (
            <article key={row.id} className="rounded border border-slate-200 p-3">
              <h3 className="font-semibold">
                {row.product.name} {row.name ? `| ${row.name}` : ''}
              </h3>
              <p className="text-xs text-slate-600">Yield: {row.yieldQuantity}</p>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {row.lines.map((line) => (
                  <li key={line.id}>
                    {line.item.name} - {line.quantity} {line.unit ?? line.item.unit}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
